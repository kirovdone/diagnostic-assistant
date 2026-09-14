# Diagnostic Assist

22 closed field-service cases, four languages, **no root-cause field anywhere in the data**.
A dispatcher types what is wrong; the system returns ranked root causes with a probability
each, and an explicit share reserved for a cause it does not have.

This README is the submission, in the order the brief asks for it. The tables in section 4
are printed by `scripts/eval_rank.py`, `scripts/eval_labeling.py` and
`scripts/compare_models.py`; the walkthrough, the language numbers and the parts-lookup
comparison came from driving the running system by hand and are not scripted. Anything
projected to a hundred thousand cases is labelled as a projection. It went past the
three-hour timebox.

Full-size diagrams are in [`diagrams/`](diagrams/) as SVG and PNG.

---

## Before the five: the hard part

Whatever assigns root causes both **creates the training data** and is the one component
nothing downstream can contradict. If it is wrong, retrieval searches a wrong index and the
probabilities are confident numbers about nothing, silently, because there is no ground
truth to disagree with them.

---

## 1. What the product is

**One screen, two users, one session.** The dispatcher has hearsay on a phone line and acts
on the probability spread and on `typical_parts`, the only field that turns a cause into a
van load. The technician is at the machine and acts on the ordering and the evidence case
ids. Two apps would double the surface that has to show its uncertainty. A third user, the
service engineer, never sees a diagnosis: they own the taxonomy and the review queue, so they
decide what the system can conclude. Their surface is `/cases`, every closed case with what
the labeller made of it and the flags that sent it to review. Cause names are carried in all
four languages, so a German dispatcher reads German causes, not a German menu over English
ones. Urgency, the dispatcher's third decision, this product does not make; section 5 says
why.

| Step | What the screen shows | What the user does |
| --- | --- | --- |
| 1 · describe | One free-text box. No dropdowns: a mechanic in front of a broken machine describes the fault, not the asset record | Types, in any of four languages |
| 2 · scope | If the machine cannot be read out of the text, one question: which machine. Until answered, the ranking is empty rather than global | Taps a family, or keeps typing |
| 3 · rank | Up to 5 causes, a probability each, a row for **"something else"**, a line saying how thin the evidence was, and the parts each cause typically needs, with a *No part* badge where it needs none | Reads |
| 4 · ask | At most 3 questions, each chosen by how much the answer would change the ranking. Two or three buttons, typing also works | Answers, or ignores them |
| 5 · confirm | The candidates as buttons, plus **"None of these"** | Presses one. This is the only ground truth the running system ever produces |

**If nobody presses confirm, there is no accuracy number.** It is pressed after the machine
is already fixed, so expect a low, self-selected rate. No model change fixes that; dispatch
has to require the press to close a job. The machine question is scope, not symptom, so it
does not count against the three.

### C-48712, walked through

| What happens | Why |
| --- | --- |
| Dispatcher types *"Customer says there is oil under the machine"* | Hearsay, third-hand, no machine named |
| System asks which machine → taps **Water Chiller CH** | `equipment.py` declines rather than guesses. Over the 22 descriptions it resolves 12, declines 10, wrong 0 |
| The answer names a family, not a type, so the type search has nothing to search; CH-200's 4 votable cases are under `MIN_TYPE_NEIGHBOURS` 5 anyway → family, and it says so | Below 5, one mislabelled case can swing the ranking alone |
| Blocked condensate drain on top, then pump seal, corroded fitting, Schrader leak. **44% reserved for something else** | The system contradicts the customer. They said oil; the corpus knows a puddle under a chiller is usually condensate |
| The top cause carries *No part*; the runners-up carry `SEAL-PMP-CH`, `FITTING-22MM` and `SCHRADER-SUC` | The van loads for the second and third rows, not the first, which is why the screen says *No part* out loud rather than leaving a field empty |
| Asks *"How fast is it coming out?"* → *"continuous flow, puddle"*. Same order, firmer, reserved falls to **38%** | Severity is the question worth asking; fluid is not, because the dispatcher already said oil. Answers are appended to the text and everything re-ranks; they never filter. Nothing new clears the floor, so no second question is asked |
| Technician confirms **blocked condensate drain** | C-48712's own notes: *"No oil leak found. Fluid was condensate from the chiller drain pan, drain line was blocked."* |
| Same session, that case held out, the regime section 4 measures. Pump seal on top, and **49% reserved** | With the cause gone from the corpus the system cannot name it, offers the three water-side causes it still has, and reserves half its probability for something it does not have. A ranker that normalised over its neighbours would have shown a confident pump seal instead |

