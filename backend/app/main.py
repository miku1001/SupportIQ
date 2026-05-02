from fastapi import FastAPI, HTTPException
import os
from dotenv import load_dotenv
from supabase import create_client, Client

#CORS
from fastapi.middleware.cors import CORSMiddleware

#upload route
from app.api.routes_upload import router as upload_router
from app.api.routes_chat import router as chat_router
from app.api.routes_company import router as company_router


load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLEKEY")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

#create client
supabase: Client = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI()
app.include_router(upload_router)
app.include_router(chat_router)
app.include_router(company_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"], # Payagan ang lahat (GET, POST, etc.)
    allow_headers=["*"], # Payagan ang lahat ng data
)

@app.get("/")
def read_root():
  return {"message" : "Test run backend", "supabase_connected": supabase is not None}

# @app.post("/api/chat")
# def handle_chat(request: ChatRequestBase):
#   return {
#     "status": "success",
#     "company_selected": request.company_id,
#     "reply": f"Natanggap ko ang message mo: '{request.user_message}'"
#   }