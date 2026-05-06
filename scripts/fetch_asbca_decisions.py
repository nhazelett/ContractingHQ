#!/usr/bin/env python3
"""
Fetch recent ASBCA decisions from the official decisions index and write a
static data bundle consumed by asbca.html.

The ASBCA site is PDF-first and often rejects command-line traffic. This script
uses the public reader rendering of the official ASBCA pages so GitHub Actions
can still pull the official decision table and PDF text without a browser.
Practitioner prompts are deterministic triage notes, not legal analysis.
"""

from __future__ import annotations

import html
import json
import os
import re
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.error import HTTPError
from urllib.parse import unquote, urljoin, urlparse
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
OUT_JSON = ROOT / "data" / "asbca-live.json"
OUT_JS = ROOT / "data" / "asbca-live.js"
DECISIONS_URL = "https://www.asbca.mil/Decisions/"
READER_PREFIX = "https://r.jina.ai/http://r.jina.ai/http://"
MAX_ITEMS = int(os.environ.get("ASBCA_MAX_ITEMS", "18"))
REQUEST_TIMEOUT = 60

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/plain,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.asbca.mil/",
}


@dataclass
class Link:
    href: str
    text: str


@dataclass
class DecisionMeta:
    date: str
    numbers: list[str]
    case_name: str
    pdf_url: str
    judge: str


class AnchorParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[Link] = []
        self._href: str | None = None
        self._buf: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "a":
            return
        attr = dict(attrs)
        href = attr.get("href")
        if href:
            self._href = href
            self._buf = []

    def handle_data(self, data: str) -> None:
        if self._href:
            self._buf.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "a" and self._href:
            self.links.append(Link(self._href, clean_text(" ".join(self._buf))))
            self._href = None
            self._buf = []


def clean_text(value: str) -> str:
    text = html.unescape(value or "")
    replacements = {
        "\u00a0": " ",
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\u2013": "-",
        "\u2014": "-",
        "\u2026": "...",
        "\ufeff": "",
        "â€™": "'",
        "â€œ": '"',
        "â€�": '"',
        "â€“": "-",
        "â€”": "-",
        "Â§": "Section",
        "Â": "",
    }
    for src, dst in replacements.items():
        text = text.replace(src, dst)
    return re.sub(r"\s+", " ", text).strip()


def fetch_text(url: str, accept: str | None = None) -> str:
    headers = dict(HEADERS)
    if accept:
        headers["Accept"] = accept
    req = Request(url, headers=headers)
    with urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
        raw = resp.read()
    return raw.decode("utf-8", errors="replace")


def reader_url(url: str) -> str:
    return READER_PREFIX + url


def fetch_reader(url: str) -> str:
    return fetch_text(reader_url(url), accept="text/plain,*/*;q=0.8")


def fetch_reader_with_retry(url: str, attempts: int = 3) -> str:
    last_error: Exception | None = None
    for attempt in range(attempts):
        try:
            return fetch_reader(url)
        except HTTPError as exc:
            last_error = exc
            if exc.code != 429 or attempt == attempts - 1:
                raise
            time.sleep(3.0 + (attempt * 4.0))
        except Exception as exc:
            last_error = exc
            if attempt == attempts - 1:
                raise
            time.sleep(1.5 + attempt)
    raise RuntimeError(str(last_error))


def markdown_content(reader_text: str) -> str:
    marker = "Markdown Content:"
    idx = reader_text.find(marker)
    if idx == -1:
        return reader_text
    return reader_text[idx + len(marker) :].strip()


def parse_display_date(value: str) -> str:
    text = clean_text(value)
    for fmt in ("%B %d, %Y", "%b %d, %Y"):
        try:
            return datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            continue
    return extract_date_from_text(text)


def display_date(value: str) -> str:
    if not value:
        return ""
    try:
        d = datetime.strptime(value[:10], "%Y-%m-%d")
        return d.strftime("%b {day}, %Y").format(day=d.day)
    except Exception:
        return value


