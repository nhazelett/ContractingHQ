#!/usr/bin/env python3
"""Pack Sketchfab's officially downloaded glTF + local textures as one GLB.

No third-party Python packages. Keeps original PBR materials and geometry.
All external buffers and images are embedded, with four-byte alignment.
"""
from __future__ import annotations

import base64
import json
import mimetypes
import pathlib
import struct
import sys
import urllib.parse


def pad4(data: bytearray) -> None:
    data.extend(b"\x00" * (-len(data) % 4))


def resource(uri: str, root: pathlib.Path) -> bytes:
    if uri.startswith("data:"):
        _header, payload = uri.split(",", 1)
        if ";base64" in _header:
            return base64.b64decode(payload)
        return urllib.parse.unquote_to_bytes(payload)
    name = urllib.parse.unquote(uri)
    file_path = (root / name).resolve()
    if not file_path.is_relative_to(root.resolve()):
        raise ValueError(f"Unsafe resource path: {uri}")
    return file_path.read_bytes()


def pack(source: pathlib.Path, dest: pathlib.Path) -> None:
    gltf_files = list(source.rglob("*.gltf"))
    if len(gltf_files) != 1:
        raise RuntimeError(f"Expected one .gltf model, found {len(gltf_files)}")
    path = gltf_files[0]
    obj = json.loads(path.read_text(encoding="utf-8"))
    if obj.get("asset", {}).get("version") != "2.0":
        raise ValueError("Only glTF 2.0 is supported")

    root = path.parent
    merged = bytearray()
    original_buffers = obj.get("buffers", [])
    offsets = []
    for buf in original_buffers:
        uri = buf.get("uri")
        if not uri:
            raise ValueError("External .gltf must provide buffer URIs")
        data = resource(uri, root)
        pad4(merged)
        offsets.append(len(merged))
        merged.extend(data)

    for view in obj.get("bufferViews", []):
        which = view.get("buffer", 0)
        view["byteOffset"] = view.get("byteOffset", 0) + offsets[which]
        view["buffer"] = 0

    for item in obj.get("images", []):
        uri = item.pop("uri", None)
        if uri is None:
            continue
        data = resource(uri, root)
        pad4(merged)
        at = len(merged)
        merged.extend(data)
        idx = len(obj.setdefault("bufferViews", []))
        obj["bufferViews"].append({"buffer": 0, "byteOffset": at, "byteLength": len(data)})
        item["bufferView"] = idx
        mime = mimetypes.guess_type(urllib.parse.urlparse(uri).path)[0]
        if uri.startswith("data:"):
            mime = uri.split(";", 1)[0].partition(":")[2]
        if mime not in ("image/png", "image/jpeg", "image/webp", "image/ktx2"):
            raise ValueError(f"Unsupported texture MIME type for {uri}: {mime}")
        item["mimeType"] = mime

    pad4(merged)
    obj["buffers"] = [{"byteLength": len(merged)}]
    json_data = json.dumps(obj, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    json_data += b" " * (-len(json_data) % 4)
    length = 12 + 8 + len(json_data) + 8 + len(merged)
    dest.parent.mkdir(parents=True, exist_ok=True)
    with dest.open("wb") as fp:
        fp.write(struct.pack("<4sII", b"glTF", 2, length))
        fp.write(struct.pack("<I4s", len(json_data), b"JSON"))
        fp.write(json_data)
        fp.write(struct.pack("<I4s", len(merged), b"BIN\x00"))
        fp.write(merged)
    actual = dest.stat().st_size
    if actual != length:
        raise RuntimeError(f"GLB length mismatch: {actual} vs {length}")
    print(
        f"Packed {path.name} -> {dest}: {actual:,} bytes, "
        f"{len(obj.get('meshes', []))} meshes, "
        f"{len(obj.get('images', []))} images"
    )


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("Usage: farcade_pack_gltf.py <unpacked source folder> <output.glb>")
    pack(pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]))
