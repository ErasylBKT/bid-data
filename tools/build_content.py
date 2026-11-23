"""Build content/ (Module -> Block -> Lesson) from the copied site in source/.

usage (from project root):  python -I tools/build_content.py .
Requires beautifulsoup4.
"""
import sys, os, re, json, shutil
from bs4 import BeautifulSoup, NavigableString, Tag

ROOT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else ".")
SRC = os.path.join(ROOT, "source", "html")
OUT = os.path.join(ROOT, "content")

# ---------------------------------------------------------------- structure
MODULES = [
    {"id": "m1", "title_ru": "Основы больших данных и бизнес-аналитики",
     "title_kk": "Үлкен деректер мен бизнес-аналитика негіздері",
     "blocks": [
         {"id": "b1.1", "title_ru": "Понятие больших данных", "title_kk": "Үлкен деректер ұғымы", "lessons": [1, 2]},
         {"id": "b1.2", "title_ru": "Бизнес-аналитика (BI) и OLAP", "title_kk": "Бизнес-аналитика (BI) және OLAP", "lessons": [3, 4]},
     ]},
    {"id": "m2", "title_ru": "Технологии хранения и обработки больших данных",
     "title_kk": "Үлкен деректерді сақтау және өңдеу технологиялары",
     "blocks": [
         {"id": "b2.1", "title_ru": "Hadoop и MapReduce", "title_kk": "Hadoop және MapReduce", "lessons": [5, 6]},
         {"id": "b2.2", "title_ru": "NoSQL базы данных", "title_kk": "NoSQL дерекқорлары", "lessons": [7, 8]},
     ]},
    {"id": "m3", "title_ru": "Визуализация и интеллектуальный анализ данных",
     "title_kk": "Деректерді визуализациялау және зияткерлік талдау",
     "blocks": [
         {"id": "b3.1", "title_ru": "Визуализация данных и язык R", "title_kk": "Деректерді визуализациялау және R тілі", "lessons": [9, 10, 11]},
         {"id": "b3.2", "title_ru": "Интеллектуальный и статистический анализ", "title_kk": "Зияткерлік және статистикалық талдау", "lessons": [12, 13]},
         {"id": "b3.3", "title_ru": "Классификация и кластеризация", "title_kk": "Жіктеу және кластерлеу", "lessons": [14, 15]},
     ]},
]

LESSONS = {
    1: ("Введение в большие данные", "Үлкен деректерге кіріспе"),
    2: ("Аналитика данных", "Деректер аналитикасы"),
    3: ("Жизненный цикл аналитики данных", "Деректер аналитикасының өмірлік циклі"),
    4: ("Компоненты аналитики MS SQL Server", "MS SQL Server аналитика компоненттері"),
    5: ("Высокопроизводительные вычисления. Hadoop", "Жоғары өнімді есептеулер. Hadoop"),
    6: ("Hadoop MapReduce 1.0 и 2.0", "Hadoop MapReduce 1.0 және 2.0"),
    7: ("Масштабирование и многоуровневое хранение данных", "Масштабтау және деректерді көпдеңгейлі сақтау"),
    8: ("MongoDB", "MongoDB"),
    9: ("Визуализация данных и результатов анализа", "Деректер мен талдау нәтижелерін визуализациялау"),
    10: ("Графики и диаграммы", "Графиктер мен диаграммалар"),
    11: ("Типы данных", "Деректер типтері"),
    12: ("Классификация задач анализа данных", "Деректерді талдау есептерінің жіктелуі"),
    13: ("Статистические методы анализа данных", "Деректерді талдаудың статистикалық әдістері"),
    14: ("Метрический классификатор", "Метрикалық классификатор"),
    15: ("Алгоритм K-means", "K-means алгоритмі"),
}