def extract_date_from_text(value: str) -> str:
    text = clean_text(unquote(value))
    match = re.search(r"\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b", text)
    if not match:
        return ""
    month, day, year = match.groups()
    year_i = int(year)
    if year_i < 100:
        year_i += 2000
    try:
        return datetime(year_i, int(month), int(day), tzinfo=timezone.utc).date().isoformat()
    except ValueError:
        return ""


def extract_case_numbers(value: str) -> list[str]:
    nums = re.findall(r"\b(\d{5})(?:-(ADR|EAJA))?\b", clean_text(value), flags=re.I)
    out: list[str] = []
    for num, suffix in nums:
        label = f"ASBCA No. {num}"
        if suffix:
            label += f"-{suffix.upper()}"
        if label not in out:
            out.append(label)
    return out


def case_number_text(nums: list[str]) -> str:
    if not nums:
        return ""
    if len(nums) == 1:
        return nums[0]
    return "ASBCA Nos. " + ", ".join(n.replace("ASBCA No. ", "") for n in nums)


def absolute_url(href: str) -> str:
    return urljoin(DECISIONS_URL, href)


def filename_from_url(url: str) -> str:
    parsed = urlparse(url)
    name = Path(unquote(parsed.path)).name
    return clean_text(name or url)


def normalize_case_name(text: str, filename: str) -> str:
    name = clean_text(text)
    if name:
        return name
    base = re.sub(r"\.pdf(?:\?.*)?$", "", filename, flags=re.I)
    base = re.sub(r"^\d{5}(?:[-\s]ADR|-EAJA)?(?:\s+et\s+al\.)?\s+", "", base, flags=re.I)
    base = re.sub(r"\b\d{1,2}\.\d{1,2}\.\d{2,4}\b.*$", "", base)
    base = re.sub(
        r"\b(Decision|Dismissal|Consent Judgment|ConsentJudgment|EAJADecision|NonDispDecision|ReconDecision)\b",
        "",
        base,
        flags=re.I,
    )
    return clean_text(base)


def parse_markdown_index(markdown: str) -> list[DecisionMeta]:
    rows: list[DecisionMeta] = []
    row_re = re.compile(r"^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*\[([^\]]+)\]\(([^)]+)\)\s*\|\s*([^|]*?)\s*\|")
    for line in markdown.splitlines():
        match = row_re.match(line.strip())
        if not match:
            continue
        date_text, number_text, case_name, href, judge = match.groups()
        if "Date" in date_text and "Appeal" in number_text:
            continue
        decision_date = parse_display_date(date_text)
        if not decision_date:
            continue
        nums = extract_case_numbers(number_text)
        rows.append(
            DecisionMeta(
                date=decision_date,
                numbers=nums,
                case_name=clean_text(case_name),
                pdf_url=absolute_url(href),
                judge=clean_text(judge),
            )
        )
    return rows


def parse_html_links(page_html: str) -> list[DecisionMeta]:
    parser = AnchorParser()
    parser.feed(page_html)
    rows: list[DecisionMeta] = []
    for link in parser.links:
        href = unquote(link.href or "")
        if ".pdf" not in href.lower() and "LinkClick.aspx" not in href:
            continue
        if not link.text:
            continue
        url = absolute_url(link.href)
        filename = filename_from_url(url)
        rows.append(
            DecisionMeta(
                date=extract_date_from_text(filename),
                numbers=extract_case_numbers(filename),
                case_name=normalize_case_name(link.text, filename),
                pdf_url=url,
                judge="",
            )
        )
    return rows


