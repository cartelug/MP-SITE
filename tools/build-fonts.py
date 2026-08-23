#!/usr/bin/env python3
"""Trim the two variable faces to what this site actually sets.

The Google latin subset carries about twice the glyphs these pages use,
plus a variation axis Newsreader never varies. On a metered connection in
Sironko the webfont is the largest single cost of a first visit, so both
files are instanced and subset here, and the results are committed.

    Montserrat  38 KB -> 23 KB   (weight range trimmed, full wght axis kept)
    Newsreader 132 KB -> 32 KB   (optical size pinned at 20, weight kept)

Newsreader's optical-size axis costs 40 KB on its own. It is pinned at
20 rather than dropped to a display value because the serif does more
work as running text than as display type here.

Run: python3 tools/build-fonts.py
"""
import subprocess
import sys
from pathlib import Path

SRC = Path("src/media/fonts")
OUT = Path("public/fonts")
CHARS = OUT.parent.parent / "tools" / "font-charset.txt"

FACES = [
    ("montserrat-latin", ["wght=300:900"]),
    ("newsreader-latin", ["opsz=20", "wght=200:700"]),
]

FEATURES = "kern,liga,calt,tnum,lnum,ccmp,locl,mark,mkmk"


def run(args):
    subprocess.run(args, check=True, capture_output=True)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, axes in FACES:
        src = SRC / f"{name}.woff2"
        instanced = Path("/tmp") / f"{name}-instanced.ttf"
        dest = OUT / f"{name}.woff2"

        run([sys.executable, "-m", "fontTools.varLib.instancer", str(src), *axes, "-o", str(instanced)])
        run([
            sys.executable, "-m", "fontTools.subset", str(instanced),
            f"--output-file={dest}",
            f"--text-file={CHARS}",
            "--flavor=woff2",
            f"--layout-features={FEATURES}",
            "--no-hinting",
            "--desubroutinize",
            "--name-IDs=1,2,3,4,6",
        ])
        print(f"{name}: {src.stat().st_size // 1024} KB -> {dest.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
