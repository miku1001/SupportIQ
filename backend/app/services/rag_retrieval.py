import os
import time
import requests
from supabase import create_client
from langchain_core.prompts import ChatPromptTemplate
from openrouter import errors as openrouter_errors
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
      temperature=0.4,          # keep answers natural but grounded
      top_p=0.9,                # mas controlled kaysa top_k lang
      max_completion_tokens=300,
      frequency_penalty=0.2,    # iwas ulit-ulit
      presence_penalty=0.0
    )
  return _chat_model

# @lru_cache(maxsize=128)
def generate_response(company_id: str, user_message: str):
  print(f"User: {user_message}")

  query_vector = get_openrouter_embedding(user_message)

  try:
    response = supabase.rpc("match_documents_hybrid", {
          "query_embedding": query_vector,
          "query_text": user_message,
          "match_threshold": 0.25,
          "match_count": 12,
          "p_company_id": company_id
      }).execute()
  except Exception:
    response = supabase.rpc("match_documents", {
          "query_embedding": query_vector,
          "match_threshold": 0.3, # Gaano ka-strict (0 to 1). 0.3 is good for basic matching.
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
        "question": user_message
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