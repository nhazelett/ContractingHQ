#!/usr/bin/env python3
"""
Build the ContractingHQ FAR Overhaul live data bundle from primary sources.

The tracker intentionally avoids practitioner/news feeds. Acquisition.gov is
the source of truth for the FAR part/deviation matrix. Acquisition.gov RSS and
the Federal Register are used only for official companion updates.
"""

from __future__ import annotations

import hashlib
import html
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlencode, urljoin
from urllib.request import Request, urlopen
from xml.etree import ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
OUT_JSON = ROOT / "data" / "far-overhaul-live.json"
OUT_JS = ROOT / "data" / "far-overhaul-live.js"

ACQ_BASE = "https://www.acquisition.gov"
FAR_OVERHAUL_URL = "https://www.acquisition.gov/far-overhaul"
DEVIATION_GUIDE_URL = "https://www.acquisition.gov/far-overhaul/far-part-deviation-guide"
ACQ_RSS_URL = "https://www.acquisition.gov/rss.xml"
FEDERAL_REGISTER_URL = "https://www.federalregister.gov/api/v1/documents.json"

REQUEST_TIMEOUT = 45
MAX_ANNOUNCEMENTS = 12
MAX_FR_ITEMS = 8

HEADERS = {
    "User-Agent": "ContractingHQ-FAR-Overhaul-Tracker/1.0 (+https://kthq.org)",
    "Accept": "text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8",
}

RFO_TERMS = re.compile(
    r"far\s+overhaul|revolutionary\s+far|model\s+deviation|far\s+companion|"
    r"\brfo\b|executive\s+order\s+14275|omb\s+memorandum\s+m-25-26|"
    r"far\s+part\s+\d+.*(?:deviation|overhaul|update)|fac\s+2026-01",
    re.I,
)


def fetch_text(url: str) -> str:
    req = Request(url, headers=HEADERS)
    with urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
        raw = resp.read()
    return raw.decode("utf-8", errors="replace")


def fetch_json(url: str) -> dict[str, Any]:
    return json.loads(fetch_text(url))


def clean_text(value: str) -> str:
    text = html.unescape(value or "")
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def absolute(url: str) -> str:
    return urljoin(ACQ_BASE, html.unescape(url or ""))


def parse_date(value: str) -> str:
    text = clean_text(value)
    if not text:
        return ""
    formats = [
        "%B %d, %Y",
        "%b %d, %Y",
        "%a, %d %b %Y %H:%M:%S %z",
        "%a, %d %b %Y %H:%M:%S",
        "%Y-%m-%d",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%S",
    ]
    text = re.sub(r"\s+[A-Z]{2,4}$", "", text)
    for fmt in formats:
        try:
            return datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            continue
    match = re.search(r"(\d{4}-\d{2}-\d{2})", text)
    if match:
        return match.group(1)
    return ""


def display_date(value: str) -> str:
    if not value:
        return ""
    try:
        d = datetime.strptime(value[:10], "%Y-%m-%d")
        return d.strftime("%b {day}, %Y").format(day=d.day)
    except ValueError:
        return value


def item_id(*parts: str) -> str:
    key = "|".join(p.strip().lower() for p in parts)
    return hashlib.sha256(key.encode("utf-8")).hexdigest()[:16]


def extract_first(pattern: str, text: str, flags: int = re.I | re.S) -> str:
    match = re.search(pattern, text, flags)
    return clean_text(match.group(1)) if match else ""


def extract_raw_first(pattern: str, text: str, flags: int = re.I | re.S) -> str:
    match = re.search(pattern, text, flags)
    return match.group(1) if match else ""


def extract_links(block: str) -> list[dict[str, str]]:
    links: list[dict[str, str]] = []
    for href, label in re.findall(r'<a\b[^>]*href="([^"]+)"[^>]*>(.*?)</a>', block, flags=re.I | re.S):
        name = clean_text(label)
        if not name:
            continue
        links.append({"name": name, "url": absolute(href)})
    return links


