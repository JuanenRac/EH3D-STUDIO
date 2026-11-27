#!/usr/bin/env python3
# =============================================================================
# EH3D-STUDIO - tools/third_party_notices.py
# Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
# GPL-3.0-or-later - see LICENSE
# =============================================================================
"""The third-party notices of the pages, made from the real dependency tree and checked against it.

    python tools/third_party_notices.py            write docs/THIRD_PARTY_NOTICES (needs node_modules: run `npm ci` first)
    python tools/third_party_notices.py --check    fail when a package of the tree, or its licence, is not in the file

The tree is every package of package-lock.json that is not only for development, plus the two build tools that leave code of
their own in the pages (BUILD_HELPERS). The licence texts are copied from node_modules. `--check` needs no node_modules and
compares names and licences, not versions. The build puts the file beside the pages, so it travels in the release archive.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = "docs/THIRD_PARTY_NOTICES"
MARKER = "Made by tools/third_party_notices.py from package-lock.json; do not edit by hand."
# small run-time helpers that the bundler writes into the pages (module preload and CommonJS interoperability)
BUILD_HELPERS = ("rolldown", "vite")
NOTICE_FILE = re.compile(r"^(licen[cs]e|copying|copyright|notice)([-_.].*)?$", re.IGNORECASE)


def clean(text: str) -> str:
    return "\n".join(line.rstrip() for line in text.replace("﻿", "").replace("\r\n", "\n").replace("\r", "\n").split("\n")).strip("\n")


def tree(root: Path) -> list[dict]:
    """The packages whose code is in the pages: name, version, licence and the folders of node_modules that hold them."""
    packages = json.loads((root / "package-lock.json").read_text(encoding="utf-8"))["packages"]
    found: dict[tuple[str, str], dict] = {}
    for path, entry in packages.items():
        if not path:
            continue
        name = path.rsplit("node_modules/", 1)[-1]
        if entry.get("dev") and not (name in BUILD_HELPERS and path == f"node_modules/{name}"):
            continue
        version = entry.get("version", "?")
        item = found.setdefault((name, version), {"name": name, "version": version, "licence": " ".join(str(entry.get("license") or "see its licence file").split()), "paths": []})
        item["paths"].append(path)
    return [found[key] for key in sorted(found)]


def texts_of(root: Path, package: dict) -> list[str]:
    for path in package["paths"]:
        folder = root / path
        if not folder.is_dir():
            continue
        texts = []
        for file in sorted(folder.iterdir(), key=lambda p: p.name):
            if file.is_file() and NOTICE_FILE.match(file.name):
                text = clean(file.read_text(encoding="utf-8", errors="replace"))
                if package["name"] == "vite":
                    # what follows is about the tools inside the build program, none of which goes into the pages
                    text = text.split("# Licenses of bundled dependencies", 1)[0].rstrip()
                if text:
                    texts.append(text)
        if texts:
            return texts
    raise SystemExit(f"{package['name']} {package['version']}: no licence text in node_modules (run `npm ci` first)")


def render(root: Path, packages: list[dict]) -> str:
    used: dict[str, tuple[str, list[str]]] = {}
    for package in packages:
        for text in texts_of(root, package):
            used.setdefault(" ".join(text.split()), (text, []))[1].append(f"{package['name']} {package['version']}")
    lines = ["Third-party notices", "===================", "", MARKER, "",
             "The pages are built with the npm packages below. Each is used under the licence named beside it; their copyright",
             "notices and licence texts follow. The source of each is at https://www.npmjs.com/package/<name>.", "",
             "Components", "----------", ""]
    lines += [f"{p['name']} | {p['version']} | {p['licence']}" for p in packages]
    lines += ["", "Copyright notices and licence texts", "-----------------------------------"]
    for text, users in used.values():
        lines += ["", "=" * 78, "Used by: " + ", ".join(dict.fromkeys(users)), "=" * 78, "", text]
    return "\n".join(lines) + "\n"


def problems(written: str, packages: list[dict]) -> list[str]:
    if MARKER not in written:
        return ["the file was not made by this tool"]
    section = written.split("\nComponents\n", 1)[-1].split("\nCopyright notices and licence texts\n", 1)[0]
    listed = set()
    for line in section.splitlines():
        parts = [part.strip() for part in line.split(" | ")]
        if len(parts) == 3:
            listed.add((parts[0], parts[2]))
    return [f"not in the notices: {p['name']} {p['version']} ({p['licence']})" for p in packages if (p["name"], p["licence"]) not in listed]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--root", type=Path, default=ROOT, help="the folder of package-lock.json")
    parser.add_argument("--check", action="store_true", help="write nothing; fail when the file does not cover the tree")
    args = parser.parse_args(argv)
    root = args.root.resolve()
    output = root / OUTPUT
    packages = tree(root)
    if args.check:
        found = problems(output.read_text(encoding="utf-8"), packages) if output.is_file() else [f"{OUTPUT} is missing"]
        for problem in found:
            print(f"- {problem}")
        print(f"THIRD_PARTY_NOTICES={'FAIL' if found else 'PASS'} ({len(packages)} packages)")
        if found:
            print("Make the file again with `npm ci` and `python3 tools/third_party_notices.py`, and commit it.")
        return 1 if found else 0
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(render(root, packages).encode("utf-8"))
    print(f"wrote {output} ({len(packages)} packages)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