When the technician presses **"None of these"** they cannot record the cause they actually
found, the half of the signal that would tell us what to add to the taxonomy. First thing I
would add to the UI.

![One session, turn by turn](diagrams/chat-sequence.png)

Dashed is designed, not built: reading features off free text is the only such call site.
The embedding model beside it is real.

---

## 2. The design note

Every threshold below, with the argument for its value, is in
`backend/diagnostic_assist/config.py`.

### a. The pipeline

![How it runs](diagrams/architecture.png)

The 3 s budget covers only the live band: every expensive step happens once per case
offline, never once per question. The live path today is one Cohere embed of the query, an
in-process scan and a weighted vote; the feature-extraction call, when it lands, is the
second model call and the one that can blow the budget. **The budget is designed for, not
measured.** Two Protocols (`LabelExtractor`, `TextSimilarity`) make the model calls
swappable, and the domain has no vendor import.

### b. The algorithms, and what each was chosen over

| Stage | Algorithm | Chosen over, and what it costs |
| --- | --- | --- |
| Labelling | Schema-constrained extraction, forced tool call, then 5 rejection rules | **Over supervising on `parts_replaced`**, the only label-shaped field. Measured over the sample, a parts-derived label agrees with the labeller on all 15 cases with a catalogued part and is silent on the 4 diagnoses fixed without one (C-48590, C-48712, C-48934, C-48801): never wrong, only silent, and silent on exactly the cases this system exists for. Cost: the extractor leans on phone-typed text instead |
| Retrieval | Cohere Embed v4, 1024d, + BM25 fused by RRF, filtered by equipment type. *Designed*; today it is dense cosine blended 0.65/0.35 with structured feature overlap, which is what section 4 measures | **Over a lexical index.** The corpus is DE/EN/FR/IT, often mixed in one case, so a language boundary the index cannot cross is most of this business failing. BM25 still earns a place because dense encoders blur `E207` into `E307` and three cases here turn on 207. Cost: RRF returns ranks, not similarities, so the cosine thresholds need re-fitting |
| Ranking | Similarity-weighted vote × evidence weight, Laplace-smoothed | **Over a learned re-ranker**, which would win on NDCG and could not explain itself. A technician is about to disagree with this number; a vote count debugs from three case ids. Cost: that gap is unmeasured |
| Uncertainty | Open-set: a prior mass for a cause outside the taxonomy, plus anything trimmed under the 3% floor or the top-5 cut, growing when retrieval widens | **Over normalising across what was retrieved**, which always sums to 100% and is therefore always wrong about its own coverage. Cost: the largest row is often one nobody can act on |
| Questions | Expected information gain in bits, floor 0.02 | **Over a fixed decision tree.** Cost: on a thin type the estimate is mostly smoothing |
| Taxonomy | Embed resolutions → UMAP → HDBSCAN → engineer names and merges → frozen version | **Over free-form generation**, whose causes never join up. Cost: a fault seen a handful of times in a large corpus lands in clustering noise and gets no cause |
| Calibration | Isotonic per `fallback_level`; Platt under ~1,000 sessions a bucket | Not built; needs outcomes. See section 5 |

### c. The data structures

**How a new case matches 100,000 old ones:** one OpenSearch round trip, kNN on the embedding
plus BM25 over normalised text, both under an `equipment_type` filter, fused by RRF. If a type
yields under 5 neighbours it re-issues at family level and stops there, never global, because
every cause outside the family is one the machine cannot have. Today it is an in-process
scan, **O(corpus) per call**.

