"""HTTP surface. FastAPI, with the diagnosis streamed over SSE."""

from __future__ import annotations

import asyncio
import json
import threading
import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from typing import Annotated, Any, Final

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field, StringConstraints
from sse_starlette.sse import EventSourceResponse

from .auth import (
    User,
    authenticate,
    change_password,
    issue_stream_ticket,
    issue_token,
    stream_ticket_is_valid,
    update_profile,
    user_from_token,
)
from .config import (
    CORS_ALLOW_ORIGINS,
    EQUIPMENT_QUESTION_ID,
    MAX_ANSWER_CHARS,
    MAX_DESCRIPTION_CHARS,
    MAX_QUESTIONS_PER_SESSION,
    MIN_PASSWORD_LENGTH,
    SESSION_TTL_SECONDS,
    SSE_KEEPALIVE_SECONDS,
)
from .corpus import sample_cases
from .equipment import Catalogue
from .equipment import resolve as resolve_equipment
from .errors import ModelUnavailableError, UpstreamError
from .extractor import LabelExtractor, default_extractor
from .labeling import label_case
from .models import (
    Case,
    CaseLabel,
    EquipmentBasis,
    EquipmentGuess,
    Question,
    Ranking,
    Session,
    SessionStatus,
)
from .normalize import extract_features
from .questions import equipment_question, next_question
from .ranking import rank
from .retrieval import CaseIndex
from .similarity import TextSimilarity, default_similarity
from .taxonomy import TAXONOMY_VERSION, all_causes, get_cause, is_known_cause


class _Corpus:
    """Labelled corpus and search index, built once on first use."""

    def __init__(
        self,
        extractor: LabelExtractor | None = None,
        similarity: TextSimilarity | None = None,
    ) -> None:
        extractor = extractor or default_extractor()
        self.cases: list[Case] = list(sample_cases())
        self.labels: dict[str, CaseLabel] = {
            case.case_id: label_case(case, extractor) for case in self.cases
        }
        self.index = CaseIndex(
            self.cases, self.labels, similarity=similarity or default_similarity()
        )
        self.case_by_id = {case.case_id: case for case in self.cases}
        families: dict[str, set[str]] = {}
        for case in self.cases:
            families.setdefault(case.equipment_family, set()).add(case.equipment_type)
        self.catalogue: Catalogue = {
            family: tuple(sorted(types)) for family, types in sorted(families.items())
        }


_corpus: _Corpus | None = None
_build_lock = threading.Lock()


def corpus() -> _Corpus:
    """The labelled corpus and its index, built on first use rather than at import.

    Sync routes run on a threadpool, so the first few requests arrive together: without the
    lock each one labels and embeds the whole corpus, and every one of those is billed.
    """
    global _corpus
    if _corpus is None:
        with _build_lock:
            if _corpus is None:
                _corpus = _Corpus()
    return _corpus


def set_corpus(replacement: _Corpus) -> None:
    """Install a corpus built with a chosen extractor, before anything reads one."""
    global _corpus
    _corpus = replacement


# STUB: sessions live in a module dict. Production is DynamoDB with an 8h TTL.
_sessions: dict[str, Session] = {}

# Every event this session has emitted, and every listener currently attached. A single queue
# would make the stream single-consumer: a reload, a second tab or a flaky connection would
# each take half the events and neither would show the whole story.
_events: dict[str, list[dict[str, Any]]] = {}
_subscribers: dict[str, set[asyncio.Queue[dict[str, Any]]]] = {}

_loop: asyncio.AbstractEventLoop | None = None


