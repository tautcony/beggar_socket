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
from html.parser import HTMLParser
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
# Mirrors :lang(zh) / :lang(zh-Hant) / :lang(ja) in src/styles/variables/_fonts.scss
# where --retro-font-micro and --font-size-micro fall back to 12px for CJK locales.
MICRO_12PX_LOCALES: frozenset[str] = frozenset({"zh-Hans", "zh-Hant", "ja-JP"})

PLACEHOLDER_RE = re.compile(r"\{[^{}]+\}")
MICRO_STYLE_RE = re.compile(
    r"font-family:\s*var\(--retro-font-micro\)|font-size:\s*(?:var\(--font-size-micro\)|10px)\b"
)
I18N_CALL_RE = re.compile(r"\$?t\(\s*['\"]([a-zA-Z0-9_.-]+)['\"]")
HTML_VOID_TAGS = frozenset({
    "area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "meta", "param", "source", "track", "wbr",
})


def parse_micro_selectors(style_text: str) -> list[str]:
    """Extract CSS/SCSS selectors whose own rule body sets 10px / --retro-font-micro."""
    style_text = re.sub(r"/\*.*?\*/", "", style_text, flags=re.S)
    style_text = re.sub(r"//[^\n]*", "", style_text)
    stack: list[list[object]] = []
    selectors: list[str] = []
    buf: list[str] = []
    for ch in style_text:
        if ch == "{":
            sel = "".join(buf).strip()
            buf = []
            stack.append([sel, []])
        elif ch == "}":
            if stack:
                own_parts: list[str] = stack[-1][1]  # type: ignore[assignment]
                own_parts.append("".join(buf))
                buf = []
                sel_obj, own_parts = stack.pop()
                sel = str(sel_obj)
                own_css = "".join(own_parts)  # type: ignore[arg-type]
                if MICRO_STYLE_RE.search(own_css):
                    parent_sels = [str(s) for s, _ in stack if s and not str(s).startswith("@")]
                    full = sel
                    for ps in reversed(parent_sels):
                        full = full.replace("&", ps) if "&" in full else f"{ps} {full}"
                    for part in full.split(","):
                        s = part.strip()
                        if s:
                            selectors.append(s)
        else:
            if stack:
                own_parts = stack[-1][1]  # type: ignore[assignment]
                own_parts.append(ch)
            else:
                buf.append(ch)
    return selectors


def _match_simple_selector(part: str, tag: str, classes: set[str]) -> bool:
    part = re.sub(r"::?[a-zA-Z0-9_-]+(?:\([^)]*\))?", "", part).strip()
    if not part:
        return False
    m = re.match(r"^([a-zA-Z0-9_-]+)?((?:\.[a-zA-Z0-9_-]+)*)$", part)
    if not m:
        return False
    req_tag, req_cls_str = m.group(1), m.group(2)
    if req_tag and req_tag.lower() != tag.lower():
        return False
    if req_cls_str:
        req_classes = [c for c in req_cls_str.split(".") if c]
        if not all(c in classes for c in req_classes):
            return False
    return bool(req_tag or req_cls_str)


def _matches_selector(sel: str, ancestor_stack: list[tuple[str, set[str]]]) -> bool:
    tokens = [t for t in sel.replace(">", " ").split() if t]
    if not tokens or not ancestor_stack:
        return False
    if not _match_simple_selector(tokens[-1], ancestor_stack[-1][0], ancestor_stack[-1][1]):
        return False
    idx = len(tokens) - 2
    for tag, cls in reversed(ancestor_stack[:-1]):
        if idx < 0:
            break
        if _match_simple_selector(tokens[idx], tag, cls):
            idx -= 1
    return idx < 0


class _Template10pxExtractor(HTMLParser):
    def __init__(self, selectors: list[str]) -> None:
        super().__init__(convert_charrefs=True)
        self.selectors = selectors
        self.stack: list[tuple[str, set[str], bool]] = []
        self.keys: set[str] = set()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr_dict = dict(attrs)
        cls_raw = attr_dict.get("class") or ""
        dyn_cls = attr_dict.get(":class") or ""
        cls_set = set(cls_raw.split())
        cls_set.update(re.findall(r"['\"]([a-zA-Z0-9_-]+)['\"]", dyn_cls))
        ancestors = [(t, c) for t, c, _ in self.stack] + [(tag, cls_set)]
        is_micro = (self.stack[-1][2] if self.stack else False) or any(
            _matches_selector(s, ancestors) for s in self.selectors
        )
        if tag.lower() in {"retrobutton", "retro-button"} and attr_dict.get("size") == "xs":
            is_micro = True
        if tag.lower() in {"retrodropzone", "retro-drop-zone"}:
            hint_val = attr_dict.get(":hint") or attr_dict.get("hint") or ""
            self.keys.update(I18N_CALL_RE.findall(hint_val))
        if is_micro:
            for _, v_attr in attrs:
                if v_attr:
                    self.keys.update(I18N_CALL_RE.findall(v_attr))
        if tag.lower() not in HTML_VOID_TAGS:
            self.stack.append((tag, cls_set, is_micro))

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() in HTML_VOID_TAGS:
            return
        while self.stack:
            t, _, _ = self.stack.pop()
            if t == tag:
                break

    def handle_data(self, data: str) -> None:
        if self.stack and self.stack[-1][2]:
            self.keys.update(I18N_CALL_RE.findall(data))


