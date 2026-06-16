import os
import time
import requests
from supabase import create_client
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from openrouter import errors as openrouter_errors
import json
# from functools import lru_cache

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLEKEY"))
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_EMBEDDING_MODEL = os.getenv("OPENROUTER_EMBEDDING_MODEL", "text-embedding-3-small")
OPENROUTER_SITE_URL = os.getenv("OPENROUTER_SITE_URL")
OPENROUTER_APP_NAME = os.getenv("OPENROUTER_APP_NAME")

def get_openrouter_embedding(text: str):
  if not OPENROUTER_API_KEY:
    raise RuntimeError("Missing OPENROUTER_API_KEY for embeddings.")

  headers = {
    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
    "Content-Type": "application/json",
  }
  if OPENROUTER_SITE_URL:
    headers["HTTP-Referer"] = OPENROUTER_SITE_URL
  if OPENROUTER_APP_NAME:
    headers["X-Title"] = OPENROUTER_APP_NAME

  payload = {
    "model": OPENROUTER_EMBEDDING_MODEL,
    "input": text,
  }

  response = requests.post("https://openrouter.ai/api/v1/embeddings", headers=headers, json=payload, timeout=30)
  response.raise_for_status()
  data = response.json()
  return data["data"][0]["embedding"]

_chat_model = None

def get_chat_model():
  global _chat_model
  if _chat_model is None:
    # Lazy load to avoid blocking app startup in hosting environments.
    from langchain_openrouter import ChatOpenRouter
    _chat_model = ChatOpenRouter(
      model="gpt-4.1-mini",
      temperature=0.4,       
      top_p=0.9,              
      max_completion_tokens=300,
      frequency_penalty=0.2,
      presence_penalty=0.0
    )
  return _chat_model

# @lru_cache(maxsize=128)
def _get_last_user_message(history):
  for message in reversed(history):
    if message.get("role") == "user" and message.get("content"):
      return message["content"]
  return None


def generate_response(company_id: str, user_message: str, history=None):
  print(f"User: {user_message}")

  history = history or []
  last_user_message = _get_last_user_message(history)
  search_query = user_message
  if last_user_message and user_message:
    search_query = f"{last_user_message}\nFollow-up: {user_message}"

  query_vector = get_openrouter_embedding(search_query)

  try:
    response = supabase.rpc("match_documents_hybrid", {
          "query_embedding": query_vector,
          "query_text": search_query,
          "match_threshold": 0.25,
          "match_count": 12,
          "p_company_id": company_id
      }).execute()
  except Exception:
    response = supabase.rpc("match_documents", {
          "query_embedding": query_vector,
          "match_threshold": 0.3, 
          "match_count": 10,
          "p_company_id": company_id
      }).execute()

  found_text = response.data

  fallback_message = "Sorry, I don't have exact info to your inquiries."

  if not found_text:
    return fallback_message

  context = "\n\n".join(doc["content"] for doc in found_text)
  
  prompt_template = ChatPromptTemplate.from_messages([
      ("system", """You are a helpful, concise assistant. Use ONLY the provided context.

  RULES:
  - Answer ONLY if the answer is clearly supported by the context.
  - You may paraphrase, but do NOT add new facts.
  - If the context is partial or unclear, ask one short follow-up question.
  - If the context does not contain the answer, reply EXACTLY: "Sorry, I don't have exact info to your inquiries."
  - IMPORTANT: Reply in the same language as the user's question.
  - Keep answers short and natural (1-2 sentences).

  <context>
  {context}
  </context>

  You are NOT a general assistant. You are NOT a calculator. You are NOT a summarizer."""),
      MessagesPlaceholder("history"),
      ("user", "User Query: {question}")
    ])

  chain = prompt_template | get_chat_model()

  # Invoke model with retries/backoff for rate-limit (429) errors
  max_retries = 3
  backoff = 1
  for attempt in range(max_retries):
    try:
      ai_response = chain.invoke({
        "context": context,
        "question": user_message,
        "history": history
      })
      return ai_response.content
    except openrouter_errors.TooManyRequestsResponseError:
      if attempt < max_retries - 1:
        time.sleep(backoff)
        backoff *= 2
        continue
      return "Provider rate limit reached; please try again later."
    except Exception as e:
      return f"AI error: {e}"
  
def _safe_parse_questions(raw: str) -> str:
  try:
    items = raw.split(",")
    return items
  except Exception:
    return []

#Fallback
DEFAULT_QUESTIONS = [
    "What services do you offer?",
    "What are your business hours?",
    "Where are you located?",
    "How can I contact you?",
]
def generate_suggested_questions(company_id: str) -> str:
  try:
    response = (supabase.table("document_chunks").select("content").eq("company_id", company_id).limit(25).execute())
  except Exception:
    return DEFAULT_QUESTIONS
  
  chunks = response.data or []
  if not chunks:
    return DEFAULT_QUESTIONS
  
  context = "\n\n".join(c["content"] for c in chunks)


  prompt_template = ChatPromptTemplate.from_messages([
    ("system", """You generate starter questions for a company's support chatbot.

  Based ONLY on the provided company documents, write the 4 most useful questions a
  customer would likely ask AND that can be confidently answered from these documents.

  RULES:
  - Output ONLY a array with comma seperated of exactly 4 short question strings. No extra text, no markdown.
  - Each question MUST be answerable from the context below.
  - Keep each question under 8 words, natural and customer-facing.
  - Write the questions in English.

  Example output:
  "What are your opening hours?", "Do you offer delivery?", "Where are you located?", "What payment methods do you accept?"

  <context>
  {context}
  </context>"""),
    ])
  
  chain = prompt_template | get_chat_model()

  try:
    ai_response = chain.invoke({"context": context})
    questions= _safe_parse_questions(ai_response.content)
    return questions

  except Exception:
    return DEFAULT_QUESTIONS