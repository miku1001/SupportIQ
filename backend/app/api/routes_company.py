import os
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from supabase import create_client
from app.services.rag_retrieval import generate_suggested_questions

router = APIRouter()
supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_ROLEKEY")
)

# Columns safe to expose on public, unauthenticated endpoints.
# Never include user_id or other internal fields here.
PUBLIC_COMPANY_FIELDS = "id, name, location, initials, description"

class CompanyPayload(BaseModel):
    id: Optional[str] = None  # e.g., "company_789"
    user_id: Optional[str] = None
    name: str                 # e.g., "FastBurger"
    location: str             # e.g., "Manila"
    initials: str             # e.g., "FB"
    description: str          # e.g., "Fast food chain"


@router.get("/api/companies")
def get_companies():
    try:
        response = supabase.table("companies").select(PUBLIC_COMPANY_FIELDS).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/companies/{company_id}")
def get_company(company_id: str):
    try:
        response = supabase.table("companies").select('*').eq('id', company_id).execute()

        if not response.data:
            raise HTTPException(status_code=404, detail="Company not found")

        return response.data[0]

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Add company
@router.post('/api/companies')
def add_company(company: CompanyPayload):
    try:
        response = supabase.table('companies').insert(
            company.dict(exclude_none=True)
        ).execute()

        return {
            'status': 'success',
            'message': 'Company added!',
            'response': response.data
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Edit company
@router.put('/api/companies/{company_id}')
def edit_company(company_id: str, company: CompanyPayload):
    try:
        response = supabase.table('companies').update({
            'name': company.name,
            'location': company.location,
            'initials': company.initials,
            'description': company.description
        }).eq('id', company_id).execute()

        if not response.data:
            raise HTTPException(status_code=404, detail="Company not found")

        return {
            'status': 'success',
            'message': 'Company updated!',
            'response': response.data
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Delete company
@router.delete('/api/companies/{company_id}')
def delete_company(company_id: str):
    try:
        response = supabase.table('companies').delete().eq('id', company_id).execute()

        if not response.data:
            raise HTTPException(status_code=404, detail="Company not found")

        return {
            'status': 'success',
            'message': f'Company {company_id} deleted!'
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/companies/by-user/{user_id}")
def get_company_by_user(user_id: str):
    try:
        response = (
            supabase.table("companies")
            .select('*')
            .eq('user_id', user_id)
            .limit(1)
            .execute()
        )

        if not response.data:
            raise HTTPException(status_code=404, detail="Company not found")

        return response.data[0]

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@router.get('/api/companies/{company_id}/suggested-questions')
def suggested_questions(company_id: str) ->str:
    try:
        questions = generate_suggested_questions(company_id)
        return questions
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))