#!/usr/bin/env python3
"""
ContractingHQ — RFO News Aggregator
Fetches RSS feeds and API data from government and practitioner sources,
filters for FAR overhaul / acquisition reform content, and outputs JSON
for the static FAR Overhaul page.

Runs as a GitHub Action on a daily schedule.
"""

import json
import re
import os
import sys
import hashlib
from datetime import datetime, timedelta, timezone
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError
from xml.etree import ElementTree as ET
from html import unescape

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "rfo-news.json")
MAX_AGE_DAYS = 365  # Drop items older than this
MAX_ITEMS_PER_SOURCE = 25
MAX_ITEMS_TOTAL = 200
REQUEST_TIMEOUT = 20  # seconds

# Keywords that mark an item as RFO-relevant (case-insensitive)
# Items from "always include" sources skip keyword filtering
RFO_KEYWORDS = [
    r"far\s+overhaul",
    r"far\s+rewrite",
    r"revolutionary\s+far",
    r"\brfo\b",
    r"acquisition\s+reform",
    r"far\s+deviation",
    r"class\s+deviation",
    r"far\s+case\b",
    r"federal\s+acquisition\s+regulation",
    r"dfars\s+overhaul",
    r"procurement\s+reform",
    r"far\s+moderniz",
    r"far\s+overhaul",
    r"far\s+companion",
    r"acquisition\.gov.{0,20}overhaul",
    r"EO\s*14275",
    r"executive\s+order\s+14275",
    r"OFPP",
    r"principles.based\s+acquisition",
    r"FAR\s+part\s+\d+.*(?:rewrite|overhaul|deviation|reform)",
    r"streamlin(?:e|ing)\s+(?:the\s+)?(?:FAR|acquisition|procurement)",
]

RFO_PATTERN = re.compile("|".join(RFO_KEYWORDS), re.IGNORECASE)

# ---------------------------------------------------------------------------
# Source definitions
# ---------------------------------------------------------------------------
# Each source has:
#   name          — display name
#   url           — feed/API URL
#   type          — "rss" or "federal_register_api"
#   category      — "government", "practitioner", or "legislative"
#   always_include — if True, skip keyword filter (source is RFO-focused)
#   icon          — emoji for display

SOURCES = [
    # ---- Government ----
    {
        "name": "Acquisition.gov",
        "url": "https://acquisition.gov/rss.xml",
        "type": "rss",
        "category": "government",
        "always_include": True,
        "icon": "\U0001f3db\ufe0f",
    },
    {
        "name": "Federal Register",
        "url": (
            "https://www.federalregister.gov/api/v1/documents.rss"
            "?conditions%5Bagencies%5D%5B%5D=defense-acquisition-regulations-system"
            "&conditions%5Bagencies%5D%5B%5D=general-services-administration"
            "&conditions%5Btype%5D%5B%5D=RULE"
            "&conditions%5Btype%5D%5B%5D=PRORULE"
            "&conditions%5Btype%5D%5B%5D=NOTICE"
            "&order=newest"
        ),
        "type": "rss",
        "category": "government",
        "always_include": False,
        "icon": "\U0001f4dc",
    },
    {
        "name": "Defense.gov",
        "url": "https://www.defense.gov/DesktopModules/ArticleCS/RSS.ashx?max=20&ContentType=800&Site=945",
        "type": "rss",
        "category": "government",
        "always_include": False,
        "icon": "\U0001f396\ufe0f",
    },
    {
        "name": "GAO Reports",
        "url": "https://www.gao.gov/rss/reports.xml",
        "type": "rss",
        "category": "government",
        "always_include": False,
        "icon": "\U0001f50d",
    },
    {
        "name": "Congress.gov",
        "url": "https://www.congress.gov/rss/most-viewed-bills.xml",
        "type": "rss",
        "category": "legislative",
        "always_include": False,
        "icon": "\U0001f3db\ufe0f",
    },

    # ---- Practitioner / Analysis ----
    {
        "name": "Federal News Network",
        "url": "https://federalnewsnetwork.com/category/defense-news/feed/",
        "type": "rss",
        "category": "practitioner",
        "always_include": False,
        "icon": "\U0001f4f0",
    },
    {
        "name": "Federal News Network (Mgmt)",
        "url": "https://federalnewsnetwork.com/category/management/feed/",
        "type": "rss",
        "category": "practitioner",
        "always_include": False,
        "icon": "\U0001f4f0",
    },
    {
        "name": "NextGov/FCW",
        "url": "https://www.nextgov.com/rss/all/",
        "type": "rss",
        "category": "practitioner",
        "always_include": False,
        "icon": "\U0001f4bb",
    },
    {
        "name": "Defense One",
        "url": "https://www.defenseone.com/rss/all/",
        "type": "rss",
        "category": "practitioner",
        "always_include": False,
        "icon": "\U0001f6e1\ufe0f",
    },
    {
        "name": "Wiley Rein",
        "url": "https://www.wiley.law/feed",
        "type": "rss",
        "category": "practitioner",
        "always_include": False,
        "icon": "\u2696\ufe0f",
    },
    {
        "name": "Crowell & Moring",
        "url": "https://www.governmentcontractslegalforum.com/feed/",
        "type": "rss",
        "category": "practitioner",
        "always_include": False,
        "icon": "\u2696\ufe0f",
    },
    {
        "name": "Inside Government Contracts",
        "url": "https://www.insidegovernmentcontracts.com/feed/",
        "type": "rss",
        "category": "practitioner",
        "always_include": False,
        "icon": "\u2696\ufe0f",
    },
    {
        "name": "PilieroMazza",
        "url": "https://www.pilieromazza.com/feed/",
        "type": "rss",
        "category": "practitioner",
        "always_include": False,
        "icon": "\u2696\ufe0f",
    },
    {
        "name": "Holland & Knight",
        "url": "https://www.hklaw.com/en/insights/rss.xml",
        "type": "rss",
        "category": "practitioner",
        "always_include": False,
        "icon": "\u2696\ufe0f",
    },
    {
        "name": "GovExec",
        "url": "https://www.govexec.com/rss/all/",
        "type": "rss",
        "category": "practitioner",
        "always_include": False,
        "icon": "\U0001f4f0",
    },
]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

