#!/usr/bin/env python3
"""Pack Sketchfab's officially downloaded glTF + local textures as one GLB.

Uses Pillow to downscale and optimize image textures while preserving PBR\nmaterial assignments and original mesh geometry.
All external buffers and images are embedded, with four-byte alignment.
"""
from __future__ import annotations

import base64
import json
import mimetypes
import io
import os
from PIL import Image
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

    max_texture = max(256, min(2048, int(os.environ.get("FARCADE_TEXTURE_MAX", "1024"))))
    quality = max(65, min(94, int(os.environ.get("FARCADE_JPEG_QUALITY", "85"))))
    before_images = 0
    after_images = 0
    for item in obj.get("images", []):
        uri = item.pop("uri", None)
        if uri is None:
            continue
        data = resource(uri, root)
        before_images += len(data)
        mime = mimetypes.guess_type(urllib.parse.urlparse(uri).path)[0]
        if uri.startswith("data:"):
            mime = uri.split(";", 1)[0].partition(":")[2]
        if mime not in ("image/png", "image/jpeg", "image/webp"):
            raise ValueError(f"Unsupported texture MIME type for {uri}: {mime}")
        image = Image.open(io.BytesIO(data))
        image.load()
        original_size = image.size
        image.thumbnail((max_texture, max_texture), Image.Resampling.LANCZOS)
        output = io.BytesIO()
        # JPEG is substantially smaller for photo-derived color maps, while
        # PNG preserves alpha and normal/roughness/metallic texture fidelity.
        if mime == "image/jpeg" and image.mode not in ("RGBA", "LA", "P"):
            image.convert("RGB").save(output, format="JPEG", quality=quality,
                                      optimize=True, progressive=True, subsampling=0)
            mime = "image/jpeg"
        else:
            image.save(output, format="PNG", optimize=True, compress_level=9)
            mime = "image/png"
        data = output.getvalue()
        after_images += len(data)
        print(f"Texture {uri[:65]}: {original_size} -> {image.size}, "
              f"{len(data):,} bytes", flush=True)
        pad4(merged)
        at = len(merged)
        merged.extend(data)
        idx = len(obj.setdefault("bufferViews", []))
        obj["bufferViews"].append({"buffer": 0, "byteOffset": at, "byteLength": len(data)})
        item["bufferView"] = idx
        item["mimeType"] = mime

    print(f"Textures optimized: {before_images:,} -> {after_images:,} bytes "
          f"({max_texture}px maximum dimension)", flush=True)


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
