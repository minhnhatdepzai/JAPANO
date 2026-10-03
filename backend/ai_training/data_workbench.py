"""Local, reviewable database/JSON/CSV -> datasets; Kaggle credentials never exported."""
import argparse
import csv
import hashlib
import json
import os
import shutil
import stat
import zipfile
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEFAULT = ROOT / 'backend/ai_training/workbench'
SOURCES = {
    'fashion': ('paramaggarwal/fashion-product-images-small', 'MIT'),
    'support': ('bitext/bitext-gen-ai-chatbot-customer-support-dataset', 'Community Data License Agreement - Sharing - Version 1.0'),
    'retail': ('mohammadtalib786/retail-sales-dataset', 'CC0-1.0'),
}


def digest(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as f:
        for b in iter(lambda: f.read(1024 * 1024), b''):
            h.update(b)
    return h.hexdigest()


def save(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')


def kaggle_api():
    os.environ.setdefault('KAGGLE_CONFIG_DIR', str(ROOT))
    from kaggle.api.kaggle_api_extended import KaggleApi
    api = KaggleApi()
    api.authenticate()
    return api


def extract(archive, dest):
    """No executable content; validate every member before writing any file."""
    dest = Path(dest).resolve()
    with zipfile.ZipFile(archive) as z:
        entries = [i for i in z.infolist() if not i.is_dir()]
        if len(entries) > 100000 or sum(i.file_size for i in entries) > 3 * 1024**3:
            raise ValueError('Archive exceeds 100000 files / 3 GiB')
        plan = []
        for i in entries:
            target = (dest / i.filename.replace('\\', '/')).resolve()
            if not target.is_relative_to(dest) or stat.S_ISLNK(i.external_attr >> 16):
                raise ValueError('Unsafe archive path')
            if target.suffix.lower() not in {'.csv', '.json', '.jsonl', '.txt', '.md', '.jpg', '.jpeg', '.png'}:
                continue
            plan.append((i, target))
        for i, target in plan:
            target.parent.mkdir(parents=True, exist_ok=True)
            with z.open(i) as src, target.open('wb') as out:
                shutil.copyfileobj(src, out)


def download(name, root):
    ref, license_name = SOURCES[name]
    dest = root / 'raw' / name
    dest.mkdir(parents=True, exist_ok=True)
    api = kaggle_api()
    api.dataset_metadata(ref, str(dest))
    metadata = json.loads((dest / 'dataset-metadata.json').read_text())
    info = metadata.get('info', metadata)
    licenses = [x['name'] for x in info.get('licenses', [])]
    if license_name not in licenses:
        raise ValueError(f'License changed for {ref}: manual review required')
    api.dataset_download_files(ref, path=str(dest), quiet=False, unzip=False)
    archives = list(dest.glob('*.zip'))
    if len(archives) != 1:
        raise ValueError('Expected exactly one archive')
    archive = archives[0]
    extract(archive, dest / 'files')
    record = {'source': f'https://www.kaggle.com/datasets/{ref}', 'license': license_name,
              'downloadedAt': datetime.now(timezone.utc).isoformat(), 'sha256': digest(archive),
              'bytes': archive.stat().st_size, 'synthetic': name in {'support', 'retail'},
              'use': 'offline-training-and-evaluation; never JAPANO inventory',
              'licenseEvidence': str(dest / 'dataset-metadata.json')}
    save(dest / 'manifest.json', record)
    print(json.dumps(record, ensure_ascii=False))


def export_catalog(source, root):
    """Allowlist product fields only: no users, orders, addresses, chats or credentials."""
    source = Path(source)
    if source.suffix == '.csv':
        with source.open(encoding='utf-8-sig') as f:
            products = list(csv.DictReader(f))
    else:
        data = json.loads(source.read_text(encoding='utf-8'))
        products = data if isinstance(data, list) else data.get('products', [])
    rows = []
    for p in products:
        if p.get('status') != 'published':
            continue
        rows.append({k: p[k] for k in ['id', 'slug', 'name', 'category', 'cat', 'price', 'status', 'tags'] if k in p})
    if not rows:
        raise ValueError('No published products. Expected product array or {products:[...]}')
    save(root / 'catalog.json', rows)
    save(root / 'catalog.manifest.json', {'sourceKind': 'local-product-export', 'sourceSha256': digest(source),
          'rows': len(rows), 'fields': sorted(set().union(*(r.keys() for r in rows))),
          'license': 'user-authorized JAPANO internal catalog; internal use only',
          'containsCustomerRecords': False, 'purpose': 'context examples, not inventory authority'})
    print(f'Exported {len(rows)} published products; customer records excluded')


def retail_report(root):
    paths = list((root / 'raw/retail/files').rglob('*.csv'))
    with paths[0].open(encoding='utf-8-sig') as f:
        rows = list(csv.DictReader(f))
    categories = Counter()
    for row in rows:
        categories[row['Product Category']] += float(row['Total Amount'])
    report = {'source': SOURCES['retail'][0], 'synthetic': True, 'rows': len(rows),
              'revenueByCategory': dict(categories), 'warning': 'Demo data, NOT JAPANO customers or revenue'}
    save(root / 'retail-demo-report.json', report)
    print(json.dumps(report, ensure_ascii=False))


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--output', type=Path, default=DEFAULT)
    commands = p.add_subparsers(dest='command', required=True)
    d = commands.add_parser('download'); d.add_argument('source', choices=SOURCES)
    e = commands.add_parser('export'); e.add_argument('--input', required=True, type=Path)
    s = commands.add_parser('search'); s.add_argument('query')
    commands.add_parser('retail-report')
    a = p.parse_args()
    if a.command == 'download': download(a.source, a.output)
    elif a.command == 'export': export_catalog(a.input, a.output)
    elif a.command == 'retail-report': retail_report(a.output)
    else:
        result = [{'ref': r.ref, 'license': r.license_name, 'bytes': r.total_bytes}
                  for r in kaggle_api().dataset_list(search=a.query)]
        save(a.output / 'search-results.json', result)
        print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