def parse_deviation_guide(page_html: str) -> list[dict[str, Any]]:
    chunks = re.split(r'<div class="content-card far-card"', page_html)
    parts: list[dict[str, Any]] = []

    for chunk in chunks[1:]:
        title_match = re.search(r'<h3 class="far-title".*?<a\b[^>]*href="([^"]+)"[^>]*>(.*?)</a>', chunk, re.I | re.S)
        if not title_match:
            continue

        part_url = absolute(title_match.group(1))
        title = clean_text(title_match.group(2))
        part_match = re.search(r"Part\s+(\d+)\s*-\s*(.+)", title, re.I)
        if not part_match:
            continue

        part_number = int(part_match.group(1))
        part_title = clean_text(part_match.group(2))
        issuance = parse_date(extract_first(r"Issuance Date:\s*([^<]+)", chunk))
        update = parse_date(extract_first(r"UPDATE:\s*([^<]+)", chunk))

        agency_block = extract_raw_first(r'<ul class="agency-list"[^>]*>(.*?)</ul>', chunk, flags=re.I | re.S)
        agencies = []
        for link in extract_links(agency_block):
            agency = {
                "name": link["name"],
                "url": link["url"],
                "id": item_id(str(part_number), link["name"], link["url"]),
            }
            agencies.append(agency)

        tags = topic_tags(part_number, part_title)
        parts.append(
            {
                "partNumber": part_number,
                "partLabel": f"Part {part_number}",
                "title": part_title,
                "fullTitle": f"Part {part_number} - {part_title}",
                "url": part_url,
                "issuanceDate": issuance,
                "issuanceDateLabel": display_date(issuance),
                "updateDate": update,
                "updateDateLabel": display_date(update),
                "isUpdated": bool(update),
                "deviationCount": len(agencies),
                "agencies": agencies,
                "tags": tags,
                "watchNote": practitioner_note(part_number, part_title, len(agencies), bool(update)),
            }
        )

    parts.sort(key=lambda part: part["partNumber"])
    if not parts:
        raise RuntimeError("No FAR part cards were parsed from Acquisition.gov deviation guide.")
    return parts


def topic_tags(part_number: int, title: str) -> list[str]:
    text = f"{part_number} {title}".lower()
    checks = [
        (r"\b1\b|system", "FAR system"),
        (r"\b2\b|definitions", "Definitions"),
        (r"competition|source selection|contracting by negotiation|sealed bidding", "Competition"),
        (r"acquisition planning|market research|describing agency needs", "Requirements"),
        (r"simplified|commercial|gsa|schedules", "Buying methods"),
        (r"labor|environment|small business|socioeconomic", "Policy"),
        (r"contract type|incentive|indefinite|pricing", "Contract type"),
        (r"cost|payment|financing|audit", "Money"),
        (r"administration|quality|termination|claims|closeout", "Performance"),
        (r"solicitation provisions|contract clauses|forms", "Clauses/forms"),
    ]
    tags = [label for pattern, label in checks if re.search(pattern, text)]
    return list(dict.fromkeys(tags))[:3] or ["FAR part"]


def practitioner_note(part_number: int, title: str, deviation_count: int, is_updated: bool) -> str:
    lead = "Updated model text is posted." if is_updated else "Model text is posted."
    if part_number in {1, 2, 52, 53}:
        return f"{lead} Treat this as infrastructure: definitions, clauses, forms, and system rules can ripple across many local templates."
    if part_number in {6, 10, 11, 12, 13, 14, 15, 16}:
        return f"{lead} Read this before building solicitations; it affects acquisition strategy, competition, evaluation, and award approach."
    if part_number in {19, 22, 23, 25}:
        return f"{lead} Policy-heavy part. Check agency deviations before relying on old local checklists or training slides."
    if part_number in {31, 32, 42, 43, 49}:
        return f"{lead} Contract administration risk area. Compare the model text against current clauses, mods, payment, and closeout practices."
    if deviation_count:
        return f"{lead} {deviation_count} agency deviation source(s) are listed; open your agency's PDF before applying the model text."
    return f"{lead} No agency deviation PDFs were listed in the official guide during the last pull."


