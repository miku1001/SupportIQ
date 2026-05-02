import io
import os
import PyPDF2
from dotenv import load_dotenv
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Query
from supabase import create_client
from app.services.rag_ingest import process_and_store_document

load_dotenv()
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLEKEY"))

router = APIRouter()


@router.get("/api/uploads")
def list_uploads(company_id: str = Query(...)):
  try:
    response = (
      supabase.table("uploaded_files")
      .select("*")
      .eq("company_id", company_id)
      .order("created_at", desc=True)
      .execute()
    )
    return response.data
  except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))


@router.delete("/api/uploads/{upload_id}")
def delete_upload(upload_id: str, company_id: str = Query(...)):
  try:
    supabase.table("document_chunks").delete().eq("upload_id", upload_id).execute()
    response = (
      supabase.table("uploaded_files")
      .delete()
      .eq("id", upload_id)
      .eq("company_id", company_id)
      .execute()
    )
    return {
      "status": "success",
      "message": "Upload deleted.",
      "response": response.data,
    }
  except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/upload")
async def upload_document(company_id: str = Form(...), file: UploadFile = File(...)):
  print(f"file accepted from {company_id}, {file.filename}")

  extracted_text = ""

  try:
    if file.filename.endswith(".pdf"):
      # Basahin ang PDF
      pdf_bytes = await file.read()
      pdf_reader = PyPDF2.PdfReader(io.BytesIO(pdf_bytes))

      for page in pdf_reader.pages:
        extracted_text += page.extract_text() + "\n"

    elif file.filename.endswith(".txt"):
      # Basahin ang normal na text file
      text_bytes = await file.read()
      extracted_text = text_bytes.decode("utf-8")

    else:
      raise HTTPException(status_code=400, detail="PDF at TXT files lang ang pwede!")

    if not extracted_text.strip():
      raise HTTPException(status_code=400, detail="Walang text na nabasa sa file.")

    upload_response = (
      supabase.table("uploaded_files")
      .insert({"company_id": company_id, "filename": file.filename})
      .execute()
    )
    upload_row = upload_response.data[0] if upload_response.data else None
    upload_id = upload_row.get("id") if upload_row else None

    print("Passing text for ingestion///")
    result = process_and_store_document(company_id, extracted_text, upload_id, file.filename)

    return {
      "status": "success",
      "filename": file.filename,
      "upload_id": upload_id,
      "message": result["message"],
    }

  except Exception as e:
    print(f"May error: {e}")
    raise HTTPException(status_code=500, detail=str(e))