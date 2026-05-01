from fastapi import FastAPI
from pydantic import BaseModel
import os
from dotenv import load_dotenv
from supabase import create_client, Client


load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLEKEY")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

#create client
supabase: Client = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI()

class ChatRequestBase(BaseModel):
  company_id : str
  user_message: str


@app.get("/")
def read_root():
  return {"message" : "Test run backend", "supabase_connected": supabase is not None}

@app.post("/api/chat")
def handle_chat(request: ChatRequestBase):
  return {
    "status": "success",
    "company_selected": request.company_id,
    "reply": f"Natanggap ko ang message mo: '{request.user_message}'"
  }
