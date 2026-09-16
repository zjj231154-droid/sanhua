#!/usr/bin/env python3
"""Initialize one combined screenplay and AIGC short-drama project."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import date
from pathlib import Path

from init_project import initialize_project, slugify


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--name", required=True, help="Human-readable project name")
    parser.add_argument("--output", required=True, type=Path, help="New or empty project directory")
    parser.add_argument("--project-id", help="Stable ID beginning with PRJ-")
    parser.add_argument("--aspect-ratio", default="9:16", help="Delivery aspect ratio")
    parser.add_argument("--episodes", type=int, default=60, help="Planned episode count")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.episodes <= 0:
        print("error: episodes must be positive", file=sys.stderr)
        return 2
    name_slug = slugify(args.name)
    if name_slug == "PROJECT":
        digest = hashlib.sha256(args.name.encode("utf-8")).hexdigest()[:8].upper()
        name_slug = f"PROJECT-{digest}"
    project_id = args.project_id or f"PRJ-{date.today().strftime('%Y%m%d')}-{name_slug}"
    output = args.output.expanduser().resolve()
    try:
        initialize_project(args.name, output, project_id, args.aspect_ratio)
        for relative in (
            "01_story/episodes",
            "07_review/screenplay",
            "09_delivery/screenplay",
        ):
            (output / relative).mkdir(parents=True, exist_ok=True)
        state = {
            "currentStep": "start",
            "genre": [],
            "audience": "",
            "tone": "",
            "ending": "",
            "totalEpisodes": args.episodes,
            "completedEpisodes": [],
            "language": "zh-CN",
            "mode": "domestic",
            "dramaTitle": args.name,
            "productionSchema": 2,
            "projectId": project_id,
        }
        (output / ".drama-state.json").write_text(
            json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
    except (OSError, ValueError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 2
    print(f"Created combined short-drama project {project_id} at {output}")
    print("Screenplay workflow: ready; AIGC production schema: v2")
    print("Network requests: 0; database operations: 0")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
