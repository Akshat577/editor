# import subprocess
# import os
# import json
# import ezdxf
# from pathlib import Path

# # -------------------------------
# # CHANGE THIS TO YOUR ODA PATH
# # -------------------------------

# ODA_PATH = "/Applications/ODAFileConverter.app/Contents/MacOS/ODAFileConverter"

# # -------------------------------


# def convert_dwg_to_dxf(dwg_file, output_dir):

#     dwg_file = Path(dwg_file).resolve()
#     output_dir = Path(output_dir).resolve()

#     input_dir = dwg_file.parent

#     output_dir.mkdir(parents=True, exist_ok=True)

#     command = [
#         ODA_PATH,
#         str(input_dir),          # Input folder
#         str(output_dir),         # Output folder
#         "ACAD2018",              # Output version
#         "DXF",                   # Output type
#         "0",                     # Recurse
#         "1",                     # Audit
#         str(dwg_file.name)
#     ]

#     subprocess.run(command, check=True)

#     dxf_file = output_dir / (dwg_file.stem + ".dxf")

#     if not dxf_file.exists():
#         raise Exception("DXF conversion failed")

#     return dxf_file


# def entity_to_json(entity):

#     data = {
#         "type": entity.dxftype(),
#         "layer": entity.dxf.layer,
#     }

#     if entity.dxftype() == "LINE":

#         data["start"] = list(entity.dxf.start)
#         data["end"] = list(entity.dxf.end)

#     elif entity.dxftype() == "CIRCLE":

#         data["center"] = list(entity.dxf.center)
#         data["radius"] = entity.dxf.radius

#     elif entity.dxftype() == "ARC":

#         data["center"] = list(entity.dxf.center)
#         data["radius"] = entity.dxf.radius
#         data["start_angle"] = entity.dxf.start_angle
#         data["end_angle"] = entity.dxf.end_angle

#     elif entity.dxftype() == "LWPOLYLINE":

#         points = []

#         for p in entity.get_points():
#             points.append([p[0], p[1]])

#         data["points"] = points

#     elif entity.dxftype() == "TEXT":

#         data["text"] = entity.dxf.text
#         data["position"] = list(entity.dxf.insert)

#     return data


# def dxf_to_json(dxf_file, json_file):

#     doc = ezdxf.readfile(dxf_file)

#     msp = doc.modelspace()

#     result = []

#     for entity in msp:
#         try:
#             result.append(entity_to_json(entity))
#         except Exception as e:
#             print("Skipping:", entity.dxftype(), e)

#     with open(json_file, "w") as f:
#         json.dump(result, f, indent=4)

#     print("Saved", json_file)


# def main():

#     dwg = "/Users/akshat/Desktop/dwgtojson/Lift Details.dwg"

#     output_dir = "/Users/akshat/Desktop/dwgtojson/converted"

#     dxf = convert_dwg_to_dxf(dwg, output_dir)

#     json_file = "/Users/akshat/Desktop/dwgtojson/building.json"

#     dxf_to_json(dxf, json_file)


# if __name__ == "__main__":
#     main()

import subprocess
import os
import json
import ezdxf
from ezdxf import bbox as ezdxf_bbox
from pathlib import Path

# -------------------------------
# CHANGE THIS TO YOUR ODA PATH
# -------------------------------

ODA_PATH = "/Applications/ODAFileConverter.app/Contents/MacOS/ODAFileConverter"

# -------------------------------


def convert_dwg_to_dxf(dwg_file, output_dir):

    dwg_file = Path(dwg_file).resolve()
    output_dir = Path(output_dir).resolve()

    input_dir = dwg_file.parent

    output_dir.mkdir(parents=True, exist_ok=True)

    command = [
        ODA_PATH,
        str(input_dir),          # Input folder
        str(output_dir),         # Output folder
        "ACAD2018",              # Output version
        "DXF",                   # Output type
        "0",                     # Recurse
        "1",                     # Audit
        str(dwg_file.name)
    ]

    subprocess.run(command, check=True)

    dxf_file = output_dir / (dwg_file.stem + ".dxf")

    if not dxf_file.exists():
        raise Exception("DXF conversion failed")

    return dxf_file


