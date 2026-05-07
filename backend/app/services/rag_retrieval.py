import os
from supabase import create_client
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_openrouter import ChatOpenRouter
from langchain_core.prompts import ChatPromptTemplate
import time
from openrouter import errors as openrouter_errors
# from functools import lru_cache

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLEKEY"))
embeddings_model = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

model = ChatOpenRouter(
  model="gpt-4.1-mini",
  temperature=0.4,          # keep answers natural but grounded
  top_p=0.9,                # mas controlled kaysa top_k lang
  max_completion_tokens=300,
  frequency_penalty=0.2,    # iwas ulit-ulit
  presence_penalty=0.0
)

# @lru_cache(maxsize=128)
def generate_response(company_id: str, user_message: str):
  print(f"User: {user_message}")

  query_vector = embeddings_model.embed_query(user_message)

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

  chain = prompt_template | model

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