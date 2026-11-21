"""Check authored/lessons/NN.json files against the format and the standard's rules.

usage: python3 tools/validate_authored.py [project_root]
"""
import sys, os, json, re, glob

ROOT = sys.argv[1] if len(sys.argv) > 1 else "."
errors, warnings = [], []
ids = set()


def err(f, m):
    errors.append(f"{os.path.basename(f)}: {m}")


def warn(f, m):
    warnings.append(f"{os.path.basename(f)}: {m}")


for f in sorted(glob.glob(os.path.join(ROOT, "authored", "lessons", "*.json"))):
    try:
        a = json.load(open(f, encoding="utf-8"))
    except Exception as e:
        err(f, f"invalid JSON: {e}")
        continue
    n = int(os.path.basename(f)[:2])
    if a.get("lesson") != n:
        err(f, "field 'lesson' does not match file name")

    for e in a.get("examples", []):
        if not e.get("title") or not e.get("html"):
            err(f, "example without title/html")

    for t in a.get("tasks", []):
        for k in ("title", "goal", "steps", "result", "form"):
            if not t.get(k):
                err(f, f"task '{t.get('title')}' missing '{k}'")  # §8: порядок, результат, форма

    qs = a.get("questions", [])
    if len(qs) < 5:
        warn(f, f"only {len(qs)} questions (need >= 5)")
    types = {q.get("type") for q in qs}
    if len(types) < 2:
        warn(f, "questions should vary in answer form (§8)")
    for q in qs:
        qid = q.get("id")
        if qid in ids:
            err(f, f"duplicate id {qid}")
        ids.add(qid)
        if not q.get("text") or not q.get("explain"):
            err(f, f"{qid}: text/explain required")
        t = q.get("type")
        if t == "single":
            if not isinstance(q.get("correct"), int) or not 0 <= q["correct"] < len(q.get("options", [])):
                err(f, f"{qid}: bad 'correct'")
        elif t == "multiple":
            c = q.get("correct")
            if not isinstance(c, list) or not c or any(not 0 <= i < len(q.get("options", [])) for i in c):
                err(f, f"{qid}: bad 'correct' list")
        elif t == "truefalse":
            if not isinstance(q.get("correct"), bool):
                err(f, f"{qid}: 'correct' must be true/false")
        elif t == "input":
            if not q.get("answers"):
                err(f, f"{qid}: 'answers' required")
        else:
            err(f, f"{qid}: unknown type {t}")

    ts = a.get("tests", [])
    if len(ts) < 10:
        warn(f, f"only {len(ts)} test items (need >= 10)")
    for t in ts:
        tid = t.get("id")
        if tid in ids:
            err(f, f"duplicate id {tid}")
        ids.add(tid)
        o = t.get("options", [])
        if len(o) != 4:
            err(f, f"{tid}: need 4 options")
        if len(set(o)) != len(o):
            err(f, f"{tid}: duplicate options")
        if not isinstance(t.get("correct"), int) or not 0 <= t["correct"] < len(o):
            err(f, f"{tid}: bad 'correct'")
        if len(t.get("feedback", [])) != len(o):
            err(f, f"{tid}: feedback must explain every option (§10)")
        if t.get("level") not in (1, 2, 3):
            err(f, f"{tid}: level 1..3")
        if any(re.search(r"все (перечисленн|вышеперечисленн)|ни один из", x, re.I) for x in o):
            warn(f, f"{tid}: avoid 'all/none of the above' options")
    # option order is shuffled by the site at display time, so answer position is not checked here

    for t in a.get("terms", []):
        if not t.get("term") or not t.get("definition"):
            err(f, "term without definition")

for w in warnings:
    print("WARN ", w)
for e in errors:
    print("ERROR", e)
print(f"{len(errors)} errors, {len(warnings)} warnings")
sys.exit(1 if errors else 0)
