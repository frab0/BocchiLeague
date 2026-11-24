"""Rigenera i dati del sito (cartella data/) dai file esportati dall'app.

Si lancia dalla cartella principale del sito:  python tools/aggiorna.py
Lo usa anche l'automazione di GitHub a ogni caricamento di un PDF.

Dove legge, per ogni stagione indicata in data/config.json -> "fonti":
  - "stagionePdf": l'export completo della stagione (se c'è)
  - "giornate":    la cartella con un PDF per giornata (il numero della giornata
                   deve stare nel nome del file, es. giornata_12.pdf)
  - "rose" / "roseXlsx": le rose in PDF o in Excel
Se c'è l'export completo, punteggi e classifiche vengono da lì; altrimenti si
ricostruisce tutto dai PDF delle singole giornate. Le formazioni vengono sempre
dai PDF di giornata.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
CFG = json.loads((DATA / "config.json").read_text(encoding="utf-8"))
MIS = json.loads((DATA / "mister.json").read_text(encoding="utf-8"))

GIORNATA_RE = re.compile(r"^\s*(\d+)a Giornata")
CLASS_CAMP_RE = re.compile(
    r"^\s*(\d+)\s+(.+?)\s+V\s+(\d+)\s+P\s+(\d+)\s+S\s+(\d+)\s+GF\s+(\d+)\s+GS\s+(\d+)\s+(-?\d+)\s+\(([\d.]+)\)")
CLASS_PUNTI_RE = re.compile(r"^\s*(\d+)\s+(.+?)\s{2,}([\d.]+)\s*$")
PUNTEGGIO_RE = re.compile(r"^\s*(.+?)\s{2,}([\d.]+)\s*$")
PARTITA_RE = re.compile(r"^\s*(.+?)\s{2,}(.+?)\s{2,}(\d+)-(\d+)\s*$")
GIOCATORE_RE = re.compile(r"^\s*\(([PDCA])\)\s+(.+?)\s{2,}(-|[\d.]+)\s+(-|[\d.]+)\s+(SI|NO)\s*$")
avvisi = []


def testo(pdf):
    r = subprocess.run(["pdftotext", "-layout", str(pdf), "-"], capture_output=True, text=True)
    return r.stdout


def chiave(nome):
    k = re.sub(r"[^a-z0-9]", "", nome.lower())
    return k.replace("fc", "").replace("sc", "")


class Nomi:
    """Riporta i nomi usati dall'app al nome ufficiale della squadra in mister.json."""

    def __init__(self, sid):
        self.sid = sid
        self.alias = CFG.get("alias", {}).get(sid, {})
        self.ufficiali = {chiave(n): n for n in MIS["stagioni"].get(sid, {})}

    def __call__(self, nome):
        nome = self.alias.get(nome.strip(), nome.strip())
        if nome in MIS["stagioni"].get(self.sid, {}):
            return nome
        trovato = self.ufficiali.get(chiave(nome))
        if trovato:
            return trovato
        msg = f"{self.sid}: squadra '{nome}' non trovata in mister.json"
        if msg not in avvisi:
            avvisi.append(msg)
        return nome


def num(x):
    return None if x == "-" else float(x)


def nuova(n):
    return {"n": n, "punteggi": {}, "partite": [], "classifica": [], "classificaPunti": []}


def leggi_risultati(pdf, norm, giornata=None):
    """Legge punteggi, partite e classifiche. giornata: numero fisso per i PDF di una sola giornata."""
    g = {}
    if giornata is not None:
        g[giornata] = nuova(giornata)
    sezione = competizione = None
    for riga in testo(pdf).splitlines():
        s = riga.strip()
        if s.startswith("Competizione:"):
            competizione = s.split(":")[1].strip(); continue
        if s in ("Punteggi", "Partite", "Formazioni"):
            sezione = s.lower(); continue
        if s.startswith("Classifica:"):
            sezione = "classifica"; competizione = s.split(":")[1].strip(); continue
        m = GIORNATA_RE.match(riga)
        if m:
            giornata = int(m.group(1)); g.setdefault(giornata, nuova(giornata)); continue
        if giornata is None or not s or s.startswith(("Squadra", "Casa", "Giocatore")):
            continue
        d = g[giornata]
        if sezione == "punteggi":
            m = PUNTEGGIO_RE.match(riga)
            if m:
                d["punteggi"][norm(m.group(1))] = float(m.group(2))
        elif sezione == "partite" and competizione == "Campionato":
            m = PARTITA_RE.match(riga)
            if m:
                d["partite"].append({"casa": norm(m.group(1)), "trasferta": norm(m.group(2)),
                                     "gc": int(m.group(3)), "gt": int(m.group(4))})
        elif sezione == "classifica" and competizione == "Campionato":
            m = CLASS_CAMP_RE.match(riga)
            if m:
                v, p, sc = int(m.group(3)), int(m.group(4)), int(m.group(5))
                pt = int(m.group(8))
                d["classifica"].append({"pos": int(m.group(1)), "squadra": norm(m.group(2)), "v": v, "p": p, "s": sc,
                                        "gf": int(m.group(6)), "gs": int(m.group(7)), "pt": pt,
                                        "fp": float(m.group(9)), "pen": pt - (3 * v + p)})
        elif sezione == "classifica" and competizione == "Punti":
            m = CLASS_PUNTI_RE.match(riga)
            if m:
                d["classificaPunti"].append({"pos": int(m.group(1)), "squadra": norm(m.group(2)),
                                             "fp": float(m.group(3))})
    return g


