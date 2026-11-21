"""Bundle content/ into site/data/course.js so the e-textbook works offline (file://) and online.

usage (from project root):  python3 -I tools/build_site.py .
Run tools/build_content.py first.
"""
import sys, os, re, json, shutil, base64, hashlib, datetime

ROOT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else ".")
CONTENT = os.path.join(ROOT, "content")
SITE = os.path.join(ROOT, "site")


def read(path, default=None):
    p = os.path.join(CONTENT, path)
    if not os.path.exists(p):
        return default
    with open(p, encoding="utf-8") as f:
        return json.load(f) if p.endswith(".json") else f.read()


def esc(s):
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def lessons_tests_count(course):
    out = {}
    for lid, d in course["lessons"].items():
        out[lid] = len(json.loads(base64.b64decode(d["tests"]).decode("utf-8")))
    return out


def write_content_guide(course, ntests):
    """docs/content-guide.html — руководство-содержание (СТ РК 34.017-2005, §12), generated from the course data."""
    m, s = course["meta"], course["structure"]
    rows, total = [], {"ex": 0, "q": 0, "t": 0}
    for mi, mod in enumerate(s["modules"], 1):
        rows.append(f'<tr><th colspan="6">Модуль {mi}. {esc(mod["title_ru"])}</th></tr>')
        for b in mod["blocks"]:
            rows.append(f'<tr><td colspan="6"><strong>Блок {esc(b["id"][1:])}. {esc(b["title_ru"])}</strong></td></tr>')
            for l in b["lessons"]:
                lid = f'{l["number"]:02d}'
                d = course["lessons"][lid]
                n_ex = d["examples"].count("<h3>")
                n_q = len(d["questions"])
                labs = [x["id"] for x in s.get("labs", []) if x["lesson"] == l["number"]]
                total["ex"] += n_ex; total["q"] += n_q; total["t"] += ntests[lid]
                rows.append(f'<tr><td>{l["number"]}</td><td>{esc(l["title_ru"])}<br><span class="muted">{esc(l["title_kk"])}</span></td>'
                            f'<td>{n_ex}</td><td>{", ".join(labs) or "—"}</td><td>{n_q}</td><td>{ntests[lid]}</td></tr>')
    labs = "".join(f'<tr><td>{esc(x["id"])}</td><td>{esc(x["title"])}</td><td>{x["lesson"]}</td></tr>' for x in s.get("labs", []))
    links = [
        ("Исходный учебный сайт курса", "https://sites.google.com/view/analyze-big-data"),
        ("R — загрузка и документация", "https://cran.r-project.org/"),
        ("RStudio Desktop", "https://posit.co/download/rstudio-desktop/"),
        ("ggplot2 — документация", "https://ggplot2.tidyverse.org/"),
        ("dplyr — документация", "https://dplyr.tidyverse.org/"),
        ("GitHub Pages (размещение сетевой версии)", "https://pages.github.com/"),
    ]
    html = f"""<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Руководство-содержание — Анализ больших данных</title>
<link rel="stylesheet" href="../assets/style.css"><link rel="stylesheet" href="docs.css"></head>
<body class="doc"><header class="doc-head"><a href="../index.html">← Электронное учебное пособие</a> · <a href="index.html">Документация</a></header>
<main class="doc-main content">
<p class="muted">Электронное учебное пособие «Анализ больших данных» · Эксплуатационная документация (СТ РК 34.017-2005, §12) · сформировано автоматически {esc(course["build"])}</p>
<h1>Руководство-содержание</h1>
<h2>1. Аннотация</h2><p>{esc(m.get("annotation_ru", ""))}</p>
<p><strong>Аннотация (қазақ тілінде).</strong> {esc(m.get("annotation_kk", ""))}</p>
<h2>2. Необходимые условия</h2>
<ul><li><strong>Целевая аудитория:</strong> {esc(m.get("audience_ru", ""))}</li>
<li><strong>Входные знания:</strong> основы информатики и баз данных (SQL), элементы теории вероятностей и математической статистики, начальные навыки программирования.</li>
<li><strong>Технические условия:</strong> браузер; для лабораторных работ — R и RStudio (см. руководство по установке).</li>
<li><strong>Язык текста:</strong> русский; интерфейс — русский и казахский.</li></ul>
<h2>3. Цели обучения</h2>
<p>После изучения пособия обучаемый сможет: объяснять понятие и характеристики больших данных; описывать жизненный цикл аналитики, BI и OLAP; объяснять архитектуру Hadoop (HDFS, MapReduce, YARN) и экосистему Spark; выбирать модель хранения (реляционная или NoSQL) с учётом теоремы CAP; выбирать способ визуализации; выполнять базовый анализ данных в R; формулировать задачи Data Mining и машинного обучения; применять и оценивать методы классификации, кластеризации и поиска ассоциативных правил.</p>
<h2>4. Структура и объём</h2>
<p>{len(s["modules"])} модуля, {sum(len(x["blocks"]) for x in s["modules"])} блоков, {sum(len(b["lessons"]) for x in s["modules"] for b in x["blocks"])} уроков. Разобранных примеров (включая материалы практических занятий) — {total["ex"]}, лабораторных работ — {len(s.get("labs", []))}, интерактивных вопросов — {total["q"]}, тестовых заданий — {total["t"]}, терминов тезауруса — {len(course["thesaurus"])}. Объём издания — {m.get("size_mb", "")} МБ.</p>
<table><tr><th>№</th><th>Урок</th><th>Примеров</th><th>Лаб. работы</th><th>Вопросов</th><th>Тестов в базе</th></tr>{"".join(rows)}</table>
<p>Каждый урок содержит обязательные элементы обучения: теорию, примеры, задания, вопросы-ответы и тест; необязательные — графику (если есть рисунки). Контроль: текущий (урок), промежуточный (блок), рубежный (модуль), итоговый (весь курс), диагностический (выбор траектории).</p>
<h2>5. Лабораторные работы</h2>
<table><tr><th>№</th><th>Тема</th><th>Урок</th></tr>{labs}</table>
<h2>6. Список внешних ссылок для преподавателя</h2>
<p>Перед использованием пособия рекомендуется проверить доступность ссылок:</p>
<ul>{"".join(f'<li>{esc(t)}: <a href="{u}">{u}</a></li>' for t, u in links)}</ul>
<p>Учебный материал пособия не зависит от внешних ссылок: все тексты и рисунки входят в комплект.</p>
<h2>7. Источники</h2>
<ol>{"".join(f"<li>{esc(b)}</li>" for b in m.get("bibliography", []))}</ol>
</main></body></html>
"""
    os.makedirs(os.path.join(SITE, "docs"), exist_ok=True)
    with open(os.path.join(SITE, "docs", "content-guide.html"), "w", encoding="utf-8") as f:
        f.write(html)


