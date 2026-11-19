"""Read a JSON envelope from stdin. Never print credentials or project records."""
import json
import re
import sys
from urllib import request, error

URL = "https://qc-automation-workbench.doanrl236.chatgpt.site/api/rd-snapshot"

class NoRedirect(request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None

def call(opener, token, payload=None):
    headers = {"OAI-Sites-Authorization": "Bearer " + token, "X-RD-Sync-Token": token}
    if payload is not None:
        headers["Content-Type"] = "application/json"
    req = request.Request(URL, data=payload, headers=headers)
    with opener.open(req, timeout=25) as response:
        return json.load(response)

def normalize(value):
    return " ".join(str(value or "").casefold().split())

def matrix_index(matrix):
    if not matrix or matrix[0][9:13] != ["Tổng case (N)", "Case đã auto (A)", "Case còn manual (N−A)", "% Automation"]:
        raise ValueError("Unexpected automation matrix headers")
    index = {}
    for row in matrix[2:]:
        if not row or not str(row[0]).strip().isdigit():
            continue
        row = (row + [""] * 21)[:21]
        for name in {normalize(row[2]), normalize(row[4])} - {""}:
            index.setdefault(name, []).append(row)
    if not index:
        raise ValueError("No automation matrix projects found")
    return index

def main():
    envelope = json.load(sys.stdin)
    a, b = envelope["projects"], envelope["metrics"]
    if len(a) < 2 or len(b) < 2 or a[0][:3] != ["Dự án", "QC phụ trách", "Môi trường"] or len(b[0]) != 23:
        raise ValueError("Unexpected sheet headers")
    if b[0][2] not in ("Mức ưu tiên", "Mức độ ưu tiên") or b[0][4:6] != ["Tổng case baseline (N)", "Case đã auto đủ điều kiện (A)"]:
        raise ValueError("Unexpected metrics headers")
    a[0] = (a[0] + [""] * 8)[:8]
    b[0][2] = "Mức ưu tiên"
    headers = a[0] + ["Account truy cập"] + b[0]
    index = matrix_index(envelope["matrix"])
    rows = []
    for i, row in enumerate(a[1:], start=1):
        if not row or not str(row[0]).strip():
            continue
        p = (row + [""] * 8)[:8]
        for col in range(3, 8):
            p[col] = re.sub(r"(https?://)[^/\s@]+@", r"\1", str(p[col]), flags=re.I)
        m = (b[i] + [""] * 23)[:23] if i < len(b) else [""] * 23
        name = normalize(p[0])
        candidates = index.get(name, [])
        by_product = [entry for entry in candidates if normalize(entry[2]) == name]
        candidates = by_product or candidates
        if len(candidates) > 1:
            raise ValueError("Ambiguous automation matrix project: " + str(p[0]))
        entry = candidates[0] if candidates else [""] * 21
        for summary_col, matrix_col in {4:9, 5:10, 8:12, 9:13, 10:15, 11:16, 12:17, 13:18, 14:19}.items():
            m[summary_col] = entry[matrix_col]
        rows.append([str(value) if value is not None else "" for value in p + [""] + m])
    if not rows:
        raise ValueError("No projects found")
    payload = {"headers": headers, "rows": rows}
    opener = request.build_opener(NoRedirect())
    token = envelope["token"]
    result = call(opener, token, json.dumps(payload, ensure_ascii=False).encode())
    verified = call(opener, token)
    if verified.get("headers") != headers or verified.get("rows") != rows or not verified.get("syncedAt"):
        raise ValueError("Hosted readback differs from source")
    print(json.dumps({"status": result["status"], "rows": len(rows), "syncedAt": verified["syncedAt"]}))

if __name__ == "__main__":
    try:
        main()
    except error.HTTPError as exc:
        sys.exit(f"Site returned HTTP {exc.code}")
    except (OSError, KeyError, ValueError) as exc:
        sys.exit(str(exc))
