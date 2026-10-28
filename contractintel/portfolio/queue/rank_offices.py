"""One read-only FY transaction export, streamed on the Actions runner; no award imports."""
import csv, decimal, hashlib, io, json, pathlib, random, sys, time, urllib.request, urllib.error, urllib.parse, zipfile

class RankingError(Exception): pass

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise RankingError("Export redirects are not allowed.")

def amount_cents(value):
    try:
        amount = decimal.Decimal(value)
        cents = amount * 100
        if not amount.is_finite() or cents != cents.to_integral_value():
            raise RankingError("Invalid or fractional-cent transaction obligation.")
        return int(cents)
    except decimal.InvalidOperation:
        raise RankingError("Invalid transaction obligation.")

def aggregate(archive, directory, config):
    codes = {o["code"]: o for o in directory}
    totals = {code: 0 for code in codes}
    counts = {code: 0 for code in codes}
    stats = {"rows": 0, "matched_rows": 0, "unmatched_rows": 0, "out_of_window": 0}
    csv.field_size_limit(config["rankingMaxFieldBytes"])
    with zipfile.ZipFile(archive) as bundle:
        members = [m for m in bundle.infolist() if m.filename.lower().endswith(".csv")]
        if not members or len(members) > config["rankingMaxCSVFiles"]:
            raise RankingError("Unexpected CSV file count.")
        if sum(m.file_size for m in members) > config["rankingMaxExpandedBytes"]:
            raise RankingError("Expanded export size limit reached.")
        for member in members:
            with bundle.open(member) as binary, io.TextIOWrapper(binary, encoding="utf-8-sig", newline="") as text:
                reader = csv.DictReader(text)
                required = {"award_id_piid", "federal_action_obligation", "action_date"}
                if not required.issubset(reader.fieldnames or []):
                    raise RankingError("Required transaction columns missing; refusing approximate ranking.")
                for row in reader:
                    stats["rows"] += 1
                    if stats["rows"] > config["rankingMaxRows"]:
                        raise RankingError("Transaction row limit reached.")
                    date = row["action_date"]
                    if not config["startDate"] <= date <= config["endDate"]:
                        stats["out_of_window"] += 1
                        raise RankingError("Export contains transactions outside the requested fiscal year.")
                    # Same exact, case-sensitive first-six PIID semantics as the browser.
                    code = row["award_id_piid"][:6]
                    cents = amount_cents(row["federal_action_obligation"])
                    if code in codes:
                        totals[code] += cents
                        counts[code] += 1
                        stats["matched_rows"] += 1
                    else:
                        stats["unmatched_rows"] += 1
    if not stats["matched_rows"]:
        raise RankingError("No directory offices matched the export.")
    ordered = sorted(codes, key=lambda code: (-totals[code], code))
    ranking = [{"rank": i + 1, "office": code, "name": codes[code]["name"],
                "fy_obligations_cents": str(totals[code]), "transaction_count": counts[code]}
               for i, code in enumerate(ordered)]
    selected = ranking[:config["seedCount"]]
    if len(selected) != config["seedCount"]:
        raise RankingError("Directory is too small for the configured seed cohort.")
    return {"fiscal_year": config["fiscalYear"], "basis": "PIID first six characters; net FY transaction obligations",
            "start_date": config["startDate"], "end_date": config["endDate"],
            "statistics": stats, "seed": selected, "ranking": ranking}