def parse_acquisition_rss(xml_text: str) -> list[dict[str, str]]:
    root = ET.fromstring(xml_text)
    items = []
    for node in root.findall(".//item"):
        title = clean_text(node.findtext("title") or "")
        url = clean_text(node.findtext("link") or "")
        date = parse_date(node.findtext("pubDate") or "")
        summary = clean_text(node.findtext("description") or "")
        text = f"{title} {url} {summary}"
        if not title or not url or not RFO_TERMS.search(text):
            continue
        if len(summary) > 280:
            summary = summary[:280].rsplit(" ", 1)[0] + "..."
        items.append(
            {
                "id": item_id(title, url),
                "title": title,
                "url": url,
                "date": date,
                "dateLabel": display_date(date),
                "source": "Acquisition.gov",
                "type": "Official announcement",
                "summary": summary,
            }
        )
    items.sort(key=lambda item: item.get("date") or "0000-00-00", reverse=True)
    return items[:MAX_ANNOUNCEMENTS]


def fetch_federal_register_items() -> list[dict[str, str]]:
    queries = [
        "Revolutionary FAR Overhaul",
        "FAR Overhaul",
        "FAR Companion",
        "FAR Case 2025-007",
        "Federal Acquisition Circular 2026-01",
    ]
    found: dict[str, dict[str, str]] = {}
    for query in queries:
        params = {
            "conditions[term]": query,
            "conditions[agencies][]": [
                "general-services-administration",
                "defense-acquisition-regulations-system",
            ],
            "per_page": "20",
            "order": "newest",
        }
        # urlencode handles duplicate keys when doseq=True.
        url = FEDERAL_REGISTER_URL + "?" + urlencode(params, doseq=True)
        try:
            data = fetch_json(url)
        except Exception as exc:
            print(f"[WARN] Federal Register query failed for {query}: {exc}", file=sys.stderr)
            continue
        for doc in data.get("results", []):
            title = clean_text(doc.get("title", ""))
            abstract = clean_text(doc.get("abstract", ""))
            html_url = clean_text(doc.get("html_url", ""))
            if not title or not html_url:
                continue
            text = f"{title} {abstract}"
            is_relevant_fac = "Federal Acquisition Circular 2026-01" in title or "FAC 2026-01" in text
            if not (RFO_TERMS.search(text) or is_relevant_fac):
                continue
            key = doc.get("document_number") or html_url
            found[key] = {
                "id": item_id(title, html_url),
                "title": title,
                "url": html_url,
                "date": doc.get("publication_date", ""),
                "dateLabel": display_date(doc.get("publication_date", "")),
                "source": "Federal Register",
                "type": clean_text(doc.get("type", "Federal Register")),
                "summary": abstract[:320].rsplit(" ", 1)[0] + "..." if len(abstract) > 320 else abstract,
            }
    items = list(found.values())
    items.sort(key=lambda item: item.get("date") or "0000-00-00", reverse=True)
    return items[:MAX_FR_ITEMS]


def official_resources(home_html: str) -> list[dict[str, str]]:
    wanted = {
        "RFO Parts & Deviations": "Official list of overhauled FAR parts and agency deviations.",
        "FAR Companion": "Living resource guide with non-regulatory practice guidance.",
        "Practitioner Albums": "Non-regulatory training materials for overhauled FAR parts.",
        "Searchable RFO": "Full RFO text in PDF format.",
    }
    resources = [
        {"title": "FAR Overhaul Hub", "url": FAR_OVERHAUL_URL, "description": "Official Acquisition.gov landing page for the RFO."},
        {"title": "FAR Parts and Agency Deviations", "url": DEVIATION_GUIDE_URL, "description": wanted["RFO Parts & Deviations"]},
    ]
    for title, href in re.findall(r'<h4>(.*?)</h4>.*?<a\b[^>]*href="([^"]+)"', home_html, flags=re.I | re.S):
        title = clean_text(title)
        if title in wanted and title not in {r["title"] for r in resources}:
            resources.append({"title": title, "url": absolute(href), "description": wanted[title]})
    return resources


def load_previous() -> dict[str, Any]:
    if not OUT_JSON.exists():
        return {}
    try:
        return json.loads(OUT_JSON.read_text(encoding="utf-8"))
    except Exception:
        return {}


def agency_key(agency: dict[str, str]) -> str:
    return f"{agency.get('name','').lower()}|{agency.get('url','').lower()}"


