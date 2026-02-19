from pathlib import Path
import textwrap


def main() -> None:
    src = Path("docs/DOMAIN_KURULUM_REHBERI.md")
    out = Path("docs/DOMAIN_KURULUM_REHBERI.pdf")
    text = src.read_text(encoding="utf-8")

    lines: list[str] = []
    for line in text.splitlines():
        line = line.rstrip()
        if not line:
            lines.append("")
            continue
        if line.startswith("#"):
            line = line.lstrip("#").strip().upper()
        lines.extend(textwrap.wrap(line, width=92) or [""])

    objects: list[bytes] = []

    def add(obj: bytes) -> int:
        objects.append(obj)
        return len(objects)

    font_id = add(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

    pages: list[int] = []
    lines_per_page = 46
    chunks = [lines[i : i + lines_per_page] for i in range(0, len(lines), lines_per_page)] or [[""]]

    for chunk in chunks:
        content_lines = [b"BT", b"/F1 11 Tf", b"50 790 Td", b"14 TL"]
        first = True
        for line in chunk:
            escaped = line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
            if first:
                content_lines.append(f"({escaped}) Tj".encode("latin-1", "replace"))
                first = False
            else:
                content_lines.append(b"T*")
                content_lines.append(f"({escaped}) Tj".encode("latin-1", "replace"))
        content_lines.append(b"ET")

        stream = b"\n".join(content_lines)
        content_id = add(b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream")
        page_id = add(
            b"<< /Type /Page /Parent 0 0 R /MediaBox [0 0 595 842] "
            b"/Resources << /Font << /F1 %d 0 R >> >> /Contents %d 0 R >>" % (font_id, content_id)
        )
        pages.append(page_id)

    kids = b" ".join(f"{pid} 0 R".encode() for pid in pages)
    pages_id = add(b"<< /Type /Pages /Kids [" + kids + b"] /Count %d >>" % len(pages))

    for i, obj in enumerate(objects):
        if b"/Type /Page" in obj and b"/Parent 0 0 R" in obj:
            objects[i] = obj.replace(b"/Parent 0 0 R", f"/Parent {pages_id} 0 R".encode())

    catalog_id = add(b"<< /Type /Catalog /Pages %d 0 R >>" % pages_id)

    out_bytes = bytearray()
    out_bytes.extend(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")

    offsets = [0]
    for idx, obj in enumerate(objects, start=1):
        offsets.append(len(out_bytes))
        out_bytes.extend(f"{idx} 0 obj\n".encode())
        out_bytes.extend(obj)
        out_bytes.extend(b"\nendobj\n")

    xref_pos = len(out_bytes)
    out_bytes.extend(f"xref\n0 {len(objects) + 1}\n".encode())
    out_bytes.extend(b"0000000000 65535 f \n")
    for off in offsets[1:]:
        out_bytes.extend(f"{off:010d} 00000 n \n".encode())

    out_bytes.extend(b"trailer\n")
    out_bytes.extend(f"<< /Size {len(objects) + 1} /Root {catalog_id} 0 R >>\n".encode())
    out_bytes.extend(b"startxref\n")
    out_bytes.extend(f"{xref_pos}\n".encode())
    out_bytes.extend(b"%%EOF\n")

    out.write_bytes(out_bytes)
    print(f"WROTE {out} ({out.stat().st_size} bytes)")


if __name__ == "__main__":
    main()

