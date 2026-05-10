"""Analiz sorgulama endpoint'leri.

NOT: Analiz sonuçlarının kanonik kaynağı Next.js Prisma DB'sidir.
Bu router gelecekte gerekirse ham analiz JSON'ını döner.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

router = APIRouter()


@router.get("/{video_id}")
async def get_analysis(video_id: str) -> dict:
    raise HTTPException(status_code=501, detail="Analiz Next.js API'sinden çekilmelidir")
