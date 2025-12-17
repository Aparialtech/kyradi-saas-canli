"""Persistence helpers for pgvector-backed document store."""

from __future__ import annotations

import json
from typing import Any, Mapping, MutableMapping, Sequence, TypedDict

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from .embeddings import EmbeddingError, embed_texts

class DocumentRecord(TypedDict):
    doc_id: str
    title: str | None
    content: str
    embedding: Sequence[float]
    meta: Mapping[str, Any] | None


async def upsert_documents(
    session: AsyncSession,
    tenant_id: str,
    docs: Sequence[DocumentRecord],
) -> int:
    """Insert or update document chunks in pgvector-backed store."""
    if not docs:
        return 0

    params: list[MutableMapping[str, Any]] = []
    for doc in docs:
        params.append(
            {
                "tenant_id": tenant_id,
                "doc_id": doc["doc_id"],
                "title": doc.get("title"),
                "content": doc["content"],
                "embedding": _format_vector(doc["embedding"]),
                "meta": json.dumps(doc.get("meta") or {}),
            }
        )

    stmt = text(
        """
        INSERT INTO ai_documents (tenant_id, doc_id, title, content, embedding, meta)
        VALUES (:tenant_id, :doc_id, :title, :content, :embedding::vector, :meta::jsonb)
        ON CONFLICT (tenant_id, doc_id) DO UPDATE
        SET title = EXCLUDED.title,
            content = EXCLUDED.content,
            embedding = EXCLUDED.embedding,
            meta = EXCLUDED.meta
        """
    )
    await session.execute(stmt, params)
    await session.commit()
    return len(params)


async def semantic_search(
    session: AsyncSession,
    tenant_id: str,
    query: str,
    *,
    top_k: int = 6,
) -> list[dict[str, str]]:
    """Return the top_k most relevant document snippets."""
    if not query.strip():
        return []

    query_vectors = await embed_texts([query])
    if not query_vectors:
        return []
    query_embedding = query_vectors[0]

    stmt = text(
        """
        SELECT title,
               content,
               substring(content for 320) AS snippet
        FROM ai_documents
        WHERE tenant_id = :tenant_id
        ORDER BY embedding <-> :embedding::vector
        LIMIT :limit
        """
    )
    params = {
        "tenant_id": tenant_id,
        "embedding": _format_vector(query_embedding),
        "limit": top_k,
    }
    result = await session.execute(stmt, params)
    rows = result.mappings().all()
    return [
        {
            "title": row.get("title") or "Doküman",
            "snippet": (row.get("snippet") or "")[:320].strip(),
            "content": row.get("content") or "",
        }
        for row in rows
    ]


def _format_vector(vector: Sequence[float]) -> str:
    return "[" + ",".join(f"{val:.6f}" for val in vector) + "]"