def collect_10px_i18n_keys(src_dir: Path) -> tuple[set[str], dict[str, list[str]]]:
    """Scan Vue SFCs for i18n keys rendered inside 10px / --retro-font-micro selectors."""
    keys: set[str] = set()
    by_file: dict[str, list[str]] = {}
    for vue_path in sorted(src_dir.rglob("*.vue")):
        text = vue_path.read_text(encoding="utf-8")
        m_tpl = re.search(r"<template>(.*)</template>", text, flags=re.S)
        if not m_tpl:
            continue
        m_style = re.search(r"<style[^>]*>(.*)</style>", text, flags=re.S)
        selectors = parse_micro_selectors(m_style.group(1)) if m_style else []
        extractor = _Template10pxExtractor(selectors)
        extractor.feed(m_tpl.group(1))
        if extractor.keys:
            keys.update(extractor.keys)
            by_file[str(vue_path.relative_to(src_dir))] = sorted(extractor.keys)
    return keys, by_file


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


def extract_char_occurrences(
    data: object,
    allowed_keys: set[str] | None = None,
) -> dict[str, list[tuple[str, str]]]:
    occurrences: dict[str, list[tuple[str, str]]] = defaultdict(list)
    for key, raw_text in iter_locale_strings(data):
        if allowed_keys is not None and key not in allowed_keys:
            continue
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
    allowed_keys: set[str] | None = None,
    scope: str = "all",
) -> dict[str, object]:
    locale_stem = locale_path.stem
    data = json.loads(locale_path.read_text(encoding="utf-8"))
    occurrences = extract_char_occurrences(data, allowed_keys=allowed_keys)
    effective_size = "12px" if (size == "10px" and scope == "css" and locale_stem in MICRO_12PX_LOCALES) else size
    covered = get_covered_codepoints(fonts_dir, effective_size, locale_stem, cmap_cache)

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
        "effective_size": effective_size,
        "scope": scope,
        "font_chain": list(LOCALE_FONT_CHAIN.get(locale_stem, DEFAULT_FONT_CHAIN)),
        "total_unique_chars": total_chars,
        "covered_chars": covered_count,
        "missing_count": missing_count,
        "coverage_percent": round(coverage_pct, 2),
        "missing": missing_details,
    }


def print_text_report(
    results: list[dict[str, object]],
    show_keys: bool,
    max_keys: int,
    ten_px_by_file: dict[str, list[str]] | None = None,
) -> None:
    by_size: dict[str, list[dict[str, object]]] = defaultdict(list)
    for r in results:
        by_size[str(r["size"])].append(r)

    for size, items in by_size.items():
        scope = str(items[0].get("scope", "all")) if items else "all"
        scope_label = " (CSS 实际使用)" if size == "10px" and scope == "css" else ""
        print("=" * 60)
        print(f"Ark Pixel {size} 字体覆盖检查{scope_label}")
        print("=" * 60)
        if size == "10px" and scope == "css" and ten_px_by_file is not None:
            total_keys = len({k for ks in ten_px_by_file.values() for k in ks})
            print(f"匹配到 {len(ten_px_by_file)} 个 Vue 文件中的 {total_keys} 个 10px i18n key")
        for item in items:
            missing = item["missing"]
            status = "PASS" if not missing else "MISSING"
            chain = " -> ".join(item["font_chain"])
            eff = item.get("effective_size")
            eff_note = f", effective: {eff} via :lang" if eff and eff != size else ""
            print(
                f"[{status}] {item['locale']} "
                f"({item['covered_chars']}/{item['total_unique_chars']}, "
                f"{item['coverage_percent']:.2f}%, chain: {chain}{eff_note})"
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
        "--10px-scope",
        choices=("css", "all"),
        default="css",
        help="For 10px, check only i18n keys used inside 10px CSS selectors ('css', default) or all locale keys ('all')",
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
    ten_px_keys: set[str] | None = None
    ten_px_by_file: dict[str, list[str]] | None = None
    if "10px" in sizes and args.ten_px_scope if hasattr(args, "ten_px_scope") else False:
        pass
    ten_px_scope = getattr(args, "10px_scope", "css")
    if "10px" in sizes and ten_px_scope == "css":
        ten_px_keys, ten_px_by_file = collect_10px_i18n_keys(web_client_dir / "src")

    for size in sizes:
        allowed = ten_px_keys if size == "10px" and ten_px_scope == "css" else None
        scope = ten_px_scope if size == "10px" else "all"
        for locale_path in locale_files:
            results.append(
                check_locale(
                    locale_path,
                    args.fonts_dir,
                    size,
                    cmap_cache,
                    allowed_keys=allowed,
                    scope=scope,
                )
            )

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
        print_text_report(
            results,
            show_keys=args.show_keys,
            max_keys=args.max_keys,
            ten_px_by_file=ten_px_by_file,
        )

    has_missing = any(r["missing_count"] > 0 for r in results)  # type: ignore[operator]
    return 1 if has_missing else 0


if __name__ == "__main__":
    sys.exit(main())
