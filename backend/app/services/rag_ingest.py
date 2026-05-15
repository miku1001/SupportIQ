import os
from dotenv import load_dotenv
from supabase import create_client
from langchain_text_splitters import RecursiveCharacterTextSplitter
import requests


load_dotenv()
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

def normalize_text(text: str) -> str:
    # Light cleanup for PDF artifacts and excessive whitespace
    cleaned = "\n".join(line.strip() for line in text.splitlines())
    cleaned = "\n".join(line for line in cleaned.splitlines() if line)
    return cleaned

# store and process data document
def process_and_store_document(company_id: str, document_text: str, upload_id: str | None = None, filename: str | None = None):
    print(f"Chuning document for {company_id}...")
    normalized_text = normalize_text(document_text)
    splitter = RecursiveCharacterTextSplitter(chunk_size=900, chunk_overlap=180)
    chunks = splitter.split_text(normalized_text)

    for chunk in chunks:
        print(f"Pino-proseso at isine-save: {chunk[:30]}...")
        
        vector = get_openrouter_embedding(chunk)
        
        payload = {
            "company_id": company_id,
            "content": chunk,
            "embedding": vector,
        }
        if upload_id:
            payload["upload_id"] = upload_id
        if filename:
            payload["source_filename"] = filename

        supabase.table("document_chunks").insert(payload).execute()

    return {
        "status":"success",
        "message": f"{len(chunks)} chunks saved for {company_id}."
    }