"""Regenerate sitemap.xml for published root pages and public builder indexes."""
from html.parser import HTMLParser
from pathlib import Path
import subprocess
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
BUILDERS = ('1442-builder', '1449-sf30-builder', 'bpa-builder',
            'dd1155-builder', 'idiq-builder', 'market-research')

class Metadata(HTMLParser):
    excluded = False
    def handle_starttag(self, tag, attrs):
        if tag.lower() != 'meta':
            return
        attrs = {k.lower(): (v or '').lower() for k, v in attrs}
        if attrs.get('http-equiv') == 'refresh':
            self.excluded = True
        if attrs.get('name') in ('robots', 'googlebot') and 'noindex' in attrs.get('content', ''):
            self.excluded = True

def build():
    namespace = 'http://www.sitemaps.org/schemas/sitemap/0.9'
    ET.register_namespace('', namespace)
    root = ET.Element(f'{{{namespace}}}urlset')
    pages = list(ROOT.glob('*.html'))
    pages.extend(ROOT / folder / 'index.html' for folder in BUILDERS
                 if (ROOT / folder / 'index.html').is_file())
    for page in sorted(pages):
        if page.name.startswith('_'):
            continue
        parser = Metadata()
        parser.feed(page.read_text(encoding='utf-8'))
        if parser.excluded:
            continue
        relative = page.relative_to(ROOT).as_posix()
        date = subprocess.check_output(
            ['git', 'log', '-1', '--format=%cs', '--', relative],
            cwd=ROOT, text=True).strip()
        if not date:
            raise RuntimeError(f'No git commit date for {relative}')
        node = ET.SubElement(root, 'url')
        ET.SubElement(node, 'loc').text = 'https://kthq.org/' + relative
        ET.SubElement(node, 'lastmod').text = date
    ET.indent(root, space='  ')
    (ROOT / 'sitemap.xml').write_bytes(
        ET.tostring(root, encoding='UTF-8', xml_declaration=True) + b'\n')
    print(f'Wrote {len(root)} URLs to sitemap.xml')

if __name__ == '__main__':
    build()