def generate(config, directory, output):
    deadline = time.monotonic() + config["rankingTimeoutMs"] / 1000
    requests = 0
    def check():
        if time.monotonic() >= deadline:
            raise RankingError("Ranking runtime budget reached.")
    def request(url, body=None, download=False):
        nonlocal requests
        parsed = urllib.parse.urlparse(url)
        allowed = {"api.usaspending.gov"} if not download else {"files.usaspending.gov"}
        if parsed.scheme != "https" or parsed.hostname not in allowed or parsed.username or parsed.password:
            raise RankingError("Unapproved export URL.")
        for attempt in range(config["rankingRetryAttempts"]):
            check()
            if requests >= config["rankingMaxRequests"]:
                raise RankingError("Ranking request budget reached.")
            requests += 1
            req = urllib.request.Request(url, data=None if body is None else json.dumps(body).encode(),
                                         headers={"Content-Type": "application/json", "User-Agent": "ContractIntel-ranking"})
            try:
                response = urllib.request.build_opener(NoRedirect).open(req, timeout=min(config["rankingHTTPTimeoutMs"]/1000, max(1, deadline-time.monotonic())))
                if response.geturl() != url:
                    response.close()
                    raise RankingError("Unexpected export redirect.")
                return response
            except urllib.error.HTTPError as error:
                if error.code not in (429, 500, 502, 503, 504) or attempt + 1 == config["rankingRetryAttempts"]:
                    raise RankingError("Export HTTP " + str(error.code)) from None
            except urllib.error.URLError:
                if attempt + 1 == config["rankingRetryAttempts"]:
                    raise RankingError("Export connection failed.") from None
            delay = min(config["rankingRetryMaxMs"], config["rankingRetryBaseMs"] * 2**attempt)
            time.sleep((delay + random.random()*config["rankingRetryJitterMs"])/1000)
        raise RankingError("Export request exhausted.")
    def get_json(url, body=None):
        with request(url, body) as response:
            data = response.read(config["rankingMaxJSONBytes"]+1)
            if len(data) > config["rankingMaxJSONBytes"]:
                raise RankingError("Export metadata limit reached.")
            return json.loads(data)
    body = {"filters": {"agencies": [], "prime_award_types": ["A","B","C","D"],
                       "date_type": "action_date", "date_range": {"start_date": config["startDate"],"end_date": config["endDate"]}},
            "columns": ["award_id_piid","federal_action_obligation","action_date"], "file_format":"csv"}
    job = get_json("https://api.usaspending.gov/api/v2/bulk_download/awards/", body)
    status_url, file_url = job["status_url"], job["file_url"]
    while True:
        status = get_json(status_url)
        state = str(status.get("status","")).lower()
        if state == "finished": break
        if state in ("failed","error"): raise RankingError("USAspending export generation failed.")
        check()
        time.sleep(config["rankingPollMs"]/1000)
    archive = output / "fy-transactions.zip"
    digest = hashlib.sha256()
    size = 0
    with request(file_url, download=True) as response, archive.open("wb") as destination:
        while True:
            check()
            block = response.read(config["rankingReadBytes"])
            if not block: break
            size += len(block)
            if size > config["rankingMaxDownloadBytes"]:
                raise RankingError("Compressed export size limit reached.")
            destination.write(block)
            digest.update(block)
    result = aggregate(archive, directory, config)
    reported = status.get("total_rows")
    if reported is None or int(reported) != result["statistics"]["rows"]:
        raise RankingError("Export row count differs from source completion metadata.")
    result["source"] = {"endpoint":"https://api.usaspending.gov/api/v2/bulk_download/awards/",
                        "request":body, "file_url":file_url, "compressed_bytes":size, "sha256":digest.hexdigest(),
                        "requests_including_retries":requests}
    archive.unlink()
    (output / "office-ranking.json").write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"ranking_complete":True,"offices":len(result["ranking"]),"seed":len(result["seed"]),
                      "requests":requests,"compressed_bytes":size,"matched_transactions":result["statistics"]["matched_rows"]}))

if __name__ == "__main__":
    try:
        config = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))
        directory = json.loads(pathlib.Path(sys.argv[2]).read_text(encoding="utf-8"))
        output = pathlib.Path(sys.argv[3])
        output.mkdir(parents=True,exist_ok=True)
        generate(config,directory,output)
    except Exception as error:
        print("Office ranking stopped: "+str(error),file=sys.stderr)
        sys.exit(1)