def build_changes(parts: list[dict[str, Any]], previous: dict[str, Any]) -> dict[str, Any]:
    prev_parts = {str(part.get("partNumber")): part for part in previous.get("parts", [])}
    changes = {
        "baseline": not bool(prev_parts),
        "newParts": [],
        "updatedParts": [],
        "newAgencyDeviations": [],
        "removedAgencyDeviations": [],
    }
    for part in parts:
        key = str(part["partNumber"])
        prev = prev_parts.get(key)
        if not prev:
            changes["newParts"].append(part_summary(part))
            continue
        if (prev.get("updateDate") or "") != (part.get("updateDate") or ""):
            changes["updatedParts"].append(
                {
                    **part_summary(part),
                    "previousUpdateDate": prev.get("updateDate", ""),
                    "previousUpdateDateLabel": display_date(prev.get("updateDate", "")),
                }
            )
        prev_agencies = {agency_key(a): a for a in prev.get("agencies", [])}
        current_agencies = {agency_key(a): a for a in part.get("agencies", [])}
        for agency_id, agency in current_agencies.items():
            if agency_id not in prev_agencies:
                changes["newAgencyDeviations"].append({"part": part_summary(part), "agency": agency})
        for agency_id, agency in prev_agencies.items():
            if agency_id not in current_agencies:
                changes["removedAgencyDeviations"].append({"part": part_summary(part), "agency": agency})
    return changes


def part_summary(part: dict[str, Any]) -> dict[str, Any]:
    return {
        "partNumber": part["partNumber"],
        "partLabel": part["partLabel"],
        "title": part["title"],
        "fullTitle": part["fullTitle"],
        "url": part["url"],
        "issuanceDate": part.get("issuanceDate", ""),
        "issuanceDateLabel": part.get("issuanceDateLabel", ""),
        "updateDate": part.get("updateDate", ""),
        "updateDateLabel": part.get("updateDateLabel", ""),
        "deviationCount": part.get("deviationCount", 0),
    }


def build_stats(parts: list[dict[str, Any]], announcements: list[dict[str, str]], fr_items: list[dict[str, str]]) -> dict[str, Any]:
    issued = [p for p in parts if p.get("issuanceDate")]
    updated = [p for p in parts if p.get("updateDate")]
    unique_agencies = sorted({agency["name"] for part in parts for agency in part.get("agencies", [])})
    latest_dates = [p["updateDate"] or p["issuanceDate"] for p in parts if p.get("updateDate") or p.get("issuanceDate")]
    return {
        "totalParts": len(parts),
        "issuedParts": len(issued),
        "updatedParts": len(updated),
        "agencyDeviationCount": sum(p.get("deviationCount", 0) for p in parts),
        "uniqueAgencyCount": len(unique_agencies),
        "latestPartDate": max(latest_dates) if latest_dates else "",
        "latestPartDateLabel": display_date(max(latest_dates) if latest_dates else ""),
        "announcementCount": len(announcements),
        "federalRegisterCount": len(fr_items),
    }


def main() -> None:
    previous = load_previous()
    guide_html = fetch_text(DEVIATION_GUIDE_URL)
    home_html = fetch_text(FAR_OVERHAUL_URL)
    rss_xml = fetch_text(ACQ_RSS_URL)

    parts = parse_deviation_guide(guide_html)
    announcements = parse_acquisition_rss(rss_xml)
    fr_items = fetch_federal_register_items()
    resources = official_resources(home_html)
    changes = build_changes(parts, previous)

    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": {
            "name": "Acquisition.gov FAR Overhaul",
            "hubUrl": FAR_OVERHAUL_URL,
            "deviationGuideUrl": DEVIATION_GUIDE_URL,
            "rssUrl": ACQ_RSS_URL,
            "federalRegisterApiUrl": FEDERAL_REGISTER_URL,
        },
        "note": "Primary-source FAR Overhaul tracker. The FAR part matrix and agency deviations are parsed from Acquisition.gov. Federal Register items are narrowly filtered official companion notices.",
        "stats": build_stats(parts, announcements, fr_items),
        "changes": changes,
        "parts": parts,
        "announcements": announcements,
        "federalRegister": fr_items,
        "resources": resources,
    }

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(payload, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
    OUT_JS.write_text("window.KTHQ_FAR_OVERHAUL_DATA = " + json.dumps(payload, indent=2, ensure_ascii=True) + ";\n", encoding="utf-8")
    print(
        f"Wrote {len(parts)} FAR parts, {len(announcements)} announcements, "
        f"and {len(fr_items)} Federal Register items to {OUT_JSON.relative_to(ROOT)}"
    )


if __name__ == "__main__":
    main()