def main():
    structure = read("structure.json")
    lessons = {}
    for m in structure["modules"]:
        for b in m["blocks"]:
            for l in b["lessons"]:
                lid = f"{l['number']:02d}"
                d = {}
                for el in ("theory", "examples", "tasks", "selfcheck"):
                    d[el] = read(f"lessons/{lid}/{el}.html", "")
                d["questions"] = read(f"lessons/{lid}/questions.json", [])
                # tests are base64-encoded so the answers are not readable at a glance in the page source
                tests = read(f"lessons/{lid}/tests.json", [])
                d["tests"] = base64.b64encode(json.dumps(tests, ensure_ascii=False).encode("utf-8")).decode("ascii")
                lessons[lid] = d

    os.makedirs(os.path.join(SITE, "data"), exist_ok=True)
    if os.path.exists(os.path.join(SITE, "images")):
        shutil.rmtree(os.path.join(SITE, "images"))
    shutil.copytree(os.path.join(CONTENT, "images"), os.path.join(SITE, "images"))

    course = {
        "structure": structure,
        "lessons": lessons,
        "thesaurus": read("thesaurus.json", []),
        "reference": read("reference/reference.html", ""),
        "labsExtra": read("reference/labs-extra.html", ""),
        "meta": read("course/meta.json", {}),
        "build": datetime.date.today().isoformat(),
    }
    js = "window.COURSE = " + json.dumps(course, ensure_ascii=False, separators=(",", ":")) + ";\n"
    with open(os.path.join(SITE, "data", "course.js"), "w", encoding="utf-8") as f:
        f.write(js)

    # total size of the edition (выпускные данные: объём данных в мегабайтах)
    total = 0
    for dp, _, fs in os.walk(SITE):
        total += sum(os.path.getsize(os.path.join(dp, x)) for x in fs)
    course["meta"]["size_mb"] = round(total / 1024 / 1024, 1)
    js = "window.COURSE = " + json.dumps(course, ensure_ascii=False, separators=(",", ":")) + ";\n"
    with open(os.path.join(SITE, "data", "course.js"), "w", encoding="utf-8") as f:
        f.write(js)
    print(f"site/data/course.js: {len(js.encode('utf-8')) / 1024:.0f} KB; site total ≈ {course['meta']['size_mb']} MB")

    write_content_guide(course, lessons_tests_count(course))

    # cache busting: index.html refers to every script/stylesheet as file?v=<hash of its content>
    index = os.path.join(SITE, "index.html")
    html = open(index, encoding="utf-8").read()

    def ver(m):
        path = m.group(2)
        with open(os.path.join(SITE, path), "rb") as f:
            h = hashlib.sha256(f.read()).hexdigest()[:10]
        return f'{m.group(1)}="{path}?v={h}"'
    html = re.sub(r'(src|href)="((?:assets|data)/[^"?]+\.(?:js|css))(?:\?v=[^"]*)?"', ver, html)
    open(index, "w", encoding="utf-8").write(html)
    print("index.html: asset versions updated")


main()
