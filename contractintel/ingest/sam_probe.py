"""Bounded SAM access probe. Never print URLs, credentials, records, or error bodies."""
import datetime as dt
import json
import os
from pathlib import Path
import urllib.error
import urllib.parse
import urllib.request


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def probe():
    key = os.environ.get("SAM_API_KEY", "").strip()
    if not key:
        raise SystemExit("SAM_API_KEY is not configured. No requests made.")
    today = dt.datetime.now(dt.timezone.utc).date()
    yesterday = today - dt.timedelta(days=1)
    queries = [
        ("opportunities", "https://api.sam.gov/opportunities/v2/search", {
            "postedFrom": yesterday.strftime("%m/%d/%Y"),
            "postedTo": today.strftime("%m/%d/%Y"), "limit": 1, "offset": 0}),
        ("contract_awards", "https://api.sam.gov/contract-awards/v1/search", {
            "contractingOfficeCode": "FA4800", "dateSigned": "[01/01/2025,01/31/2025]",
            "limit": 1, "offset": 0}),
    ]
    results = []
    opener = urllib.request.build_opener(NoRedirect())
    for name, endpoint, params in queries:
        item = {"endpoint": name, "http_status": None, "valid_json": False}
        try:
            url = endpoint + "?" + urllib.parse.urlencode({**params, "api_key": key})
            req = urllib.request.Request(url, headers={"Accept": "application/json"})
            with opener.open(req, timeout=45) as response:
                item["http_status"] = response.status
                raw = response.read(2_000_001)
                if len(raw) > 2_000_000:
                    item["error"] = "Response exceeded probe size limit"
                else:
                    data = json.loads(raw)
                    item["valid_json"] = isinstance(data, dict)
                    if name == "opportunities" and isinstance(data, dict):
                        records = data.get("opportunitiesData")
                        item["records_array_present"] = isinstance(records, list)
                        if isinstance(records, list):
                            item["records_returned"] = len(records)
                            first = records[0] if records and isinstance(records[0], dict) else {}
                            item["known_fields_present"] = {field: field in first for field in (
                                "noticeId", "title", "postedDate", "fullParentPathCode",
                                "responseDeadLine", "reponseDeadLine", "typeOfSetAside", "setAside")}
        except urllib.error.HTTPError as exc:
            item["http_status"] = exc.code
            item["error"] = "SAM rejected the request; no response body retained"
        except (OSError, ValueError):
            item["error"] = "Network failure or unexpected JSON; details suppressed"
        results.append(item)
    report = {"checked_at": dt.datetime.now(dt.timezone.utc).isoformat(),
              "request_count": len(queries), "quota_entitlement": "not verified", "results": results}
    print(json.dumps(report, indent=2))
    Path("sam-probe.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    if any(r["http_status"] != 200 or not r["valid_json"] for r in results):
        raise SystemExit(1)


if __name__ == "__main__":
    probe()
