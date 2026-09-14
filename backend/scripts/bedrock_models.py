"""What this AWS account can actually call, and whether the configured ids are among them.

Model ids are not guessable. They depend on the region, on which inference profiles AWS
exposes there, and on which models the account has been granted in the Bedrock console, and
they change faster than a constant in `config.py` does. So rather than hard-code an id and
hope, this prints what is really available and says whether the two configured ids are in it.

    uv run python scripts/bedrock_models.py

Exits non-zero if either configured model is unavailable, so it doubles as a preflight check
before the first labelling run.
"""

from __future__ import annotations

import sys

from diagnostic_assist.config import (
    BEDROCK_EMBEDDING_MODEL_ID,
    BEDROCK_MODEL_ID,
    BEDROCK_REGION,
)

# Substrings worth surfacing: the text models that can hold a tool call, and the embedding
# models. Everything else Bedrock carries (image, video, speech) is noise here.
INTERESTING = ("claude", "gpt", "nova", "embed", "titan-embed", "mistral", "llama")


def main() -> int:
    try:
        import boto3
    except ImportError:
        print("boto3 is not installed. Run: uv sync --extra bedrock")
        return 2

    print(f"region {BEDROCK_REGION}\n")

    try:
        # Client construction resolves credentials, so it belongs inside the guard: a missing
        # provider dependency or an expired login surfaces here, not as a traceback.
        bedrock = boto3.client("bedrock", region_name=BEDROCK_REGION)
        foundation = bedrock.list_foundation_models()["modelSummaries"]
        profiles = bedrock.list_inference_profiles().get("inferenceProfileSummaries", [])
    except Exception as exc:  # broad on purpose: every failure here needs the same advice
        print(f"could not reach Bedrock: {exc}")
        print("\nCheck: credentials configured, the region is right, and the IAM principal")
        print("has bedrock:ListFoundationModels and bedrock:ListInferenceProfiles.")
        return 2

    # A granted model is one the account may actually invoke. AWS reports this per model.
    granted = {
        m["modelId"]
        for m in foundation
        if m.get("modelLifecycle", {}).get("status") == "ACTIVE"
    }

    print("INFERENCE PROFILES  (use these ids, not the bare model id, for cross-region models)")
    for p in sorted(profiles, key=lambda p: str(p.get("inferenceProfileId", ""))):
        pid = str(p.get("inferenceProfileId", ""))
        if any(k in pid.lower() for k in INTERESTING):
            print(f"  {pid:<62} {p.get('status', '')}")
    if not profiles:
        print("  none exposed in this region")

    print("\nFOUNDATION MODELS  (text and embedding only)")
    for m in sorted(foundation, key=lambda m: str(m["modelId"])):
        mid = str(m["modelId"])
        if not any(k in mid.lower() for k in INTERESTING):
            continue
        modes = ",".join(m.get("inferenceTypesSupported", []))
        print(f"  {mid:<62} {modes}")

    print("\nCONFIGURED")
    ids = {str(p.get("inferenceProfileId", "")) for p in profiles} | granted
    ok = True
    for label, wanted in (
        ("extraction", BEDROCK_MODEL_ID),
        ("embeddings", BEDROCK_EMBEDDING_MODEL_ID),
    ):
        found = wanted in ids
        ok &= found
        print(f"  {label:<12} {wanted:<52} {'available' if found else 'NOT AVAILABLE'}")

    if not ok:
        print("\nOne or both are unavailable. Either request access in the Bedrock console,")
        print("or point the environment at something from the lists above:")
        print("  DIAGNOSTIC_ASSIST_BEDROCK_MODEL=...")
        print("  DIAGNOSTIC_ASSIST_BEDROCK_EMBEDDING_MODEL=...")
        return 1

    print("\nBoth available. `uv run python scripts/eval_labeling.py` will use them.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
