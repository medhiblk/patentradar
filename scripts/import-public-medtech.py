"""Refresh a small, attributed public patent reference corpus, not a search API.

Only documented anonymous EPO Publication Server URLs are requested. Requests
are sequential, >=1.1s apart, bounded, with no retry/bypass or credentials.
--offline-cache is an audit-only import of previously observed HTTP-200 bytes.
"""
import argparse
import datetime
import hashlib
import html
import json
import pathlib
import re
import time
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
SERVICE = "https://data.epo.org/publication-server/rest/v1.2"
# Identifiers were discovered in the official dated publication listing, then
# individually retrieved and checked for medical classification and full text.
MANIFEST = [(number, "20200108") for number in ["EP3590450A1", "EP3590452A1", "EP3590448A1", "EP3590455A1", "EP3590550A1"]] + [(number, "20000517") for number in [
    "EP1000581A1", "EP1000583A1", "EP1000584A1", "EP1000587A1",
    "EP1000590A1", "EP1000594A1", "EP1000595A1", "EP1000596A1",
    "EP1000599A1", "EP1000600A1", "EP1000629A1", "EP1000630A1", "EP1000634A1",
]]
SAMPLE_IDS = ["EP1000590A1", "EP1000594A1", "EP3590450A1"]
MAX_BYTES = 4 * 1024 * 1024
last_request = 0.0


def timestamp():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def clean(value):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]*>", " ", value))).strip()


def url_for(number, date, extension):
    identifier = re.sub(r"([AB]\d)$", r"NW\1", number)
    return f"{SERVICE}/publication-dates/{date}/patents/{identifier}/document.{extension}"


def get(url):
    global last_request
    time.sleep(max(0, 1.1 - (time.monotonic() - last_request)))
    last_request = time.monotonic()
    started = time.monotonic()
    request = urllib.request.Request(url, headers={"User-Agent": "FormaProof-PublicReferenceImport/1.0", "Accept": "application/xml, application/pdf"})
    with urllib.request.urlopen(request, timeout=25) as response:
        body = response.read(MAX_BYTES + 1)
        if response.status != 200 or len(body) > MAX_BYTES:
            raise ValueError("Unsuccessful or oversized public document response")
        return body, {"url": url, "httpStatus": response.status, "contentType": response.headers.get("Content-Type"), "bytes": len(body), "latencyMs": round((time.monotonic() - started) * 1000), "retrievedAt": timestamp(), "sha256": hashlib.sha256(body).hexdigest()}