One indexed record, C-48712 as the pipeline builds it. In production S3 Parquet is
authoritative and the index rebuilds from it; today both live in process.

```json
{
  "case_id": "C-48712",
  "equipment_family": "Water Chiller CH",
  "equipment_type": "CH-200",
  "language": "en",

  "label": {
    "taxonomy_version": "2026-09-seed",
    "outcome_status": "CONFIRMED",
    "cause_id": "CH.DRAIN.CONDENSATE_BLOCKED",
    "confidence": 0.95,
    "evidence_weight": 1.0,
    "flags": ["NO_PART_FIX", "CUSTOMER_SYMPTOM_MISMATCH"],
    "evidence_spans": [
      "Fluid was condensate from the chiller drain pan, drain line was blocked.",
      "Blocked condensate drain line, cleared."
    ]
  },

  "features": {
    "error_codes": [],
    "error_codes_absent": false,
    "fluid_claimed": "oil",
    "severity": "continuous",
    "recurrence": "unknown",
    "onset_conditions": [],
    "normalized_text": "customer reported puddle of oil under the machine."
  },

  "embedding_ref": {
    "model": "cohere.embed-v4",
    "input_type": "search_document",
    "dims": 1024
  },
  "embedding": [ "1024 floats" ]
}
```

**`evidence_weight` comes from `outcome_status`, never from `confidence`**: CONFIRMED 1.0,
PROVISIONAL 0.25, else 0. A confidently labelled warranty swap is still worth nothing, and
the model returns nearly the same confidence every time anyway. Confidence enters at one
point only: under `MIN_CONFIDENCE_FOR_CONFIRMED` (0.6) a label is held at PROVISIONAL. The
~15% of the corpus with no `resolution_text` (C-48801 here) carries `NULL_RESOLUTION` and is
capped the same way: technician notes alone can inform a ranking, not decide one. Only `evidence_weight > 0` is
indexed, 19 of 22 here; the other three have real symptom text and no trustworthy answer,
and that text does not get to vote.

`features` derives from `customer_description` only, because a live session has nothing
else, and so does the embedding: the index compares like with like. Technician text is what
the case is labelled from, not what it is retrieved by.
The field is `fluid_claimed`, not `fluid`: here it says **oil**, the confirmed cause is a
condensate drain, and the case carries `CUSTOMER_SYMPTOM_MISMATCH` for it. `language` is
recorded and never translated: translating evidence loses the words the match was made on.

### d. The processing

**100k backfill.** Bedrock batch inference over JSONL on S3, every prompt built by
`build_prompt`, the same function the live path uses, so the two cannot drift. Results are
joined back, validated, embedded and bulk-indexed behind an alias flip. Parse failures go to
a dead-letter prefix, never dropped: a systematic parse failure looks exactly like a
systematic absence of that cause. Cost: at the rate `compare_models.py` measured, extraction
for 100k cases is about $10; with embeddings, tens of dollars at most, and an overnight run.

**~500 a day.** EventBridge → SQS → Lambda calling the same extractor, reserved concurrency 5
so a replay cannot exhaust the Bedrock quota the backfill shares. Not batched: batching would
save pennies and add a day's delay.

**What breaks between 22 cases and a million.** The scan above is the first: O(corpus) per
call, and the only part of the live path that does not survive real volume. `build_prompt`
puts the whole taxonomy in every prompt, so **cost scales corpus × taxonomy**; the fix is to
scope the catalogue to the case's equipment family. Three thresholds fail the other way.
`MIN_TYPE_NEIGHBOURS`, `DEGRADED_EVIDENCE_MASS` and `OTHER_PRIOR_MASS` are absolute, not
relative to the type: at a million cases the first two clear always, and the "something
else" row shrinks as vote mass grows whether or not the taxonomy got better. All three have
to become relative to the type's own baseline, or the honesty is a small-corpus artefact.

### e. The failure modes, and how I find out

The thresholds are starting points, not fitted ones; they get re-fitted against the first
quarter's baseline.

