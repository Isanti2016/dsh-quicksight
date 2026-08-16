# dsh-quicksight tier-1 runner: fast local OCR via RapidOCR (PP-OCR / ONNX).
# Usage: python ocr.py <image-path> [out-file]
#   Writes extracted text (UTF-8) to out-file (default: <image>.ocr.txt),
#   prints one ASCII-only summary line:  OK: N chars -> <out-file>
#   or  ERROR: <reason>.  Fully offline; no data leaves the machine.

import sys
import os

def main():
    if len(sys.argv) < 2:
        print("ERROR: usage: ocr.py <image-path> [out-file]")
        return 2
    img = sys.argv[1]
    if not os.path.isfile(img):
        print(f"ERROR: image file not found: {img}")
        return 2
    out = sys.argv[2] if len(sys.argv) > 2 else img + ".ocr.txt"
    try:
        from rapidocr_onnxruntime import RapidOCR
    except Exception as e:
        print(f"ERROR: rapidocr not available: {e}")
        return 3
    try:
        engine = RapidOCR()
        result, _ = engine(img)
    except Exception as e:
        print(f"ERROR: OCR failed: {e}")
        return 1
    if not result:
        with open(out, "w", encoding="utf-8") as f:
            f.write("")
        print(f"OK: 0 chars -> {out}")
        return 0
    lines = [str(item[1]) for item in result]
    body = "\n".join(lines)
    with open(out, "w", encoding="utf-8") as f:
        f.write(body)
    print(f"OK: {len(body)} chars -> {out}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
