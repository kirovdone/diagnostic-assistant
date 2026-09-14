"""Every tunable number in the system, with the reason it has the value it has.

Nothing else in the package hard-codes a threshold. If a number is worth arguing
about in review, it belongs here where the argument is visible.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Final

# --------------------------------------------------------------------------------------
# Paths
# --------------------------------------------------------------------------------------

# The package lives at <repo>/backend/diagnostic_assist/, so the repo root is two up.
REPO_ROOT: Final[Path] = Path(__file__).resolve().parents[2]

# The corpus stays where it was delivered. Overridable so a larger extract can be pointed at
# without touching code (the production loader reads a manifest of S3 keys instead).
SAMPLE_CASES_PATH: Final[Path] = Path(
    os.environ.get("DIAGNOSTIC_ASSIST_CASES_PATH", REPO_ROOT / "sample_cases.json")
)

# Hand-written ground truth for the 22 sample cases, used only by scripts/eval_labeling.py.
GOLD_LABELS_PATH: Final[Path] = Path(
    os.environ.get("DIAGNOSTIC_ASSIST_GOLD_PATH", REPO_ROOT / "gold_labels.json")
)

# --------------------------------------------------------------------------------------
# Labelling: evidence weight by outcome status
# --------------------------------------------------------------------------------------
# How much one labelled case is allowed to influence a future diagnosis.

# The technician found the cause, fixed it, and wrote it down.
EVIDENCE_WEIGHT_CONFIRMED: Final[float] = 1.0

# A plausible cause with a temporary fix or a missing resolution. The symptom text is still real
# and still useful for retrieval, but the outcome was never verified, so it votes at a quarter
# strength: enough to matter when there is nothing better, not enough to outvote a single
# confirmed case.
EVIDENCE_WEIGHT_PROVISIONAL: Final[float] = 0.25

# No fault found, whole-unit swap, billing dispute, or a label we could not validate.
EVIDENCE_WEIGHT_EXCLUDED: Final[float] = 0.0

# --------------------------------------------------------------------------------------
# Labelling: confidence
# --------------------------------------------------------------------------------------

# Below this, an extracted cause is not trusted enough to count as CONFIRMED and is demoted to
# PROVISIONAL. Set at 0. 6 because the extractor's own calibration is unproven: until we have
# measured it against gold labels, the safer default is to demote rather than to admit a wrong
# cause at full weight.
MIN_CONFIDENCE_FOR_CONFIRMED: Final[float] = 0.6

# A label that failed validation is capped here regardless of what the extractor claimed, so
# that a confidently wrong model answer cannot outrank a hesitant correct one in the review
# queue.
CONFIDENCE_CEILING_UNMAPPED: Final[float] = 0.2

# Deterministic pre-checks (billing, warranty swap, no fault found) read explicit phrases
# written by the technician, so they are more reliable than the extractor.
CONFIDENCE_DETERMINISTIC: Final[float] = 0.9

# Rows at or below this confidence are surfaced in the review queue on /labels.
REVIEW_CONFIDENCE_THRESHOLD: Final[float] = 0.5

# --------------------------------------------------------------------------------------
# Normalisation
# --------------------------------------------------------------------------------------

# How many tokens after a negation cue stay inside its scope. Technician notes are short clauses
# ("No oil leak found", "keine Anzeige am Display"), so a six-token window covers the clause
# without leaking into the next sentence.
NEGATION_SCOPE_TOKENS: Final[int] = 6

# --------------------------------------------------------------------------------------
# Bedrock: region and models
# --------------------------------------------------------------------------------------
# Frankfurt, behind an `eu.` inference profile, because a closed case carries a customer's site,
# their complaint and what a technician found.
BEDROCK_REGION: Final[str] = os.environ.get("AWS_REGION", "eu-central-1")

# Extraction. Every id here is overridable, because the right one depends on what the account
# has been granted and which profiles the region exposes, and because model generations move
# faster than this file does.
BEDROCK_MODEL_ID: Final[str] = os.environ.get(
    "DIAGNOSTIC_ASSIST_BEDROCK_MODEL", "eu.amazon.nova-lite-v1:0"
)

# Embeddings. Cohere Embed v4: 100+ languages in one vector space, and trained against real
# documents with spelling and formatting noise, which is a fair description of a technician's
# notes typed on a phone.
BEDROCK_EMBEDDING_MODEL_ID: Final[str] = os.environ.get(
    "DIAGNOSTIC_ASSIST_BEDROCK_EMBEDDING_MODEL", "eu.cohere.embed-v4:0"
)

# Embed v4 emits 256 to 1536 dimensions.
BEDROCK_EMBEDDING_DIMENSIONS: Final[int] = 1024

# Texts accepted per embed call.
# How many times a throttled Bedrock call is retried before it fails. Labelling a corpus is
# one call per case in a loop against a per-account quota, so the first run on a cold quota
# is throttled rather than refused, and giving up on the first 429 turns a pause into an
# outage.
BEDROCK_MAX_ATTEMPTS: Final[int] = 8

BEDROCK_EMBEDDING_BATCH: Final[int] = 96


def aws_credentials_available() -> bool:
    """Whether boto3 can actually resolve credentials.

    Asking boto3 rather than looking for AWS_PROFILE or AWS_ACCESS_KEY_ID in the environment,
    because `aws login` and `aws configure` write to ~/.aws and export nothing. A guard that
    sniffs environment variables rejects a correctly configured machine, which is worse than
    no guard: it fails at the first request with a message telling the user to do the thing
    they already did.
    """
    try:
        import boto3

        return boto3.Session().get_credentials() is not None
    except Exception:
        return False

# --------------------------------------------------------------------------------------
# Retrieval
# --------------------------------------------------------------------------------------

# supporting cases still reaches the ranker, and narrow enough that the tail of weakly similar
# cases does not dominate the vote once weighted.
TOP_K_NEIGHBOURS: Final[int] = 25

# A low guard, not a precision knob, and it is deliberately low after measuring the alternative.
MIN_NEIGHBOUR_SIMILARITY: Final[float] = 0.08

# Split of the neighbour score. Free text carries most of the signal, but an error code or an
# explicit "no error codes" is a hard fact that free text washes out, so structured feature
# overlap gets a third of the weight.
TEXT_SIMILARITY_WEIGHT: Final[float] = 0.65
FEATURE_OVERLAP_WEIGHT: Final[float] = 0.35

# Fewer labelled neighbours than this for the exact equipment_type and we back off to the
# family. 5 is the point where a single mislabelled case stops being able to swing the ranking
# on its own. There is deliberately no equivalent threshold for backing off past the family. One
# family neighbour beats a global search, because every cause outside the family is one the
# machine cannot have and the ranker drops it.
MIN_TYPE_NEIGHBOURS: Final[int] = 5

# --------------------------------------------------------------------------------------
# Ranking
# --------------------------------------------------------------------------------------

# Additive smoothing on each candidate's vote mass. Small relative to a single confirmed vote
# (1.0) so it does not invent candidates, large enough that one lucky match does not produce a
# 99% answer.
RANKING_SMOOTHING_ALPHA: Final[float] = 0.15

# Pseudo-count reserved for "something else". Sized so one confirmed neighbour can at best tie
# with it: with fourteen seed causes against a corpus that certainly holds more, that is the
# right starting posture. Moves once the null confirm rate measures it directly.
OTHER_PRIOR_MASS: Final[float] = 1.0

# The "other" mass is multiplied by this when retrieval had to back off, because a family-level
# or global match is exactly the situation where our causes do not apply.
OTHER_MASS_FAMILY_MULTIPLIER: Final[float] = 1.6
OTHER_MASS_GLOBAL_MULTIPLIER: Final[float] = 3.0

# Candidates below this probability are dropped from the response rather than shown: a
# dispatcher loading a van cannot act on a 2% cause, and the list stays readable on a phone.
MIN_CANDIDATE_PROBABILITY: Final[float] = 0.03

# Most probable causes shown at once, which is what fits above the fold on a phone.
MAX_CANDIDATES: Final[int] = 5

# Total weighted evidence below which the answer is marked degraded and the UI says so. An
# absolute count, so it stops firing at scale and must become relative to the type.
DEGRADED_EVIDENCE_MASS: Final[float] = 2.0

# --------------------------------------------------------------------------------------
# Questions
# --------------------------------------------------------------------------------------

# Questions asked before we stop and show the answer. Three is what someone on a phone call
# will sit through; the machine question is scope, not symptom, and does not count.
MAX_QUESTIONS_PER_SESSION: Final[int] = 3

# The id of the question that establishes which machine this is, asked only when equipment.py
# could not read it out of the description.
EQUIPMENT_QUESTION_ID: Final[str] = "equipment"

# Expected information gain, in bits, below which a question is not worth asking.
MIN_INFORMATION_GAIN_BITS: Final[float] = 0.02

# --------------------------------------------------------------------------------------
# Auth
# --------------------------------------------------------------------------------------

# Key the session tokens are signed with. The fallback exists so the project runs after a clone
# with no setup; it is a literal in a public repository and therefore not a secret, which is why
# a deployment must set the environment variable.
AUTH_SECRET: Final[str] = os.environ.get(
    "DIAGNOSTIC_ASSIST_AUTH_SECRET", "dev-only-not-a-secret-set-the-env-var"
)

# How long a token is good for. A shift is eight hours and nobody wants to log in again halfway
# through one; a dispatcher's browser is also a shared machine in a depot office, so this is not
# a week.
AUTH_TOKEN_TTL_SECONDS: Final[int] = 12 * 60 * 60

# The shortest password the change-password endpoint will accept. Four, which is not a password
# policy and is not pretending to be one.
MIN_PASSWORD_LENGTH: Final[int] = 4

# scrypt work factors. 2**14 with r=8, p=1 is the parameter set RFC 7914 gives as its
# interactive-login example, and it costs about 16MB and a few milliseconds per attempt, which
# is invisible on a login and expensive in bulk.
SCRYPT_COST: Final[int] = 2**14
SCRYPT_BLOCK_SIZE: Final[int] = 8
SCRYPT_PARALLELISATION: Final[int] = 1

# --------------------------------------------------------------------------------------
# API
# --------------------------------------------------------------------------------------

# Dev origins allowed by CORS. 3001 is what frontend/package. json runs `next dev` on, and 3002
# is where `npx serve out` puts the built static export; both are listed so that testing the
# real artefact does not silently fail on a preflight.
CORS_ALLOW_ORIGINS: Final[tuple[str, ...]] = tuple(
    os.environ.get(
        "DIAGNOSTIC_ASSIST_CORS_ORIGINS",
        "http://localhost:3001,http://127.0.0.1:3001,http://localhost:3002,http://127.0.0.1:3002",
    ).split(",")
)

# How long a session survives without being touched. Eight hours matches a shift and the TTL the
# design note puts on the DynamoDB `sessions` table, so the in-memory store expires on the same
# clock the production one will.
SESSION_TTL_SECONDS: Final[int] = 8 * 60 * 60

# Seconds between SSE keep-alive comments, below the 30s idle timeout most proxies use.
SSE_KEEPALIVE_SECONDS: Final[float] = 15.0