| What breaks | How it is detected |
| --- | --- |
| The labeller degrades after a model or prompt change, or non-diagnostic cases leak into the index | A frozen gold set of engineer-labelled cases as a blocking CI gate, exclusion recall its headline metric; drift on the weekly cause distribution per family and on the CONFIRMED share |
| The model invents a cause or a justification | The `UNMAPPED` rate per family and model version, alarming on a move in either direction |
| Probabilities drift out of calibration | A reliability curve over confirmed outcomes, and Brier score per `fallback_level` |
| Retrieval quietly falls back for a whole type | `fallback_level` is on every response and log line. Daily share per type, alarming when a type that normally resolves at type level starts backing off |
| The first candidate misses 3 s | p95 to first SSE token, per `fallback_level`: a family-level fallback issues two queries, not one |
| The feed stops and nothing looks broken | The load-bearing alarm is freshness: documents indexed per day against their own baseline. Then SQS oldest-message age, dead letters, Lambda errors and throttles |
| A silent per-language hole | Extraction rate per feature *per language*, and the parity set as a blocking gate. This is the one failure with no natural alarm; the feature just reads `unknown` |
| Feedback-loop poisoning | The label store never ingests a `cause_id` from a session, and a small random share of sessions would be held out with no ranking at all |

### f. The stack, and where each choice hurts

| Choice | Why | Where it hurts |
| --- | --- | --- |
| Bedrock, `eu-central-1`, `eu.` profile | Not quality: residency. A closed case carries a customer's site, their complaint and what a technician found. The `eu.` profile keeps inference in EU regions rather than adding a sub-processor to every DPA | Batch turnaround is queued and opaque; quotas are per account and shared with the live Lambda |
| Nova Lite | Picked by running `compare_models.py` over the models this account can invoke, not by reputation, with cost taken from Bedrock's own usage counters. It scores **19/19 at $0.0022 a run**; Nova Pro matches it at 12× the price, and **Nova 2 Lite, newer and 8.6× the price, scores 15/19** (`scripts/model_sweep.txt`) | A model chosen on 22 cases is chosen on a wide interval, and Nova Micro is one case behind at half the price, which 22 cases cannot separate. Re-run the sweep whenever the gold set grows |
| Cohere Embed v4 | 100+ languages in one space. Not Titan, which is 5× cheaper and English-optimised, reintroducing exactly the failure the embedding removes | A model id is not a weight hash. A silent weight change is a corpus-wide recall failure producing perfectly well-formed numbers |
| OpenSearch Serverless | kNN, BM25 and the type filter in one query rather than three systems kept in agreement | It is most of the monthly bill, and at this corpus size the whole index fits in RAM. I would probably take Postgres with pgvector |
| S3 Parquet + DynamoDB | S3 authoritative and rebuildable. Two tables: sessions are a scratchpad with an 8 h TTL, outcomes are the record and never expire | TTL deletion runs up to 48 h late, so a read must still check |
| FastAPI + SSE, Next.js static export | Every POST returns the whole view; the stream replays this session's event log from `Last-Event-ID` and fans out to every listener, so a reload or a second screen sees the same story rather than half of it. Four backend runtime dependencies, plus boto3 behind the `bedrock` extra | The session lives in React state and nothing puts its id in the URL, so a refresh starts over: the replay is there and the client cannot yet ask for it. No ISR or server actions |

**The search tier is most of the bill, not the inference.** Bedrock has no standing charge:
pay per token, no endpoint, nothing accrues while nobody is calling it.

---

## 3. The component I built, and why that one

**The labeller**, for the reason at the top of this page. Retrieval, ranking and question
selection can each be debugged against a case you can read; a wrong label cannot. Everything
after it is arithmetic on its output.

