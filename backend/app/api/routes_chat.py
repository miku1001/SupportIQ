from fastapi import APIRouter
from pydantic import BaseModel
from app.services.rag_retrieval import generate_response

router = APIRouter()

class ChatRequest(BaseModel):
  company_id: str
  user_message: str


@router.post("/api/chat")
def handle_message(request:ChatRequest):
  ai_reply = generate_response(request.company_id, request.user_message)

  return {
    "status": "success",
    "company_id": request.company_id,
    "reply": ai_reply

  }
