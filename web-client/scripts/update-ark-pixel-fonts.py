#!/usr/bin/env python3
"""Download Ark Pixel proportional ttf.woff2 fonts and inject a bi-level gasp table.

The upstream TakWolf/ark-pixel-font releases ship .ttf.woff2 files without a
`gasp` table, causing Windows DirectWrite / WebView2 to apply grayscale/ClearType
antialiasing at 10px/12px on 1x (non-Retina) displays. Adding `gasp` with
`{65535: 0x0000}` instructs Windows to disable grayscale and symmetric smoothing.

Usage:
  uv run --with fonttools --with brotli python3 scripts/update-ark-pixel-fonts.py
  uv run --with fonttools --with brotli python3 scripts/update-ark-pixel-fonts.py --version 2026.11.10
"""

from __future__ import annotations

import argparse
import json
import shutil
import tempfile
import urllib.request
import zipfile
from pathlib import Path

from fontTools.ttLib import TTFont, newTable

REPO = "TakWolf/ark-pixel-font"
SIZES = ("10px", "12px")
VARIANTS = ("ja", "latin", "zh_hans", "zh_hant")
GASP_BEHAVIOR_BILEVEL = 0x0000


def fetch_latest_tag() -> str:
    url = f"https://api.github.com/repos/{REPO}/releases/latest"
    req = urllib.request.Request(url, headers={"Accept": "application/vnd.github+json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.load(resp)
    tag = data.get("tag_name")
    if not tag:
        raise RuntimeError("Failed to determine latest release tag from GitHub API")
    return str(tag)


def download_file(url: str, dest: Path) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": "ark-pixel-font-updater"})
    with urllib.request.urlopen(req, timeout=60) as resp, dest.open("wb") as fp:
        shutil.copyfileobj(resp, fp)


def inject_gasp_and_save(src_path: Path, dst_path: Path) -> None:
    font = TTFont(src_path)
    gasp = newTable("gasp")
    gasp.version = 1
    gasp.gaspRange = {65535: GASP_BEHAVIOR_BILEVEL}
    font["gasp"] = gasp
    font.flavor = "woff2"
    font.save(dst_path)

    verify = TTFont(dst_path)
    if "gasp" not in verify or verify["gasp"].gaspRange != {65535: GASP_BEHAVIOR_BILEVEL}:
        raise RuntimeError(f"gasp table verification failed for {dst_path.name}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Update Ark Pixel ttf.woff2 fonts with bi-level gasp table")
    parser.add_argument("--version", help="Release tag (e.g. 2026.11.10). Defaults to latest GitHub release.")
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=Path(__file__).resolve().parent.parent / "src" / "assets" / "fonts" / "ark-pixel",
        help="Destination font directory",
    )
    args = parser.parse_args()

    version = args.version or fetch_latest_tag()
    out_dir: Path = args.out_dir
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"Updating Ark Pixel fonts from {REPO}@{version} -> {out_dir}")

    with tempfile.TemporaryDirectory() as tmp:
        tmp_dir = Path(tmp)
        extracted_dir = tmp_dir / "extracted"
        extracted_dir.mkdir()

        for size in SIZES:
            archive_name = f"ark-pixel-font-{size}-proportional-ttf.woff2-v{version}.zip"
            url = f"https://github.com/{REPO}/releases/download/{version}/{archive_name}"
            zip_path = tmp_dir / archive_name
            print(f"Downloading {archive_name}...")
            download_file(url, zip_path)
            with zipfile.ZipFile(zip_path) as zf:
                zf.extractall(extracted_dir)

        ofl_src = extracted_dir / "OFL.txt"
        if ofl_src.exists():
            shutil.copy2(ofl_src, out_dir / "OFL.txt")

        for size in SIZES:
            for variant in VARIANTS:
                filename = f"ark-pixel-{size}-proportional-{variant}.ttf.woff2"
                src_font = extracted_dir / filename
                if not src_font.exists():
                    raise FileNotFoundError(f"Expected font file not found in archive: {filename}")
                dst_font = out_dir / filename
                inject_gasp_and_save(src_font, dst_font)
                print(f"Saved & verified: {filename} ({dst_font.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
