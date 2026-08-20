#!/usr/bin/env python3
"""Build an import-test bank JSON that includes images extracted from the test PDF."""

import base64
import io
import json
from pathlib import Path

import pdfplumber


PDF = Path(r"F:/xwechat_files/wxid_90pko7ciifhs22_642f/msg/file/2026-08/通信精讲班结课测试.pdf")
BANK = Path(__file__).with_name("sample-bank.json")
OUT = Path(__file__).with_name("import-test-bank.json")

# question id -> list of (page_index, crop_bbox)
CROPS = {
    9: [(1, (192, 318, 402, 488))],
    161: [
        (14, (103, 638, 513, 738)),
        (16, (133, 64, 483, 251)),
        (16, (111, 236, 505, 407)),
    ],
    162: [
        (14, (103, 638, 513, 738)),
        (16, (133, 64, 483, 251)),
        (16, (111, 236, 505, 407)),
    ],
    163: [
        (14, (103, 638, 513, 738)),
        (16, (133, 64, 483, 251)),
        (16, (111, 236, 505, 407)),
    ],
    164: [
        (14, (103, 638, 513, 738)),
        (16, (133, 64, 483, 251)),
        (16, (111, 236, 505, 407)),
    ],
    165: [
        (14, (103, 638, 513, 738)),
        (16, (133, 64, 483, 251)),
        (16, (111, 236, 505, 407)),
    ],
}


def crop_data_uri(pdf, page_index, bbox):
    page = pdf.pages[page_index]
    image = page.crop(bbox).to_image(resolution=150)
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def main():
    bank = json.loads(BANK.read_text(encoding="utf-8"))
    bank["title"] = "通信精讲班结课测试（含图导入测试）"
    with pdfplumber.open(str(PDF)) as pdf:
        for q in bank["questions"]:
            crops = CROPS.get(q["id"])
            if crops:
                q["images"] = [crop_data_uri(pdf, pi, bbox) for pi, bbox in crops]
    OUT.write_text(json.dumps(bank, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    total_imgs = sum(len(q.get("images", [])) for q in bank["questions"])
    print(f"Wrote {OUT} with {len(bank['questions'])} questions, {total_imgs} embedded images")


if __name__ == "__main__":
    main()