@asynccontextmanager
async def _lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Capture the running loop so worker threads can publish SSE events."""
    global _loop
    _loop = asyncio.get_running_loop()
    yield
    _loop = None


def _expire_sessions(now: datetime) -> None:
    """Drop sessions created more than SESSION_TTL_SECONDS ago, and their event logs."""
    cutoff = now - timedelta(seconds=SESSION_TTL_SECONDS)
    stale = [sid for sid, s in _sessions.items() if s.created_at < cutoff]
    for sid in stale:
        _sessions.pop(sid, None)
        _events.pop(sid, None)
        _subscribers.pop(sid, None)


class CreateSessionRequest(BaseModel):
    """Opening a diagnosis: the free text, and the locale to answer in.

    The bounds are the API's own. The composer caps what a browser can send, which stops an
    accident; a signed-in caller posting straight at this route is bounded only here, and
    every character of it is paid for in an embed call.
    """

    description: str = Field(min_length=1, max_length=MAX_DESCRIPTION_CHARS)
    language: str = Field(default="en", max_length=8)
    equipment_family: str | None = Field(default=None, max_length=80)
    equipment_type: str | None = Field(default=None, max_length=40)


class AnswerRequest(BaseModel):
    """One answer to one question."""

    question_id: str = Field(max_length=40)
    value: str = Field(min_length=1, max_length=MAX_ANSWER_CHARS)
    language: str | None = Field(default=None, max_length=8)


class AddDetailRequest(BaseModel):
    """More of the description, once the questions have run out."""

    text: str = Field(min_length=1, max_length=MAX_ANSWER_CHARS)
    language: str | None = Field(default=None, max_length=8)


class CloseSessionRequest(BaseModel):
    """The confirmed cause, or null when the technician found none of them."""

    confirmed_cause_id: str | None = None


class EvidenceCase(BaseModel):
    """A historical case shown as evidence behind a candidate.

    Everything the case holds, not a summary of it. Someone who has opened one of these is
    checking a number against the record behind it, and the fields that settle it are the
    ones a summary drops: what the technician found, what was actually fitted, and the
    cause the labeller assigned with the spans it quoted to justify it.
    """

    case_id: str
    equipment_family: str
    equipment_type: str
    created_at: datetime
    language: str
    customer_description: str
    technician_notes: str
    parts_replaced: list[str]
    resolution_text: str | None
    cause_id: str | None
    cause_label: str | None
    outcome_status: str
    evidence_spans: list[str]


class SessionView(BaseModel):
    """Everything the screen needs after any turn."""

    session_id: str
    status: SessionStatus
    seq: int
    taxonomy_version: str
    equipment_family: str | None
    equipment_type: str | None
    equipment_basis: EquipmentBasis | None
    language: str
    description: str
    answers: dict[str, str]
    ranking: Ranking
    question: Question | None
    confirmed_cause_id: str | None
    stream_ticket: str | None = None


class LabelRow(BaseModel):
    """One row of the review queue on /cases."""

    label: CaseLabel
    equipment_family: str
    equipment_type: str
    created_at: datetime
    language: str
    customer_description: str
    technician_notes: str
    resolution_text: str | None
    parts_replaced: tuple[str, ...]
    cause_label: str | None


app = FastAPI(title="Diagnostic Assist", version=TAXONOMY_VERSION, lifespan=_lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(CORS_ALLOW_ORIGINS),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(UpstreamError)
async def _aws_unavailable(_: Request, exc: Exception) -> JSONResponse:
    """Both model calls are upstream dependencies, so their failures are 503, not 500."""
    if isinstance(exc, ModelUnavailableError):
        # Nothing is configured at all: say what to configure rather than "cannot reach".
        return JSONResponse(status_code=503, content={"detail": str(exc), "cause": "unconfigured"})
    return JSONResponse(
        status_code=503,
        content={
            "detail": (
                "The diagnosis service cannot reach Amazon Bedrock. Extraction and retrieval "
                "both run there and neither falls back, because a label nobody inferred is "
                "worse than no label. Check credentials and model access, then retry: "
                "see BEDROCK_SETUP.md."
            ),
            "cause": str(exc) or type(exc).__name__,
        },
    )


UNKNOWN_EQUIPMENT_RANKING: Final[Ranking] = Ranking(
    candidates=(),
    other_probability=1.0,
    n_similar_cases=0,
    fallback_level="global",
    degraded=True,
)


def _rank_session(session: Session, language: str | None = None) -> Ranking:
    """Rank against the corpus using the description plus every answer so far."""
    if session.equipment_family is None:
        return UNKNOWN_EQUIPMENT_RANKING
    text = session.effective_text()
    result = corpus().index.search(text, session.equipment_family, session.equipment_type)
    return rank(
        result.neighbours,
        result.fallback_level,
        language=language or session.language,
        equipment_family=session.equipment_family,
    )


def _diagnostic_questions_asked(session: Session) -> int:
    """Questions asked about the fault. The equipment question is not one of them."""
    return len([q for q in session.asked_question_ids if q != EQUIPMENT_QUESTION_ID])


def _choose_question(session: Session) -> Question | None:
    """The next question worth asking, or None if nothing clears the gain floor."""
    if session.status is SessionStatus.CLOSED:
        return None
    if session.equipment_family is None:
        guess = resolve_equipment(session.description, corpus().catalogue)
        return equipment_question(corpus().catalogue, guess.matched_families)
    if _diagnostic_questions_asked(session) >= MAX_QUESTIONS_PER_SESSION:
        return None
    text = session.effective_text()
    result = corpus().index.search(text, session.equipment_family, session.equipment_type)
    return next_question(
        ranking=rank(
            result.neighbours,
            result.fallback_level,
            language=session.language,
            equipment_family=session.equipment_family,
        ),
        neighbours=result.neighbours,
        session_features=extract_features(text),
        already_asked=session.asked_question_ids,
    )


def _view(session: Session, language: str | None = None) -> SessionView:
    """The whole session state, rendered in `language` if one is asked for."""
    ranking = _rank_session(session, language)
    question = session.pending_question
    return SessionView(
        session_id=session.session_id,
        status=session.status,
        seq=session.seq,
        taxonomy_version=TAXONOMY_VERSION,
        equipment_family=session.equipment_family,
        equipment_type=session.equipment_type,
        equipment_basis=session.equipment_basis,
        language=language or session.language,
        description=session.description,
        answers=dict(session.answers),
        ranking=ranking,
        question=question,
        confirmed_cause_id=session.confirmed_cause_id,
        # Minted on every view, so a reload can open the stream without a second round trip.
        stream_ticket=issue_stream_ticket(session.session_id),
    )


def _emit(session: Session, event: str, data: dict[str, Any]) -> None:
    """Record one SSE event and hand it to every listener, stamped with its sequence number."""
    session.seq += 1
    payload: dict[str, Any] = {
        "event": event,
        "seq": session.seq,
        "taxonomy_version": TAXONOMY_VERSION,
        **data,
    }
    log = _events.get(session.session_id)
    if log is None:
        return
    log.append(payload)

    queues = list(_subscribers.get(session.session_id, ()))
    if not queues:
        return
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        if _loop is not None:
            for queue in queues:
                _loop.call_soon_threadsafe(queue.put_nowait, payload)
            return
    for queue in queues:
        queue.put_nowait(payload)


def _publish(session: Session, candidates_event: str) -> SessionView:
    """Recompute, then push the whole story: candidates, degradation, next step."""
    session.pending_question = _choose_question(session)
    view = _view(session)
    _emit(session, candidates_event, {"ranking": view.ranking.model_dump(mode="json")})
    if view.ranking.degraded:
        _emit(
            session,
            "degraded",
            {
                "reason": (
                    "no_similar_cases" if view.ranking.n_similar_cases == 0 else "thin_evidence"
                ),
                "n_similar_cases": view.ranking.n_similar_cases,
                "fallback_level": view.ranking.fallback_level,
            },
        )
    if view.question is not None:
        session.asked_question_ids.append(view.question.question_id)
        _emit(session, "question", {"question": view.question.model_dump(mode="json")})
    else:
        _emit(session, "done", {"reason": "no_more_questions"})
    view.seq = session.seq
    return view


def _require_session(session_id: str) -> Session:
    """Fetch a live session, or 404. Expiry is checked here, not only when one is created."""
    _expire_sessions(datetime.now(UTC))
    session = _sessions.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="session not found")
    return session


_bearer = HTTPBearer(auto_error=False)


def current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> User:
    """The caller, or 401. Applied to every route that reads or writes case data."""
    if credentials is None:
        raise HTTPException(status_code=401, detail="not authenticated")
    user = user_from_token(credentials.credentials)
    if user is None:
        raise HTTPException(status_code=401, detail="invalid or expired token")
    return user


class LoginRequest(BaseModel):
    """Username and password."""

    username: str = Field(max_length=200)
    password: str = Field(max_length=200)


class LoginResponse(BaseModel):
    """The signed token and the account it belongs to."""

    token: str
    user: User


@app.post("/auth/login", response_model=LoginResponse)
def login(body: LoginRequest) -> LoginResponse:
    """Exchange a username and password for a token."""
    user = authenticate(body.username, body.password)
    if user is None:
        raise HTTPException(status_code=401, detail="wrong username or password")
    return LoginResponse(token=issue_token(user), user=user)


CurrentUser = Annotated[User, Depends(current_user)]


@app.get("/auth/me", response_model=User)
def me(user: CurrentUser) -> User:
    """Who the held token says you are."""
    return user


class UpdateProfileRequest(BaseModel):
    """A new display name. Stripped before it is measured, so "   " is empty, not valid."""

    name: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)
    ]


class ChangePasswordRequest(BaseModel):
    """Current password, and the one to replace it with."""

    current_password: str = Field(max_length=200)
    new_password: str = Field(min_length=MIN_PASSWORD_LENGTH, max_length=200)


@app.patch("/auth/me", response_model=User)
def update_me(body: UpdateProfileRequest, user: CurrentUser) -> User:
    """Change the signed-in user's display name."""
    updated = update_profile(user.username, body.name)
    if updated is None:
        raise HTTPException(status_code=404, detail="no such user")
    return updated