# practice page -> (lesson, element). "theory" = appended to the lesson theory, "examples" = Примеры
PRACTICE = {
    1: (1, "theory"), 2: (2, "examples"), 4: (3, "theory"), 3: (4, "examples"),
    5: (5, "examples"), 6: (6, "theory"), 7: (7, "theory"), 8: (8, "theory"),
    9: (9, "theory"), 10: (11, "theory"), 11: (11, "theory"), 12: (12, "theory"),
    13: (13, "theory"), 14: (15, "theory"), 15: (15, "theory"),
}

# practice pages whose tail is a verbatim copy of a lecture: cut from this heading on
CUT_AT = {9: "Лекция 10"}

# lab id -> lesson   (A = first series on the Labs page, B = second series)
LABS = {
    "A1": 11, "A2": 11, "A3": 13, "A4": 10, "A5": 14,
    "B1": 11, "B2": 11, "B3": 11, "B4": 13, "B5": 10, "B6": 11, "B7": 11,
    "B8": 11, "B9": 14, "B10": 15, "B11": 12, "B12": 13, "B13": 13, "B14": 14,
}

# ---------------------------------------------------------------- helpers
def load(name):
    html = open(os.path.join(SRC, name + ".html"), encoding="utf-8").read()
    s = BeautifulSoup(html, "html.parser")
    for b in s.find_all("base"):
        b.decompose()
    for t in s.find_all(["title", "meta"]):
        t.decompose()
    return s


def norm(t):
    return re.sub(r"[\W_]+", "", t).lower()


def flatten(s):
    """Unwrap the per-section <div class=section> wrappers into one flat list of blocks."""
    out = []
    for d in s.find_all("div", class_="section"):
        for c in list(d.children):
            if isinstance(c, NavigableString) and not c.strip():
                continue
            out.append(c.extract())
    return out


def is_heading_para(el):
    """<p><strong>Short title</strong></p> used as a heading in the source."""
    if el.name != "p":
        return False
    txt = el.get_text(" ", strip=True)
    if not txt or len(txt) > 90 or txt.endswith((".", ":", ";", ",")):
        return False
    strongs = el.find_all("strong")
    st = "".join(x.get_text(" ", strip=True) for x in strongs).replace(" ", "")
    return bool(strongs) and st == txt.replace(" ", "") and not el.find("img")


def normalize_headings(blocks, soup):
    res = []
    for el in blocks:
        if isinstance(el, Tag):
            if el.name == "h1":
                el.name = "h2"
            elif el.name == "h4":
                el.name = "h4"
            elif is_heading_para(el):
                h = soup.new_tag("h3")
                h.string = el.get_text(" ", strip=True)
                el = h
            if el.name in ("h2", "h3", "h4"):
                txt = re.sub(r"\s+", " ", el.get_text(" ", strip=True)).strip()
                el.clear()
                el.string = txt
        res.append(el)
    return res


TITLE_RE = re.compile(r"^(лекция|практическ\w+ заняти\w+)\s*(№\s*)?\d+[.:]?", re.I)
QUIZ_RE = re.compile(r"контрольные вопросы", re.I)


def drop_title_lines(blocks):
    """Remove 'Лекция N…' / 'Практическое занятие N…' headings (the site shows the lesson title)."""
    out = []
    skip_next_short = False
    for el in blocks:
        txt = el.get_text(" ", strip=True) if isinstance(el, Tag) else str(el).strip()
        if isinstance(el, Tag) and el.name in ("h2", "h3", "h4", "p") and TITLE_RE.match(txt) and len(txt) < 110:
            # keep text after the title if it is a real heading, e.g. "Практическое занятие 8. Типы Data Minig"
            rest = TITLE_RE.sub("", txt).strip(" .:")
            if rest and el.name != "p" and not any(norm(rest) == norm(v[0]) for v in LESSONS.values()):
                el.string = rest
                out.append(el)
            skip_next_short = True
            continue
        if skip_next_short and isinstance(el, Tag) and el.name in ("p", "h3") and len(txt) < 40 and not txt.endswith("."):
            # split title continuation such as "результатов анализа"
            skip_next_short = False
            if norm(txt) and any(norm(txt) in norm(v[0]) for v in LESSONS.values()):
                continue
        skip_next_short = False
        out.append(el)
    return out


