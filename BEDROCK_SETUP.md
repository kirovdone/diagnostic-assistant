# Activating it

Five steps. Everything except step 2 is a few minutes; step 2 is a request you wait on.

---

## 1. Region and credentials

`eu-central-1`. This is not a latency choice. The `eu.` inference profiles route across
eu-central-1, eu-west-1, eu-north-1, eu-west-3, eu-south-1 and eu-south-2, so inference stays
inside EU processing — which is the entire reason to be on Bedrock rather than a hosted API,
given the case text is a customer's site, their complaint and what a technician found.

```bash
aws configure                 # or `aws login` for temporary credentials, or AWS_PROFILE
aws configure set region eu-central-1
```

Nothing in the code reads a credential. `boto3` resolves them from the standard chain, and
`config.aws_credentials_available()` asks boto3 whether it managed rather than sniffing
environment variables — `aws login` sets none, and a guard that looked for them refused
correctly configured machines.

---

## 2. Request model access — this is the gate

Bedrock console, `eu-central-1` → **Model access** → Manage model access. Two grants:

| for | model |
|---|---|
| extraction | **Amazon Nova Lite** (see the model choice below) |
| embeddings | **Cohere Embed v4** |

Amazon and Cohere models are usually granted immediately. **Anthropic models need an extra
step**: a *use case details* form, linked from the same page, asking for company, website and
a sentence on what you are building. Until it is submitted, Claude models fail with
`ResourceNotFoundException: Model use case details have not been submitted`.

---

## 3. IAM

Scope it to what you actually call rather than `*`:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["bedrock:InvokeModel", "bedrock:Converse"],
    "Resource": [
      "arn:aws:bedrock:*:*:inference-profile/eu.amazon.nova-*",
      "arn:aws:bedrock:*:*:inference-profile/eu.cohere.embed-*",
      "arn:aws:bedrock:*::foundation-model/amazon.nova-*",
      "arn:aws:bedrock:*::foundation-model/cohere.embed-*"
    ]
  }, {
    "Effect": "Allow",
    "Action": ["bedrock:ListFoundationModels", "bedrock:ListInferenceProfiles"],
    "Resource": "*"
  }]
}
```

The second statement is only so the discovery script below can read the catalogue. Use an IAM
user or role, never the account root: root cannot be scoped, cannot be revoked without changing
the account password, and cannot have a budget action applied to it.

---

## 4. Install, then find out what the account actually has

```bash
cd backend
uv sync --extra bedrock
uv run python scripts/bedrock_models.py
```

That prints every text and embedding model the account can call in this region, the inference
profiles in front of them, and whether the two configured ids are among them. **Model ids are
not guessable** — they depend on the region, on which profiles AWS exposes there, and on what
has been granted. It exits non-zero when something is missing, so it works as a CI preflight.

To point at something else:

```bash
export DIAGNOSTIC_ASSIST_BEDROCK_MODEL=eu.amazon.nova-pro-v1:0
export DIAGNOSTIC_ASSIST_BEDROCK_EMBEDDING_MODEL=eu.cohere.embed-v4:0
```

---

## 5. Run it

```bash
uv run python scripts/eval_labeling.py                   # 22 cases against the real model
uv run python scripts/eval_rank.py                       # retrieval + ranking, leave-one-out
uv run python scripts/compare_models.py                  # accuracy beside cost, per model
uv run uvicorn diagnostic_assist.api:app --port 8000
```

---

## Which models, and why

Chosen by measurement rather than reputation. `scripts/compare_models.py` runs the same gold
evaluation across every model the account can invoke:

| model, `eu-central-1` | $/M in | $/M out | cause | non-English | per run |
|---|---|---|---|---|---|
| `eu.amazon.nova-micro-v1:0` | 0.046 | 0.184 | 18/19 | 4/4 | $0.0013 |
| **`eu.amazon.nova-lite-v1:0`** | **0.078** | **0.312** | **19/19** | **4/4** | **$0.0022** |
| `eu.amazon.nova-2-lite-v1:0` | 0.429 | 3.597 | 15/19 | 4/4 | $0.0189 |
| `eu.amazon.nova-pro-v1:0` | 1.05 | 2.10 | 19/19 | 4/4 | $0.0265 |

One run of `scripts/compare_models.py`, committed verbatim as `scripts/model_sweep.txt`. The
cost column is Bedrock's own `usage` counters, not an estimate from character counts, which is
what it used to be and which was out by roughly half.

The cheapest model that scored full marks was taken. The column that decided it is
**non-English**: a model that reads English notes perfectly and German ones poorly is the
failure this corpus hides best, because only four of twenty-two are not English. Amazon prices
come from the AWS pricing API for this region and are exact.

The Nova 2 Lite row is why the sweep exists rather than a paragraph of reasoning. It is the
newer model and the obvious upgrade, and it scores **15/19 at 8.6× the price**. Assuming it
would be better would have cost accuracy and money at the same time. It is also the least
stable of the four: an earlier run put it at 14/19, so treat the gap as real and its size as
approximate.

**Embeddings: Cohere Embed v4**, 1024 dimensions, not Amazon Titan V2. Titan is five times
cheaper and optimised for English, which reintroduces exactly the failure the embedding exists
to remove. Measured: a German query scores 0.396 against the right English case and 0.176
against the wrong one; French 0.329 / 0.128; Italian 0.447 / 0.169. The margin is what
matters there, not the absolute number.

**Anthropic models are not the default** for one reason visible in the account listing:
Anthropic publishes twelve `eu.` profiles in this region and OpenAI publishes none, only
`global.`, which may route outside the EU. Since residency is the entire point, a model without
an EU profile is not a candidate however good it is — and among the EU-profile models, Nova Lite
already scores full marks.

---

## What it costs

| | |
|---|---|
| one full evaluation run | **$0.0022** |
| the whole model comparison sweep | under $0.05 |
| embedding all 22 cases | $0.00003 |
| standing cost while idle | **$0** |

Pay-per-token, no endpoint and no provisioned throughput, so nothing accrues when you are not
calling it. The only way to incur standing cost on Bedrock is Provisioned Throughput, bought
deliberately by the hour.

**AWS has no hard spending cap.** A budget alert is the practical protection; a Budget Action
attaching a deny policy is the closest thing to a stop, and it cannot be applied to root. At
real volume, batch inference (`CreateModelInvocationJob`) is roughly half the on-demand price.

---

## Running without AWS

The test suite needs neither credentials nor network:

```bash
uv run pytest        # 257 tests; tests/stubs.py supplies the extractor
```

Neither model call falls back. The suite injects its own doubles — `StubExtractor` and
`StubSimilarity` in `tests/stubs.py` — so its speed, cost and results never depend on whether
the machine happens to be logged in. Nothing in the package imports them.

---

## Known limits of this path

The Cohere response shape differs between versions — v4 returns
`{"embeddings": {"float": [[...]]}}` and v3 a bare list. Both are handled, because reading the
v4 shape as a list silently produces a five-dimensional "vector" spelling out `float`: a system
that runs, ranks, and retrieves nothing.

Feature extraction is still regex, so German compounds (`Hydrauliköl`, `Fehlermeldung`) are
missed and a German query can still rank differently from the same fault in English. Embeddings
fixed the retrieval half of that; the remaining half is moving `fluid`, `severity`, `onset` and
`recurrence` into the extraction call, which is the next change and is free — that model call
already happens.
