import json
import argparse
import os

from dotenv import load_dotenv
from google import genai

load_dotenv()  

SYSTEM_PROMPT = """You are assisting a structural engineer who needs to understand \
what changed between two versions of an architectural drawing, so they can decide \
where the structural drawing needs corresponding updates.

You will be given a JSON diff with three categories: "added", "removed", and \
"modified" entities, each tagged with structural_relevance ("high" or "low") \
based on their layer.

Write a concise report with these sections:

1. Summary (2-3 sentences, high-level)

2. Changes requiring structural review
   - Only include items whose structural_relevance is "high".
   - Describe each change in plain language:
     - what element changed
     - what layer
     - what happened
     - approximate movement or modification if available

3. Other changes
   - Include all "low" relevance changes.
   - Keep each to one short line.

Do not dump JSON.
Do not repeat coordinates unless necessary.
Translate technical data into readable engineering language.
Be precise and factual.
"""


def generate_report(diff_path, out_path):

    with open(diff_path) as f:
        diff = json.load(f)

    def slim(entry):
        return {
            "type": entry.get("type"),
            "layer": entry.get("layer"),
            "structural_relevance": entry.get("structural_relevance"),
            "change": entry.get("change"),
        }

    slim_diff = {
        "added": [slim(e) for e in diff.get("added", [])],
        "removed": [slim(e) for e in diff.get("removed", [])],
        "modified": [slim(e) for e in diff.get("modified", [])],
        "unchanged_count": diff.get("unchanged_count", 0),
    }

    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        raise ValueError(
            "GEMINI_API_KEY environment variable not found. "
            "Check that a .env file exists in this directory and that "
            "python-dotenv is installed (pip install python-dotenv)."
        )

    client = genai.Client(api_key=api_key)

    prompt = f"""
{SYSTEM_PROMPT}

JSON DIFF:

{json.dumps(slim_diff, indent=2)}
"""

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
    )

    report = response.text

    with open(out_path, "w") as f:
        f.write(report)

    print(f"\nReport written to {out_path}\n")
    print(report)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("diff_json")
    parser.add_argument("--out", default="engineer_report.md")

    args = parser.parse_args()

    generate_report(args.diff_json, args.out)


if __name__ == "__main__":
    main()