def split_quiz(blocks):
    """Separate 'Контрольные вопросы…' (self-check questions) from the theory."""
    for i, el in enumerate(blocks):
        if isinstance(el, Tag) and el.name in ("h2", "h3", "h4", "p") and QUIZ_RE.search(el.get_text()):
            return blocks[:i], blocks[i:]
    return blocks, []


def render(blocks):
    html = "\n".join(str(b) for b in blocks if str(b).strip())
    html = re.sub(r"(<br/>\s*){2,}", "<br/>", html)
    return html.strip() + "\n"


def text_len(html):
    return len(BeautifulSoup(html, "html.parser").get_text(strip=True))


# ---------------------------------------------------------------- labs
EXTRAS = []  # "Дополнительные материалы" from the Labs page -> Справочник
CHAT_RE = re.compile(r"^(Вы сказали:?|ChatGPT( сказал:?)?|напиши 15 лабораторных.*|Конечно! Вот 15.*)$", re.I)
R_SPLIT = re.compile(r"(?<=[\w)\]]) (?=[A-Za-z_][\w.$]*(?:\[[^\]]*\])?\s*(?:<-|\())")


def split_r_statements(line):
    """'z <- x + y print(z)' -> two lines; leaves 'function(x) mean(x)' alone."""
    parts, start = [], 0
    for m in R_SPLIT.finditer(line):
        before = line[:m.start()]
        depth = before.count("(") - before.count(")")
        if depth != 0 or re.search(r"function\s*\([^)]*\)$", before) or re.search(r"(if|for|while)\s*\(.*\)$", before):
            continue
        parts.append(line[start:m.start()].strip())
        start = m.end()
    parts.append(line[start:].strip())
    return [p for p in parts if p]


def build_labs():
    s = load("labs")
    blocks = flatten(s)
    labs, cur, series, seen_one = [], None, "A", 0
    flagged = []
    i = 0
    while i < len(blocks):
        el = blocks[i]
        if not isinstance(el, Tag):
            i += 1
            continue
        txt = el.get_text(" ", strip=True)
        m = re.match(r"Лабораторное задание (\d+)\s*:\s*(.+?)(?:\s+Цель:\s*(.+?))?(?:\s+Задания:)?$", txt)
        if m and el.name in ("h1", "h2", "p"):
            n = int(m.group(1))
            if n == 1:
                seen_one += 1
                series = "A" if seen_one == 1 else "B"
            cur = {"id": f"{series}{n}", "title": m.group(2).strip(), "blocks": []}
            if m.group(3):  # heading, goal and "Задания:" were glued into one paragraph in the source
                p = s.new_tag("p")
                st = s.new_tag("strong")
                st.string = "Цель: "
                p.append(st)
                p.append(m.group(3).strip())
                h = s.new_tag("h4")
                h.string = "Задания:"
                cur["blocks"] += [p, h]
            labs.append(cur)
            i += 1
            continue
        if cur is None or CHAT_RE.match(txt) or (el.name == "h2" and txt == "Лабы"):
            i += 1
            continue
        if re.match(r"^Дополнительные материалы", txt) or re.match(r"^Эти лабораторные задания помогут", txt):
            # trailing part of a series: keep the reference list for "Справочник", skip the chatter
            j = i + 1
            while j < len(blocks) and not (isinstance(blocks[j], Tag) and re.match(r"Лабораторное задание \d+", blocks[j].get_text(" ", strip=True))):
                t = blocks[j].get_text(" ", strip=True) if isinstance(blocks[j], Tag) else ""
                if t.startswith("·"):
                    EXTRAS.append(t.lstrip("· ").strip())
                j += 1
            i = j
            continue
        # code block: <p><strong>R</strong></p> followed by "Копировать код ..." paragraphs
        if el.name == "p" and txt in ("R", "r"):
            code, j = [], i + 1
            while j < len(blocks):
                b = blocks[j]
                if isinstance(b, Tag) and b.name in ("h1", "h2", "h3", "h4", "ul", "ol"):
                    break
                if isinstance(b, Tag) and b.name == "p":
                    t = b.get_text("", strip=False).replace("\xa0", " ").strip()
                    # a code block ends at chat text, the next "R" marker or a prose line (task statement)
                    t = re.sub(r"^Копировать код\s*", "", t)
                    if CHAT_RE.match(t) or t in ("R", "r") or re.match(r"^(\d+\.\s*)?[А-ЯЁа-яё(]", t):
                        break
                    if t:
                        lines = split_r_statements(t)
                        if len(lines) > 1:
                            flagged.append({"lab": cur["id"], "original": t, "split": lines})
                        code += lines
                j += 1
            pre = s.new_tag("pre")
            c = s.new_tag("code", attrs={"class": "language-r"})
            c.string = "\n".join(code)
            pre.append(c)
            cur["blocks"].append(pre)
            i = j
            continue
        # Word bullet leftovers "o " / "· "
        for node in el.find_all(string=True):
            node.replace_with(re.sub(r"^\s*[o·•]\s+", "", str(node)))
        if el.name == "h1":
            el.name = "h3"
        elif el.name in ("h2", "h3") and re.match(r"^\d+\.", el.get_text(strip=True)):
            el.name = "h4"
        elif el.name in ("h2", "h3"):
            el.name = "h4" if el.get_text(strip=True) != "Задания:" else "h4"
        cur["blocks"].append(el)
        i += 1
    return labs, flagged