| Stage | State | What it does |
| --- | --- | --- |
| Normalise: codes, negation, shorthand, 4 languages | **real** | Negation is a feature, not noise: "no error codes" is not the same fact as nobody mentioning codes |
| Deterministic pre-screen | **real** | 3 of the 22 never reach a model: a billing dispute, a warranty swap, a no-fault-found. Whether that share holds at 100k is a guess until the backfill runs |
| Extract a cause | **real** | Nova Lite on Bedrock, Converse API, forced tool call, so the model cannot answer in prose, add a field or omit one |
| Validate: 5 rejection rules | **real** | Never repairs. Repair is how a wrong answer quietly becomes a plausible one |
| Weight by outcome status | **real** | Not by the model's confidence |
| 100k backfill, index, corpus loader | *stub* | Each carries a `# STUB:` comment naming what the real implementation does and how |

The five rejection rules, as written in `labeling.py`:

```python
def validate(case: Case, extracted: ExtractedLabel) -> tuple[str | None, list[LabelFlag]]:
    """Check an extracted label against the taxonomy, the text and the parts list.

    Validation never repairs a label. A label that needs repair is a label a
    human should look at.
    """
    flags: list[LabelFlag] = []
    cause_id = extracted.cause_id

    # 1. The cause must exist in the frozen taxonomy...
    if cause_id is None:
        return None, [LabelFlag.NO_CAUSE_EXTRACTED]
    cause = get_cause(cause_id)
    if cause is None:
        return None, [LabelFlag.UNMAPPED]

    # 2. ...and be possible on this family.
    if case.equipment_family not in cause.families:
        return None, [LabelFlag.UNMAPPED]

    # 3. Every quoted span must occur in the case text, and a claim with no quotation
    # at all fails rather than passes -- quoting nothing must not be the cheapest way
    # past the check.
    if not extracted.evidence_spans:
        return None, [LabelFlag.UNMAPPED, LabelFlag.EVIDENCE_NOT_IN_TEXT]
    unsupported = [span for span in extracted.evidence_spans if not _span_occurs_in(span, case)]
    if unsupported:
        return None, [LabelFlag.UNMAPPED, LabelFlag.EVIDENCE_NOT_IN_TEXT]

    # 4. At least one quotation must be the technician's. The customer's line is a symptom
    # reported second-hand, so a cause justified only from it is the model agreeing with the
    # caller -- which is the failure this whole system exists to catch. One span is enough:
    # the model legitimately quotes the customer alongside the technician.
    if not any(_span_is_the_technician(span, case) for span in extracted.evidence_spans):
        return None, [LabelFlag.UNMAPPED, LabelFlag.EVIDENCE_NOT_IN_TEXT]

    # 5. Parts are a consistency check, never a source. One supporting part settles it:
    # technicians fix more than one thing per visit, and a stricter rule sent real
    # diagnoses to review because the van also carried a filter.
    catalogued = [part for part in case.parts_replaced if part in PART_TO_CAUSE]
    if catalogued and all(PART_TO_CAUSE[part] != cause_id for part in catalogued):
        return None, [LabelFlag.UNMAPPED, LabelFlag.PART_CAUSE_CONTRADICTION]
    ...
```

There is no offline fallback for either model call: a label nobody inferred is worse than no
label, and an index that quietly stopped crossing languages is worse still, because it looks
healthy.

Three defects in my own labeller, all of which made it more confident than it should be.
**Quoting nothing used to be the cheapest way past the span check**: only the offered spans
were checked, so quoting badly got you rejected and quoting nothing sailed through at full
evidence weight, the opposite of the intended incentive. **Every span was checked against the
whole case**, customer line included, so a cause justified only by the caller's hearsay
passed at CONFIRMED: on C-48712 the system would have endorsed "oil" from the customer while
the technician wrote "no oil leak found". At least one quotation must now be the
technician's. And **Nova returns two contradictory tool calls on some cases**, a committed
answer beside an abstention, on 8 of 20 calls on C-49355, where the code took whichever came
first; it now takes the most confident, and refuses when two causes tie. Each has a test.

---

## 4. How I would know it works

