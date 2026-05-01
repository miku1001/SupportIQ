import os
from dotenv import load_dotenv
from supabase import create_client
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter


# 1. Buksan ang vault at kunin ang keys
load_dotenv()
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLEKEY"))

# 2. I-setup ang Hugging Face (Ito yung magko-convert ng words to numbers)
# Note: Sa unang run, magda-download ito ng model file sa laptop mo kaya medyo matagal ng konti.
print("Naghahanda ng AI Embedding model...")
embeddings_model = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

#store and process data document
def process_and_store_document(company_id:str, document_text:str):
    print(f"Chuning document for {company_id}...")
    splitter = RecursiveCharacterTextSplitter(chunk_size=150, chunk_overlap=20)
    chunks = splitter.split_text(document_text)

    for chunk in chunks:
        print(f"Pino-proseso at isine-save: {chunk[:30]}...")
        
        vector = embeddings_model.embed_query(chunk)
        
        supabase.table("document_chunks").insert({
            "company_id": company_id,
            "content": chunk,
            "embedding": vector
        }).execute()

    return {
        "status":"success",
        "message": f"{len(chunks)} chunks saved for {company_id}."
    }