# ---------------------------------------------------------------- authored content
AUTH = os.path.join(ROOT, "authored")
THESAURUS = []


# Word "Symbol" font characters that turned into Latin-1 letters when the lectures were copied
SYMBOL_FONT = {"Í": "⊆", "Î": "∈", "È": "∪", "Æ": "∅", "Ù": "∧", "´": "×", "Ñ": "∇"}
PATCHES = None


def fix_html(n, el, html):
    """Apply authored overrides (authored/overrides/NN-element.html), patches and the Symbol-font fix."""
    global PATCHES
    ov = os.path.join(AUTH, "overrides", f"{n:02d}-{el}.html")
    if os.path.exists(ov):
        html = re.sub(r"^<!--.*?-->\s*", "", open(ov, encoding="utf-8").read(), flags=re.S)
    if PATCHES is None:
        pf = os.path.join(AUTH, "patches.json")
        PATCHES = json.load(open(pf, encoding="utf-8")) if os.path.exists(pf) else []
    for p in PATCHES:
        if p["lesson"] != n or p["element"] != el:
            continue
        if "find" in p:
            if p["find"] not in html:
                raise SystemExit(f"patch not applied (lesson {n}): {p['find'][:60]}")
            html = html.replace(p["find"], p["replace"])
        else:
            i, j = html.find(p["find_from"]), html.find(p["find_to"])
            if i < 0 or j < i:
                raise SystemExit(f"patch range not found (lesson {n}): {p['find_from'][:60]}")
            html = html[:i] + p["replace"] + html[j + len(p["find_to"]):]
    html = place_figures(n, el, html)
    for a, b in SYMBOL_FONT.items():
        html = html.replace(a, b)
    # links to the original Google Sites images expire within hours; the local copy in images/ is used instead
    html = re.sub(r'\s*data-original="[^"]*"', "", html)
    return tidy_word_lists(html)


FIGURES = None


def figure_html(f):
    return (f'<figure class="fig"><img src="{f["src"]}" alt="{f["caption"]}"/>'
            f'<figcaption>{f["caption"]}</figcaption></figure>')