| Metric | Value | Reading it |
| --- | --- | --- |
| Extraction vs gold | 19/19 | 3/3 exclusions, 4/4 non-English, 0 validation failures. Live Nova Lite, not a fixture |
| Recall@5, answer reachable | **10/10** | 5 causes have a second supporter and each of the 10 cases retrieves its pair; three pairs are the same fault in two languages, so this overlaps the cross-language result |
| Top-1, answer reachable | 8/10 | Ranking, not retrieval, is the remaining loss |
| Top-1, all 19 | 42.1% | Wilson 95%: 23–64% |
| Recall@5, all 19 | 52.6% | Measures corpus size: 9 of 14 causes are singletons. Wilson 95%: 32–73% |
| Baseline: lookup table | 0/19 | Commonest cause for the type, then family; tie = miss. With 14 causes over 19 cases the table has nothing to look up, so this says nothing about the ranker. An earlier version credited empty types and insertion-order ties and printed 4/19; fixed |
| Margin over baseline | +42.1 pts | Against a baseline that cannot exist at this size. The comparison that decides anything is on a real gold set, below |

Reproduce with `uv run python scripts/eval_rank.py` and `scripts/eval_labeling.py`. The
ranking eval scores against the pipeline's own labels, not gold; that is safe only while the
labelling eval shows 19/19 agreement, so run them in that order.

**Where the thing to measure against comes from.** Today it does not: the gold labels, the
taxonomy and the extraction prompt were written by the same person from the same 22 cases,
so 19/19 measures agreement with one reader, not accuracy. The extractor is a live Nova Lite
call, so the number is not circular, just small. What replaces it: a stratified sample of
~500 cases with a service engineer blind-labelling 200, three or four days of their time,
pennies of tokens. **Until that exists I will not quote a production accuracy figure.**

**Testing without ground truth, where it is possible.** The same fault written in four
languages must be understood four ways identically: that asserts invariance, not
correctness, so a disagreement is a bug whichever answer is right and no labels are needed.
Run by hand across three faults in four languages, not scripted, roughly one check in six
disagreed, measured before the negation-scope fix below closed part of it. Retrieval crosses
languages: the German query scores the right English case about twice the wrong one in all
three. German loses its features: both-edge-anchored cues miss compounds, so
`Hydraulikoel`, `Hydrauliköl` and `Kuehlwasserverlust` all read as fluid
`unknown`; unanchored, the German oil cue matches inside `cold` and every cold-start fault
reports an oil leak.

**The same session in German gets it wrong, reproducibly.** *"Hydraulikoel laeuft aus"* on
the same chiller puts the right cause **second** (pump seal 16%, condensate drain 11%, 55%
reserved), then spends one of its three questions asking *"What is the fluid?"*, which the
user typed first; the English session never asks it. German is the majority language in this
market, so this is a blocker. Probing the fix: the model reads every compound the tables miss
and gets `severity` right once the prompt names the two values and permits abstaining
(without that it answers `drip` for a puddle), but returns `error_codes_absent` true on all
six probes, including the English control and cases that never mention a code, even when
told in so many words to return false when the text is silent: it manufactures a denial
nobody made. So `fluid` and `severity` move into the extraction call and the codes stay with
the rules. Not shipped: it alters the labeller's prompt and 22 cases cannot say whether it
helped.

**What would make me stop and rethink.** Four triggers, fixed before I measured:

- Exclusion recall under 0.90 on the gold set.
- A 70% bucket that resolves at 40%.
- First-visit fix rate flat after a quarter.
- The one that kills the architecture: **if top-1 cannot beat the lookup-table baseline by
  about ten points on a real gold set, ship the lookup table**, no index, no embeddings, no
  inference bill. Ten points needs roughly 200 labelled cases to resolve, which is why the
  blind-labelling experiment is that size. Same test for the labeller against the parts table.

---

## 5. What I cut