def leggi_formazioni(pdf, norm):
    squadre, corrente, ultimo, panchina = {}, None, -1, False
    for riga in testo(pdf).splitlines():
        s = riga.strip()
        if s.startswith("Formazione:"):
            nome = norm(s.split(":", 1)[1])
            corrente = None if nome in squadre else nome
            if corrente:
                squadre[corrente], ultimo, panchina = [], -1, False
            continue
        if s.startswith("Competizione:"):
            corrente = None
        if not corrente:
            continue
        m = GIOCATORE_RE.match(riga)
        if m:
            r = "PDCA".index(m.group(1))
            if r < ultimo:
                panchina = True
            ultimo = r
            squadre[corrente].append({"r": m.group(1), "nome": m.group(2).strip(), "v": num(m.group(3)),
                                      "fv": num(m.group(4)), "ok": m.group(5) == "SI", "tit": not panchina})
    return squadre


def numero_giornata(pdf):
    m = re.search(r"(\d+)", pdf.stem)
    return int(m.group(1)) if m else None


def leggi_rose_pdf(pdf, norm):
    rose, corrente = {}, None
    for riga in testo(pdf).splitlines():
        s = riga.strip()
        if not s or s.startswith(("Nome", "Ultimo aggiornamento", "Scarica")):
            continue
        m = re.match(r"^\s*(.+?)\s{2,}(.+?)\s{2,}([PDCA])\s+(\d+)\s*$", riga)
        if m and corrente:
            rose[corrente].append({"nome": m.group(1).strip(), "club": m.group(2).strip(), "r": m.group(3),
                                   "costo": int(m.group(4))})
        elif not m:
            corrente = norm(s)
            rose.setdefault(corrente, [])
    return rose


def leggi_rose_xlsx(xlsx, norm):
    import openpyxl
    righe = list(openpyxl.load_workbook(xlsx, data_only=True).active.iter_rows(values_only=True))
    ruoli = ["P"] * 3 + ["D"] * 8 + ["C"] * 8 + ["A"] * 5
    rose = {}
    for col in range(0, len(righe[0]), 3):
        if not righe[0][col]:
            continue
        squadra = norm(str(righe[0][col]))
        rose[squadra] = []
        for i, r in enumerate(ruoli):
            nome, costo = righe[1 + i][col], righe[1 + i][col + 1]
            if nome:
                rose[squadra].append({"nome": str(nome).strip(), "club": None, "r": r, "costo": int(costo or 0)})
    return rose


def salva(nome, dati):
    (DATA / nome).write_text(json.dumps(dati, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def stagione(sid, f):
    norm = Nomi(sid)
    pdf_giornate = []
    if f.get("giornate") and (ROOT / f["giornate"]).is_dir():
        pdf_giornate = sorted((p for p in (ROOT / f["giornate"]).glob("*.pdf") if numero_giornata(p)),
                              key=numero_giornata)
    if f.get("stagionePdf"):
        giornate = leggi_risultati(ROOT / f["stagionePdf"], norm)
    else:
        giornate = {}
        for pdf in pdf_giornate:
            n = numero_giornata(pdf)
            giornate.update(leggi_risultati(pdf, norm, giornata=n))
    lista = [giornate[k] for k in sorted(giornate)
             if giornate[k]["partite"] and len(giornate[k]["classifica"]) > 0]
    for k in sorted(giornate):
        if not (giornate[k]["partite"] and giornate[k]["classifica"]):
            avvisi.append(f"{sid}: giornata {k} senza partite o classifica, ignorata")
    rose = {}
    for fase, p in f.get("rose", {}).items():
        rose[fase] = leggi_rose_pdf(ROOT / p, norm)
    for fase, p in f.get("roseXlsx", {}).items():
        rose[fase] = leggi_rose_xlsx(ROOT / p, norm)
    salva(f"stagione-{sid}.json", {"id": sid, "giornate": lista, "rose": rose})
    if pdf_giornate:
        salva(f"formazioni-{sid}.json", {numero_giornata(p): leggi_formazioni(p, norm) for p in pdf_giornate})
    print(f"{sid}: {len(lista)} giornate, rose {list(rose)}, formazioni {len(pdf_giornate)}")
    return bool(pdf_giornate)


def main():
    con_formazioni = []
    for sid, f in CFG.get("fonti", {}).items():
        if stagione(sid, f):
            con_formazioni.append(sid)
    if sorted(CFG.get("formazioni", [])) != sorted(con_formazioni):
        CFG["formazioni"] = con_formazioni
        (DATA / "config.json").write_text(json.dumps(CFG, ensure_ascii=False, indent=1), encoding="utf-8")
    for a in avvisi:
        print("ATTENZIONE:", a)
    return 0


if __name__ == "__main__":
    sys.exit(main())
