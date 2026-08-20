#!/usr/bin/env python3
"""Validate the categorized communications question bank used by the quiz app."""

import argparse
import json
import sys
from pathlib import Path


LETTERS = "ABCDEF"
CATEGORY_BY_ID = {}
for _i in (1, 5, 6, 7, 11, 12, 19, 20):
    CATEGORY_BY_ID[_i] = "qiye"
for _i in (2, 3, 4, 8, 9, 10) + tuple(range(13, 19)) + tuple(range(156, 166)):
    CATEGORY_BY_ID[_i] = "xingce"
for _i in range(21, 34):
    CATEGORY_BY_ID[_i] = "tongxin"
for _i in range(34, 47):
    CATEGORY_BY_ID[_i] = "jiaohuan"
for _i in range(47, 60):
    CATEGORY_BY_ID[_i] = "guangxian"
for _i in range(60, 73):
    CATEGORY_BY_ID[_i] = "yidong"
for _i in range(73, 86):
    CATEGORY_BY_ID[_i] = "shujuwang"
for _i in range(86, 96):
    CATEGORY_BY_ID[_i] = "qiye"
for _i in range(96, 102):
    CATEGORY_BY_ID[_i] = "tongxin"
for _i in range(102, 108):
    CATEGORY_BY_ID[_i] = "jiaohuan"
for _i in range(108, 114):
    CATEGORY_BY_ID[_i] = "guangxian"
for _i in range(114, 120):
    CATEGORY_BY_ID[_i] = "yidong"
for _i in range(120, 126):
    CATEGORY_BY_ID[_i] = "shujuwang"
for _i in range(126, 132):
    CATEGORY_BY_ID[_i] = "tongxin"
for _i in range(132, 138):
    CATEGORY_BY_ID[_i] = "jiaohuan"
for _i in range(138, 144):
    CATEGORY_BY_ID[_i] = "guangxian"
for _i in range(144, 150):
    CATEGORY_BY_ID[_i] = "yidong"
for _i in range(150, 156):
    CATEGORY_BY_ID[_i] = "shujuwang"


def norm_type(value):
    text = str(value or "").strip().lower()
    if text in ("single", "单选"):
        return "single"
    if text in ("multiple", "multi", "多选"):
        return "multiple"
    if text in ("judge", "truefalse", "判断"):
        return "judge"
    return None


