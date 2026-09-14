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

from diagnostic_assist.corpus import sample_cases
from diagnostic_assist.errors import UpstreamError
from diagnostic_assist.extractor import default_extractor
from diagnostic_assist.labeling import label_case
from diagnostic_assist.models import Case
from diagnostic_assist.ranking import rank
from diagnostic_assist.retrieval import CaseIndex
from diagnostic_assist.similarity import default_similarity


def pct(a: int, b: int) -> str:
    return f"{a / b * 100:5.1f}%" if b else "    --"


def wilson(k: int, n: int, z: float = 1.96) -> str:
    """95% Wilson interval, which is what a proportion on n=19 actually deserves."""
    if not n:
        return "--"
    p = k / n
    centre = (p + z * z / (2 * n)) / (1 + z * z / n)
    half = z * ((p * (1 - p) / n + z * z / (4 * n * n)) ** 0.5) / (1 + z * z / n)
    return f"{(centre - half) * 100:.0f}-{(centre + half) * 100:.0f}%"


def _single_commonest(table: Counter[str]) -> str | None:
    """The one commonest cause, or None when the table is empty or its top is tied."""
    ranked = table.most_common(2)
    if not ranked or (len(ranked) > 1 and ranked[0][1] == ranked[1][1]):
        return None
    return ranked[0][0]


def lookup_table_hit(
    held: Case, truth: str, by_type: dict[str, Counter[str]], by_family: dict[str, Counter[str]]
) -> bool:
    """What the lookup table says for one held-out case: the commonest cause for its type,
    falling back to its family when the type has no other case -- the same fallback the
    ranker gets. A tie is a miss: a table that has to flip a coin is not a table.
    """
    for table, key in ((by_type, held.equipment_type), (by_family, held.equipment_family)):
        remaining = Counter(table.get(key, Counter()))
        remaining[truth] -= 1
        remaining = +remaining  # drops the zero left behind by the held-out case
        if remaining:
            return _single_commonest(remaining) == truth
    return False


def main() -> int:
    cases = list(sample_cases())
    extractor = default_extractor()
    labels = {c.case_id: label_case(c, extractor) for c in cases}

    votable = [
        c for c in cases
        if labels[c.case_id].cause_id and labels[c.case_id].evidence_weight > 0
    ]
    by_type: dict[str, Counter[str]] = {}
    by_family: dict[str, Counter[str]] = {}
    for c in votable:
        cause = labels[c.case_id].cause_id
        assert cause is not None
        by_type.setdefault(c.equipment_type, Counter())[cause] += 1
        by_family.setdefault(c.equipment_family, Counter())[cause] += 1

    top1 = top5 = top25 = base = 0
    # A cause with only one supporting case cannot be retrieved once that case is held out:
    # the cause leaves the corpus entirely. Scoring those as failures measures corpus size,
    # not retrieval, so both numbers are reported.
    reachable_top1 = reachable_top5 = reachable = 0
    counts = Counter(labels[c.case_id].cause_id for c in votable)

    for held in votable:
        truth = labels[held.case_id].cause_id
        assert truth is not None  # votable, by construction above
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

        base += lookup_table_hit(held, truth, by_type, by_family)

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
    print(f"  baseline, lookup table   {base:2}/{n}   {pct(base, n)}"
          "   (commonest cause per type, then family; tie = miss)")
    print(f"  margin over baseline          {(top1 - base) / n * 100:+.1f} pts\n")
    print(f"  where the answer is reachable at all "
          f"({reachable} cases whose cause has a second supporter)")
    print(f"    top-1                  {reachable_top1:2}/{reachable}   "
          f"{pct(reachable_top1, reachable)}")
    print(f"    recall@5               {reachable_top5:2}/{reachable}   "
          f"{pct(reachable_top5, reachable)}")
    print(f"\n  n={n}. Wilson 95%: top-1 {wilson(top1, n)}, recall@5 {wilson(top5, n)}, "
          f"baseline {wilson(base, n)}. Treat every figure above as an ordering, not an estimate.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except UpstreamError as exc:
        raise SystemExit(f"AWS is not usable: {exc}\nSee BEDROCK_SETUP.md.") from exc
