import io
import PyPDF2
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.services.rag_ingest import process_and_store_document

router = APIRouter()

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
        raise HTTPException(status_code=400, detail="PDF at TXT files lang ang pwede!")\
    
    if not extracted_text.strip():
            raise HTTPException(status_code=400, detail="Walang text na nabasa sa file.")

    print("Passing text for ingestion///")
    result = process_and_store_document(company_id, extracted_text)

    # success message
    return {
        "status": "success",
        "filename": file.filename,
        "message": result["message"]
    }

  except Exception as e:
        print(f"May error: {e}")
        raise HTTPException(status_code=500, detail=str(e))