"""Tests of tools/third_party_notices.py with made-up packages (no npm, no network)."""
from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import third_party_notices as notices  # noqa: E402


def make(root: Path) -> None:
    packages = {
        "": {"name": "x"},
        "node_modules/alpha": {"version": "1.0.0", "license": "MIT"},
        "node_modules/vite": {"version": "8.0.0", "license": "MIT", "dev": True},
        "node_modules/onlydev": {"version": "2.0.0", "license": "MIT", "dev": True},
    }
    (root / "package-lock.json").write_text(json.dumps({"packages": packages}), encoding="utf-8")
    for name, text in (("alpha", "Copyright (c) Alpha"), ("vite", "Copyright (c) Vite\n# Licenses of bundled dependencies\nOther")):
        folder = root / "node_modules" / name
        folder.mkdir(parents=True)
        (folder / "LICENSE").write_text(text, encoding="utf-8")


class Notices(unittest.TestCase):
    def setUp(self) -> None:
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.root = Path(folder.name)
        make(self.root)

    def test_the_tree_leaves_the_development_packages_out_but_keeps_the_build_helpers(self) -> None:
        self.assertEqual([p["name"] for p in notices.tree(self.root)], ["alpha", "vite"])

    def test_the_file_carries_the_texts_and_passes_its_own_check(self) -> None:
        self.assertEqual(notices.main(["--root", str(self.root)]), 0)
        written = (self.root / notices.OUTPUT).read_text(encoding="utf-8")
        self.assertIn("Copyright (c) Alpha", written)
        self.assertNotIn("Other", written)
        self.assertEqual(notices.main(["--root", str(self.root), "--check"]), 0)

    def test_a_dependency_that_is_not_listed_fails_the_check(self) -> None:
        notices.main(["--root", str(self.root)])
        lock = json.loads((self.root / "package-lock.json").read_text(encoding="utf-8"))
        lock["packages"]["node_modules/beta"] = {"version": "1.0.0", "license": "ISC"}
        (self.root / "package-lock.json").write_text(json.dumps(lock), encoding="utf-8")
        self.assertEqual(notices.main(["--root", str(self.root), "--check"]), 1)

    def test_a_missing_file_fails_the_check(self) -> None:
        self.assertEqual(notices.main(["--root", str(self.root), "--check"]), 1)


class TheRepository(unittest.TestCase):
    def test_the_notices_of_the_repository_cover_its_tree(self) -> None:
        written = (notices.ROOT / notices.OUTPUT).read_text(encoding="utf-8")
        self.assertEqual(notices.problems(written, notices.tree(notices.ROOT)), [])


if __name__ == "__main__":
    unittest.main()