@app.post("/auth/password", response_model=LoginResponse)
def set_password(body: ChangePasswordRequest, user: CurrentUser) -> LoginResponse:
    """Change the password, and hand back a fresh token."""
    if not change_password(user.username, body.current_password, body.new_password):
        raise HTTPException(status_code=401, detail="wrong current password")
    return LoginResponse(token=issue_token(user), user=user)


def _stated_equipment(body: CreateSessionRequest) -> EquipmentGuess | None:
    """The machine the caller named, if it named one the corpus holds."""
    family = body.equipment_family
    if family is None or family not in corpus().catalogue:
        return None
    equipment_type = body.equipment_type
    if equipment_type is not None and equipment_type not in corpus().catalogue[family]:
        equipment_type = None
    return EquipmentGuess(
        family=family,
        equipment_type=equipment_type,
        basis=EquipmentBasis.STATED,
        matched_families=(family,),
    )


@app.post("/sessions", response_model=SessionView)
def create_session(body: CreateSessionRequest, user: CurrentUser) -> SessionView:
    """Start a diagnosis from one free-text description."""
    now = datetime.now(UTC)
    _expire_sessions(now)
    guess = _stated_equipment(body) or resolve_equipment(body.description, corpus().catalogue)
    session = Session(
        session_id=str(uuid.uuid4()),
        equipment_family=guess.family,
        equipment_type=guess.equipment_type,
        equipment_basis=guess.basis,
        language=body.language,
        description=body.description,
        created_at=now,
    )
    _sessions[session.session_id] = session
    _events[session.session_id] = []
    _subscribers[session.session_id] = set()
    return _publish(session, "candidates.initial")