USER_AGENT = "ContractingHQ-RFO-Aggregator/1.0 (GitHub Pages; +https://kthq.org)"


def fetch_url(url):
    """Fetch a URL and return the response body as a string."""
    req = Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
            data = resp.read()
            # Try utf-8 first, fall back to latin-1
            try:
                return data.decode("utf-8")
            except UnicodeDecodeError:
                return data.decode("latin-1")
    except (URLError, HTTPError, OSError) as exc:
        print(f"  [WARN] Failed to fetch {url}: {exc}", file=sys.stderr)
        return None


def clean_html(text):
    """Strip HTML tags and unescape entities."""
    if not text:
        return ""
    text = unescape(text)
    # Double-decode in case of double-escaped entities
    text = unescape(text)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    # Strip Drupal-style author/date prefix from Acquisition.gov
    text = re.sub(r"^.*?Anonymous\s*\(not verified\)\s*\w{3},\s*\d{2}/\d{2}/\d{4}\s*-\s*\d{2}:\d{2}\s*", "", text)
    text = re.sub(r"^.*?gregory\.pangbo[^\s]*\s*\w{3},\s*\d{2}/\d{2}/\d{4}\s*-\s*\d{2}:\d{2}\s*", "", text)
    return text


def extract_date_from_text(text):
    """Try to pull a date from Drupal-style summary text."""
    # Match patterns like "Tue, 03/17/2026 - 11:00"
    m = re.search(r"(\d{2})/(\d{2})/(\d{4})\s*-\s*\d{2}:\d{2}", text or "")
    if m:
        return f"{m.group(3)}-{m.group(1)}-{m.group(2)}"
    return None


