"""How two pieces of case text are compared."""

from __future__ import annotations

import json
import math
from collections.abc import Sequence
from typing import Any, Protocol

from .config import (
    BEDROCK_EMBEDDING_BATCH,
    BEDROCK_EMBEDDING_DIMENSIONS,
    BEDROCK_EMBEDDING_MODEL_ID,
    BEDROCK_MAX_ATTEMPTS,
    BEDROCK_REGION,
    MIN_NEIGHBOUR_SIMILARITY,
    aws_credentials_available,
)


class TextSimilarity(Protocol):
    """Compares one query against indexed case texts, in [0, 1]."""

    min_similarity: float

    def fit(self, texts: Sequence[str]) -> None:
        """Index these texts. Called once, when the corpus is loaded."""
        ...

    def scores(self, query: str, indices: Sequence[int]) -> list[float]:
        """Similarity of the query to each named index, in the order given."""
        ...


def _cosine(a: Sequence[float], b: Sequence[float]) -> float:
    """Cosine of two vectors, clamped to [0, 1]."""
    dot = sum(x * y for x, y in zip(a, b, strict=True))
    norm = math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(y * y for y in b))
    return max(0.0, dot / norm) if norm else 0.0


_CACHE: dict[tuple[str, str, str], tuple[float, ...]] = {}


def _bedrock_config() -> Any:
    """Retry policy for both Bedrock clients.

    Adaptive rather than the default standard mode: it adds a client-side rate limiter that
    slows down when the service starts throttling, instead of firing the same burst again
    after a backoff. Labelling a corpus is exactly the shape that trips this -- a tight loop
    of one call per case against a per-account quota -- and the design note's reserved
    concurrency of 5 on the live Lambda is the same argument made in infrastructure.
    """
    from botocore.config import Config

    return Config(retries={"max_attempts": BEDROCK_MAX_ATTEMPTS, "mode": "adaptive"})


# STUB: vectors held in memory. Production stores them in the OpenSearch index.
class BedrockEmbedding:
    """Cohere Embed v4 on Bedrock: 100+ languages in one vector space."""

    min_similarity: float = MIN_NEIGHBOUR_SIMILARITY

    def __init__(
        self, model_id: str = BEDROCK_EMBEDDING_MODEL_ID, region: str = BEDROCK_REGION
    ) -> None:
        self._model_id = model_id
        self._region = region
        self._client: Any | None = None
        self._vectors: list[tuple[float, ...]] = []

    def _bedrock(self) -> Any:
        """Lazily built client, so importing the module costs nothing."""
        if self._client is None:
            import boto3

            self._client = boto3.client(
                "bedrock-runtime", region_name=self._region, config=_bedrock_config()
            )
        return self._client

    def _key(self, text: str, input_type: str) -> tuple[str, str, str]:
        """Cache key. `input_type` is part of it because the same text embedded as a"""
        return (self._model_id, input_type, text)

    def _embed(self, texts: Sequence[str], input_type: str) -> list[tuple[float, ...]]:
        """Embed, reusing anything already seen, in batches the endpoint accepts."""
        missing = [t for t in dict.fromkeys(texts) if self._key(t, input_type) not in _CACHE]
        for i in range(0, len(missing), BEDROCK_EMBEDDING_BATCH):
            batch = missing[i : i + BEDROCK_EMBEDDING_BATCH]
            response = self._bedrock().invoke_model(
                modelId=self._model_id,
                accept="application/json",
                contentType="application/json",
                body=json.dumps(
                    {
                        "texts": batch,
                        "input_type": input_type,
                        "truncate": "END",
                        "output_dimension": BEDROCK_EMBEDDING_DIMENSIONS,
                        "embedding_types": ["float"],
                    }
                ),
            )
            payload = json.loads(response["body"].read())
            block = payload["embeddings"]
            vectors = block["float"] if isinstance(block, dict) else block
            for text, vector in zip(batch, vectors, strict=True):
                _CACHE[self._key(text, input_type)] = tuple(vector)
        return [_CACHE[self._key(t, input_type)] for t in texts]

    def fit(self, texts: Sequence[str]) -> None:
        """Embed the corpus once, as documents."""
        self._vectors = self._embed(texts, "search_document") if texts else []

    def scores(self, query: str, indices: Sequence[int]) -> list[float]:
        """Cosine of the query against each named index, in the order given."""
        if not self._vectors or not indices:
            return []
        vector = self._embed([query], "search_query")[0]
        return [_cosine(vector, self._vectors[i]) for i in indices]


def default_similarity() -> TextSimilarity:
    """The embedding backend, or an error saying what to configure."""
    if not aws_credentials_available():
        raise RuntimeError(
            "No text similarity is available: no AWS credentials found. Configure them "
            "(`aws configure`, or AWS_PROFILE / AWS_ACCESS_KEY_ID in the environment), "
            "install the extra with `uv sync --extra bedrock`, and grant the account access "
            f"to {BEDROCK_EMBEDDING_MODEL_ID} in the Bedrock console."
        )
    return BedrockEmbedding()
