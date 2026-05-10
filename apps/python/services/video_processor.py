"""Ana video işleme pipeline'ı.

Akış:
    1. cv2.VideoCapture ile videoyu aç
    2. Her FRAME_INTERVAL_SECONDS saniyede bir frame al (timestamp tabanlı)
    3. YOLOv8 ile oyuncu tespiti
    4. OpenCV ile saha tespiti (mask + bbox)
    5. K-means ile takım ayrımı (kaleci/hakem outlier filtresi)
    6. Bölgesel + kompaktlık + pres analizi
    7. Claude API ile maç-özeti taktik yorum (tek seferlik)
    8. Sonuçları JSON olarak kaydet ve Next.js callback'i tetikle
    9. İlerleme WebSocket ile yayınlanır
    10. Maçın 3 farklı zaman noktasında debug önizleme görüntüsü kaydedilir
"""
from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path
from typing import Awaitable, Callable

import cv2
import httpx

from ai.claude_client import ask
from ai.prompts import COACH_SYSTEM_PROMPT, build_frame_analysis_prompt
from services.pitch_detector import PitchInfo, detect_pitch
from services.player_detector import MIN_PLAYERS_PER_FRAME, Detection, detect_players
from services.team_classifier import OUTLIER_LABEL, classify_teams
from services.zone_analyzer import FrameMetrics, compute_metrics

ProgressCb = Callable[[str, dict], Awaitable[None]]

FRAME_INTERVAL_SECONDS = float(os.getenv("FRAME_INTERVAL_SECONDS", "2"))
ANALYSIS_OUTPUT_DIR = Path(os.getenv("ANALYSIS_OUTPUT_DIR", "./uploads/analyses"))
NEXTJS_CALLBACK_URL = os.getenv("NEXTJS_CALLBACK_URL", "http://localhost:3000")
PROJECT_ROOT = Path(__file__).resolve().parents[3]
PREVIEW_DIR = PROJECT_ROOT / "public" / "previews"
# Videonun yaklaşık %20, %50, %80 noktalarında debug görüntüsü kaydet
PREVIEW_PROGRESS_RATIOS = (0.2, 0.5, 0.8)


