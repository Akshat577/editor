"""
convert_both.py

Converts a before/after DWG pair to JSON in one command.

Usage:
    python3 convert_both.py before.dwg after.dwg --workdir ./output
"""

import argparse
from pathlib import Path
from dwg_to_json import convert


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("before_dwg")
    parser.add_argument("after_dwg")
    parser.add_argument("--workdir", default="./converted")
    args = parser.parse_args()

    workdir = Path(args.workdir)
    workdir.mkdir(parents=True, exist_ok=True)

    before_json = workdir / "before.json"
    after_json = workdir / "after.json"

    print("Converting BEFORE drawing...")
    convert(args.before_dwg, workdir / "before_dxf", before_json)

    print("Converting AFTER drawing...")
    convert(args.after_dwg, workdir / "after_dxf", after_json)

    print(f"\nDone. Next step:")
    print(f"  python3 dwg_diff.py {before_json} {after_json} --out {workdir}/diff_report.json")


if __name__ == "__main__":
    main()