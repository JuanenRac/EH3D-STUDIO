#!/usr/bin/env python3
# =============================================================================
# EH3D-STUDIO - tools/sync_settings_contract.py
# Copyright (C) 2026 JuanenRac (Electro Hobby 3D)
# GPL-3.0-or-later - see LICENSE
# =============================================================================
"""Keeps the copy of the settings contract of the server that Studio draws its settings page from.

    python tools/sync_settings_contract.py --check     # exit 1 when the copy is not the file of the server (next to this repository) or is not a valid contract
    python tools/sync_settings_contract.py --write     # copies docs/settings-contract.json of the sibling EH3D-SERVER into src/data/settings-contract.json

The server writes `docs/settings-contract.json` (document `eh3d.settings.contract/1`) from its own code. Studio keeps a copy at `src/data/settings-contract.json`, used when
the live contract (`GET /api/v1/settings/contract`) cannot be read. With the sibling next to this repository the check compares the two files; without it (a checkout of this
repository alone, the CI) it validates the copy against the schema that Studio understands. No network is used.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
COPY = ROOT / "src" / "data" / "settings-contract.json"
SIBLING = ROOT.parent / "EH3D-SERVER" / "docs" / "settings-contract.json"

SCHEMA = "eh3d.settings.contract/1"
LANGUAGES = ["en", "es", "de", "fr", "it", "ja", "zh", "pt"]
TYPES = {"boolean", "integer", "string", "enum", "list"}
APPLY = {"now", "restart"}
VIA = {"policy", "file"}
RISKS = {"none", "security", "exposure", "capacity", "machine", "data"}


def read_json(path: Path) -> object:
    """The JSON document of a file; a file that is not valid JSON is a problem for the caller to report."""
    return json.loads(path.read_text(encoding="utf-8"))


def normalised(path: Path) -> str:
    """The text of a file with line ends as LF, so a checkout with CRLF compares equal to the one with LF."""
    return path.read_bytes().decode("utf-8").replace("\r\n", "\n")


def _texts(entry: dict, field: str, where: str) -> list[str]:
    value = entry.get(field)
    if not isinstance(value, dict):
        return [f"{where}: '{field}' is not a table of texts"]
    out = [f"{where}: '{field}' has no text in {lang}" for lang in LANGUAGES if not str(value.get(lang, "")).strip()]
    return out


def schema_problems(doc: object) -> list[str]:
    """What is wrong with a contract document, judged by what Studio needs to draw a page from it (no hardware, no server)."""
    if not isinstance(doc, dict):
        return ["the contract is not a JSON object"]
    problems: list[str] = []
    if doc.get("schema") != SCHEMA:
        problems.append(f"schema is {doc.get('schema')!r}, Studio understands {SCHEMA!r}")
        return problems
    if doc.get("languages") != LANGUAGES:
        problems.append(f"languages are {doc.get('languages')!r}, expected {LANGUAGES!r}")
    groups = doc.get("groups")
    group_ids: list[str] = []
    if not isinstance(groups, list) or not groups:
        problems.append("groups is empty")
    else:
        for g in groups:
            if not isinstance(g, dict) or not isinstance(g.get("id"), str):
                problems.append(f"a group has no id: {g!r}")
                continue
            group_ids.append(g["id"])
            problems += _texts(g, "label", f"group {g['id']}")
        if len(set(group_ids)) != len(group_ids):
            problems.append("a group id is repeated")
    settings = doc.get("settings")
    if not isinstance(settings, list) or not settings:
        return problems + ["settings is empty"]
    seen: set[str] = set()
    for s in settings:
        if not isinstance(s, dict) or not isinstance(s.get("key"), str):
            problems.append(f"a setting has no key: {s!r}")
            continue
        key = s["key"]
        if key in seen:
            problems.append(f"{key}: the key is repeated")
        seen.add(key)
        if s.get("group") not in group_ids:
            problems.append(f"{key}: group {s.get('group')!r} is not one of the groups")
        if s.get("type") not in TYPES:
            problems.append(f"{key}: type {s.get('type')!r} is not one of {sorted(TYPES)}")
        if s.get("apply") not in APPLY:
            problems.append(f"{key}: apply {s.get('apply')!r} is not now or restart")
        if s.get("risk") not in RISKS:
            problems.append(f"{key}: risk {s.get('risk')!r} is not one of {sorted(RISKS)}")
        if not isinstance(s.get("secret"), bool):
            problems.append(f"{key}: secret is not true or false")
        if "default" not in s:
            problems.append(f"{key}: no default")
        write = s.get("write")
        if not isinstance(write, dict) or write.get("via") not in VIA:
            problems.append(f"{key}: write.via is not policy or file")
        elif write["via"] == "policy" and not (write.get("method") and str(write.get("path", "")).startswith("/api/v1/")):
            problems.append(f"{key}: a key written by the policy has no method and path")
        if s.get("type") == "integer" and not (isinstance(s.get("min"), int) and isinstance(s.get("max"), int)):
            problems.append(f"{key}: an integer without min and max")
        for field in ("label", "help", "warning"):
            problems += _texts(s, field, key)
    return problems


def check() -> int:
    """0 when the copy is a valid contract and, with the sibling next to this repository, the same file as the server's."""
    if not COPY.is_file():
        print(f"SETTINGS_CONTRACT=FAIL: {COPY.relative_to(ROOT).as_posix()} is missing (python tools/sync_settings_contract.py --write)")
        return 1
    try:
        doc = read_json(COPY)
    except (OSError, ValueError) as e:
        print(f"SETTINGS_CONTRACT=FAIL: the copy is not valid JSON: {e}")
        return 1
    problems = schema_problems(doc)
    mode = "schema only"
    if not problems and SIBLING.is_file():
        mode = "against the server"
        if normalised(COPY) != normalised(SIBLING):
            problems.append("the copy differs from docs/settings-contract.json of EH3D-SERVER (python tools/sync_settings_contract.py --write)")
    for p in problems:
        print(f"  {p}")
    if problems:
        print(f"SETTINGS_CONTRACT=FAIL ({len(problems)} problem(s))")
        return 1
    count = len(doc["settings"]) if isinstance(doc, dict) else 0
    print(f"SETTINGS_CONTRACT=PASS ({count} settings, {mode})")
    return 0


def write() -> int:
    """Copies the contract of the sibling server into Studio, after checking it is a contract Studio understands."""
    if not SIBLING.is_file():
        print("SETTINGS_CONTRACT=FAIL: EH3D-SERVER is not next to this repository, there is nothing to copy")
        return 1
    problems = schema_problems(read_json(SIBLING))
    if problems:
        for p in problems:
            print(f"  {p}")
        print("SETTINGS_CONTRACT=FAIL: the file of the server is not a contract Studio understands")
        return 1
    COPY.parent.mkdir(parents=True, exist_ok=True)
    COPY.write_bytes(normalised(SIBLING).encode("utf-8"))
    print(f"copied {SIBLING.name} to {COPY.relative_to(ROOT).as_posix()}")
    return check()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Check or refresh the copy of the settings contract of the server.")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--check", action="store_true", help="verify the copy (the default)")
    mode.add_argument("--write", action="store_true", help="copy the contract of the sibling EH3D-SERVER")
    args = parser.parse_args(argv)
    return write() if args.write else check()


if __name__ == "__main__":
    sys.exit(main())
