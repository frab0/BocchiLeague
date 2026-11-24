"""Costruisce data/stagione-26-27.json dai dati letti su Leghe Fantacalcio.

Input (in tools/leghe/):
  calendario.json  [[giornata, giornata_serie_a, [[casa, gol, fp, trasferta, gol, fp], ...]], ...]
                   solo le giornate giocate
  rose.json        {squadra: {"cred": crediti residui, "rose": ["R|Nome|FVM|Q.acq|Q.att", ...]}}
Le classifiche giornata per giornata si calcolano qui: 3 punti a vittoria, 1 a pareggio,
a parità di punti contano i fantapunti (come da regolamento).
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(__file__).resolve().parent / "leghe"
SID = "26-27"
CICLO = 10  # con 6 squadre il calendario si ripete ogni 10 giornate
TOTALE = 36


def main():
    cal = json.loads((SRC / "calendario.json").read_text(encoding="utf-8"))
    rose_src = json.loads((SRC / "rose.json").read_text(encoding="utf-8"))
    squadre = list(json.loads((ROOT / "data/mister.json").read_text(encoding="utf-8"))["stagioni"][SID])
    tab = {t: {"v": 0, "p": 0, "s": 0, "gf": 0, "gs": 0, "pt": 0, "fp": 0.0} for t in squadre}
    giornate, accoppiamenti = [], {}
    for n, sa, partite in sorted(cal):
        g = {"n": n, "serieA": sa, "punteggi": {}, "partite": [], "classifica": [], "classificaPunti": []}
        accoppiamenti[(n - 1) % CICLO] = [(p[0], p[3]) for p in partite]
        for casa, gc, fc, trasf, gt, ft in partite:
            gc, gt, fc, ft = int(gc), int(gt), float(fc), float(ft)
            g["punteggi"][casa], g["punteggi"][trasf] = fc, ft
            g["partite"].append({"casa": casa, "trasferta": trasf, "gc": gc, "gt": gt})
            for t, a, b, f in ((casa, gc, gt, fc), (trasf, gt, gc, ft)):
                r = tab[t]
                r["gf"] += a; r["gs"] += b; r["fp"] += f
                k = "v" if a > b else "s" if a < b else "p"
                r[k] += 1
                r["pt"] += {"v": 3, "p": 1, "s": 0}[k]
        ordine = sorted(squadre, key=lambda t: (-tab[t]["pt"], -tab[t]["fp"]))
        g["classifica"] = [{"pos": i + 1, "squadra": t, **{k: tab[t][k] for k in ("v", "p", "s", "gf", "gs", "pt")},
                            "fp": round(tab[t]["fp"], 1), "pen": 0} for i, t in enumerate(ordine)]
        g["classificaPunti"] = [{"pos": i + 1, "squadra": t, "fp": round(tab[t]["fp"], 1)}
                                for i, t in enumerate(sorted(squadre, key=lambda t: -tab[t]["fp"]))]
        giornate.append(g)
    ultima = giornate[-1]["n"] if giornate else 0
    prossime = [{"n": n, "serieA": n + 2, "partite": [{"casa": a, "trasferta": b} for a, b in accoppiamenti[(n - 1) % CICLO]]}
                for n in range(ultima + 1, TOTALE + 1) if (n - 1) % CICLO in accoppiamenti]
    rose = {t: [{"r": x.split("|")[0], "nome": x.split("|")[1], "club": None, "costo": int(x.split("|")[3]),
                 "fvm": int(x.split("|")[2]), "quot": int(x.split("|")[4])} for x in v["rose"]]
            for t, v in rose_src.items()}
    crediti = {t: v["cred"] for t, v in rose_src.items()}
    out = {"id": SID, "fonte": "Leghe Fantacalcio", "totaleGiornate": TOTALE, "giornate": giornate,
           "prossime": prossime, "rose": {"andata": rose}, "crediti": crediti}
    (ROOT / f"data/stagione-{SID}.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    fin = giornate[-1]["classifica"] if giornate else []
    print(f"{SID}: {len(giornate)} giornate, prossime {len(prossime)}")
    for r in fin:
        print(f"  {r['pos']} {r['squadra']:<20} {r['pt']:>3} {r['v']}-{r['p']}-{r['s']} {r['gf']}:{r['gs']} {r['fp']}")


if __name__ == "__main__":
    main()
