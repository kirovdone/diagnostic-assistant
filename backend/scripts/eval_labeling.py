"""Run the labeller over the corpus and compare it to hand-written ground truth.

    uv run python scripts/eval_labeling.py

Two numbers matter here and they are not the same number.

**Cause accuracy** is how often the labeller picks the right root cause on cases that
have one. It is the number everyone asks for.

**Exclusion recall** is how often the labeller refuses to put a cause on a case that
never had one: the billing disputes, warranty swaps and no-fault-found visits. This is
the number to watch. A labeller at 95% cause accuracy that also invents causes for the
fifth of the corpus which has none has quietly filled the index with confident nonsense,
and nothing downstream can tell.

Honest caveat, and it applies to any number this script prints: gold_labels.json and the
fixtures in extractor.py were written by the same person from the same 22 cases, so this
measures self-consistency and regression, not extraction quality. The moment the
extractor is a real model the two stop being circular. Until then, treat a drop here as
informative and a perfect score as meaning nothing.
"""

from __future__ import annotations

import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from diagnostic_assist.config import GOLD_LABELS_PATH
from diagnostic_assist.corpus import load_cases
from diagnostic_assist.extractor import default_extractor
from diagnostic_assist.labeling import label_case
from diagnostic_assist.models import CaseLabel, OutcomeStatus
from diagnostic_assist.taxonomy import TAXONOMY_VERSION

DIAGNOSTIC_STATUSES = {OutcomeStatus.CONFIRMED, OutcomeStatus.PROVISIONAL}


def load_gold() -> dict[str, dict[str, object]]:
    payload = json.loads(GOLD_LABELS_PATH.read_text(encoding="utf-8"))
    if payload.get("taxonomy_version") != TAXONOMY_VERSION:
        print(
            f"WARNING: gold labels were written for taxonomy "
            f"{payload.get('taxonomy_version')}, code is on {TAXONOMY_VERSION}.\n"
            f"         Cause ids may not mean the same thing. Re-label before trusting this.\n"
        )
    return {row["case_id"]: row for row in payload["labels"]}


def main() -> int:
    cases = load_cases()
    gold = load_gold()
    extractor = default_extractor()
    predicted: dict[str, CaseLabel] = {c.case_id: label_case(c, extractor) for c in cases}

    status_totals: Counter[str] = Counter()
    status_correct: Counter[str] = Counter()
    confusion: dict[str, Counter[str]] = defaultdict(Counter)
    disagreements: list[str] = []

    cause_total = cause_correct = 0
    exclusion_total = exclusion_correct = 0

    for case in cases:
        truth = gold.get(case.case_id)
        if truth is None:
            disagreements.append(f"  {case.case_id}  no gold label")
            continue

        label = predicted[case.case_id]
        expected_status = str(truth["outcome_status"])
        expected_cause = truth["cause_id"]

        status_totals[expected_status] += 1
        confusion[expected_status][label.outcome_status.value] += 1
        status_ok = label.outcome_status.value == expected_status
        if status_ok:
            status_correct[expected_status] += 1

        if expected_cause is None:
            exclusion_total += 1
            if label.cause_id is None:
                exclusion_correct += 1
        else:
            cause_total += 1
            if label.cause_id == expected_cause:
                cause_correct += 1

        if not status_ok or label.cause_id != expected_cause:
            disagreements.append(
                f"  {case.case_id}  expected {expected_status}/{expected_cause}"
                f"  got {label.outcome_status.value}/{label.cause_id}"
                f"  flags={','.join(f.value for f in label.flags) or '-'}"
            )

    print(f"Labelling evaluation, taxonomy {TAXONOMY_VERSION}, {len(cases)} cases\n")

    print("Outcome status accuracy")
    for status in OutcomeStatus:
        total = status_totals[status.value]
        if not total:
            continue
        correct = status_correct[status.value]
        print(f"  {status.value:<16} {correct}/{total}  {correct / total:6.1%}")

    print("\nHeadline metrics")
    if cause_total:
        share = cause_correct / cause_total
        print(f"  cause accuracy    {cause_correct}/{cause_total}  {share:6.1%}")
    if exclusion_total:
        print(
            f"  exclusion recall  {exclusion_correct}/{exclusion_total}"
            f"  {exclusion_correct / exclusion_total:6.1%}   <- the one that matters"
        )

    votable = [
        label
        for label in predicted.values()
        if label.outcome_status in DIAGNOSTIC_STATUSES and label.cause_id
    ]
    review = [label for label in predicted.values() if label.needs_review]
    print(f"  votable cases     {len(votable)}/{len(cases)}")
    print(f"  needs review      {len(review)}/{len(cases)}")

    print("\nConfusion (expected -> predicted)")
    for expected, counts in sorted(confusion.items()):
        for got, n in sorted(counts.items()):
            marker = " " if expected == got else "*"
            print(f" {marker} {expected:<16} -> {got:<16} {n}")

    print(f"\nDisagreements ({len(disagreements)})")
    if disagreements:
        print("\n".join(disagreements))
    else:
        print("  none")

    return 1 if disagreements else 0


if __name__ == "__main__":
    raise SystemExit(main())
