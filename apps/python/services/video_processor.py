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
from typing import Awaitable, Callable, Optional

import cv2
import httpx

from ai.claude_client import ask
from ai.prompts import (
    COACH_SYSTEM_PROMPT,
    build_frame_analysis_prompt,
    build_segment_analysis_prompt,
)
from services.ball_analyzer import (
    FrameBallInfo,
    aggregate_ball,
    aggregate_to_dict,
    analyze_frame_ball,
)
from services.pitch_detector import PitchInfo, detect_pitch
from services.player_detector import (
    MIN_PLAYERS_PER_FRAME,
    BallDetection,
    Detection,
    detect_players_and_ball,
)
from services.player_tracker import PlayerTrack, PlayerTracker
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
# Zaman serisi yorum için dilim uzunluğu (dakika)
SEGMENT_MINUTES = int(os.getenv("SEGMENT_MINUTES", "5"))
# Bir dilime yorum üretebilmek için min anlamlı frame sayısı
MIN_FRAMES_PER_SEGMENT = 2


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
        segments = _generate_segment_advice(result["frames"])
        result["segments"] = segments
        # Geriye dönük uyumluluk: son dilimin yorumunu maç-geneli özet alanına da ver
        result["ai_advice"] = segments[-1]["advice"] if segments else None
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

    # Tek tracker örneği video boyunca yaşar.
    tracker = PlayerTracker()
    # Top + sahiplenme frame frame biriktir, sonra agrege
    ball_infos: list[FrameBallInfo] = []

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

            detections, ball, pitch, metrics, labels = _analyze_frame(frame)
            player_total = sum(metrics.zones_a.values()) + sum(metrics.zones_b.values())

            # Saha-içi + takıma atanmış (kaleci/hakem değil) tespitler tracker'a girer.
            assigned_ids = _update_tracker(tracker, detections, labels, pitch, i, actual_sec)

            # Top + sahiplenme analizi (sadece anlamlı frame'lerde — kesim/zoom'da yok say)
            if player_total >= MIN_PLAYERS_PER_FRAME:
                ball_infos.append(analyze_frame_ball(
                    ball=ball,
                    detections=detections,
                    team_labels=labels,
                    pitch=pitch,
                    frame_shape=frame.shape[:2],
                    minute=int(actual_sec // 60),
                    timestamp_sec=actual_sec,
                ))

            # Önizleme — videodaki 3 zaman noktasına yakın frame'lerde
            while preview_idx < len(preview_times) and target_sec >= preview_times[preview_idx]:
                if player_total >= MIN_PLAYERS_PER_FRAME:
                    name = f"{video_id}_{preview_idx + 1}.jpg"
                    if _save_preview(name, frame, detections, pitch, assigned_ids, ball):
                        saved_previews.append({
                            "name": name,
                            "timestamp_sec": actual_sec,
                            "player_count": player_total,
                            "outliers": metrics.outlier_count,
                            "has_ball": ball is not None,
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
                "tracks_active": len(tracker._active),  # noqa: SLF001 — telemetry için
            })

        # Geriye kalan preview noktaları için son geçerli frame'i kullanma — geç.
    finally:
        cap.release()

    # Track agregasyonu
    track_summary = _summarize_tracks(tracker.all_tracks(), declared_duration)

    # Top + sahiplenme + olay agregasyonu
    ball_stats = aggregate_to_dict(aggregate_ball(ball_infos))

    return {
        "fps": fps,
        "duration_sec": max(declared_duration, actual_duration),
        "total_frames": declared_total,
        "frames_attempted": len(capture_times),
        "frames_analyzed": len(analyzed),
        "frames_skipped": skipped_count,
        "previews": saved_previews,
        "frames": analyzed,
        "tracks": track_summary,
        "ball_stats": ball_stats,
    }


def _update_tracker(
    tracker: PlayerTracker,
    detections: list[Detection],
    labels: list[int],
    pitch: PitchInfo | None,
    frame_idx: int,
    timestamp_sec: float,
) -> list[Optional[int]]:
    """Saha-içi + takıma atanmış tespitleri tracker'a sok, hizalı id listesi döner.

    Her tespit için: int (eşleşti) veya None (atlandı/saha-dışı/outlier).
    """
    filtered_dets: list[Detection] = []
    filtered_labels: list[int] = []
    keep_idx: list[int] = []
    for i, (det, lbl) in enumerate(zip(detections, labels)):
        if lbl == OUTLIER_LABEL:
            continue
        cx = (det.x1 + det.x2) / 2
        foot_y = det.y2
        if pitch is not None and not pitch.contains(cx, foot_y, tolerance=10):
            continue
        filtered_dets.append(det)
        filtered_labels.append(lbl)
        keep_idx.append(i)

    if not filtered_dets:
        # Yine de track'leri yaşlandır
        tracker.update([], [], frame_idx=frame_idx, timestamp_sec=timestamp_sec)
        return [None] * len(detections)

    ids = tracker.update(filtered_dets, filtered_labels, frame_idx=frame_idx, timestamp_sec=timestamp_sec)
    result: list[Optional[int]] = [None] * len(detections)
    for orig_i, tid in zip(keep_idx, ids):
        result[orig_i] = tid
    return result


def _summarize_tracks(tracks: list[PlayerTrack], duration_sec: float) -> list[dict]:
    """Stabil track'leri payload formatına çevir (mesafe büyükten küçüğe)."""
    summary: list[dict] = []
    for t in tracks:
        if not t.stable:
            continue
        first_min, last_min = t.active_minutes()
        summary.append({
            "id": t.id,
            "team": t.dominant_team(),
            "frames": len(t.samples),
            "pixel_distance": round(t.pixel_distance(), 1),
            "active_from_minute": first_min,
            "active_to_minute": last_min,
            "avg_confidence": round(
                sum(s.confidence for s in t.samples) / len(t.samples), 2
            ),
        })
    # Mesafeye göre azalan sırada
    summary.sort(key=lambda x: -x["pixel_distance"])
    return summary


def _frange(start: float, stop: float, step: float):
    t = start
    while t < stop:
        yield t
        t += step


def _analyze_frame(
    frame,
) -> tuple[list[Detection], Optional[BallDetection], PitchInfo | None, FrameMetrics, list[int]]:
    detections, ball = detect_players_and_ball(frame)
    pitch = detect_pitch(frame)
    if detections:
        labels, _ = classify_teams(frame, detections)
    else:
        labels = []
    metrics = compute_metrics(detections, labels, pitch, frame.shape[:2])
    return detections, ball, pitch, metrics, labels


def _save_preview(
    name: str,
    frame,
    detections: list[Detection],
    pitch: PitchInfo | None,
    track_ids: list[Optional[int]] | None = None,
    ball: Optional[BallDetection] = None,
) -> bool:
    """YOLOv8 tespitlerini frame üstüne çiz (saha-içi cyan, dışı kırmızı).

    `track_ids` verilirse her kutunun üstüne "#id" etiketi eklenir — tracker
    çıktısını gözle doğrulamayı kolaylaştırır. `ball` verilirse parlak sarı
    daire ile işaretlenir.
    """
    try:
        PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
        annotated = frame.copy()

        # Saha kenarını yarı saydam koyu yeşil overlay ile göster
        if pitch is not None:
            green_layer = annotated.copy()
            green_layer[pitch.mask] = (0, 100, 0)
            cv2.addWeighted(green_layer, 0.20, annotated, 0.80, 0, annotated)

        ids = track_ids or [None] * len(detections)
        for det, tid in zip(detections, ids):
            x1, y1, x2, y2 = det.crop_box
            foot_x = (det.x1 + det.x2) / 2
            foot_y = det.y2
            on_pitch = pitch.contains(foot_x, foot_y, tolerance=10) if pitch else True
            color = (0, 229, 255) if on_pitch else (60, 60, 220)  # Cyan / Kırmızı (BGR)
            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
            label = f"#{tid} {det.confidence:.2f}" if tid is not None else f"{det.confidence:.2f}"
            cv2.putText(
                annotated,
                label,
                (x1, max(15, y1 - 6)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                color,
                1,
                cv2.LINE_AA,
            )

        # Top: parlak sarı daire + güven etiketi
        if ball is not None:
            bx, by = ball.center
            radius = max(8, int((ball.x2 - ball.x1) / 1.5))
            cv2.circle(annotated, (int(bx), int(by)), radius, (0, 255, 255), 2)
            cv2.putText(
                annotated,
                f"top {ball.confidence:.2f}",
                (int(bx) - 30, int(by) - radius - 6),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                (0, 255, 255),
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


def _generate_segment_advice(frames: list[dict]) -> list[dict]:
    """Maçı SEGMENT_MINUTES'lik dilimlere ayırıp her dilim için Claude yorumu üretir.

    Çıktı dilimleri zaman sırasında, her biri o pencerenin ortalamaları + kompaktlık
    trendi + pres min/ort/max bilgisini taşır.
    """
    if not frames:
        return []
    if not os.getenv("ANTHROPIC_API_KEY"):
        return []

    # Frame'leri dakikaya göre bucket'la
    buckets: dict[int, list[dict]] = {}
    for f in frames:
        bucket_idx = int(f.get("minute", 0)) // SEGMENT_MINUTES
        buckets.setdefault(bucket_idx, []).append(f)

    segments: list[dict] = []
    for bucket_idx in sorted(buckets.keys()):
        bucket = buckets[bucket_idx]
        if len(bucket) < MIN_FRAMES_PER_SEGMENT:
            continue

        minute_from = bucket_idx * SEGMENT_MINUTES
        minute_to = minute_from + SEGMENT_MINUTES

        avg_a = sum(f["compactness_a"] for f in bucket) / len(bucket)
        avg_b = sum(f["compactness_b"] for f in bucket) / len(bucket)
        avg_count_a = sum(f["player_count_a"] for f in bucket) / len(bucket)
        avg_count_b = sum(f["player_count_b"] for f in bucket) / len(bucket)
        pressures = [f["pressure_score"] for f in bucket]
        p_min, p_avg, p_max = min(pressures), sum(pressures) / len(pressures), max(pressures)

        trend_a = _trend_label([f["compactness_a"] for f in bucket])
        trend_b = _trend_label([f["compactness_b"] for f in bucket])

        user_msg = build_segment_analysis_prompt(
            minute_from=minute_from,
            minute_to=minute_to,
            frames_count=len(bucket),
            avg_count_a=avg_count_a,
            avg_count_b=avg_count_b,
            avg_compactness_a=avg_a,
            avg_compactness_b=avg_b,
            pressure_min=p_min,
            pressure_avg=p_avg,
            pressure_max=p_max,
            compactness_trend_a=trend_a,
            compactness_trend_b=trend_b,
        )
        try:
            advice = ask(COACH_SYSTEM_PROMPT, user_msg, max_tokens=250)
        except Exception as exc:
            advice = f"AI yorum üretilemedi: {exc}"

        segments.append({
            "minute_from": minute_from,
            "minute_to": minute_to,
            "frames_count": len(bucket),
            "avg_count_a": round(avg_count_a, 1),
            "avg_count_b": round(avg_count_b, 1),
            "avg_compactness_a": round(avg_a, 1),
            "avg_compactness_b": round(avg_b, 1),
            "pressure_avg": round(p_avg, 1),
            "pressure_min": round(p_min, 1),
            "pressure_max": round(p_max, 1),
            "advice": advice,
        })

    return segments


def _trend_label(values: list[float]) -> str:
    """Sayı serisinin yönünü ilk-son yarı ortalamalarıyla nitele."""
    if len(values) < 2:
        return "sabit"
    half = len(values) // 2 or 1
    first_avg = sum(values[:half]) / half
    last_avg = sum(values[-half:]) / half
    diff = last_avg - first_avg
    # Kompaktlık metre cinsinden — 3 metreden büyük değişimleri trend say
    if diff > 3:
        return "artıyor"
    if diff < -3:
        return "azalıyor"
    return "sabit"


async def _notify_nextjs(video_id: str, result: dict) -> None:
    url = f"{NEXTJS_CALLBACK_URL}/api/video/{video_id}/complete"
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            await client.post(url, json={
                "frames_analyzed": result["frames_analyzed"],
                "frames_skipped": result["frames_skipped"],
                "duration_sec": result["duration_sec"],
                "frames": result["frames"],
                "ai_advice": result.get("ai_advice"),
                "segments": result.get("segments", []),
                "tracks": result.get("tracks", []),
                "ball_stats": result.get("ball_stats"),
                "previews": result.get("previews", []),
            })
    except Exception:
        pass
