import os
from dotenv import load_dotenv
from supabase import create_client
from langchain_text_splitters import RecursiveCharacterTextSplitter


# 1. Buksan ang vault at kunin ang keys
load_dotenv()
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLEKEY"))

_embeddings_model = None

def get_embeddings_model():
    global _embeddings_model
    if _embeddings_model is None:
        # Lazy load to avoid blocking app startup in hosting environments.
        from langchain_huggingface import HuggingFaceEmbeddings
        print("Loading AI Embedding model...")
        _embeddings_model = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
    return _embeddings_model

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
        
        vector = get_embeddings_model().embed_query(chunk)
        
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