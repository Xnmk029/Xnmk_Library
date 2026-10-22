"""Curate pinned, non-code Kenney inputs for the draft Godot question bank."""
from pathlib import Path
import hashlib
import json
import posixpath
import struct
import zipfile

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "NativeWorkflowBench/GodotBenchVNext/assets"


def sha(data):
    return hashlib.sha256(data).hexdigest()


def main():
    upstream = json.loads((BASE / "UPSTREAM_LOCK.json").read_text(encoding="utf-8"))
    sources = {s["slug"]: s for s in upstream["sources"]}
    specifications = {
        "A2D": ("tiny-dungeon", None),
        "A3D": ("platformer-kit", [
            "Models/GLB format/" + name + ".glb" for name in [
                "character-oopi", "chest", "door-rotate", "lever", "block-grass",
                "block-grass-large-slope", "coin-gold", "crate", "button-round"]]),
        "AUI": ("ui-pack", ["PNG/Grey/Default/" + name + ".png" for name in [
            "button_rectangle_flat", "button_rectangle_border", "button_square_flat",
            "button_square_border", "check_square_color_checkmark", "check_square_grey",
            "icon_checkmark", "icon_cross", "arrow_basic_e", "arrow_basic_w",
            "slide_hangle", "slide_horizontal_color", "slide_horizontal_grey"]]),
        "AAUDIO": ("interface-sounds", ["Audio/" + name + ".ogg" for name in [
            "back_001", "click_001", "close_001", "confirmation_001", "error_001", "open_001"]]),
    }
    output = BASE / "candidate_packs"
    output.mkdir(exist_ok=True)
    result = {"schema_version": 1, "status": "bytes_frozen_engine_import_pending",
              "contains_game_code": False, "engine_import_verified": False, "packs": {}}
    for pack, (slug, selected) in specifications.items():
        source = sources[slug]
        raw = (BASE / "sources" / (slug + ".zip")).read_bytes()
        assert sha(raw) == source["sha256"], "Source archive changed"
        with zipfile.ZipFile(BASE / "sources" / (slug + ".zip")) as z:
            if selected is None:
                selected = [n for n in z.namelist() if n.startswith("Tiles/") and n.endswith(".png")]
                selected += ["Tilemap/tilemap_packed.png", "Tilesheet.txt"]
            selected += ["License.txt"]
            for name in list(selected):
                if not name.endswith(".glb"):
                    continue
                data = z.read(name)
                length = struct.unpack_from("<I", data, 12)[0]
                gltf = json.loads(data[20:20 + length])
                for obj in gltf.get("buffers", []) + gltf.get("images", []):
                    uri = obj.get("uri", "")
                    if not uri or uri.startswith("data:"):
                        continue
                    dependency = posixpath.normpath(posixpath.join(posixpath.dirname(name), uri))
                    assert not dependency.startswith(("/", "../")) and ":" not in dependency
                    assert dependency in z.namelist(), "Source GLB dependency missing"
                    if dependency not in selected:
                        selected.append(dependency)
            payload = {"assets/" + slug + "/" + n: z.read(n) for n in selected}
        clips = {}
        for name, data in payload.items():
            if name.endswith(".glb"):
                assert data[:4] == b"glTF"
                length, chunk_type = struct.unpack_from("<II", data, 12)
                assert chunk_type == 0x4E4F534A
                gltf = json.loads(data[20:20 + length])
                for obj in gltf.get("buffers", []) + gltf.get("images", []):
                    uri = obj.get("uri", "")
                    if uri and not uri.startswith("data:"):
                        dependency = posixpath.normpath(posixpath.join(posixpath.dirname(name), uri))
                        assert dependency in payload, "Unbundled GLB dependency"
                clips[name] = [a.get("name") for a in gltf.get("animations", [])]
        note = (f"{pack}: selected assets from {source['page']}\n"
                f"Original archive SHA-256: {source['sha256']}\n"
                "License: CC0. Original License.txt is included.\n"
                "The selected source asset bytes are unchanged. No scripts, scenes, sample maps, or game templates are included.\n"
                "Choose import options, collision, material adaptation, animation state logic and UI layout in your project.\n")
        if clips:
            note += "Observed animation names (not a completed controller):\n" + json.dumps(clips, ensure_ascii=False, indent=2) + "\n"
        payload["ASSETS_README.txt"] = note.encode("utf-8")
        manifest = {name: {"sha256": sha(data), "size": len(data)} for name, data in sorted(payload.items())}
        archive = output / (pack + ".zip")
        with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
            for name, data in sorted(payload.items()):
                info = zipfile.ZipInfo(name, (2026, 10, 18, 0, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                z.writestr(info, data)
        with zipfile.ZipFile(archive) as z:
            assert set(z.namelist()) == set(manifest)
            assert all(sha(z.read(n)) == v["sha256"] for n, v in manifest.items())
        result["packs"][pack] = {"file": "candidate_packs/" + archive.name,
            "sha256": sha(archive.read_bytes()), "size": archive.stat().st_size,
            "source": slug, "source_sha256": source["sha256"], "page": source["page"],
            "license": "CC0", "selected_asset_count": len(selected) - 1,
            "files": manifest, "animation_names": clips}
    (BASE / "ASSET_LOCK.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: {a: v[a] for a in ("size", "sha256", "selected_asset_count")}
                      for k, v in result["packs"].items()}, indent=2))


if __name__ == "__main__":
    main()