def parse(body, observation, expected):
    xml = body.decode("utf-8")
    root = re.search(r"<ep-patent-document\s([^>]+)>", xml)
    if not root:
        raise ValueError("Expected patent XML, not an HTML/login response")
    attrs = dict(re.findall(r'([\w-]+)="([^"]*)"', root[1]))
    number = attrs.get("country", "") + attrs.get("doc-number", "") + attrs.get("kind", "")
    if number != expected:
        raise ValueError("Returned publication does not match requested identifier")
    title_match = re.search(r"<B541>en</B541>\s*<B542>(.*?)</B542>", xml, re.S)
    if not title_match:
        raise ValueError("English bibliographic title absent")
    applicant = re.search(r"<B710>(.*?)</B710>", xml, re.S)
    inventor = re.search(r"<B720>(.*?)</B720>", xml, re.S)
    claim_blocks = re.findall(r'<claims\b[^>]*lang="([^"]+)"[^>]*>(.*?)</claims>', xml, re.S)
    if not claim_blocks:
        raise ValueError("No claim text: do not promote bibliography-only records")
    claim_language, block = next((pair for pair in claim_blocks if pair[0] == "en"), claim_blocks[0])
    all_claims = [clean(value) for value in re.findall(r"<claim\b[^>]*>(.*?)</claim>", block, re.S)]
    all_claims = [value for value in all_claims if value]
    if not all_claims:
        raise ValueError("Claims container was empty")
    claims, remaining = [], 40000
    for claim in all_claims[:20]:
        excerpt = claim[:min(6000, remaining)]
        if excerpt:
            claims.append(excerpt)
            remaining -= len(excerpt)
    full = len(claims) == len(all_claims) and all(a == b for a, b in zip(claims, all_claims))
    abstracts = re.findall(r'<abstract\b[^>]*lang="([^"]+)"[^>]*>(.*?)</abstract>', xml, re.S)
    abstract_pair = next((pair for pair in abstracts if pair[0] == "en"), abstracts[0] if abstracts else None)
    abstract = clean(abstract_pair[1])[:10000] if abstract_pair else ""
    description = re.search(r'<description\b[^>]*lang="' + re.escape(claim_language) + r'"[^>]*>(.*?)</description>', xml, re.S)
    classification = []
    for value in re.findall(r"<B511>(.*?)</B511>", xml, re.S) + re.findall(r"<classification-ipcr\b[^>]*>(.*?)</classification-ipcr>", xml, re.S):
        match = re.search(r"([A-H])\s*(\d{2})\s*([A-Z])\s*(\d+)\s*/\s*(\d+)", clean(value))
        if match:
            classification.append("".join(match.groups()[:3]) + match[4] + "/" + match[5])
    if not any(value.startswith("A61") for value in classification):
        raise ValueError("Reference corpus entry is not medical-classified")
    date = attrs["date-publ"]
    record = {"id": number, "publicationNumber": number, "title": clean(title_match[1]), "applicants": [clean(value) for value in re.findall(r"<snm>(.*?)</snm>", applicant[1], re.S)] if applicant else [], "inventors": [clean(value) for value in re.findall(r"<snm>(.*?)</snm>", inventor[1], re.S)] if inventor else [], "publicationDate": f"{date[:4]}-{date[4:6]}-{date[6:]}", "jurisdiction": attrs["country"], "ipcCodes": list(dict.fromkeys(classification)), "claims": claims, "claimsScope": "full" if full else "excerpts", "source": "EPO Publication Server — indexed public reference corpus", "sourceUrl": observation["url"], "pdfUrl": observation["url"].replace("document.xml", "document.pdf"), "retrievedAt": observation["retrievedAt"]}
    if abstract:
        record["abstract"] = abstract
    app = re.search(r"<B210>(.*?)</B210>", xml, re.S)
    if app:
        record["applicationNumber"] = clean(app[1])
    record["evidence"] = [{"source": record["source"], "sourceUrl": record["sourceUrl"], "retrievedAt": record["retrievedAt"], "fields": {"title": record["title"], "abstract": abstract, "claims": claims, "claimsScope": record["claimsScope"], "claimLanguage": claim_language, "abstractLanguage": abstract_pair[0] if abstract_pair else None, "originalClaimsCount": len(all_claims), "descriptionExcerpt": clean(description[1])[:18000] if description else "", "sourceXmlSha256": observation["sha256"], "referenceCorpus": True, "coverage": "Bounded indexed public references; not live worldwide search or legal status verification."}}]
    return record


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--offline-cache", type=pathlib.Path)
    args = parser.parse_args()
    observed = []
    if args.offline_cache:
        for path in [args.offline_cache / "epo-medtech-fetch-log.json", args.offline_cache / "epo-medtech-pdf-log.json", *args.offline_cache.glob("EP*.retrieval.json")]:
            if path.exists():
                value = json.loads(path.read_text())
                observed.extend(value if isinstance(value, list) else [value])
    records, observations = [], []
    for number, date in MANIFEST:
        url = url_for(number, date, "xml")
        if args.offline_cache:
            observation = next((row for row in observed if row.get("url") == url and row.get("httpStatus") == 200), None)
            if not observation:
                raise ValueError("No original successful HTTP observation for " + number)
            body = (args.offline_cache / (re.sub(r"([AB]\d)$", r"NW\1", number) + ".xml")).read_bytes()
            if hashlib.sha256(body).hexdigest() != observation["sha256"]:
                raise ValueError("Cached source differs from observed HTTP bytes")
        else:
            body, observation = get(url)
        record = parse(body, observation, number)
        records.append(record)
        observations.append(observation)
    samples = []
    asset_dir = ROOT / "apps/web/public/examples/medtech"
    asset_dir.mkdir(parents=True, exist_ok=True)
    for index, number in enumerate(SAMPLE_IDS, 1):
        record = next(row for row in records if row["publicationNumber"] == number)
        name = f"sample-document-{index:02}.pdf"
        path = asset_dir / name
        if args.offline_cache:
            observation = next(row for row in observed if row.get("url") == record["pdfUrl"] and row.get("httpStatus") == 200)
            body = path.read_bytes()
            if hashlib.sha256(body).hexdigest() != observation["sha256"]:
                raise ValueError("Sample PDF differs from original download")
        else:
            body, observation = get(record["pdfUrl"])
        if not body.startswith(b"%PDF-") or len(body) > MAX_BYTES:
            raise ValueError("Sample is not a bounded PDF")
        path.write_bytes(body)
        samples.append({"id": f"medical-device-{index:02}", "title": record["title"], "description": "Actual public EPO document. Matching uses a limited reference corpus; this is not a freedom-to-operate assessment.", "publicationNumber": number, "sourceUrl": record["pdfUrl"], "pdfPath": f"/examples/medtech/{name}", "sha256": observation["sha256"], "bytes": len(body), "retrievedAt": observation["retrievedAt"]})
        observations.append(observation)
    samples.sort(key=lambda row: 0 if row["id"] == "medical-device-03" else 1)
    dataset = {"schemaVersion": 1, "id": "epo-public-medtech-v1", "label": "Indexed public medical patent references", "coverage": "Small attributed public-reference corpus; EP medical publications from 2000 and 2020, not live worldwide search, not a complete competitive landscape and not legal-status clearance.", "importedAt": timestamp(), "recordCount": len(records), "discoveryUrl": SERVICE + "/publication-dates/20200108/patents", "records": records, "samples": samples, "observations": observations}
    output = ROOT / "apps/web/src/lib/patents/data/public-medtech-patents.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(dataset, ensure_ascii=False, indent=2) + "\n")
    cases_module = ROOT / "apps/web/src/lib/demo/medtech-cases.ts"
    cases_module.parent.mkdir(parents=True, exist_ok=True)
    cases_module.write_text("// Actual official public documents. IDs select downloads, never expected search answers.\nexport const MEDTECH_CASES = " + json.dumps(samples, ensure_ascii=False, indent=2) + " as const;\n")
    print(json.dumps({"records": len(records), "samples": len(samples), "output": str(output), "observedHttp200": len(observations)}))


if __name__ == "__main__":
    main()
