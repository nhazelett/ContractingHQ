"""Build the static training search index from linked, published training cards.

Run: python scripts/build_training_search.py [--root PATH] [--check]
No network, third-party packages, or runtime crawl is required.
"""
import argparse
import gzip
import json
import re
import unicodedata
import math
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

class Node:
    def __init__(self, tag='', attrs=(), parent=None):
        self.tag, self.attrs, self.parent, self.children = tag, dict(attrs), parent, []
    def walk(self):
        yield self
        for child in self.children:
            if isinstance(child, Node):
                yield from child.walk()
    def text(self):
        if self.tag in {'script','style','nav','footer','svg','noscript','textarea','select'}:
            return ''
        return ' '.join(c.text() if isinstance(c, Node) else c for c in self.children)
    def has(self, cls):
        return cls in self.attrs.get('class','').split()

class Document(HTMLParser):
    VOID = {'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}
    def __init__(self, text):
        super().__init__(convert_charrefs=True)
        self.root=Node(); self.current=self.root; self.feed(text)
    def handle_starttag(self, tag, attrs):
        node=Node(tag,attrs,self.current);self.current.children.append(node)
        if tag not in self.VOID:self.current=node
    def handle_startendtag(self, tag, attrs):
        self.current.children.append(Node(tag,attrs,self.current))
    def handle_endtag(self, tag):
        node=self.current
        while node.parent is not None:
            if node.tag==tag:self.current=node.parent;return
            node=node.parent
    def handle_data(self, data):self.current.children.append(data)

def clean(text):return re.sub(r'\s+',' ',text).strip()
def normalize(text):
    text=unicodedata.normalize('NFKD',text).encode('ascii','ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+',' ',text).strip()

STOP=set('the and for with that this from your you are will can not have has was were into their what when which how its all but also more than they these those should must shall each any only does use using used been being then there where who why our out per such may other both under over before after about through between while do to of in on at as by or an be is it if a'.split())
ALIASES={
    'contractor-responsibility.html':'COC certificate of competency SBA responsibility determination',
    'evaluation-responsibility-boundary.html':'COC certificate of competency LPTA lowest price technically acceptable pass fail neutral experience past performance',
    'past-performance.html':'PP CPARS performance confidence neutral rating',
    'cpars.html':'contractor performance assessment reporting system performance reviews',
    'simplified-solicitations-commercial.html':'SAP simplified acquisition RFQ request for quotation combined synopsis solicitation',
    'evaluating-quotations.html':'SAP RFQ quote evaluation best value',
    'government-purchase-cards.html':'GPC purchase card credit card micro purchase',
    'performance-work-statements.html':'PWS statement of work SOW requirements',
    'statements-of-work.html':'SOW statement of work PWS',
    'statements-of-objectives.html':'SOO statement of objectives',
    'funding-color-of-money.html':'fiscal law appropriation purpose time amount bona fide need funds',
    'preparing-ratifications.html':'unauthorized commitment UAC ratify ratification',
    'set-asides.html':'small business sole source 8a women owned WOSB SDVOSB HUBZone',
    'provisions-clauses-commercial.html':'provision clause selection 52.212 commercial RFO',
    'miprs-deployed-environment.html':'MIPR military interdepartmental purchase request DD 448 DD 448-2',
    'unit-deployment-manager.html':'UDM unit deployment manager deployment',
    'udm-force.html':'UTC unit type code force package MISCAP',
    'udm-readiness.html':'UDM readiness medical training mobility deployment',
    'source-selection-guide.html':'LPTA tradeoff source selection SSA SSEB SSAC',
    'warrant-board.html':'CO warrant contracting officer board interview unlimited',
    'sat-warrant-board.html':'SAT warrant board simplified acquisition threshold',
    'commercial-item-df.html':'commerciality determination commercial product service',
    'closeout.html':'contract closeout closing contracts',
    'contract-closeout.html':'contract closeout closing contracts',
    'cso.html':'CSO commercial solutions opening',
    'ota.html':'OTA other transaction authority agreement',
    'naf-contracting.html':'NAF nonappropriated funds',
    'sf30-modifications.html':'SF 30 modification mod supplemental agreement',
    'unilateral-bilateral-modifications.html':'unilateral bilateral modification mod change order',
}
SOURCES=[
    ('training-beginner.html','Beginner',{'topic-card'}),
    ('training-intermediate.html','Intermediate',{'topic-card'}),
    ('training-advanced.html','Advanced',{'adv-card'}),
    ('training-specializations.html','Specializations',{'topic-card'}),
    ('contingency-contracting.html','Contingency',{'cc-card'}),
    ('unit-deployment-manager.html','UDM',{'udm-card'}),
    ('training.html','Resources',{'topic-card'}),
]

def build(root):
    entries={}
    def add(url,track,title=''):
        path=urlsplit(url).path
        if not re.fullmatch(r'[a-z0-9][a-z0-9-]*\.html',path):return
        if not (root/path).is_file():raise ValueError('Linked training page is missing: '+path)
        if path not in entries:entries[path]={'url':path,'title':title,'tracks':[]}
        if track not in entries[path]['tracks']:entries[path]['tracks'].append(track)
    for filename,track,classes in SOURCES:
        doc=Document((root/filename).read_text(encoding='utf-8-sig'))
        for node in doc.root.walk():
            if not any(node.has(c) for c in classes):continue
            if any(child.has('badge-coming') for child in node.walk()):continue
            anchor=node if node.tag=='a' else next((n for n in node.walk() if n.tag=='a' and 'href' in n.attrs),None)
            if not anchor:continue
            title=next((clean(n.text()) for n in node.walk() if n.has('topic-name') or n.has('adv-card-title') or n.has('udm-card-name') or n.tag=='h3'),'')
            add(anchor.attrs.get('href',''),track,title)
    # The two role landing pages are useful search destinations in their own right.
    add('contingency-contracting.html','Contingency','Contingency Contracting')
    add('unit-deployment-manager.html','UDM','Unit Deployment Manager')
    for entry in entries.values():
        doc=Document((root/entry['url']).read_text(encoding='utf-8-sig'));nodes=list(doc.root.walk())
        main=next((n for n in nodes if n.tag=='main'),doc.root)
        if not entry['title']:
            heading=next((n for n in nodes if n.tag=='h1'),None)
            entry['title']=clean(heading.text()) if heading else entry['url'].removesuffix('.html').replace('-',' ')
        meta=next((n for n in nodes if n.tag=='meta' and n.attrs.get('name','').lower()=='description'),None)
        description=clean(meta.attrs.get('content','')) if meta else ''
        if not description:
            description=next((clean(n.text()) for n in main.walk() if n.tag=='p' and len(clean(n.text()))>45),'Open this training topic for guidance and practice.')
        # Descriptions are short display text; body terms still cover the entire lesson.
        entry['description']=description[:217].rsplit(' ',1)[0]+'…' if len(description)>220 else description
        entry['headings']=clean(' '.join(n.text() for n in main.walk() if n.tag in {'h1','h2','h3'}))[:7000]
        entry['_counts']=Counter(w for w in normalize(main.text()).split() if 2<len(w)<29 and w not in STOP and not w.isdigit())
        entry['aliases']=ALIASES.get(entry['url'],'')
    # Topic search, not a downloadable copy of every lesson. Keep salient body
    # keywords; titles, descriptions, headings and curated aliases remain intact.
    frequency=Counter(word for entry in entries.values() for word in entry['_counts'])
    for entry in entries.values():
        counts=entry.pop('_counts')
        covered=set(normalize(' '.join([entry['title'],entry['description'],entry['headings'],entry['aliases']])).split())
        ranked=sorted((w for w in counts if w not in covered),key=lambda w:(-(1+math.log(counts[w]))*math.log(1+len(entries)/frequency[w]),w))
        entry['terms']=' '.join(sorted(ranked[:220]))
    return {'version':1,'entries':sorted(entries.values(),key=lambda e:e['title'].casefold())}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1]);parser.add_argument('--check',action='store_true');args=parser.parse_args()
    result=build(args.root)
    output=('/* Generated by scripts/build_training_search.py. Do not edit by hand. */\nwindow.KTHQ_TRAINING_SEARCH_INDEX='+json.dumps(result,ensure_ascii=True,separators=(',',':')).replace('</','<\\/')+';\n').encode('utf-8')
    target=args.root/'training-search-index.js'
    if args.check:
        if not target.exists() or target.read_bytes()!=output:raise SystemExit('Training search index is stale. Run python scripts/build_training_search.py and commit the updated index.')
    else:target.write_bytes(output)
    print(f'{len(result["entries"])} unique training pages; {len(output):,} bytes; {len(gzip.compress(output)):,} bytes gzip.')

if __name__=='__main__':main()
