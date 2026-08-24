"""
run_pipeline.py

Single-command end-to-end pipeline:
    two DWG files -> enriched JSON -> geometric diff -> Gemini engineer report.

Edit the paths in main() and run:
    python3 run_pipeline.py
"""

from pathlib import Path
import json

from dwg_to_json import convert
from dwg_diff import build_diff
from generate_report import generate_report


def run(before_dwg, after_dwg, workdir):
    workdir = Path(workdir)
    workdir.mkdir(parents=True, exist_ok=True)

    before_json = workdir / "before.json"
    after_json = workdir / "after.json"
    diff_json = workdir / "diff_report.json"
    report_md = workdir / "engineer_report.md"

    # NOTE: before/after DWGs get SEPARATE output subfolders. If both files
    # happen to share the same filename (e.g. two revisions both named
    # "Lift Details.dwg"), converting them into the same folder would
    # overwrite one DXF with the other before it could be read.
    print("Converting BEFORE drawing...")
    convert(before_dwg, workdir / "converted_before", before_json)

    print("Converting AFTER drawing...")
    convert(after_dwg, workdir / "converted_after", after_json)

    print("Diffing...")
    with open(before_json) as f:
        before_entities = json.load(f)
    with open(after_json) as f:
        after_entities = json.load(f)

    diff = build_diff(before_entities, after_entities)
    for key in ("added", "removed", "modified"):
        diff[key].sort(key=lambda x: 0 if x["structural_relevance"] == "high" else 1)

    with open(diff_json, "w") as f:
        json.dump(diff, f, indent=2)

    print(f"Added: {len(diff['added'])}, Removed: {len(diff['removed'])}, "
          f"Modified: {len(diff['modified'])}, Unchanged: {diff['unchanged_count']}")

    print("Generating engineer report (requires GEMINI_API_KEY in .env)...")
    generate_report(diff_json, report_md)


import sys
import argparse

def main():
    if len(sys.argv) > 1:
        parser = argparse.ArgumentParser(description="Run DWG diff pipeline")
        parser.add_argument("before", help="Path to before DWG file")
        parser.add_argument("after", help="Path to after DWG file")
        parser.add_argument("--workdir", default="/Users/akshat/Desktop/editor/dwgtojson/output", help="Working directory")
        args = parser.parse_args()
        
        run(args.before, args.after, args.workdir)
    else:
        before_dwg = "/Users/akshat/Desktop/dwgtojson/Architectural_Before.dwg"
        after_dwg = "/Users/akshat/Desktop/dwgtojson/Architectural_After.dwg"
        workdir = "/Users/akshat/Desktop/dwgtojson/output"

        run(before_dwg, after_dwg, workdir)


if __name__ == "__main__":
    main()