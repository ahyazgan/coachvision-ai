"""Claude API ince istemcisi (Python tarafı).

Video analiz sonuçlarına Türkçe taktik yorum üretir.
Maliyet kontrolü: max 300 token/istek.
"""
from __future__ import annotations

import os
from typing import Iterable

from anthropic import Anthropic

_client: Anthropic | None = None


def _get_client() -> Anthropic:
    global _client
    if _client is None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY tanımlı değil")
        _client = Anthropic(api_key=api_key)
    return _client


def ask(
    system_prompt: str,
    user_message: str,
    model: str = "claude-sonnet-4-20250514",
    max_tokens: int = 300,
) -> str:
    """Tek seferlik Claude çağrısı."""
    client = _get_client()
    response = client.messages.create(
        model=model,
        max_tokens=max_tokens,
        system=system_prompt,
        messages=[{"role": "user", "content": user_message}],
    )
    parts: Iterable = (b.text for b in response.content if getattr(b, "type", None) == "text")
    return "\n".join(parts)
