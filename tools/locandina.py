"""Genera la locandina della giornata da condividere nel gruppo.

Uso: python tools/locandina.py [stagione] [giornata]
Senza argomenti: l'ultima giornata giocata della stagione in corso.
Crea:
  assets/img/locandine/<stagione>-<giornata>.png   1080x1350, per WhatsApp e Instagram
  assets/img/og.jpg                                1200x630, anteprima dei link al sito
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
F = ROOT / "tools/fonts"
BG, CARD, INK, MUTE, FAINT, RED = (6, 6, 6), (20, 20, 20), (244, 244, 244), (163, 163, 163), (110, 110, 110), (255, 45, 70)


def font(name, size):
    return ImageFont.truetype(str(F / name), size)


ANTON = lambda s: font("Anton-Regular.ttf", s)
BOLD = lambda s: font("Inter-ExtraBold.otf", s)
SEMI = lambda s: font("Inter-Bold.otf", s)
MED = lambda s: font("Inter-Medium.otf", s)


def load(n):
    return json.loads((ROOT / "data" / f"{n}.json").read_text(encoding="utf-8"))


CFG, MIS = load("config"), load("mister")


def fp(x):
    return (f"{x:.1f}".rstrip("0").rstrip(".")).replace(".", ",")


def tondo(img, size):
    img = img.convert("RGBA").resize((size, size), Image.LANCZOS)
    m = Image.new("L", (size * 4, size * 4), 0)
    ImageDraw.Draw(m).ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255)
    img.putalpha(m.resize((size, size), Image.LANCZOS))
    return img


def stemma(team, sid, size):
    p = CFG.get("stemmi", {}).get(team)
    if p and (ROOT / p).exists():
        return tondo(Image.open(ROOT / p), size)
    col = CFG["coloriMister"].get(MIS["stagioni"].get(sid, {}).get(team, ""), "#A3A3A3")
    im = Image.new("RGBA", (size * 4, size * 4), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=(17, 17, 17), outline=col, width=size // 5)
    sig = CFG["sigle"].get(team, team[:3].upper())
    f = ANTON(size * 4 // 3)
    w = d.textlength(sig, font=f)
    d.text(((size * 4 - w) / 2, size * 4 * 0.27), sig, font=f, fill=col)
    return im.resize((size, size), Image.LANCZOS)


def testo_a_capo(d, txt, f, maxw):
    righe, cur = [], ""
    for w in txt.split():
        prova = (cur + " " + w).strip()
        if d.textlength(prova, font=f) <= maxw:
            cur = prova
        else:
            righe.append(cur)
            cur = w
    righe.append(cur)
    return righe


def testata(W, H, sid, n, logo_size):
    """Collage sfocato con il logo in primo piano, come la home del sito."""
    col = Image.open(ROOT / "assets/img/collage-largo.jpg").convert("RGB")
    r = max(W / col.width, H / col.height)
    col = col.resize((int(col.width * r) + 2, int(col.height * r) + 2)).crop((0, 0, W, H)).filter(ImageFilter.GaussianBlur(6))
    vign = Image.new("L", (W, H), 0)
    dv = ImageDraw.Draw(vign)
    for i in range(60):
        k = i / 60
        dv.ellipse((W / 2 - W * (0.75 - k * 0.5), H * 0.46 - H * (0.95 - k * 0.6), W / 2 + W * (0.75 - k * 0.5), H * 0.46 + H * (0.95 - k * 0.6)), fill=int(150 * k))
    dark = Image.new("RGB", (W, H), BG)
    head = Image.composite(col, dark, vign.filter(ImageFilter.GaussianBlur(30)))
    logo = tondo(Image.open(ROOT / "assets/img/logo.jpg"), logo_size)
    ring = Image.new("RGBA", (logo_size + 40, logo_size + 40), (0, 0, 0, 0))
    dr = ImageDraw.Draw(ring)
    dr.ellipse((0, 0, logo_size + 39, logo_size + 39), fill=(255, 45, 70, 140))
    dr.ellipse((12, 12, logo_size + 27, logo_size + 27), fill=(255, 255, 255, 255))
    return head, logo, ring


def barra(d, img, x, y, w, h, sid, p, pc, pt):
    d.rounded_rectangle((x, y, x + w, y + h), 14, fill=CARD)
    bw = int(w * 0.24)
    bx = x + (w - bw) // 2
    d.rectangle((bx, y, bx + bw, y + h), fill=(255, 255, 255))
    lc, lt = p["gc"] < p["gt"], p["gt"] < p["gc"]
    f = ANTON(int(h * 0.62))
    sc = [(str(p["gc"]), (154, 154, 154) if lc else BG), ("–", (154, 154, 154)), (str(p["gt"]), (154, 154, 154) if lt else BG)]
    tot = sum(d.textlength(t, font=f) for t, _ in sc) + 24
    cx = bx + (bw - tot) / 2
    for t, c in sc:
        d.text((cx, y + h * 0.13), t, font=f, fill=c)
        cx += d.textlength(t, font=f) + 12
    cs = int(h * 0.58)
    fs, fn = BOLD(int(h * 0.3)), MED(int(h * 0.22))
    for lato, team, punti, perde in (("s", p["casa"], pc, lc), ("d", p["trasferta"], pt, lt)):
        st = stemma(team, sid, cs)
        sig = CFG["sigle"].get(team, team[:3].upper())
        col = FAINT if perde else INK
        if lato == "s":
            img.paste(st, (x + 18, y + (h - cs) // 2), st)
            d.text((x + 30 + cs, y + h * 0.3), sig, font=fs, fill=col)
            t = fp(punti)
            d.text((bx - 18 - d.textlength(t, font=fn), y + h * 0.37), t, font=fn, fill=FAINT)
        else:
            img.paste(st, (x + w - 18 - cs, y + (h - cs) // 2), st)
            d.text((x + w - 30 - cs - d.textlength(sig, font=fs), y + h * 0.3), sig, font=fs, fill=col)
            d.text((bx + bw + 18, y + h * 0.37), fp(punti), font=fn, fill=FAINT)


def locandina(sid, n):
    st, gaz = load(f"stagione-{sid}"), load("gazzetta")
    g = next(x for x in st["giornate"] if x["n"] == n)
    art = next((a for a in gaz if a["stagione"] == sid and a["giornata"] == n), None)
    W, H = 1080, 1350
    img = Image.new("RGB", (W, H), BG)
    head, logo, ring = testata(W, 400, sid, n, 150)
    img.paste(head, (0, 0))
    img.paste(ring, ((W - ring.width) // 2, 52), ring)
    img.paste(logo, ((W - 150) // 2, 72), logo)
    d = ImageDraw.Draw(img)
    f = ANTON(64)
    t = "BOCCHI LEAGUE"
    d.text(((W - d.textlength(t, font=f)) / 2, 248), t, font=f, fill=INK)
    sub = f"GIORNATA {n}" + (f" · {g['serieA']}ª DI SERIE A" if g.get("serieA") else "") + f" · {sid.replace('-', '/')}"
    fk = BOLD(26)
    kw = d.textlength(sub, font=fk) + 36
    d.rounded_rectangle(((W - kw) / 2, 340, (W + kw) / 2, 384), 8, fill=RED)
    d.text(((W - kw) / 2 + 18, 345), sub, font=fk, fill=(255, 255, 255))

    y = 420
    titolo = (art["titolo"] if art else f"Risultati della giornata {n}").upper()
    ft = ANTON(70)
    for r in testo_a_capo(d, titolo, ft, W - 120)[:3]:
        d.text((60, y), r, font=ft, fill=INK)
        y += 78
    y += 22
    for p in g["partite"]:
        barra(d, img, 60, y, W - 120, 110, sid, p, g["punteggi"][p["casa"]], g["punteggi"][p["trasferta"]])
        y += 126
    y += 10
    pun = sorted(g["punteggi"].items(), key=lambda x: -x[1])
    half = (W - 120 - 20) // 2
    for i, (k, (team, v), col) in enumerate((("TOP DELLA GIORNATA", pun[0], (76, 195, 138)), ("FLOP DELLA GIORNATA", pun[-1], RED))):
        x0 = 60 + i * (half + 20)
        d.rounded_rectangle((x0, y, x0 + half, y + 186), 14, fill=CARD)
        d.text((x0 + 24, y + 20), k, font=BOLD(22), fill=col)
        d.text((x0 + 24, y + 50), fp(v), font=ANTON(70), fill=INK)
        d.text((x0 + 24, y + 142), team, font=SEMI(26), fill=MUTE)
    y += 214
    cl = g["classifica"]
    d.text((60, y), "CLASSIFICA", font=ANTON(36), fill=INK)
    fx = MED(24)
    righe = "   ".join(f"{r['pos']}. {CFG['sigle'].get(r['squadra'], r['squadra'][:3])} {r['pt']}" for r in cl)
    d.text((60 + d.textlength("CLASSIFICA", font=ANTON(36)) + 24, y + 10), righe, font=fx, fill=MUTE)
    foot = "frab0.github.io/BocchiLeague"
    d.text(((W - d.textlength(foot, font=SEMI(24))) / 2, H - 52), foot, font=SEMI(24), fill=FAINT)
    out = ROOT / "assets/img/locandine"
    out.mkdir(parents=True, exist_ok=True)
    img.save(out / f"{sid}-{n}.png", optimize=True)

    # anteprima dei link (orizzontale)
    W2, H2 = 1200, 630
    og = Image.new("RGB", (W2, H2), BG)
    head, logo, ring = testata(W2, H2, sid, n, 230)
    og.paste(head, (0, 0))
    velo = Image.new("L", (W2, H2), 0)
    ImageDraw.Draw(velo).rectangle((330, 0, W2, H2), fill=150)
    og.paste(Image.new("RGB", (W2, H2), BG), (0, 0), velo.filter(ImageFilter.GaussianBlur(60)))
    og.paste(ring, (80, (H2 - ring.height) // 2 - 20), ring)
    og.paste(logo, (100, (H2 - 230) // 2 - 20), logo)
    d2 = ImageDraw.Draw(og)
    d2.text((400, 120), "BOCCHI LEAGUE", font=ANTON(56), fill=INK)
    yy = 200
    for r in testo_a_capo(d2, titolo, ANTON(58), 740)[:3]:
        d2.text((400, yy), r, font=ANTON(58), fill=INK)
        yy += 66
    d2.text((400, yy + 14), sub, font=BOLD(24), fill=RED)
    og.save(ROOT / "assets/img/og.jpg", quality=86)
    chiave = f"{sid}-{n}"
    if chiave not in CFG.setdefault("locandine", []):
        CFG["locandine"].append(chiave)
        (ROOT / "data/config.json").write_text(json.dumps(CFG, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"locandina {sid} G{n} creata")


if __name__ == "__main__":
    sid = sys.argv[1] if len(sys.argv) > 1 else CFG["stagioneCorrente"]
    if len(sys.argv) > 2:
        n = int(sys.argv[2])
    else:
        n = load(f"stagione-{sid}")["giornate"][-1]["n"]
    locandina(sid, n)
