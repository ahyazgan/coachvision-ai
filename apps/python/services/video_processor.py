"""Ana video işleme pipeline'ı.

Akış:
    1. cv2.VideoCapture ile videoyu aç
    2. Her FRAME_INTERVAL_SECONDS saniyede bir frame al
    3. YOLOv8 ile oyuncu tespiti
    4. OpenCV ile saha tespiti
    5. K-means ile takım ayrımı
    6. Bölgesel + kompaktlık + pres analizi
    7. Claude API ile maç-özeti taktik yorum (tek seferlik)
    8. Sonuçları JSON olarak kaydet ve Next.js callback'i tetikle
    9. İlerleme WebSocket ile yayınlanır
"""
from __future__ import annotations

import asyncio
import json
import os
from dataclasses import asdict
from pathlib import Path
from typing import Awaitable, Callable

import cv2
import httpx

from ai.claude_client import ask
from ai.prompts import COACH_SYSTEM_PROMPT, build_frame_analysis_prompt
from services.pitch_detector import detect_pitch
from services.player_detector import detect_players
from services.team_classifier import classify_teams
from services.zone_analyzer import FrameMetrics, compute_metrics

ProgressCb = Callable[[str, dict], Awaitable[None]]

FRAME_INTERVAL_SECONDS = int(os.getenv("FRAME_INTERVAL_SECONDS", "2"))
ANALYSIS_OUTPUT_DIR = Path(os.getenv("ANALYSIS_OUTPUT_DIR", "./uploads/analyses"))
NEXTJS_CALLBACK_URL = os.getenv("NEXTJS_CALLBACK_URL", "http://localhost:3000")


async def process_video(
    video_id: str,
    file_path: str,
    match_id: str,
    progress_cb: ProgressCb,
) -> None:
    """Bir videoyu uçtan uca işler."""
    try:
        await progress_cb(video_id, {"status": "processing", "progress": 0, "stage": "opening"})

        # Ana loop'u yakala — sync thread'den progress yollamak için gerekli
        loop = asyncio.get_running_loop()

        # Ağır iş thread'de — async loop'u bloklamasın
        result = await asyncio.to_thread(_run_pipeline_sync, video_id, file_path, progress_cb, loop)

        # Maç özeti taktik yorum (Claude)
        await progress_cb(video_id, {"status": "processing", "progress": 95, "stage": "ai_advice"})
        ai_advice = _generate_advice(result["frames"])
        result["ai_advice"] = ai_advice
        result["match_id"] = match_id
        result["video_id"] = video_id

        # JSON çıktısı
        ANALYSIS_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        out_path = ANALYSIS_OUTPUT_DIR / f"{video_id}.json"
        out_path.write_text(
            json.dumps(result, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        # Next.js'e callback (DB yazımı için)
        await _notify_nextjs(video_id, result)

        await progress_cb(video_id, {"status": "done", "progress": 100, "stage": "complete"})
    except Exception as exc:
        await progress_cb(video_id, {"status": "error", "message": str(exc)})
        raise


def _run_pipeline_sync(
    video_id: str,
    file_path: str,
    progress_cb: ProgressCb,
    loop: asyncio.AbstractEventLoop,
) -> dict:
    """Bloklayan video işleme — thread'de çalışır."""
    cap = cv2.VideoCapture(file_path)
    if not cap.isOpened():
        raise RuntimeError(f"Video açılamadı: {file_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    duration_sec = total_frames / fps if fps > 0 else 0
    step = max(1, int(fps * FRAME_INTERVAL_SECONDS))

    target_frames = max(1, total_frames // step)
    analyzed: list[dict] = []
    frame_idx = 0
    processed = 0

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            if frame_idx % step == 0:
                metrics = _analyze_frame(frame)
                analyzed.append({
                    "minute": int((frame_idx / fps) // 60),
                    "second": int((frame_idx / fps) % 60),
                    "frame_number": frame_idx,
                    "timestamp": frame_idx / fps,
                    **_metrics_to_dict(metrics),
                })
                processed += 1
                pct = min(90, int(10 + (processed / target_frames) * 80))
                # Progress'i sync thread'den async loop'a gönder
                _schedule_progress(loop, progress_cb, video_id, {
                    "status": "processing",
                    "progress": pct,
                    "stage": "analyzing",
                    "frames_analyzed": processed,
                })
            frame_idx += 1
    finally:
        cap.release()

    return {
        "fps": fps,
        "duration_sec": duration_sec,
        "total_frames": total_frames,
        "frames_analyzed": len(analyzed),
        "frames": analyzed,
    }


def _analyze_frame(frame) -> FrameMetrics:
    """Tek bir frame'in tüm metriklerini hesapla."""
    detections = detect_players(frame)
    pitch = detect_pitch(frame)
    if detections:
        labels, _ = classify_teams(frame, detections)
    else:
        labels = []
    return compute_metrics(detections, labels, pitch, frame.shape[:2])


def _metrics_to_dict(m: FrameMetrics) -> dict:
    return {
        "player_count_a": sum(m.zones_a.values()),
        "player_count_b": sum(m.zones_b.values()),
        "zones_a": m.zones_a,
        "zones_b": m.zones_b,
        "compactness_a": round(m.compactness_a, 2),
        "compactness_b": round(m.compactness_b, 2),
        "pressure_score": round(m.pressure_score, 1),
        "heatmap_a": m.heatmap_a,
        "heatmap_b": m.heatmap_b,
    }


def _schedule_progress(
    loop: asyncio.AbstractEventLoop,
    progress_cb: ProgressCb,
    video_id: str,
    payload: dict,
) -> None:
    """Sync thread'den async progress yayını planla."""
    try:
        asyncio.run_coroutine_threadsafe(progress_cb(video_id, payload), loop)
    except Exception:
        pass


def _generate_advice(frames: list[dict]) -> str | None:
    """Tüm frame ortalamasından tek bir taktik yorum üret."""
    if not frames:
        return None
    if not os.getenv("ANTHROPIC_API_KEY"):
        return None

    avg_a = sum(f["compactness_a"] for f in frames) / len(frames)
    avg_b = sum(f["compactness_b"] for f in frames) / len(frames)
    avg_pressure = sum(f["pressure_score"] for f in frames) / len(frames)
    avg_count_a = sum(f["player_count_a"] for f in frames) / len(frames)
    avg_count_b = sum(f["player_count_b"] for f in frames) / len(frames)
    last_minute = frames[-1].get("minute", 0)

    user_msg = build_frame_analysis_prompt(
        minute=last_minute,
        player_count_a=int(avg_count_a),
        player_count_b=int(avg_count_b),
        compactness_a=avg_a,
        compactness_b=avg_b,
        pressure_score=avg_pressure,
    )
    try:
        return ask(COACH_SYSTEM_PROMPT, user_msg, max_tokens=300)
    except Exception as exc:
        return f"AI yorum üretilemedi: {exc}"


async def _notify_nextjs(video_id: str, result: dict) -> None:
    """Analiz tamamlandı bildirimini Next.js'e gönder (DB yazımı için)."""
    url = f"{NEXTJS_CALLBACK_URL}/api/video/{video_id}/complete"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(url, json={
                "frames_analyzed": result["frames_analyzed"],
                "duration_sec": result["duration_sec"],
                "frames": result["frames"],
                "ai_advice": result.get("ai_advice"),
            })
    except Exception:
        # Callback başarısız olsa da JSON dosyası kaydedildi
        pass
