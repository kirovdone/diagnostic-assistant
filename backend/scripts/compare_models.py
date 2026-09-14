"""Run the gold evaluation across several Bedrock models and print accuracy beside cost.

The cheapest model that is accurate enough is the right one, and "enough" is not a judgement
you can make from a price list. This turns it into a table:

    uv run python scripts/compare_models.py
    uv run python scripts/compare_models.py eu.amazon.nova-micro-v1:0 eu.anthropic.claude-sonnet-5

Costs a fraction of a cent per model on the 22-case corpus, so there is no reason to guess.
The number to watch is not overall accuracy but whether the non-English cases hold: a small
model that reads English notes perfectly and German ones poorly is the failure this corpus is
most likely to hide, because only four of the twenty-two are not English.
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

from diagnostic_assist.config import GOLD_LABELS_PATH
from diagnostic_assist.corpus import load_cases
from diagnostic_assist.extractor import BedrockLabelExtractor
from diagnostic_assist.labeling import label_case

# $ per million tokens, in / out, eu-central-1, from the AWS pricing API. Approximate for the
# Anthropic rows, which the pricing API does not expose per region the same way.
RATES: dict[str, tuple[float, float]] = {
    # Amazon rows come from the pricing API for eu-central-1 and are exact.
    "eu.amazon.nova-micro-v1:0": (0.046, 0.184),
    "eu.amazon.nova-lite-v1:0": (0.078, 0.312),
    "eu.amazon.nova-2-lite-v1:0": (0.429, 3.597),
    "eu.amazon.nova-pro-v1:0": (1.05, 2.10),
    # Anthropic rows are published list rates; the pricing API does not expose them per region
    # the same way, so treat these as approximate and re-check before quoting them to anyone.
    "eu.anthropic.claude-sonnet-4-5-20250929-v1:0": (3.00, 15.00),
    "eu.anthropic.claude-sonnet-4-6": (3.00, 15.00),
    "eu.anthropic.claude-opus-4-5-20251101-v1:0": (5.00, 25.00),
}
DEFAULT = ["eu.amazon.nova-lite-v1:0", "eu.amazon.nova-pro-v1:0",
           "eu.anthropic.claude-sonnet-4-5-20250929-v1:0", "eu.anthropic.claude-sonnet-4-6"]


def main(model_ids: list[str]) -> int:
    cases = load_cases()
    gold = {row["case_id"]: row for row in json.loads(Path(GOLD_LABELS_PATH).read_text())["labels"]}
    by_lang: dict[str, list[str]] = {}
    for c in cases:
        by_lang.setdefault(c.language, []).append(c.case_id)

    langs = ", ".join(f"{k}={len(v)}" for k, v in sorted(by_lang.items()))
    print(f"{len(cases)} cases · languages {langs}")
    print(f"\n{'model':<46}{'cause':>8}{'excl':>7}{'non-en':>8}{'secs':>7}{'cost':>10}")
    print("-" * 86)

    for model_id in model_ids:
        try:
            extractor = BedrockLabelExtractor(model_id=model_id)
            t0 = time.perf_counter()
            labels = {c.case_id: label_case(c, extractor) for c in cases}
            elapsed = time.perf_counter() - t0
        except Exception as exc:  # broad: an unavailable model should not stop the sweep
            print(f"{model_id:<46}{'—':>8}  {type(exc).__name__}: {str(exc)[:40]}")
            continue

        cause_ok = cause_n = excl_ok = excl_n = non_en_ok = non_en_n = 0
        for c in cases:
            want, got = gold[c.case_id].get("cause_id"), labels[c.case_id].cause_id
            if want is None:
                excl_n += 1
                excl_ok += got is None
            else:
                cause_n += 1
                cause_ok += got == want
                if c.language != "en":
                    non_en_n += 1
                    non_en_ok += got == want

        rate = RATES.get(model_id)
        cost = "—"
        if rate:
            sent = [c for c in cases if labels[c.case_id].confidence != 0.9]  # skipped pre-checks
            tok_in = sum(len(c.full_text) / 4 + 550 for c in sent)
            cost = f"${tok_in / 1e6 * rate[0] + len(sent) * 100 / 1e6 * rate[1]:.4f}"
        print(
            f"{model_id:<46}{cause_ok}/{cause_n:<6}{excl_ok}/{excl_n:<5}"
            f"{non_en_ok}/{non_en_n:<6}{elapsed:>7.1f}{cost:>10}"
        )

    print("-" * 86)
    print("\ncause  = right root cause, of the cases that have one")
    print("excl   = correctly refused a cause, of the cases that have none")
    print("non-en = the same as cause, restricted to DE/FR/IT — the column that decides this")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:] or DEFAULT))
