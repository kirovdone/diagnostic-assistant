"""Leave-one-out evaluation of retrieval and ranking, against the baseline that kills it.

The design note names the stop condition this measures: if top-1 cannot beat "the most common
cause for this equipment type" by about ten points absolute on a real gold set, ship the
lookup table and skip the index and the embeddings entirely.

Every case with a votable label is held out of the index in turn, queried with only its
customer description -- which is all a live session has -- and scored against the cause the
pipeline assigned it.

    uv run python scripts/eval_rank.py

Needs AWS: extraction and embeddings both run against Bedrock, because a number produced by
a test double is not a measurement of this system.
"""

from __future__ import annotations

from collections import Counter

import botocore.exceptions

from diagnostic_assist.corpus import sample_cases
from diagnostic_assist.extractor import default_extractor
from diagnostic_assist.labeling import label_case
from diagnostic_assist.ranking import rank
from diagnostic_assist.retrieval import CaseIndex
from diagnostic_assist.similarity import default_similarity


def pct(a: int, b: int) -> str:
    return f"{a / b * 100:5.1f}%" if b else "    --"


def main() -> int:
    cases = list(sample_cases())
    extractor = default_extractor()
    labels = {c.case_id: label_case(c, extractor) for c in cases}

    votable = [
        c for c in cases
        if labels[c.case_id].cause_id and labels[c.case_id].evidence_weight > 0
    ]
    by_type: dict[str, Counter[str]] = {}
    for c in votable:
        by_type.setdefault(c.equipment_type, Counter())[labels[c.case_id].cause_id] += 1

    top1 = top5 = top25 = base = 0
    # A cause with only one supporting case cannot be retrieved once that case is held out:
    # the cause leaves the corpus entirely. Scoring those as failures measures corpus size,
    # not retrieval, so both numbers are reported.
    reachable_top1 = reachable_top5 = reachable = 0
    counts = Counter(labels[c.case_id].cause_id for c in votable)

    for held in votable:
        truth = labels[held.case_id].cause_id
        rest = [c for c in cases if c.case_id != held.case_id]
        index = CaseIndex(rest, labels, similarity=default_similarity())
        neighbours, level = index.search(
            held.customer_description, held.equipment_family, held.equipment_type
        )
        ranking = rank(
            neighbours, level,
            language=held.language, equipment_family=held.equipment_family,
        )
        ordered = [c.cause_id for c in ranking.candidates]
        hit1, hit5 = (ordered[:1] == [truth]), (truth in ordered[:5])
        top1 += hit1
        top5 += hit5
        top25 += truth in [n.cause_id for n in neighbours]

        common = by_type.get(held.equipment_type, Counter())
        without = Counter(common)
        without[truth] -= 1
        base += bool(without) and without.most_common(1)[0][0] == truth

        if counts[truth] > 1:
            reachable += 1
            reachable_top1 += hit1
            reachable_top5 += hit5

    n = len(votable)
    print(f"corpus {len(cases)} cases | votable {n} | causes {len(counts)} "
          f"| singletons {sum(1 for v in counts.values() if v == 1)}\n")
    print(f"  top-1                    {top1:2}/{n}   {pct(top1, n)}")
    print(f"  recall@5                 {top5:2}/{n}   {pct(top5, n)}")
    print(f"  recall@25 (retrieved)    {top25:2}/{n}   {pct(top25, n)}")
    print(f"  baseline, commonest      {base:2}/{n}   {pct(base, n)}")
    print(f"  margin over baseline          {(top1 - base) / n * 100:+.1f} pts\n")
    print(f"  where the answer is reachable at all "
          f"({reachable} cases whose cause has a second supporter)")
    print(f"    top-1                  {reachable_top1:2}/{reachable}   "
          f"{pct(reachable_top1, reachable)}")
    print(f"    recall@5               {reachable_top5:2}/{reachable}   "
          f"{pct(reachable_top5, reachable)}")
    print(f"\n  n={n}: one standard error is about {(0.5 / n ** 0.5) * 100:.0f} points. "
          f"Treat every figure above as an ordering, not an estimate.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except botocore.exceptions.BotoCoreError as exc:
        raise SystemExit(f"AWS is not usable: {exc}\nSee BEDROCK_SETUP.md.") from exc
