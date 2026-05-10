"""Video işleme endpoint'leri."""
from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from pydantic import BaseModel, Field

from services.video_processor import process_video

router = APIRouter()


class ProcessRequest(BaseModel):
    video_id: str = Field(..., description="MatchVideo.id (CUID)")
    file_path: str = Field(..., description="Sunucudaki video dosya yolu")
    match_id: str = Field(..., description="Match.id")


class ProcessResponse(BaseModel):
    video_id: str
    status: str


@router.post("/process", response_model=ProcessResponse)
async def start_processing(
    payload: ProcessRequest,
    background_tasks: BackgroundTasks,
    request: Request,
) -> ProcessResponse:
    """Video işleme job'unu arka planda başlatır."""
    broadcast = request.app.state.broadcast_progress

    async def _run() -> None:
        try:
            await process_video(
                video_id=payload.video_id,
                file_path=payload.file_path,
                match_id=payload.match_id,
                progress_cb=broadcast,
            )
        except Exception as exc:
            await broadcast(payload.video_id, {"status": "error", "message": str(exc)})

    background_tasks.add_task(_run)
    return ProcessResponse(video_id=payload.video_id, status="processing")


@router.get("/status/{video_id}")
async def get_status(video_id: str) -> dict:
    # NOT: Gerçek durum Next.js DB'sinde tutuluyor.
    # Bu endpoint canlı progress için fallback (WS yoksa).
    raise HTTPException(status_code=501, detail="Status için /ws/video/{video_id} kullanın")
