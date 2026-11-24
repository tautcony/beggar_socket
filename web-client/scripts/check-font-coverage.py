#!/usr/bin/env python3
"""Check whether the bundled Ark Pixel fonts cover all characters in i18n locales.

Reads the font fallback rules matching `src/styles/variables/_fonts.scss` and
checks every string in `src/i18n/locales/*.json` against the corresponding
`.ttf.woff2` cmap tables.

Usage:
  uv run --with fonttools --with brotli python3 scripts/check-font-coverage.py
  uv run --with fonttools --with brotli python3 scripts/check-font-coverage.py --size all
  uv run --with fonttools --with brotli python3 scripts/check-font-coverage.py --locale zh-Hans --show-keys
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import Iterable

from fontTools.ttLib import TTFont

SIZES = ("12px", "10px")

# Mirrors the :lang(...) fallback chain in src/styles/variables/_fonts.scss
LOCALE_FONT_CHAIN: dict[str, tuple[str, ...]] = {
    "zh-Hant": ("zh_hant", "zh_hans"),
    "ja-JP": ("ja", "zh_hans"),
    "zh-Hans": ("zh_hans",),
    "en-US": ("zh_hans",),
    "ru-RU": ("zh_hans",),
}
DEFAULT_FONT_CHAIN: tuple[str, ...] = ("zh_hans",)

PLACEHOLDER_RE = re.compile(r"\{[^{}]+\}")


def iter_locale_strings(obj: object, prefix: str = "") -> Iterable[tuple[str, str]]:
    if isinstance(obj, dict):
        for k, v in obj.items():
            key = f"{prefix}.{k}" if prefix else str(k)
            yield from iter_locale_strings(v, key)
    elif isinstance(obj, list):
        for idx, v in enumerate(obj):
            yield from iter_locale_strings(v, f"{prefix}[{idx}]")
    elif isinstance(obj, str):
        yield prefix, obj


def load_cmap(font_path: Path) -> set[int]:
    if not font_path.exists():
        raise FileNotFoundError(f"Font file not found: {font_path}")
    font = TTFont(font_path)
    cmap = font.getBestCmap()
    return set(cmap.keys()) if cmap else set()


def get_covered_codepoints(fonts_dir: Path, size: str, locale_stem: str, cache: dict[Path, set[int]]) -> set[int]:
    chain = LOCALE_FONT_CHAIN.get(locale_stem, DEFAULT_FONT_CHAIN)
    covered: set[int] = set()
    for variant in chain:
        font_path = fonts_dir / f"ark-pixel-{size}-proportional-{variant}.ttf.woff2"
        if font_path not in cache:
            cache[font_path] = load_cmap(font_path)
        covered |= cache[font_path]
    return covered


def extract_char_occurrences(data: object) -> dict[str, list[tuple[str, str]]]:
    occurrences: dict[str, list[tuple[str, str]]] = defaultdict(list)
    for key, raw_text in iter_locale_strings(data):
        cleaned = PLACEHOLDER_RE.sub("", raw_text)
        seen_in_key: set[str] = set()
        for ch in cleaned:
            cp = ord(ch)
            if cp < 0x20 or ch in "\n\r\t":
                continue
            if ch not in seen_in_key:
                occurrences[ch].append((key, raw_text))
                seen_in_key.add(ch)
    return occurrences


def check_locale(
    locale_path: Path,
    fonts_dir: Path,
    size: str,
    cmap_cache: dict[Path, set[int]],
) -> dict[str, object]:
    locale_stem = locale_path.stem
    data = json.loads(locale_path.read_text(encoding="utf-8"))
    occurrences = extract_char_occurrences(data)
    covered = get_covered_codepoints(fonts_dir, size, locale_stem, cmap_cache)

    missing_chars = sorted((ch for ch in occurrences if ord(ch) not in covered), key=ord)
    total_chars = len(occurrences)
    missing_count = len(missing_chars)
    covered_count = total_chars - missing_count
    coverage_pct = (covered_count / total_chars * 100.0) if total_chars else 100.0

    missing_details = [
        {
            "char": ch,
            "codepoint": f"U+{ord(ch):04X}",
            "keys": [k for k, _ in occurrences[ch]],
            "samples": occurrences[ch],
        }
        for ch in missing_chars
    ]

    return {
        "locale": locale_path.name,
        "size": size,
        "font_chain": list(LOCALE_FONT_CHAIN.get(locale_stem, DEFAULT_FONT_CHAIN)),
        "total_unique_chars": total_chars,
        "covered_chars": covered_count,
        "missing_count": missing_count,
        "coverage_percent": round(coverage_pct, 2),
        "missing": missing_details,
    }


def print_text_report(results: list[dict[str, object]], show_keys: bool, max_keys: int) -> None:
    by_size: dict[str, list[dict[str, object]]] = defaultdict(list)
    for r in results:
        by_size[str(r["size"])].append(r)

    for size, items in by_size.items():
        print("=" * 60)
        print(f"Ark Pixel {size} 字体覆盖检查")
        print("=" * 60)
        for item in items:
            missing = item["missing"]
            status = "PASS" if not missing else "MISSING"
            chain = " -> ".join(item["font_chain"])
            print(
                f"[{status}] {item['locale']} "
                f"({item['covered_chars']}/{item['total_unique_chars']}, "
                f"{item['coverage_percent']:.2f}%, chain: {chain})"
            )
            if missing:
                chars_str = "".join(m["char"] for m in missing)
                print(f"  缺失 {item['missing_count']} 个字符: {chars_str}")
                for m in missing:
                    keys = m["keys"]
                    key_preview = ", ".join(keys[:max_keys])
                    extra = f" ... (+{len(keys) - max_keys})" if len(keys) > max_keys else ""
                    print(f"    - '{m['char']}' ({m['codepoint']}): {key_preview}{extra}")
                    if show_keys:
                        for key, text in m["samples"][:max_keys]:
                            compact = text.replace("\n", "\\n")
                            print(f"        [{key}] {compact}")
        print()


def main() -> int:
    script_dir = Path(__file__).resolve().parent
    web_client_dir = script_dir.parent

    parser = argparse.ArgumentParser(description="Check Ark Pixel font coverage for i18n locale files.")
    parser.add_argument(
        "--locales-dir",
        type=Path,
        default=web_client_dir / "src" / "i18n" / "locales",
        help="Path to i18n locales directory",
    )
    parser.add_argument(
        "--fonts-dir",
        type=Path,
        default=web_client_dir / "src" / "assets" / "fonts" / "ark-pixel",
        help="Path to ark-pixel fonts directory",
    )
    parser.add_argument(
        "--size",
        choices=("12px", "10px", "all"),
        default="12px",
        help="Font size variant to check (default: 12px)",
    )
    parser.add_argument(
        "--locale",
        action="append",
        help="Specific locale name or filename to check (can be repeated)",
    )
    parser.add_argument(
        "--show-keys",
        action="store_true",
        help="Print sample i18n text for each missing character",
    )
    parser.add_argument(
        "--max-keys",
        type=int,
        default=3,
        help="Max number of keys to display per missing character (default: 3)",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output JSON report instead of human-readable text",
    )
    args = parser.parse_args()

    if not args.locales_dir.is_dir():
        print(f"Locales directory not found: {args.locales_dir}", file=sys.stderr)
        return 2
    if not args.fonts_dir.is_dir():
        print(f"Fonts directory not found: {args.fonts_dir}", file=sys.stderr)
        return 2

    locale_files = sorted(args.locales_dir.glob("*.json"))
    if args.locale:
        targets = {loc if loc.endswith(".json") else f"{loc}.json" for loc in args.locale}
        locale_files = [p for p in locale_files if p.name in targets]
        missing_targets = targets - {p.name for p in locale_files}
        if missing_targets:
            print(f"Locale file(s) not found: {', '.join(sorted(missing_targets))}", file=sys.stderr)
            return 2

    if not locale_files:
        print(f"No locale JSON files found in {args.locales_dir}", file=sys.stderr)
        return 2

    sizes = SIZES if args.size == "all" else (args.size,)
    cmap_cache: dict[Path, set[int]] = {}
    results: list[dict[str, object]] = []

    for size in sizes:
        for locale_path in locale_files:
            results.append(check_locale(locale_path, args.fonts_dir, size, cmap_cache))

    if args.json:
        serializable = [
            {
                **r,
                "missing": [
                    {"char": m["char"], "codepoint": m["codepoint"], "keys": m["keys"]}
                    for m in r["missing"]  # type: ignore[union-attr]
                ],
            }
            for r in results
        ]
        print(json.dumps(serializable, ensure_ascii=False, indent=2))
    else:
        print_text_report(results, show_keys=args.show_keys, max_keys=args.max_keys)

    has_missing = any(r["missing_count"] > 0 for r in results)  # type: ignore[operator]
    return 1 if has_missing else 0


if __name__ == "__main__":
    sys.exit(main())