@app.get("/sessions/{session_id}", response_model=SessionView)
def get_session(session_id: str, user: CurrentUser, language: str | None = None) -> SessionView:
    """Current state without the stream."""
    session = _require_session(session_id)
    return _view(session, language)


@app.post("/sessions/{session_id}/answers", response_model=SessionView)
def submit_answer(session_id: str, body: AnswerRequest, user: CurrentUser) -> SessionView:
    """Record an answer. Idempotent by question_id."""
    session = _require_session(session_id)
    if session.status is SessionStatus.CLOSED:
        raise HTTPException(status_code=409, detail="session is closed")
    if body.question_id not in session.asked_question_ids:
        raise HTTPException(status_code=422, detail="unknown question for this session")

    if session.answers.get(body.question_id) == body.value:
        return _view(session)

    pending = session.pending_question
    if (
        pending
        and pending.question_id != body.question_id
        and pending.question_id not in session.answers
    ):
        session.asked_question_ids.remove(pending.question_id)

    if body.language is not None:
        session.language = body.language
    session.answers[body.question_id] = body.value
    if body.question_id == EQUIPMENT_QUESTION_ID:
        _apply_equipment_answer(session, body.value)
    session.pending_question = None
    return _publish(session, "candidates.updated")


def _apply_equipment_answer(session: Session, value: str) -> None:
    """Set the machine from the answer to the equipment question."""
    guess = resolve_equipment(value, corpus().catalogue)
    if not guess.resolved:
        session.answers.pop(EQUIPMENT_QUESTION_ID, None)
        if EQUIPMENT_QUESTION_ID in session.asked_question_ids:
            session.asked_question_ids.remove(EQUIPMENT_QUESTION_ID)
        return
    session.equipment_family = guess.family
    session.equipment_type = guess.equipment_type
    session.equipment_basis = EquipmentBasis.STATED


