"""Flag generated test items that overlap the source tests (word 4-grams and number sequences).

Usage: SHLAV_SOURCES=dir1:dir2 python3 -I scripts/stage_b/originality.py tests/test_b1.html [more.html ...]
Sources: every .txt (pdftotext output of the official and prep tests) in the SHLAV_SOURCES dirs,
default ./sources. The source tests are copyrighted and not in this repo – download them yourself.
pdftotext output of Hebrew is often visually reversed and letter-spaced, so each source line is
indexed both as-is and reversed, with spaces removed for a letter-level match as well.
"""
import html, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
import os
NIKUD = re.compile(r"[֑-ׇ]")
SOURCE_DIRS = [pathlib.Path(d) for d in os.environ.get("SHLAV_SOURCES", str(ROOT / "sources")).split(":") if d]
STOP = set("של את על עם זה זו הוא היא הם הן כי אם לא גם או מה מי כל יש אין עוד אחד אחת בין לפי כמה".split())


def norm_words(text):
    text = NIKUD.sub("", text)
    return [w for w in re.findall(r"[א-ת]{2,}", text) if w not in STOP]


def letters(text):
    return re.sub(r"[^א-ת]", "", NIKUD.sub("", text))


def numbers_seq(text):
    return tuple(int(n) for n in re.findall(r"\d+", text))


def load_sources():
    grams, letter_chunks, num_seqs = {}, {}, {}
    global PAIRS
    PAIRS = {}
    for d in SOURCE_DIRS:
        if not d.exists():
            continue
        for f in d.glob("*.txt"):
            prev_big = []
            for line in f.read_text(encoding="utf-8", errors="ignore").splitlines():
                cur_big = [int(n) for n in re.findall(r"\d+", line) if int(n) >= 10]
                for a in prev_big[-2:]:
                    for b in cur_big[:2]:
                        if a != b:
                            PAIRS.setdefault(frozenset((a, b)), f.name)
                if cur_big:
                    prev_big = cur_big
                for variant in (line, line[::-1]):
                    w = norm_words(variant)
                    for i in range(len(w) - 3):
                        grams.setdefault(tuple(w[i:i + 4]), f.name)
                    L = letters(variant)
                    for i in range(0, max(0, len(L) - 18), 3):
                        letter_chunks.setdefault(L[i:i + 18], f.name)
                ns = numbers_seq(line)
                big = [n for n in ns if n >= 10]
                for a, b in zip(big, big[1:]):
                    PAIRS.setdefault(frozenset((a, b)), f.name)
                if len(ns) >= 3:
                    num_seqs.setdefault(ns, f.name)
    return grams, letter_chunks, num_seqs


def items(path):
    s = path.read_text(encoding="utf-8").split('class="answers"')[0]
    s = re.sub(r'<span class="n">\d</span>|<span class="box"></span>\d?', " ", s)  # option labels
    s = re.sub(r'<div class="part-title">.*?</div>|<p class="(?:instr|next|end)">.*?</p>', " ", s, flags=re.S)  # fixed headings
    s = re.sub(r"<svg.*?</svg>", lambda m: " " + " ".join(re.findall(r">([^<]+)</text>", m.group(0))) + " ", s, flags=re.S)
    blocks = re.split(r'<div[^>]*class="(?:q|example)[^"]*"', s)
    for i, b in enumerate(blocks[1:], 1):
        yield i, html.unescape(re.sub(r"<[^>]+>", " ", b))


def main(paths):
    grams, chunks, nums = load_sources()
    flagged = 0
    for p in map(pathlib.Path, paths):
        for i, text in items(p):
            hits = set()
            w = norm_words(text)
            for j in range(len(w) - 3):
                if tuple(w[j:j + 4]) in grams:
                    hits.add(("4gram", " ".join(w[j:j + 4]), grams[tuple(w[j:j + 4])]))
            L = letters(text)
            for j in range(0, max(0, len(L) - 18)):
                if L[j:j + 18] in chunks:
                    hits.add(("letters", L[j:j + 18], chunks[L[j:j + 18]]))
                    break
            ns = numbers_seq(text)
            for k in range(len(ns) - 2):
                for src, fname in nums.items():
                    if len(src) >= 3 and ns[k:k + 3] == src[:3] and max(ns[k:k + 3]) > 4:
                        hits.add(("numbers", str(ns[k:k + 3]), fname))
            big = [n for n in ns if n >= 10]
            for a_ in range(len(big)):
                for b_ in range(a_ + 1, len(big)):
                    key = frozenset((big[a_], big[b_]))
                    if len(key) == 2 and key in PAIRS:
                        hits.add(("pair", str(sorted(key)), PAIRS[key]))
            if hits:
                flagged += 1
                print(f"{p.name} block {i}: " + "; ".join(f"{t} '{v}' ~ {f}" for t, v, f in sorted(hits))[:400])
    print(f"--- {flagged} flagged blocks")


if __name__ == "__main__":
    main(sys.argv[1:])
