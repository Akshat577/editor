"""
test_with_sample.py

Runs your JSON extraction + diff pipeline on the included before.dxf / after.dxf
sample files, WITHOUT needing ODA or a real DWG. This isolates and validates the
ezdxf extraction logic and the diff/matching logic on their own.

Usage:
    python test_with_sample.py
"""

from dwg_to_json import dxf_to_json
from dwg_diff import build_diff
import json

# 1. Extract JSON directly from the sample DXFs (skips convert_dwg_to_dxf/ODA)
dxf_to_json("before.dxf", "before_sample.json")
dxf_to_json("after.dxf", "after_sample.json")

# 2. Diff them
with open("before_sample.json") as f:
    before = json.load(f)
with open("after_sample.json") as f:
    after = json.load(f)

diff = build_diff(before, after)



print("\n=== ACTUAL ===")
print(f"added: {len(diff['added'])}")
print(f"removed: {len(diff['removed'])}")
print(f"modified: {len(diff['modified'])}")

with open("sample_diff_report.json", "w") as f:
    json.dump(diff, f, indent=2)

print("\nFull report written to sample_diff_report.json")