@app.post("/sessions/{session_id}/details", response_model=SessionView)
def add_detail(session_id: str, body: AddDetailRequest, user: CurrentUser) -> SessionView:
    """Add to the description and re-rank, without starting again.

    The alternative the screen used to take -- concatenate and open a new session -- threw
    away the answers already given, handed back a fresh budget of three questions, and left
    the old session in memory with nobody reading it. What someone types after the questions
    run out is more description, so it goes on the description.
    """
    session = _require_session(session_id)
    if session.status is SessionStatus.CLOSED:
        raise HTTPException(status_code=409, detail="session is closed")

    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=422, detail="empty detail")
    if len(session.description) + len(text) + 2 > MAX_DESCRIPTION_CHARS:
        raise HTTPException(status_code=422, detail="description would be too long")

    pending = session.pending_question
    if pending and pending.question_id not in session.answers:
        # It was offered and answered with prose instead. It was never answered, so it must
        # not count against the three, and it stays available to be asked again.
        session.asked_question_ids.remove(pending.question_id)

    if body.language is not None:
        session.language = body.language
    session.description = f"{session.description}; {text}"
    if session.equipment_family is None:
        # The new text may name the machine the first description did not.
        guess = resolve_equipment(session.description, corpus().catalogue)
        if guess.resolved:
            session.equipment_family = guess.family
            session.equipment_type = guess.equipment_type
            session.equipment_basis = guess.basis
    session.pending_question = None
    return _publish(session, "candidates.updated")


@app.post("/sessions/{session_id}/close", response_model=SessionView)
def close_session(session_id: str, body: CloseSessionRequest, user: CurrentUser) -> SessionView:
    """Close the session with what the cause actually was."""
    session = _require_session(session_id)
    if session.status is SessionStatus.CLOSED:
        raise HTTPException(status_code=409, detail="session is already closed")
    if body.confirmed_cause_id is not None and not is_known_cause(body.confirmed_cause_id):
        raise HTTPException(
            status_code=422,
            detail=f"unknown cause_id {body.confirmed_cause_id!r} for taxonomy {TAXONOMY_VERSION}",
        )
    session.status = SessionStatus.CLOSED
    session.confirmed_cause_id = body.confirmed_cause_id
    session.pending_question = None
    _emit(session, "done", {"reason": "closed", "confirmed_cause_id": body.confirmed_cause_id})
    view = _view(session)
    view.seq = session.seq
    return view