def load_index() -> tuple[list[DecisionMeta], dict[str, Any]]:
    status: dict[str, Any] = {
        "ok": False,
        "url": DECISIONS_URL,
        "readerUrl": reader_url(DECISIONS_URL),
        "mode": "",
        "error": "",
        "linksFound": 0,
    }
    try:
        markdown = markdown_content(fetch_reader(DECISIONS_URL))
        rows = parse_markdown_index(markdown)
        if rows:
            status.update({"ok": True, "mode": "reader-markdown", "linksFound": len(rows)})
            return rows, status
        status["error"] = "Reader markdown contained no decision rows."
    except Exception as exc:
        status["error"] = str(exc)

    try:
        page_html = fetch_text(DECISIONS_URL)
        rows = parse_html_links(page_html)
        if rows:
            status.update({"ok": True, "mode": "direct-html", "linksFound": len(rows), "error": ""})
            return rows, status
        status["error"] = "Direct ASBCA HTML contained no decision links."
    except Exception as exc:
        status["error"] = f"{status.get('error')}; direct fallback failed: {exc}"

    return [], status


def classify_type(filename: str, text: str) -> str:
    hay = f"{filename} {text}".lower()
    if "consent" in hay:
        return "Consent judgment"
    if "eaja" in hay:
        return "EAJA"
    if "dismissal" in hay or "dismissed" in hay:
        return "Dismissal"
    if "recon" in hay or "reconsideration" in hay:
        return "Reconsideration"
    if "non" in hay and "disp" in hay:
        return "Non-dispositive"
    if "adr" in hay:
        return "ADR"
    return "Decision"


def classify_outcome(decision_type: str, text: str) -> str:
    hay = clean_text(text).lower()
    if "consent judgment" in decision_type.lower():
        return "settled"
    if "dismiss" in decision_type.lower() or re.search(r"\b(appeal|motion|application|petition).{0,100}dismissed\b", hay):
        return "dismissed"
    if re.search(r"\b(appeal|motion|application|petition).{0,100}sustained\b", hay):
        return "sustained"
    if re.search(r"\b(appeal|motion|application|petition).{0,100}denied\b", hay) or " is denied" in hay:
        return "denied"
    if re.search(r"\b(appeal|motion|application|petition).{0,100}granted\b", hay):
        return "granted"
    if "non-dispositive" in decision_type.lower() or "adr" in decision_type.lower():
        return "procedural"
    return "unclassified"


def outcome_label(outcome: str) -> str:
    return {
        "sustained": "Sustained",
        "denied": "Denied",
        "dismissed": "Dismissed",
        "settled": "Settled",
        "granted": "Granted",
        "procedural": "Procedural",
        "unclassified": "Read Decision",
    }.get(outcome, "Read Decision")


def relevant_sentences(text: str, max_chars: int = 620) -> str:
    if not text:
        return ""
    cleaned = re.sub(r"\b(Signatures continued|I concur|I certify that the foregoing).*$", "", text, flags=re.I)
    direct_patterns = [
        r"(It is the Board's decision, pursuant to.*?No further interest shall be paid\.)",
        r"(It is the Board's decision, pursuant to.*?amount of \$?[\d,]+\.\d{2}\.)",
        r"(The dispute has been settled\.\s*The appeal is dismissed[^.]*\.)",
        r"(The dispute has been settled\.\s*The application for attorney fees and costs is dismissed[^.]*\.)",
        r"(The dispute has been settled\.\s*The appeal is dismissed[^.]*and no matters remain[^.]*\.)",
        r"(The appeal is dismissed[^.]*\.)",
        r"(The appeal is sustained[^.]*\.)",
        r"(The appeal is denied[^.]*\.)",
    ]
    for pattern in direct_patterns:
        match = re.search(pattern, cleaned, re.I)
        if match:
            return clean_text(match.group(1))[:max_chars].rstrip()
    candidates = re.split(r"(?<=[.!?])\s+", cleaned)
    priority = [
        r"appeal is sustained",
        r"appeal is denied",
        r"appeal is dismissed",
        r"motion .* denied",
        r"motion .* granted",
        r"application .* denied",
        r"lack of jurisdiction",
        r"consent judgment",
        r"sum certain",
        r"certification",
        r"termination",
        r"equitable adjustment",
        r"constructive change",
        r"accord and satisfaction",
        r"the parties have resolved",
    ]
    chosen: list[str] = []
    for pattern in priority:
        for sentence in candidates:
            sentence = clean_text(sentence)
            if len(sentence) < 45 or sentence in chosen:
                continue
            if re.search(pattern, sentence, re.I):
                chosen.append(sentence)
                break
        if len(" ".join(chosen)) >= max_chars:
            break
    if not chosen:
        chosen = [clean_text(s) for s in candidates if len(clean_text(s)) > 70][:2]
    text_out = clean_text(" ".join(chosen))
    if len(text_out) > max_chars:
        return text_out[: max_chars - 3].rstrip() + "..."
    return text_out