def norm_answer(value, qtype, option_count, index, errors):
    if qtype == "multiple":
        if not isinstance(value, list) or not value:
            errors.append(f"Q{index}: multiple-choice answer must be a non-empty array")
            return []
        keys = []
        for item in value:
            key = str(item).strip().upper()
            if key in LETTERS[:option_count]:
                keys.append(key)
            else:
                errors.append(f"Q{index}: answer option {item!r} is out of range")
        return sorted(set(keys))
    if qtype == "judge":
        if isinstance(value, bool):
            return "A" if value else "B"
        text = str(value).strip().lower()
        if text in ("true", "1", "对", "正确", "a"):
            return "A"
        if text in ("false", "0", "错", "错误", "b"):
            return "B"
        errors.append(f"Q{index}: judge answer must be true/false or A/B")
        return "A"
    key = str(value).strip().upper()
    if key not in LETTERS[:option_count]:
        errors.append(f"Q{index}: single-choice answer {value!r} is out of range")
    return key


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bank", type=Path, help="path to question bank JSON")
    parser.add_argument("--expect-single", type=int, default=95)
    parser.add_argument("--expect-multiple", type=int, default=40)
    parser.add_argument("--expect-judge", type=int, default=30)
    parser.add_argument("--allow-missing-reasons", action="store_true")
    args = parser.parse_args()

    try:
        data = json.loads(args.bank.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"FAIL: cannot read JSON: {exc}")
        return 1

    if not isinstance(data, dict):
        print("FAIL: bank must be a JSON object")
        return 1
    if not isinstance(data.get("categories"), list) or len(data["categories"]) < 2:
        print("FAIL: bank.categories must be a non-empty array")
        return 1
    if not isinstance(data.get("composite"), dict) or not isinstance(data["composite"].get("weights"), dict):
        print("FAIL: bank.composite.weights is required")
        return 1

    questions = data.get("questions")
    if not isinstance(questions, list) or not questions:
        print("FAIL: bank.questions must be a non-empty array")
        return 1

    errors = []
    warnings = []
    counts = {"single": 0, "multiple": 0, "judge": 0}
    section_counts = {}
    full_score = 0.0
    cat_ids = {c.get("id") for c in data["categories"]}
    expected_ids = {"xingce", "qiye", "tongxin", "guangxian", "shujuwang", "yidong", "huiyi", "jiaohuan"}
    if not expected_ids.issubset(cat_ids):
        errors.append(f"missing categories: {sorted(expected_ids - cat_ids)}")

    for index, q in enumerate(questions, start=1):
        if not isinstance(q, dict):
            errors.append(f"Q{index}: question must be an object")
            continue
        qtype = norm_type(q.get("type"))
        if qtype is None:
            errors.append(f"Q{index}: invalid type {q.get('type')!r}")
            continue
        counts[qtype] += 1
        section = str(q.get("section") or "")
        section_counts[section] = section_counts.get(section, 0) + 1
        if q.get("category") not in cat_ids:
            errors.append(f"Q{index}: unknown category {q.get('category')!r}")
        expected_cat = CATEGORY_BY_ID.get(index)
        if expected_cat and q.get("category") != expected_cat:
            errors.append(f"Q{index}: expected category {expected_cat}, got {q.get('category')!r}")

        if not q.get("stem") or not str(q["stem"]).strip():
            errors.append(f"Q{index}: missing stem")

        options = ["正确", "错误"] if qtype == "judge" else q.get("options")
        if qtype != "judge":
            if not isinstance(options, list) or len(options) < 2:
                errors.append(f"Q{index}: options must contain at least 2 items")
                options = []
            else:
                options = [str(opt) for opt in options]

        if "answer" not in q:
            errors.append(f"Q{index}: missing answer")
        else:
            norm_answer(q.get("answer"), qtype, len(options), index, errors)

        if not q.get("reason") or not str(q["reason"]).strip():
            if args.allow_missing_reasons:
                warnings.append(f"Q{index}: missing reason")
            else:
                errors.append(f"Q{index}: missing reason")

        try:
            score = float(q.get("score"))
        except (TypeError, ValueError):
            errors.append(f"Q{index}: invalid score {q.get('score')!r}")
            score = 0.0
        if score < 0:
            errors.append(f"Q{index}: score must not be negative")
            score = 0.0
        expected_score = 1 if 81 <= index <= 85 or 96 <= index <= 125 else 0.5
        if abs(score - expected_score) > 1e-9:
            errors.append(f"Q{index}: expected score {expected_score:g}, got {score:g}")
        full_score += score

    total = sum(counts.values())
    if counts["single"] != args.expect_single:
        errors.append(f"expected {args.expect_single} single questions, got {counts['single']}")
    if counts["multiple"] != args.expect_multiple:
        errors.append(f"expected {args.expect_multiple} multiple questions, got {counts['multiple']}")
    if counts["judge"] != args.expect_judge:
        errors.append(f"expected {args.expect_judge} judge questions, got {counts['judge']}")
    if total != 165:
        errors.append(f"expected 165 questions total, got {total}")
    if abs(full_score - 100) > 1e-9:
        errors.append(f"expected full score 100, got {full_score:g}")
    expected_sections = {"综合单选": 20, "专业单选": 65, "综合多选": 10, "专业多选": 30, "专业判断": 30, "资料分析": 10}
    for section, want in expected_sections.items():
        if section_counts.get(section) != want:
            errors.append(f"expected {want} questions in {section}, got {section_counts.get(section, 0)}")

    print(f"Title: {data.get('title', '(untitled)')}")
    print(f"Questions: {total} (single={counts['single']}, multiple={counts['multiple']}, judge={counts['judge']})")
    print(f"Full score: {full_score:g}")
    for warning in warnings:
        print(f"WARN: {warning}")
    for error in errors:
        print(f"ERROR: {error}")

    if errors:
        print("FAIL")
        return 1
    print("OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
