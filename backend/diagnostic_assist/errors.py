"""Failures that are not this service's fault.

Both model calls are upstream dependencies with no offline fallback, so their failures have
to be distinguishable from a bad label: one is a 503 the caller should retry, the other is a
row for the review queue. Keeping them out of `RuntimeError` is what makes that separation
hold in `labeling.label_case`, which swallows bad answers and must not swallow an outage.
"""

from __future__ import annotations


class UpstreamError(Exception):
    """Bedrock could not be reached, or refused the call."""


class ModelUnavailableError(UpstreamError):
    """No model can be called at all: credentials or the `bedrock` extra are missing."""
