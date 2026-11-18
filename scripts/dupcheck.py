import re,sys,html,itertools,collections
"""Report math exercises / names that appear in more than one test."""
items=collections.defaultdict(set)
for f in sys.argv[1:]:
    s=open(f,encoding='utf8').read()
    s=s.split('class="answers"')[0]
    s=html.unescape(re.sub(r'<[^>]+>',' ',s)); s=re.sub(r'[֑-ׇ︎]','',s)
    for m in re.findall(r'[\d∆_ ]+(?:[+−\-×:<>=][\d∆_ ]+)+',s):
        k=re.sub(r'\s+','',m)
        if len(k)>=5: items['EX '+k].add(f)
    for n in ['תמר','מיכל','יעל','נועם','הדר','ליאת','נוגה','עדי','דניאל','אורי','רוני']:
        if n in s: items['NAME '+n].add(f)
for k,v in sorted(items.items()):
    if len(v)>1: print(k, sorted(x.split('/')[-1] for x in v))
