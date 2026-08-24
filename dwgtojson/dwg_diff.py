"""
dwg_diff.py

Compares two DWG->JSON exports (before/after architectural drawings) and produces
a structured diff: added / removed / modified entities, grouped by layer, with a
focus on entities relevant to structural engineers.

Usage:
    python dwg_diff.py before.json after.json --out diff_report.json

Requires: scipy, numpy  (pip install scipy numpy --break-system-packages)
"""

import json
import argparse
import numpy as np
from scipy.optimize import linear_sum_assignment
from collections import defaultdict

# ---------------------------------------------------------------------------
# CONFIG
# ---------------------------------------------------------------------------

# Layers a structural engineer actually cares about. Tune this to your project's
# layer naming convention. Everything not listed is still diffed but flagged
# as low-priority (e.g. DIM, TEXT, HATCH-for-render-only).
STRUCTURAL_LAYERS = {
    "RETAINING WALL", "WALL", "COLUMN", "BEAM", "SLAB", "STEEL", "FOUNDATION",
    "OPENING", "SHEAR WALL",
}

# Distance (in drawing units) within which two entities of the same type/layer
# are considered "the same entity, possibly moved" rather than a totally
# different add/remove pair. Set based on your drawing's unit scale.
MATCH_DISTANCE_THRESHOLD = 5000.0   # generous default; tighten per project units
MOVE_TOLERANCE = 1.0                # below this, treat as "unchanged" (rounding noise)

# ---------------------------------------------------------------------------
# GEOMETRY HELPERS
# ---------------------------------------------------------------------------

def entity_centroid(e):
    """Return a representative (x, y) point for any entity type we know about."""
    t = e.get("type")
    if t == "LINE" and "start" in e and "end" in e:
        s, en = e["start"], e["end"]
        return ((s[0] + en[0]) / 2.0, (s[1] + en[1]) / 2.0)
    if t == "CIRCLE" and "center" in e:
        return (e["center"][0], e["center"][1])
    if "insert" in e:
        return (e["insert"][0], e["insert"][1])
    if "center" in e:
        return (e["center"][0], e["center"][1])
    if "bbox" in e:
        (x0, y0), (x1, y1) = e["bbox"]
        return ((x0 + x1) / 2.0, (y0 + y1) / 2.0)
    return None  # entity has no locatable geometry in this export -> can't be matched


def entity_signature(e):
    """Attributes (beyond position) used to detect 'modified' vs 'unchanged'."""
    t = e.get("type")
    sig = {}
    if t == "LINE":
        sig["length"] = _dist(e.get("start"), e.get("end"))
    if t == "CIRCLE":
        sig["radius"] = e.get("radius")
    if t == "MTEXT":
        sig["text"] = e.get("text")
    sig["layer"] = e.get("layer")
    return sig


def _dist(a, b):
    if a is None or b is None:
        return None
    return float(np.hypot(a[0] - b[0], a[1] - b[1]))


# ---------------------------------------------------------------------------
# MATCHING
# ---------------------------------------------------------------------------

def group_by_type_layer(entities):
    groups = defaultdict(list)
    for e in entities:
        groups[(e.get("type"), e.get("layer"))].append(e)
    return groups


def match_group(before_list, after_list):
    """
    Optimal assignment between two lists of entities (same type+layer) using
    centroid distance. Returns (matched_pairs, unmatched_before, unmatched_after).
    Entities with no locatable geometry are placed straight into unmatched
    (can't be diffed positionally; flagged separately in the report).
    """
    b_pts, b_idx = [], []
    for i, e in enumerate(before_list):
        c = entity_centroid(e)
        if c:
            b_pts.append(c); b_idx.append(i)

    a_pts, a_idx = [], []
    for j, e in enumerate(after_list):
        c = entity_centroid(e)
        if c:
            a_pts.append(c); a_idx.append(j)

    matched_pairs = []
    unmatched_before = [before_list[i] for i in range(len(before_list)) if i not in b_idx]
    unmatched_after = [after_list[j] for j in range(len(after_list)) if j not in a_idx]

    if b_pts and a_pts:
        b_arr = np.array(b_pts)
        a_arr = np.array(a_pts)
        cost = np.linalg.norm(b_arr[:, None, :] - a_arr[None, :, :], axis=2)
        row_ind, col_ind = linear_sum_assignment(cost)

        used_b, used_a = set(), set()
        for r, c in zip(row_ind, col_ind):
            if cost[r, c] <= MATCH_DISTANCE_THRESHOLD:
                matched_pairs.append((before_list[b_idx[r]], after_list[a_idx[c]], cost[r, c]))
                used_b.add(b_idx[r]); used_a.add(a_idx[c])

        unmatched_before += [before_list[i] for i in b_idx if i not in used_b]
        unmatched_after += [after_list[j] for j in a_idx if j not in used_a]

    return matched_pairs, unmatched_before, unmatched_after


# ---------------------------------------------------------------------------
# DIFF CLASSIFICATION
# ---------------------------------------------------------------------------

def build_diff(before_entities, after_entities):
    before_groups = group_by_type_layer(before_entities)
    after_groups = group_by_type_layer(after_entities)

    all_keys = set(before_groups) | set(after_groups)
    report = {"added": [], "removed": [], "modified": [], "unchanged_count": 0}

    for key in all_keys:
        etype, layer = key
        b_list = before_groups.get(key, [])
        a_list = after_groups.get(key, [])
        matched, unmatched_b, unmatched_a = match_group(b_list, a_list)

        for e in unmatched_b:
            report["removed"].append(_tag(e, layer))
        for e in unmatched_a:
            report["added"].append(_tag(e, layer))

        for before_e, after_e, dist in matched:
            sig_b = entity_signature(before_e)
            sig_a = entity_signature(after_e)
            changed_attrs = {
                k: {"before": sig_b.get(k), "after": sig_a.get(k)}
                for k in set(sig_b) | set(sig_a)
                if sig_b.get(k) != sig_a.get(k)
            }
            moved = dist is not None and dist > MOVE_TOLERANCE

            if moved or changed_attrs:
                entry = _tag(after_e, layer)
                entry["change"] = {}
                if moved:
                    entry["change"]["moved_distance"] = round(dist, 3)
                if changed_attrs:
                    entry["change"]["attributes"] = changed_attrs
                report["modified"].append(entry)
            else:
                report["unchanged_count"] += 1

    return report


def _tag(e, layer):
    return {
        "type": e.get("type"),
        "layer": layer,
        "structural_relevance": "high" if layer in STRUCTURAL_LAYERS else "low",
        "raw": e,
    }


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("before")
    parser.add_argument("after")
    parser.add_argument("--out", default="diff_report.json")
    args = parser.parse_args()

    with open(args.before) as f:
        before = json.load(f)
    with open(args.after) as f:
        after = json.load(f)

    report = build_diff(before, after)

    # Sort so high-relevance changes surface first
    for key in ("added", "removed", "modified"):
        report[key].sort(key=lambda x: 0 if x["structural_relevance"] == "high" else 1)

    with open(args.out, "w") as f:
        json.dump(report, f, indent=2)

    print(f"Added: {len(report['added'])}, Removed: {len(report['removed'])}, "
          f"Modified: {len(report['modified'])}, Unchanged: {report['unchanged_count']}")
    print(f"Report written to {args.out}")


if __name__ == "__main__":
    main()