| Cut | Why, and what it costs |
| --- | --- |
| Taxonomy induction | 14 causes written by hand after reading 22 cases. Induction is half a day on real data and worth nothing on 22 rows. Cost: a cause nobody wrote down falls into "other", and the Aerial Platform family has two causes, so an AP diagnosis is near a coin flip |
| Calibration | No held-out set exists, so the probabilities are smoothed vote shares: ordered, not calibrated. Cost: **nothing maps 0.40 to "right four times in ten", and a dispatcher loading a van reads it as a frequency.** The screen only says `degraded` |
| Deduplication | Repeat visits to one machine each cast a vote, so one chronic machine can manufacture a cause. No machine or site id exists in the corpus. Cost: a near-duplicate pass cannot tell a chronic machine from a fault the fleet genuinely repeats, so it deletes real evidence too. The fix is a schema change upstream |
| Durable sessions and outcomes | In-process dicts. Cost: `close` writes the confirmed cause to memory and loses it on restart, **the only ground truth the running system produces** |
| Urgency, technician skill, van stock | No contract, SLA, site criticality, technician or stock field exists anywhere in the corpus. Cost: of the three dispatcher decisions, this answers what to tell the technician, gestures at which parts to load, and is silent on urgency. Stock decides as much of first-visit fix rate as diagnosis does. That needs data upstream |
| Token revocation on sign-out | Tokens are signed with a key that includes the password hash, so changing the password kills every token issued before it. Nothing else does. Cost: signing out clears the browser and revokes nothing server-side, so a token that has already leaked stays good until it expires. A real identity provider issues short-lived tokens against a refresh token it can revoke |
| Tracing, IaC, roles, rate limits | No spans, nothing provisions the services, and any signed-in user reaches everything, including the review queue. One role by design: the person who diagnoses against the corpus is the person who audits the labeller. Cost: no audit log on the surface every future ranking is computed from; the fix is the identity provider that replaces `auth.py` |
| The 5% holdout | Designed, not built. Cost: without it the numbers measure an echo: the system suggests a cause, the technician checks it, the case closes on it |

**Next, in order:** (1) the gold set above; nothing is measured until it is not mine.
(2) `fluid` and `severity` into the extraction call, once (1) can say whether it helped.
(3) Persist the confirmed cause.

---

## Where AI was used, and where I overrode it

Used throughout: scaffolding, the four-language cue tables, the test suite and the frontend
component port were all drafted by a model. Two defaults I rejected. The model wanted answers
to filter the candidate set, the obvious shape and wrong here: an answer the user gets
slightly wrong deletes the right cause permanently, so answers are appended to the text and
everything re-ranks. That one is reasoned, not measured. And it wanted `parts_replaced` as
the supervision label; measured over the sample it is silent on exactly the diagnoses this
system is for (algorithms table). One place the review missed: I checked the model-drafted
cue tables for coverage, not for German compounding, which is how `Hydrauliköl` shipped
reading as nothing. The cross-language check caught it, not the review.

What kept it on a leash: every tunable number in `config.py` with its argument beside it,
and `ruff`, `mypy --strict` and the suite as a gate. The gate caught a model-written
embedding parser that would not have crashed and would have retrieved nothing, and a
negation rule that inverted the meaning of German fault reports.

---

## Running it

Python 3.12, [uv](https://docs.astral.sh/uv/), Node 22. Credentials and model access:
[BEDROCK_SETUP.md](BEDROCK_SETUP.md), which also carries the model-sweep commands. The test
suite needs neither.

```bash
cd backend && uv sync --extra bedrock
uv run pytest && uv run ruff check . && uv run mypy   # 257 tests, no credentials or network
uv run python scripts/eval_labeling.py                # labelling against gold_labels.json
uv run python scripts/eval_rank.py                    # leave-one-out ranking, vs the lookup table
uv run uvicorn diagnostic_assist.api:app --port 8000

cd ../frontend && npm install && npm run dev          # :3001, /login as user@test.com / user
```

The seeded account is printed on the login page, because a take-home nobody can run is not a
take-home. Set `DIAGNOSTIC_ASSIST_AUTH_SECRET` anywhere the tokens matter; the fallback is a
literal in the repository. Everything under `frontend/src/components/kit/` is copied from a
private in-house component library, with a header on each file saying what changed: about
2,900 of the frontend's 7,400 lines. A further 1,100 lines of hooks, helpers and consts
beside it are copies too, and say so in the same way. Roughly 3,400 lines are new to this
product.
