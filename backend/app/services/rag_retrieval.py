import os
from supabase import create_client
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_openrouter import ChatOpenRouter
from langchain_core.prompts import ChatPromptTemplate
import time
from openrouter import errors as openrouter_errors
from functools import lru_cache

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLEKEY"))
embeddings_model = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

model = ChatOpenRouter(
    model="gpt-4o-mini",
    temperature=0.2,          # less hallucination
    top_p=0.9,                # mas controlled kaysa top_k lang
    max_completion_tokens=100,
    frequency_penalty=0.2,    # iwas ulit-ulit
    presence_penalty=0.0
)

@lru_cache(maxsize=128)
def generate_response(company_id: str, user_message: str):
  print(f"User: {user_message}")

  query_vector = embeddings_model.embed_query(user_message)

  response = supabase.rpc("match_documents", {
        "query_embedding": query_vector,
        "match_threshold": 0.3, # Gaano ka-strict (0 to 1). 0.3 is good for basic matching.
        "match_count": 3,     
        "p_company_id": company_id
    }).execute()

  found_text = response.data

  if not found_text:
    context = "No context found in database"
  else:
    context = "\n\n".join(doc['content'] for doc in found_text)
  
  prompt_template = ChatPromptTemplate.from_messages([
      ("system", """You are a polite and intelligent customer support agent.

  Use ONLY the information from the CONTEXT below to answer the user's question.

  Strict rules:
  - DO NOT use prior knowledge
  - DO NOT make up answers
  - If the answer is not in the context, respond exactly with:
    "I'm sorry, I cannot find the answer in the provided information. I will refer you to a human agent."

  - Keep your answer concise, clear, and direct.

  CONTEXT:
  {context}
  """),
      ("user", "{question}")
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