def place_figures(n, el, html):
    """authored/figures.json: numbered captions for lesson images; figures drawn for the e-textbook
    are inserted after the paragraph that refers to them."""
    global FIGURES
    if FIGURES is None:
        ff = os.path.join(AUTH, "figures.json")
        FIGURES = [x for x in json.load(open(ff, encoding="utf-8")) if "src" in x] if os.path.exists(ff) else []
    for f in FIGURES:
        if f["lesson"] != n or f["element"] != el:
            continue
        img = re.compile(r'<img[^>]*src="' + re.escape(f["src"]) + r'"[^>]*/?>')
        if not f.get("after"):
            if not img.search(html):
                raise SystemExit(f"figure image not found (lesson {n}): {f['src']}")
            html = img.sub(lambda m: figure_html(f), html, count=1)
            continue
        html = img.sub("", html, count=1)          # an existing image is moved to its reference
        i = html.find(f["after"])
        if i < 0:
            raise SystemExit(f"figure anchor not found (lesson {n}): {f['after'][:60]}")
        close = f.get("close", "</p>")
        j = html.find(close, i)
        if j < 0:
            raise SystemExit(f"figure anchor end not found (lesson {n}): {f['after'][:60]}")
        j += len(close)
        html = html[:j] + "\n" + figure_html(f) + html[j:]
    return html


BULLET_P = re.compile(r"<p>\s*[·•▪]\s*((?:(?!</p>).)*)</p>", re.S)


def tidy_word_lists(html):
    """Word bullets pasted as '<p>·      text</p>' -> real <ul><li> lists; collapse runs of spaces."""
    html = re.sub(r"[  ]{2,}", " ", html)
    html = re.sub(r"<p>(\s*\d{1,2}\.) +", r"<p>\1 ", html)

    def to_list(m):
        items = BULLET_P.findall(m.group(0))
        return "<ul>" + "".join(f"<li>{x.strip()}</li>" for x in items) + "</ul>\n"
    html = re.sub(r"(?:<p>\s*[·•▪]\s*(?:(?!</p>).)*</p>\s*(?:<br/>\s*)?)+", to_list, html, flags=re.S)
    # a list item that is only a bullet sign (empty) is noise
    html = re.sub(r"<li>\s*</li>", "", html)
    return html


def task_html(t):
    h = [f"<h3>{t['title']}</h3>", f"<p><strong>Цель:</strong> {t['goal']}</p>", "<p><strong>Порядок выполнения:</strong></p><ol>"]
    h += [f"<li>{s}</li>" for s in t["steps"]]
    h.append("</ol>")
    h.append(f"<p><strong>Ожидаемый результат:</strong> {t['result']}</p>")
    h.append(f"<p><strong>Форма представления:</strong> {t['form']}</p>")
    if t.get("hint"):
        h.append(f"<details class='hint'><summary>Подсказка</summary><p>{t['hint']}</p></details>")
    return "\n".join(h)