def extract_judge(text: str, fallback: str) -> str:
    if fallback:
        return fallback
    patterns = [
        r"OPINION BY ADMINISTRATIVE JUDGE\s+([A-Z][A-Z'\-]+)",
        r"Administrative Judge\s+([A-Z][A-Za-z'\-]+)",
        r"\b([A-Z][A-Za-z'\-]+),\s+Administrative Judge\b",
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return clean_text(match.group(1).title())
    return fallback


def classify_topics(text: str, decision_type: str) -> list[str]:
    hay = f"{text} {decision_type}".lower()
    checks = [
        (r"jurisdiction|sum certain|certification|certified claim|privity", "Jurisdiction"),
        (r"termination|default|convenience|constructive termination", "Termination"),
        (r"equitable adjustment|change order|constructive change|delay|differing site|modification", "REA / changes"),
        (r"eaja|equal access to justice", "EAJA"),
        (r"consent judgment|settlement|settled|stipulation", "Settlement"),
        (r"reconsideration", "Reconsideration"),
        (r"summary judgment|motion to dismiss|non-dispositive", "Motions"),
        (r"cost|allowable|disallow|overhead|indirect", "Costs"),
        (r"delivery|late|failure to deliver", "Delivery"),
        (r"adr|alternative dispute", "ADR"),
        (r"contract disputes act|cda|final decision", "CDA process"),
    ]
    tags = [label for pattern, label in checks if re.search(pattern, hay)]
    return list(dict.fromkeys(tags))[:5]


def practitioner_prompt(tags: list[str], outcome: str) -> str:
    if "Jurisdiction" in tags:
        return "Check the claim before the final decision: sum certain, certification, privity, and whether the contractor actually presented the same claim to the CO."
    if "Termination" in tags:
        return "Termination actions need clean documentation. If performance is effectively ended, make sure the file and notices match the legal theory."
    if "REA / changes" in tags:
        return "When settling a change, be explicit about which delay, disruption, and impact claims are released. Ambiguous mod language keeps disputes alive."
    if "EAJA" in tags:
        return "EAJA deadlines and party identity rules are strict. The contractor entity, not just an owner, usually needs to be the prevailing applicant."
    if "Settlement" in tags and outcome == "dismissed":
        return "Settlement dismissals are final off-ramps. Confirm authority to settle, make release language clear, and document why the appeal can be dismissed."
    if "Settlement" in tags:
        return "Consent judgments are a practical off-ramp. Use them when exposure is clear and the negotiated number is better than continued litigation."
    if outcome == "dismissed":
        return "Dismissals often turn on threshold mistakes. New specialists should read these for what must happen before the Board can reach the merits."
    if outcome == "denied":
        return "Denied appeals are useful file-discipline examples. Look for what evidence the Board expected and what the appellant could not prove."
    return "Open the PDF when the facts resemble your contract file. ASBCA decisions are usually about claims discipline, final decisions, and dispute documentation."


def build_item(meta: DecisionMeta, index: int) -> dict[str, Any]:
    filename = filename_from_url(meta.pdf_url)
    pdf_text = ""
    source_status = "metadata-only"
    source_error = ""

    try:
        time.sleep(0.45)
        pdf_text = clean_text(markdown_content(fetch_reader_with_retry(meta.pdf_url)))
        source_status = "reader-extracted" if pdf_text else "metadata-only"
    except Exception as exc:
        source_error = str(exc)

    excerpt = relevant_sentences(pdf_text)
    if not excerpt:
        excerpt = "Metadata from the ASBCA decisions index. Open the PDF for the Board's full reasoning."
    decision_type = classify_type(filename, f"{meta.case_name} {pdf_text[:3000]}")
    outcome = classify_outcome(decision_type, f"{excerpt} {pdf_text[:5000]} {pdf_text[-5000:]}")
    tags = classify_topics(f"{filename} {excerpt} {pdf_text[:5000]}", decision_type)

    nums = meta.numbers or extract_case_numbers(f"{filename} {pdf_text[:1500]}")
    date = meta.date or extract_date_from_text(f"{filename} {pdf_text[:1500]}")
    case_name = meta.case_name
    if not case_name and pdf_text:
        match = re.search(r"Appeal of -\s*(.*?)\s*(?:ASBCA|Under Contract|APPEARANCES)", pdf_text, re.I)
        if match:
            case_name = clean_text(match.group(1))

    return {
        "id": re.sub(r"[^a-zA-Z0-9-]+", "-", f"{date}-{case_name}-{index}").strip("-").lower(),
        "caseName": case_name or "ASBCA decision",
        "caseNumberText": case_number_text(nums),
        "caseNumbers": nums,
        "decisionDate": date,
        "displayDate": display_date(date),
        "decisionType": decision_type,
        "outcome": outcome,
        "outcomeLabel": outcome_label(outcome),
        "judge": extract_judge(pdf_text, meta.judge),
        "officialExcerpt": excerpt,
        "tags": tags,
        "practitionerPrompt": practitioner_prompt(tags, outcome),
        "pdfUrl": meta.pdf_url,
        "filename": filename,
        "sourceStatus": source_status,
        "sourceStatusLabel": "ASBCA PDF text extracted" if source_status == "reader-extracted" else "ASBCA index metadata",
        "sourceError": source_error,
    }


def build_stats(items: list[dict[str, Any]], source_status: dict[str, Any]) -> dict[str, Any]:
    counts: dict[str, int] = {}
    for item in items:
        outcome = item.get("outcome") or "unclassified"
        counts[outcome] = counts.get(outcome, 0) + 1
    return {
        "total": len(items),
        "latestDecisionDate": items[0].get("decisionDate", "") if items else "",
        "downloadedPdfs": sum(1 for item in items if item.get("sourceStatus") == "reader-extracted"),
        "metadataOnly": sum(1 for item in items if item.get("sourceStatus") != "reader-extracted"),
        "outcomes": counts,
        "sourceStatus": {"decisionsPage": source_status},
    }


def main() -> None:
    rows, source_status = load_index()
    if not rows:
        print(f"No ASBCA decision rows found. Source status: {source_status}", file=sys.stderr)
        sys.exit(1)

    rows = rows[:MAX_ITEMS]
    items = [build_item(meta, index) for index, meta in enumerate(rows)]
    items.sort(key=lambda item: (item.get("decisionDate") or "", item.get("caseName") or ""), reverse=True)
    source_status["linksUsed"] = len(rows)

    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": {
            "name": "Armed Services Board of Contract Appeals",
            "decisionsUrl": DECISIONS_URL,
        },
        "note": "Automated KTHQ ASBCA decision watch. Official excerpts are extracted from ASBCA PDF text when available. Practitioner prompts are deterministic triage notes, not legal advice.",
        "stats": build_stats(items, source_status),
        "items": items,
    }

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(payload, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
    OUT_JS.write_text("window.KTHQ_ASBCA_DATA = " + json.dumps(payload, indent=2, ensure_ascii=True) + ";\n", encoding="utf-8")
    print(f"Wrote {len(items)} ASBCA decisions to {OUT_JSON.relative_to(ROOT)} and {OUT_JS.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
