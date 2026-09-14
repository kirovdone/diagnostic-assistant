"""Loading closed cases off disk."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from .config import SAMPLE_CASES_PATH
from .models import Case


def load_cases(path: Path | None = None) -> list[Case]:
    """Every closed case in the corpus, validated."""
    source = path or SAMPLE_CASES_PATH
    raw = json.loads(source.read_text(encoding="utf-8"))
    return [Case.model_validate(row) for row in raw]


@lru_cache(maxsize=1)
# STUB: reads a file. Production reads the case store the backfill writes to.
def sample_cases() -> tuple[Case, ...]:
    """The delivered corpus, parsed once per process."""
    return tuple(load_cases())