async def process_video(
    video_id: str,
    file_path: str,
    match_id: str,
    progress_cb: ProgressCb,
) -> None:
    """Bir videoyu uçtan uca işler."""
    try:
        await progress_cb(video_id, {"status": "processing", "progress": 0, "stage": "opening"})

        loop = asyncio.get_running_loop()
        result = await asyncio.to_thread(_run_pipeline_sync, video_id, file_path, progress_cb, loop)

        await progress_cb(video_id, {"status": "processing", "progress": 95, "stage": "ai_advice"})
        ai_advice = _generate_advice(result["frames"])
        result["ai_advice"] = ai_advice
        result["match_id"] = match_id
        result["video_id"] = video_id

        ANALYSIS_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        out_path = ANALYSIS_OUTPUT_DIR / f"{video_id}.json"
        out_path.write_text(
            json.dumps(result, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

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
    """Bloklayan video işleme — timestamp tabanlı, atomik."""
    cap = cv2.VideoCapture(file_path)
    if not cap.isOpened():
        raise RuntimeError(f"Video açılamadı: {file_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    declared_total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    declared_duration = declared_total / fps if fps > 0 else 0

    # Çıkarım için zaman noktaları üret (saniye cinsinden)
    if declared_duration <= 0:
        capture_times: list[float] = []
    else:
        capture_times = [
            t for t in _frange(0.0, declared_duration, FRAME_INTERVAL_SECONDS)
        ]
    target_count = max(1, len(capture_times))

    # Önizleme zaman noktaları (saatin %20, %50, %80'i)
    preview_times = sorted({
        max(0.0, declared_duration * r) for r in PREVIEW_PROGRESS_RATIOS
    })
    preview_idx = 0
    saved_previews: list[dict] = []

    analyzed: list[dict] = []
    skipped_count = 0
    actual_duration = 0.0

    try:
        for i, target_sec in enumerate(capture_times):
            # Hedef zamana git — ms cinsinden
            cap.set(cv2.CAP_PROP_POS_MSEC, target_sec * 1000.0)
            ret, frame = cap.read()
            if not ret or frame is None:
                # Video bittiyse erken çık
                break

            actual_sec = cap.get(cv2.CAP_PROP_POS_MSEC) / 1000.0
            actual_duration = max(actual_duration, actual_sec)

            detections, pitch, metrics = _analyze_frame(frame)
            player_total = sum(metrics.zones_a.values()) + sum(metrics.zones_b.values())

            # Önizleme — videodaki 3 zaman noktasına yakın frame'lerde
            while preview_idx < len(preview_times) and target_sec >= preview_times[preview_idx]:
                if player_total >= MIN_PLAYERS_PER_FRAME:
                    name = f"{video_id}_{preview_idx + 1}.jpg"
                    if _save_preview(name, frame, detections, pitch):
                        saved_previews.append({
                            "name": name,
                            "timestamp_sec": actual_sec,
                            "player_count": player_total,
                            "outliers": metrics.outlier_count,
                        })
                preview_idx += 1

            # Anlamsız frame'leri at (kesim/zoom/replay)
            if player_total < MIN_PLAYERS_PER_FRAME:
                skipped_count += 1
            else:
                analyzed.append({
                    "minute": int(actual_sec // 60),
                    "second": int(actual_sec % 60),
                    "frame_number": int(actual_sec * fps),
                    "timestamp": actual_sec,
                    **_metrics_to_dict(metrics),
                })

            pct = min(90, int(10 + ((i + 1) / target_count) * 80))
            _schedule_progress(loop, progress_cb, video_id, {
                "status": "processing",
                "progress": pct,
                "stage": "analyzing",
                "frames_analyzed": len(analyzed),
                "frames_skipped": skipped_count,
            })

        # Geriye kalan preview noktaları için son geçerli frame'i kullanma — geç.
    finally:
        cap.release()

    return {
        "fps": fps,
        "duration_sec": max(declared_duration, actual_duration),
        "total_frames": declared_total,
        "frames_attempted": len(capture_times),
        "frames_analyzed": len(analyzed),
        "frames_skipped": skipped_count,
        "previews": saved_previews,
        "frames": analyzed,
    }


def _frange(start: float, stop: float, step: float):
    t = start
    while t < stop:
        yield t
        t += step


def _analyze_frame(
    frame,
) -> tuple[list[Detection], PitchInfo | None, FrameMetrics]:
    detections = detect_players(frame)
    pitch = detect_pitch(frame)
    if detections:
        labels, _ = classify_teams(frame, detections)
    else:
        labels = []
    metrics = compute_metrics(detections, labels, pitch, frame.shape[:2])
    return detections, pitch, metrics


def _save_preview(
    name: str,
    frame,
    detections: list[Detection],
    pitch: PitchInfo | None,
) -> bool:
    """YOLOv8 tespitlerini frame üstüne çiz (saha-içi cyan, dışı kırmızı)."""
    try:
        PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
        annotated = frame.copy()

        # Saha kenarını yarı saydam koyu yeşil overlay ile göster
        if pitch is not None:
            overlay = annotated.copy()
            mask_3 = pitch.mask.astype("uint8") * 255
            green_layer = annotated.copy()
            green_layer[pitch.mask] = (0, 100, 0)
            cv2.addWeighted(green_layer, 0.20, annotated, 0.80, 0, annotated)

        for det in detections:
            x1, y1, x2, y2 = det.crop_box
            foot_x = (det.x1 + det.x2) / 2
            foot_y = det.y2
            on_pitch = pitch.contains(foot_x, foot_y, tolerance=10) if pitch else True
            color = (0, 229, 255) if on_pitch else (60, 60, 220)  # Cyan / Kırmızı (BGR)
            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
            cv2.putText(
                annotated,
                f"{det.confidence:.2f}",
                (x1, max(15, y1 - 6)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                color,
                1,
                cv2.LINE_AA,
            )
        out = PREVIEW_DIR / name
        cv2.imwrite(str(out), annotated, [cv2.IMWRITE_JPEG_QUALITY, 80])
        return True
    except Exception:
        return False


def _metrics_to_dict(m: FrameMetrics) -> dict:
    return {
        "player_count_a": sum(m.zones_a.values()),
        "player_count_b": sum(m.zones_b.values()),
        "outlier_count": m.outlier_count,
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
    try:
        asyncio.run_coroutine_threadsafe(progress_cb(video_id, payload), loop)
    except Exception:
        pass


def _generate_advice(frames: list[dict]) -> str | None:
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
    url = f"{NEXTJS_CALLBACK_URL}/api/video/{video_id}/complete"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            await client.post(url, json={
                "frames_analyzed": result["frames_analyzed"],
                "frames_skipped": result["frames_skipped"],
                "duration_sec": result["duration_sec"],
                "frames": result["frames"],
                "ai_advice": result.get("ai_advice"),
                "previews": result.get("previews", []),
            })
    except Exception:
        pass
