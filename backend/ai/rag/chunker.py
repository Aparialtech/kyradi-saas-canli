"""Lightweight document chunking utilites."""

from __future__ import annotations

import re
from dataclasses import dataclass
from html import unescape
from html.parser import HTMLParser
from typing import Iterable, List


@dataclass(slots=True)
class Chunk:
    """Represents a chunked portion of the ingested document."""

    order: int
    title: str | None
    content: str


class _HTMLStripper(HTMLParser):
    """Minimal HTML to text converter."""

    block_tags = {"p", "div", "section", "article", "br", "li", "ul", "ol", "table", "tr"}

    def __init__(self) -> None:
        super().__init__()
        self._parts: list[str] = []
        self._skip_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str]]) -> None:  # noqa: D401 - interface
        if tag in {"script", "style"}:
            self._skip_depth += 1
        elif self._skip_depth == 0 and tag in self.block_tags:
            self._parts.append("\n")

    def handle_endtag(self, tag: str) -> None:  # noqa: D401 - interface
        if tag in {"script", "style"} and self._skip_depth > 0:
            self._skip_depth -= 1
        elif self._skip_depth == 0 and tag in self.block_tags:
            self._parts.append("\n")

    def handle_data(self, data: str) -> None:  # noqa: D401 - interface
        if self._skip_depth == 0 and data.strip():
            self._parts.append(data)

    def get_text(self) -> str:
        joined = "".join(self._parts)
        return _compact_whitespace(joined)


def strip_html(raw: str) -> str:
    """Convert HTML into normalized plain text."""
    parser = _HTMLStripper()
    parser.feed(unescape(raw))
    parser.close()
    return parser.get_text()


def chunk_text(
    text: str,
    title: str | None = None,
    *,
    target_tokens: int = 900,
    max_tokens: int = 1200,
) -> list[Chunk]:
    """Split text into overlapping chunks roughly target_tokens in size."""
    normalized = _compact_whitespace(text)
    if not normalized:
        return []

    paragraphs = [para.strip() for para in re.split(r"\n{2,}", normalized) if para.strip()]
    if not paragraphs:
        paragraphs = [normalized]

    chunks: list[Chunk] = []
    buffer: list[str] = []
    buffer_tokens = 0

    for para in paragraphs:
        para_tokens = _estimate_tokens(para)
        if buffer_tokens + para_tokens > max_tokens and buffer:
            chunks.append(
                Chunk(order=len(chunks), title=title, content="\n\n".join(buffer).strip())
            )
            buffer = []
            buffer_tokens = 0

        buffer.append(para)
        buffer_tokens += para_tokens

        if buffer_tokens >= target_tokens:
            chunks.append(
                Chunk(order=len(chunks), title=title, content="\n\n".join(buffer).strip())
            )
            buffer = []
            buffer_tokens = 0

    if buffer:
        chunks.append(Chunk(order=len(chunks), title=title, content="\n\n".join(buffer).strip()))

    return chunks


def _compact_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _estimate_tokens(value: str) -> int:
    # Rough heuristic: 1 token ≈ 4 characters (English/average)
    return max(1, len(value) // 4)