def _generic_geometry(entity):
    """
    Fallback geometry extractor that works for ANY entity type (MTEXT, HATCH,
    INSERT, SPLINE, DIMENSION, etc.) by computing its bounding box.
    This is what makes every entity locatable/diffable, not just LINE/CIRCLE/TEXT.
    """
    try:
        box = ezdxf_bbox.extents([entity], fast=True)
    except Exception:
        return {}

    if not box.has_data:
        return {}

    center = box.center
    return {
        "insert": [round(center.x, 4), round(center.y, 4)],
        "bbox": [
            [round(box.extmin.x, 4), round(box.extmin.y, 4)],
            [round(box.extmax.x, 4), round(box.extmax.y, 4)],
        ],
    }


def entity_to_json(entity):

    data = {
        "type": entity.dxftype(),
        "layer": entity.dxf.layer,
    }

    # Type-specific fields (kept from your original code, unchanged)
    if entity.dxftype() == "LINE":
        data["start"] = list(entity.dxf.start)
        data["end"] = list(entity.dxf.end)

    elif entity.dxftype() == "CIRCLE":
        data["center"] = list(entity.dxf.center)
        data["radius"] = entity.dxf.radius

    elif entity.dxftype() == "ARC":
        data["center"] = list(entity.dxf.center)
        data["radius"] = entity.dxf.radius
        data["start_angle"] = entity.dxf.start_angle
        data["end_angle"] = entity.dxf.end_angle

    elif entity.dxftype() == "LWPOLYLINE":
        points = [[p[0], p[1]] for p in entity.get_points()]
        data["points"] = points

    elif entity.dxftype() == "TEXT":
        data["text"] = entity.dxf.text
        data["position"] = list(entity.dxf.insert)

    elif entity.dxftype() == "MTEXT":
        data["text"] = entity.text
        data["position"] = list(entity.dxf.insert)

    elif entity.dxftype() == "HATCH":
        data["pattern_name"] = getattr(entity.dxf, "pattern_name", None)
        data["solid_fill"] = bool(getattr(entity.dxf, "solid_fill", 0))

    elif entity.dxftype() == "INSERT":
        # Block reference — critical for architectural drawings (doors, columns,
        # fixtures are often blocks, not raw geometry)
        data["block_name"] = entity.dxf.name
        data["position"] = list(entity.dxf.insert)
        data["rotation"] = getattr(entity.dxf, "rotation", 0.0)
        data["scale"] = [
            getattr(entity.dxf, "xscale", 1.0),
            getattr(entity.dxf, "yscale", 1.0),
        ]

    elif entity.dxftype() == "DIMENSION":
        try:
            data["measurement"] = entity.get_measurement()
        except Exception:
            pass

    # Generic fallback geometry — fills in insert/bbox for every entity type,
    # including ones with no case above (SPLINE, SOLID, ELLIPSE, etc.), and
    # ALSO fills the gap for MTEXT/HATCH so they become locatable/diffable.
    if "insert" not in data and "center" not in data and "start" not in data:
        data.update(_generic_geometry(entity))
    else:
        # Still attach bbox for consistency, useful for the diff tool's matching
        geom = _generic_geometry(entity)
        if "bbox" in geom:
            data["bbox"] = geom["bbox"]

    return data


def dxf_to_json(dxf_file, json_file):

    doc = ezdxf.readfile(dxf_file)

    msp = doc.modelspace()

    result = []

    for entity in msp:
        try:
            result.append(entity_to_json(entity))
        except Exception as e:
            print("Skipping:", entity.dxftype(), e)

    with open(json_file, "w") as f:
        json.dump(result, f, indent=4)

    print("Saved", json_file)


def convert(dwg_path, output_dir, json_path):
    """Single entry point: DWG -> DXF -> enriched JSON."""
    dxf = convert_dwg_to_dxf(dwg_path, output_dir)
    dxf_to_json(dxf, json_path)
    return json_path


def main():
    dwg = "/Users/akshat/Desktop/dwgtojson/Lift Details.dwg"
    output_dir = "/Users/akshat/Desktop/dwgtojson/converted"
    json_file = "/Users/akshat/Desktop/dwgtojson/building.json"

    convert(dwg, output_dir, json_file)


if __name__ == "__main__":
    main()