def parse_date(date_str):
    """Best-effort date parsing. Returns ISO date string or None."""
    if not date_str:
        return None
    # Strip timezone abbreviations like "EST", "EDT" that strptime can't handle
    date_str = re.sub(r"\s+[A-Z]{2,4}\s*$", "", date_str.strip())
    formats = [
        "%a, %d %b %Y %H:%M:%S %z",
        "%a, %d %b %Y %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
        "%d %b %Y",
        "%B %d, %Y",
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(date_str, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue
    # Last resort: look for YYYY-MM-DD anywhere in string
    m = re.search(r"(\d{4}-\d{2}-\d{2})", date_str)
    if m:
        return m.group(1)
    return None


def is_rfo_relevant(title, summary):
    """Check if an item matches RFO keywords."""
    text = f"{title} {summary}"
    return bool(RFO_PATTERN.search(text))


def item_id(title, url):
    """Generate a stable ID for deduplication."""
    key = f"{title.lower().strip()}|{url.strip()}"
    return hashlib.md5(key.encode()).hexdigest()[:12]


# ---------------------------------------------------------------------------
# RSS parser
# ---------------------------------------------------------------------------

# Common XML namespaces in RSS/Atom feeds
NS = {
    "atom": "http://www.w3.org/2005/Atom",
    "dc": "http://purl.org/dc/elements/1.1/",
    "content": "http://purl.org/rss/1.0/modules/content/",
}


def parse_rss(xml_text, source):
    """Parse an RSS or Atom feed and return a list of item dicts."""
    items = []
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as exc:
        print(f"  [WARN] XML parse error for {source['name']}: {exc}", file=sys.stderr)
        return items

    cutoff = datetime.now(timezone.utc) - timedelta(days=MAX_AGE_DAYS)
    cutoff_str = cutoff.strftime("%Y-%m-%d")

    # Detect Atom vs RSS
    if root.tag == "{http://www.w3.org/2005/Atom}feed" or root.tag == "feed":
        entries = root.findall("atom:entry", NS) or root.findall("entry")
        for entry in entries:
            title_el = entry.find("atom:title", NS) or entry.find("title")
            link_el = entry.find("atom:link", NS) or entry.find("link")
            summary_el = entry.find("atom:summary", NS) or entry.find("summary")
            content_el = entry.find("atom:content", NS) or entry.find("content")
            date_el = entry.find("atom:updated", NS) or entry.find("atom:published", NS) or entry.find("updated") or entry.find("published")

            title = clean_html(title_el.text if title_el is not None and title_el.text else "")
            url = link_el.get("href", "") if link_el is not None else ""
            summary = clean_html((summary_el.text if summary_el is not None and summary_el.text else "") or
                                 (content_el.text if content_el is not None and content_el.text else ""))
            date = parse_date(date_el.text if date_el is not None and date_el.text else "")

            if not title or not url:
                continue
            if date and date < cutoff_str:
                continue
            if len(summary) > 400:
                summary = summary[:397] + "..."

            items.append({
                "title": title,
                "url": url,
                "source": source["name"],
                "icon": source["icon"],
                "category": source["category"],
                "date": date or "",
                "summary": summary,
            })
    else:
        # RSS 2.0 / RSS 1.0
        channel_items = root.findall(".//item")
        for item in channel_items:
            title_el = item.find("title")
            link_el = item.find("link")
            desc_el = item.find("description")
            content_el = item.find("content:encoded", NS)
            date_el = item.find("pubDate") or item.find("dc:date", NS)

            title = clean_html(title_el.text if title_el is not None and title_el.text else "")
            url = link_el.text.strip() if link_el is not None and link_el.text else ""
            desc_text = desc_el.text if desc_el is not None and desc_el.text else ""
            content_text = content_el.text if content_el is not None and content_el.text else ""
            raw_summary = desc_text or content_text
            summary = clean_html(raw_summary)
            date = parse_date(date_el.text if date_el is not None and date_el.text else "")

            # Fallback: extract date from summary text (Acquisition.gov Drupal feeds)
            if not date:
                date = extract_date_from_text(raw_summary)

            if not title or not url:
                continue
            if date and date < cutoff_str:
                continue
            if len(summary) > 400:
                summary = summary[:397] + "..."
            # Strip the title repeated at start of summary
            if summary.startswith(title):
                summary = summary[len(title):].strip()

            items.append({
                "title": title,
                "url": url,
                "source": source["name"],
                "icon": source["icon"],
                "category": source["category"],
                "date": date or "",
                "summary": summary,
            })

    return items[:MAX_ITEMS_PER_SOURCE]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    all_items = []
    seen_ids = set()

    for source in SOURCES:
        print(f"Fetching: {source['name']} ({source['url'][:80]}...)")
        raw = fetch_url(source["url"])
        if not raw:
            continue

        if source["type"] == "rss":
            items = parse_rss(raw, source)
        else:
            print(f"  [WARN] Unknown source type: {source['type']}", file=sys.stderr)
            continue

        # Filter for RFO relevance (unless source is always-include)
        if not source.get("always_include"):
            items = [i for i in items if is_rfo_relevant(i["title"], i["summary"])]

        # Deduplicate
        for item in items:
            iid = item_id(item["title"], item["url"])
            if iid not in seen_ids:
                seen_ids.add(iid)
                all_items.append(item)

        print(f"  -> {len(items)} relevant items")

    # Sort by date descending (items without dates go to the end)
    all_items.sort(key=lambda x: x.get("date") or "0000-00-00", reverse=True)

    # Cap total
    all_items = all_items[:MAX_ITEMS_TOTAL]

    # Build output
    output = {
        "last_updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "item_count": len(all_items),
        "sources_checked": len(SOURCES),
        "items": all_items,
    }

    # Ensure output directory exists
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"\nDone. {len(all_items)} items written to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
