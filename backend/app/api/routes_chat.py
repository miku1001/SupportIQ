import time
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from app.services.rag_retrieval import generate_response, FALLBACK_MESSAGE
from app.services.rate_limit import allow

router = APIRouter()

CHAT_MEMORY = {}
MAX_TURNS = 8

# Simpleng in-memory metric: ilan ang nasagot vs kabuuan (deflection rate)
CHAT_STATS = {"answered": 0, "total": 0}


class ChatRequest(BaseModel):
  company_id: str
  user_message: str


@router.post("/api/chat")
def handle_message(request:ChatRequest, raw_request: Request):

  device_id = raw_request.headers.get("x-device-id")
  ip = raw_request.headers.get("x-forwarded-for", raw_request.client.host)
  key = f"chat:user:{device_id or ip}"

  if not allow(key, max_req=20, window_seconds=60):
    raise HTTPException(status_code=429, detail="Rate limit exceeded.")

  device_key = device_id or ip
  history = CHAT_MEMORY.get(device_key, [])

  start = time.perf_counter()
  ai_reply = generate_response(request.company_id, request.user_message, history)
  elapsed_ms = (time.perf_counter() - start) * 1000

  # Metric: nasagot ba mula sa docs, o napunta sa fallback? (errors hindi bilang sagot)
  is_error = ai_reply.startswith(("AI error:", "Provider rate limit"))
  answered = (not is_error) and (ai_reply != FALLBACK_MESSAGE)
  CHAT_STATS["total"] += 1
  if answered:
    CHAT_STATS["answered"] += 1
  rate = CHAT_STATS["answered"] / CHAT_STATS["total"] * 100
  print(
    f"[chat] company={request.company_id} answered={answered} {elapsed_ms:.0f}ms"
    f"  | rate: {CHAT_STATS['answered']}/{CHAT_STATS['total']} ({rate:.0f}%)"
  )

  history.append({"role": "user", "content": request.user_message})
  history.append({"role": "assistant", "content": ai_reply})
  CHAT_MEMORY[device_key] = history[-(MAX_TURNS * 2):]

  return {
    "status": "success",
    "company_id": request.company_id,
    "reply": ai_reply

  }
