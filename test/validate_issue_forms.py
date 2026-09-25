#!/usr/bin/env python3
"""Structural validation of issue forms and config against GitHub's schema."""
import glob
import json
import sys

import yaml

TYPES = {"markdown", "textarea", "input", "dropdown", "checkboxes"}
errors = []


def err(f, msg):
    errors.append(f"{f}: {msg}")


def check_form(f):
    d = yaml.safe_load(open(f))
    for k in ("name", "description", "body"):
        if k not in d:
            err(f, f"missing top-level '{k}'")
    ids = set()
    ai_dropdown = confirm_boxes = None
    for i, item in enumerate(d.get("body", [])):
        t = item.get("type")
        if t not in TYPES:
            err(f, f"body[{i}] bad type {t!r}")
            continue
        attrs = item.get("attributes", {})
        if t == "markdown":
            if "value" not in attrs:
                err(f, f"body[{i}] markdown needs attributes.value")
            continue
        if "label" not in attrs and t != "checkboxes":
            err(f, f"body[{i}] {t} needs attributes.label")
        if "id" in item:
            if item["id"] in ids:
                err(f, f"duplicate id {item['id']}")
            ids.add(item["id"])
        if t == "dropdown":
            if not attrs.get("options"):
                err(f, f"body[{i}] dropdown needs options")
            if item.get("id") == "ai-use":
                ai_dropdown = item
        if t == "checkboxes":
            if not attrs.get("options"):
                err(f, f"body[{i}] checkboxes needs options")
            for o in attrs.get("options", []):
                if "label" not in o:
                    err(f, f"body[{i}] checkbox option needs label")
            if item.get("id") == "confirmations":
                confirm_boxes = attrs["options"]
    # ASL003 requirements
    if not ai_dropdown:
        err(f, "missing ai-use dropdown")
    else:
        if ai_dropdown["attributes"]["options"] != ["No", "Yes, for wording or editing only", "Yes, substantially"]:
            err(f, "ai-use options wrong (YAML 'No' must be quoted)")
        if not ai_dropdown.get("validations", {}).get("required"):
            err(f, "ai-use dropdown not required")
        if ai_dropdown["attributes"]["label"] != "Did you use AI tools to write this report?":
            err(f, "ai-use label wrong")
    if not confirm_boxes:
        err(f, "missing confirmations checkboxes")
    else:
        if not any("ASL003" in o["label"] and o.get("required") for o in confirm_boxes):
            err(f, "missing required ASL003 checkbox")
        if "bug_report" in f and not any(
            o["label"] == "I have personally experienced or reproduced this problem" and o.get("required")
            for o in confirm_boxes
        ):
            err(f, "bug report missing required reproduced checkbox")


for f in sorted(glob.glob("ISSUE_TEMPLATE/*.yml")):
    if f.endswith("config.yml"):
        c = yaml.safe_load(open(f))
        if c.get("blank_issues_enabled") is not False:
            err(f, "blank_issues_enabled must be false")
        for l in c.get("contact_links", []):
            if set(l) != {"name", "url", "about"}:
                err(f, f"contact link keys {sorted(l)}")
    else:
        check_form(f)

json.load(open("workflow-templates/ai-disclosure.properties.json"))
if errors:
    print("\n".join(errors))
    sys.exit(1)
print("issue forms OK")
