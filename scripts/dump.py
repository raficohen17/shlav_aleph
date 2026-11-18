import re,html,sys
s=open(sys.argv[1],encoding='utf8').read()
s=re.sub(r'<style.*?</style>','',s,flags=re.S)
s=re.sub(r'<li>','\n• ',s); s=re.sub(r'<(div|p|h\d|tr|br)[^>]*>','\n',s)
s=re.sub(r'<[^>]+>',' ',s); s=html.unescape(s)
s=re.sub(r'[֑-ׇ︎]','',s)
s=re.sub(r'[ \t]+',' ',s); s=re.sub(r'\n\s*\n+','\n',s)
# number passage lines
out=[];n=0
for l in s.split('\n'):
    if l.startswith('• ') and not re.match(r'• [אבגד]\. ',l): n+=1; l=f'{n:>2}| '+l[2:]
    elif not l.startswith('• '): 
        if 'עברו' in l: n=0
    out.append(l)
print('\n'.join(out))