def merge_authored(n, d, elements):
    """Add authored examples/tasks/questions/tests/terms (authored/lessons/NN.json) to lesson n."""
    f = os.path.join(AUTH, "lessons", f"{n:02d}.json")
    a = json.load(open(f, encoding="utf-8")) if os.path.exists(f) else {}
    lid = f"{n:02d}"

    def append(el, html_new):
        path = os.path.join(d, el + ".html")
        old = open(path, encoding="utf-8").read() if os.path.exists(path) else ""
        html = (html_new + "\n" + old) if el == "tasks" else (old + "\n" + html_new)
        open(path, "w", encoding="utf-8").write(html.strip() + "\n")
        elements[el] = {"file": f"lessons/{lid}/{el}.html", "chars": text_len(html), "images": html.count("<img")}

    if a.get("examples"):
        append("examples", "\n".join(f"<h3>{e['title']}</h3>\n{e['html']}" for e in a["examples"]))
    if a.get("tasks"):
        append("tasks", "\n".join(task_html(t) for t in a["tasks"]))
    for el in ("questions", "tests"):
        items = a.get(el, [])
        if items:
            json.dump(items, open(os.path.join(d, el + ".json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        elements[el] = {"file": f"lessons/{lid}/{el}.json" if items else None, "count": len(items)}
    for t in a.get("terms", []):
        THESAURUS.append(dict(t, lesson=n))


# ---------------------------------------------------------------- build
def main():
    if os.path.exists(OUT):
        shutil.rmtree(OUT)
    os.makedirs(os.path.join(OUT, "lessons"))
    shutil.copytree(os.path.join(ROOT, "source", "images"), os.path.join(OUT, "images"))
    if os.path.isdir(os.path.join(AUTH, "images")):          # figures drawn for the e-textbook
        shutil.copytree(os.path.join(AUTH, "images"), os.path.join(OUT, "images"), dirs_exist_ok=True)

    # theory text of every lecture, for de-duplication of practices
    lecture_blocks, lecture_norms = {}, set()
    for n in range(1, 16):
        s = load(f"lecture-{n:02d}")
        b = drop_title_lines(normalize_headings(flatten(s), s))
        lecture_blocks[n] = b
        for el in b:
            if isinstance(el, Tag):
                for x in [el] + el.find_all(["p", "li", "h2", "h3", "h4"]):
                    t = norm(x.get_text())
                    if len(t) >= 12:
                        lecture_norms.add(t)

    lessons = {n: {"theory": [], "examples": [], "tasks": [], "selfcheck": [], "sources": [f"lecture-{n:02d}"],
                   "removed_duplicates": 0} for n in range(1, 16)}
    for n, b in lecture_blocks.items():
        theory, quiz = split_quiz(b)
        lessons[n]["theory"] += theory
        lessons[n]["selfcheck"] += quiz

    # Lecture 10: practice 9 holds a slightly fuller version of one sentence
    for el in lessons[10]["theory"]:
        if isinstance(el, Tag) and el.name == "p" and el.get_text(strip=True).startswith("Его целью обычно является выделение"):
            el.insert(0, NavigableString("Специфический вид визуализации. "))

    for p, (ln, role) in PRACTICE.items():
        s = load(f"practice-{p:02d}")
        b = flatten(s)
        if p in CUT_AT:  # the rest of the page is a copy of another lecture
            idx = next(i for i, el in enumerate(b) if isinstance(el, Tag) and el.get_text(" ", strip=True).startswith(CUT_AT[p]))
            lessons[ln]["removed_duplicates"] += len(b) - idx
            b = b[:idx]
        b = drop_title_lines(normalize_headings(b, s))
        same_lecture = norm(" ".join(x.get_text() for x in lecture_blocks[ln] if isinstance(x, Tag)))
        kept, dropped = [], 0
        for el in b:
            # also drop fragments contained verbatim in this lesson's lecture (short bullets, re-split paragraphs)
            if isinstance(el, Tag) and not el.find("img"):
                t = norm(el.get_text())
                if len(t) >= 4 and t in same_lecture:
                    dropped += 1
                    continue
            if isinstance(el, Tag) and el.name in ("ul", "ol"):
                for li in el.find_all("li", recursive=False):
                    if norm(li.get_text()) in lecture_norms:
                        li.decompose()
                        dropped += 1
                if not el.get_text(strip=True):
                    continue
            if isinstance(el, Tag) and norm(el.get_text()) in lecture_norms and not el.find("img"):
                dropped += 1
                continue
            kept.append(el)
        # a heading left with no content under it is a leftover of removed duplicates
        cleaned = []
        for i, el in enumerate(kept):
            if isinstance(el, Tag) and el.name in ("h2", "h3", "h4"):
                nxt = next((x for x in kept[i + 1:] if not (isinstance(x, Tag) and x.name == "br") and str(x).strip()), None)
                if nxt is None or (isinstance(nxt, Tag) and nxt.name in ("h2", "h3", "h4")):
                    dropped += 1
                    continue
            cleaned.append(el)
        kept = cleaned
        lessons[ln]["removed_duplicates"] += dropped
        lessons[ln]["sources"].append(f"practice-{p:02d}")
        if text_len(render(kept)) < 80:
            continue  # nothing left after removing duplicates
        theory, quiz = split_quiz(kept)
        lessons[ln][role] += theory
        lessons[ln]["selfcheck"] += quiz

    labs, flagged = build_labs()
    lab_index = []
    for lab in labs:
        ln = LABS.get(lab["id"])
        if ln is None:
            raise SystemExit(f"lab {lab['id']} is not mapped to a lesson")
        h = BeautifulSoup("", "html.parser").new_tag("h3")
        h.string = f"Лабораторная работа {lab['id']}. {lab['title']}"
        lessons[ln]["tasks"] += [h] + lab["blocks"]
        if "labs" not in lessons[ln]["sources"]:
            lessons[ln]["sources"].append("labs")
        lab_index.append({"id": lab["id"], "title": lab["title"], "lesson": ln})

    # write files
    structure = {"title_ru": "Анализ больших данных", "title_kk": "Үлкен деректерді талдау",
                 "language": "ru", "modules": []}
    report = []
    for m in MODULES:
        mm = {k: m[k] for k in ("id", "title_ru", "title_kk")}
        mm["blocks"] = []
        for b in m["blocks"]:
            bb = {k: b[k] for k in ("id", "title_ru", "title_kk")}
            bb["lessons"] = []
            for n in b["lessons"]:
                lid = f"{n:02d}"
                d = os.path.join(OUT, "lessons", lid)
                os.makedirs(d)
                L = lessons[n]
                elements = {}
                for el in ("theory", "examples", "tasks", "selfcheck"):
                    html = fix_html(n, el, render(L[el]))
                    chars = text_len(html) if L[el] else 0
                    if chars:
                        open(os.path.join(d, el + ".html"), "w", encoding="utf-8").write(html)
                    elements[el] = {"file": f"lessons/{lid}/{el}.html" if chars else None, "chars": chars,
                                    "images": html.count("<img")}
                merge_authored(n, d, elements)
                bb["lessons"].append({
                    "id": f"l{lid}", "number": n, "title_ru": LESSONS[n][0], "title_kk": LESSONS[n][1],
                    "sources": L["sources"], "elements": elements,
                })
                report.append((n, LESSONS[n][0], elements, L["removed_duplicates"]))
            mm["blocks"].append(bb)
        structure["modules"].append(mm)
    structure["labs"] = lab_index
    json.dump(structure, open(os.path.join(OUT, "structure.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    THESAURUS.sort(key=lambda t: t["term"].lower())
    json.dump(THESAURUS, open(os.path.join(OUT, "thesaurus.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    for extra in ("reference", "course"):
        src = os.path.join(AUTH, extra)
        if os.path.isdir(src):
            shutil.copytree(src, os.path.join(OUT, extra), dirs_exist_ok=True)
    os.makedirs(os.path.join(OUT, "reference"), exist_ok=True)
    open(os.path.join(OUT, "reference", "labs-extra.html"), "w", encoding="utf-8").write(
        "<h3>Дополнительные материалы по R</h3>\n<ul>\n" + "".join(f"<li>{x}</li>\n" for x in EXTRAS) + "</ul>\n")
    json.dump(flagged, open(os.path.join(OUT, "labs-code-review.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    print(f"{'#':>2} {'урок':44} теория  прим.  задан. к.вопр вопр тест  img  дубл.")
    for n, t, e, dup in report:
        print(f"{n:>2} {t[:44]:44} {e['theory']['chars']:6} {e['examples']['chars']:6} {e['tasks']['chars']:6} "
              f"{e['selfcheck']['chars']:6} {e['questions']['count']:4} {e['tests']['count']:4} "
              f"{sum(x.get('images', 0) for x in e.values()):4} {dup:5}")
    print("thesaurus terms:", len(THESAURUS))
    print("labs:", ", ".join(f"{l['id']}→{l['lesson']}" for l in lab_index))
    print("code lines split automatically (review):", len(flagged))


main()