@app.get("/sessions/{session_id}/events")
async def stream_events(session_id: str, ticket: str, request: Request) -> EventSourceResponse:
    """The SSE channel for one session.

    EventSource cannot set headers, so whatever authorises this lands in every access log.
    That is a ticket rather than the bearer token: sixty seconds, bound to this session id,
    and useless on any other route.

    The session's whole event log is replayed from `Last-Event-ID` before live events are
    fanned out, so a reload or a dropped connection shows the same story rather than half of
    it, and a second listener does not steal events from the first.
    """
    if not stream_ticket_is_valid(session_id, ticket):
        raise HTTPException(status_code=401, detail="invalid or expired stream ticket")
    _require_session(session_id)
    last_seen = int(request.headers.get("last-event-id") or 0)

    async def generator() -> AsyncIterator[dict[str, Any]]:
        """Replay what this listener has not seen, then follow along live."""
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        _subscribers.setdefault(session_id, set()).add(queue)
        try:
            for payload in list(_events.get(session_id, ())):
                if payload["seq"] <= last_seen:
                    continue
                event = dict(payload)
                name = event.pop("event")
                yield {"event": name, "id": str(payload["seq"]), "data": json.dumps(event)}
                if name == "done":
                    return
            while True:
                try:
                    payload = await asyncio.wait_for(queue.get(), timeout=SSE_KEEPALIVE_SECONDS)
                except TimeoutError:
                    yield {"event": "ping", "data": "{}"}
                    continue
                event = dict(payload)
                name = event.pop("event")
                yield {"event": name, "id": str(payload["seq"]), "data": json.dumps(event)}
                if name == "done":
                    return
        finally:
            _subscribers.get(session_id, set()).discard(queue)

    return EventSourceResponse(generator())


@app.get("/cases", response_model=list[LabelRow])
def list_cases(
    user: CurrentUser, language: Annotated[str, Query(max_length=8)] = "en"
) -> list[LabelRow]:
    """Every labelled case, for the review page, with cause names in the caller's language."""
    rows: list[LabelRow] = []
    for case in corpus().cases:
        label = corpus().labels[case.case_id]
        cause = get_cause(label.cause_id) if label.cause_id else None
        rows.append(
            LabelRow(
                label=label,
                equipment_family=case.equipment_family,
                equipment_type=case.equipment_type,
                created_at=case.created_at,
                language=case.language,
                customer_description=case.customer_description,
                technician_notes=case.technician_notes,
                resolution_text=case.resolution_text,
                parts_replaced=case.parts_replaced,
                cause_label=cause.label(language) if cause else None,
            )
        )
    return rows


@app.get("/cases/{case_id}", response_model=EvidenceCase)
def get_case(case_id: str, user: CurrentUser, language: str = "en") -> EvidenceCase:
    """One historical case, for when the user taps an evidence case id."""
    case = corpus().case_by_id.get(case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="case not found")
    label = corpus().labels.get(case_id)
    cause = get_cause(label.cause_id) if label and label.cause_id else None
    return EvidenceCase(
        case_id=case.case_id,
        equipment_family=case.equipment_family,
        equipment_type=case.equipment_type,
        created_at=case.created_at,
        language=case.language,
        customer_description=case.customer_description,
        technician_notes=case.technician_notes,
        parts_replaced=list(case.parts_replaced),
        resolution_text=case.resolution_text,
        cause_id=label.cause_id if label else None,
        cause_label=cause.label(language) if cause else None,
        outcome_status=label.outcome_status.value if label else "UNKNOWN",
        evidence_spans=list(label.evidence_spans) if label else [],
    )


@app.get("/equipment")
def list_equipment(user: CurrentUser) -> dict[str, list[str]]:
    """Families and their types. Not called by this frontend, which asks the scope question
    instead of showing a picker; it is here for a client that wants the catalogue."""
    families: dict[str, set[str]] = {}
    for case in corpus().cases:
        families.setdefault(case.equipment_family, set()).add(case.equipment_type)
    return {family: sorted(types) for family, types in sorted(families.items())}


@app.get("/taxonomy")
def get_taxonomy(user: CurrentUser) -> dict[str, Any]:
    """The whole cause catalogue with its version. Not called by this frontend, which reads
    localised labels off each ranking; it is here for a client that renders its own."""
    return {
        "taxonomy_version": TAXONOMY_VERSION,
        "causes": [cause.model_dump(mode="json") for cause in all_causes()],
    }
