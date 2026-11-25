"""Compare a blind solver's answers with a test's key.

usage: python3 scripts/compare_blind.py N "21314423 41341232 13412324 14221334 14243231 121432"
(one group of digits per part, in question order)
"""
import pathlib, re, sys

n, groups = sys.argv[1], sys.argv[2].split()
html = (pathlib.Path(__file__).resolve().parents[2] / f"tests/test_g3b{n}.html").read_text(encoding="utf-8")
parts = re.split(r'<tr><th colspan="3">', re.split(r'class="answers[ "]', html)[1])[1:]
bad = 0
for p, (part, blind) in enumerate(zip(parts, groups), 1):
    keys = re.findall(r'<tr><td>\d+</td><td>\s*(\d)', part)
    if len(keys) != len(blind):
        print(f"P{p}: {len(keys)} key rows but {len(blind)} blind answers"); bad += 1
    for q, (k, b) in enumerate(zip(keys, blind), 1):
        if k != b:
            print(f"MISMATCH P{p}Q{q}: key {k}, blind {b}"); bad += 1
print(f"test ג{n}: {sum(len(g) for g in groups)} compared, {bad} mismatches")
