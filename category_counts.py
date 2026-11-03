"""Count products per Shoprenter category for the storefront menu ([1315]-style badges).

Each category's number = distinct visible products in that category AND all of its
subcategories (a product in two subcategories is counted once). Read-only on the shop.

    uv run src/webshop_changer/storefront/category_counts.py
    uv run src/webshop_changer/storefront/category_counts.py --compare old_counts.json

Writes src/data/category_counts/category_counts.json (and .js) in the same shape the
menu script already uses: {innerId: [name, count, parentInnerId]}.

Credentials: secrets/username.txt + secrets/password.txt, or the environment variables
SHOPRENTER_USERNAME / SHOPRENTER_PASSWORD (used by the scheduled GitHub Action).
"""

import argparse
import html
import json
import os
import sys
import time
from collections import defaultdict
from datetime import UTC, datetime
from pathlib import Path

import requests

try:
    import yaml
except ImportError:  # standalone run without PyYAML
    yaml = None
from requests.auth import HTTPBasicAuth

CONFIG_FILE = Path("src/config/shoprenter-config.yaml")
OUT_DIR = Path(os.environ.get("COUNTS_OUT_DIR", "src/data/category_counts"))
GET_DELAY = 0.1
RETRIES = 6


def _secret(env, path):
    value = os.environ.get(env, "").strip()
    if not value and Path(path).exists():
        value = Path(path).read_text(encoding="utf-8").strip()
    if not value:
        raise RuntimeError(f"Missing Shoprenter credential: set {env} or fill {path}")
    return value


def session():
    s = requests.Session()
    s.auth = HTTPBasicAuth(
        _secret("SHOPRENTER_USERNAME", "secrets/username.txt"),
        _secret("SHOPRENTER_PASSWORD", "secrets/password.txt"),
    )
    s.headers.update({"Accept": "application/json"})
    return s


def get(s, url, params):
    for attempt in range(RETRIES):
        try:
            r = s.get(url, params=params, timeout=60)
        except requests.RequestException:
            if attempt + 1 == RETRIES:
                raise
            time.sleep(2 ** (attempt + 1))
            continue
        if r.status_code in {429, 500, 502, 503, 504} and attempt + 1 < RETRIES:
            time.sleep(float(r.headers.get("Retry-After") or 2 ** (attempt + 1)))
            continue
        r.raise_for_status()
        time.sleep(GET_DELAY)
        return r.json()
    raise RuntimeError(f"GET failed: {url}")


def get_all(s, url, label):
    page, items = 0, []
    while True:
        data = get(s, url, {"full": 1, "limit": 200, "page": page})
        items += data.get("items", [])
        page += 1
        pages = int(data.get("pageCount") or 0)
        if page % 25 == 0 or page >= pages:
            print(f"  {label}: page {page}/{pages}", flush=True)
        if page >= pages:
            return items


def rid(value):
    if isinstance(value, dict):
        value = value.get("id") or value.get("href")
    return str(value or "").rstrip("/").rsplit("/", 1)[-1]


def compute(categories, names, relations, visible_ids):
    """Return {innerId: [name, count, parentInnerId]} for every named category."""
    inner_of = {c["id"]: str(c.get("innerId")) for c in categories}
    parent_of = {c["id"]: rid(c.get("parentCategory")) for c in categories}
    children = defaultdict(list)
    for cid, parent in parent_of.items():
        if parent in inner_of:
            children[parent].append(cid)

    direct = defaultdict(set)
    for product_id, category_id in relations:
        if product_id in visible_ids and category_id in inner_of:
            direct[category_id].add(product_id)

    memo = {}

    def subtree(cid, path=()):
        if cid in memo:
            return memo[cid]
        if cid in path:  # defensive: a parent loop must not hang the job
            return set()
        result = set(direct[cid])
        for child in children[cid]:
            result |= subtree(child, (*path, cid))
        memo[cid] = result
        return result

    out = {}
    for cid, inner in inner_of.items():
        name = names.get(cid, "")
        if not name:
            continue
        parent = parent_of.get(cid, "")
        out[inner] = [name, len(subtree(cid)), inner_of.get(parent, "")]
    return dict(sorted(out.items(), key=lambda kv: int(kv[0]) if kv[0].isdigit() else 0))


DEFAULT_API = "https://rockpince.api.shoprenter.hu"
DEFAULT_LANGUAGE = "bGFuZ3VhZ2UtbGFuZ3VhZ2VfaWQ9MQ=="  # Hungarian


def fetch(environment):
    if CONFIG_FILE.exists() and yaml is not None:
        config = yaml.safe_load(CONFIG_FILE.read_text(encoding="utf-8"))
        base = str(config["BASE_URL" if environment == "production" else "SANDBOX_BASE_URL"]).rstrip("/")
        lang = config["LANGUAGE_IDS"]["HUN"]
    else:  # standalone (GitHub Action): no repo config file
        base = os.environ.get("SHOPRENTER_API_URL", DEFAULT_API).rstrip("/")
        lang = DEFAULT_LANGUAGE
    s = session()
    categories = get_all(s, f"{base}/categories", "categories")
    descriptions = get_all(s, f"{base}/categoryDescriptions", "category names")
    names = {
        rid(d.get("category")): " ".join(html.unescape(str(d.get("name") or "")).split())
        for d in descriptions
        if rid(d.get("language")) == lang
    }
    # inactive categories are kept too: the menu can still link to them
    products = get_all(s, f"{base}/products", "products")
    visible = {p["id"] for p in products if str(p.get("status")) == "1"}
    relations = [
        (rid(r.get("product")), rid(r.get("category")))
        for r in get_all(s, f"{base}/productCategoryRelations", "product-category links")
    ]
    return categories, names, relations, visible


def write(counts):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    payload = {"generated": stamp, "counts": counts}
    text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    (OUT_DIR / "category_counts.json").write_text(text, encoding="utf-8")
    (OUT_DIR / "category_counts.js").write_text(f"window.RR_CATEGORY_COUNTS={text};\n", encoding="utf-8")
    return OUT_DIR / "category_counts.json"


def compare(new, old_path):
    old = json.loads(Path(old_path).read_text(encoding="utf-8"))
    old = old.get("counts", old)
    same = sum(1 for k in new if k in old and old[k][1] == new[k][1])
    print(f"Compared with {old_path}: {same} of {len(new)} identical")
    diffs = sorted(((abs(new[k][1] - old[k][1]), k) for k in new if k in old and old[k][1] != new[k][1]), reverse=True)
    for _, k in diffs[:15]:
        print(f"  {k} {new[k][0]}: old {old[k][1]} -> new {new[k][1]}")
    print(f"  only in new: {len(set(new) - set(old))}, only in old: {len(set(old) - set(new))}")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--environment", choices=("production", "sandbox"), default="production")
    parser.add_argument("--compare", help="Old counts JSON to compare with")
    args = parser.parse_args()

    started = time.monotonic()
    counts = compute(*fetch(args.environment))
    path = write(counts)
    roots = {k: v for k, v in counts.items() if not v[2]}
    for k, v in roots.items():
        print(f"ROOT {k} {v[0]}: {v[1]}")
    print(f"Wrote {len(counts)} categories to {path.resolve()} in {time.monotonic() - started:.0f}s")
    if args.compare:
        compare(counts, args.compare)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
