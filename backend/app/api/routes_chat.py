from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from app.services.rag_retrieval import generate_response
from app.services.rate_limit import allow

router = APIRouter()

CHAT_MEMORY = {}
MAX_TURNS = 8


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

  ai_reply = generate_response(request.company_id, request.user_message, history)

  history.append({"role": "user", "content": request.user_message})
  history.append({"role": "assistant", "content": ai_reply})
  CHAT_MEMORY[device_key] = history[-(MAX_TURNS * 2):]

  return {
    "status": "success",
    "company_id": request.company_id,
    "reply": ai_reply

  }
