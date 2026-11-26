#!/usr/bin/env python3
"""Chiedi alla Lega: risponde alle domande in domande_ricevute.txt e scrive invia_risposte.txt.

Lo script fa i conti sui dati veri della lega (cartella data/) e prepara un "dossier" compatto;
il modello di intelligenza artificiale deve solo capire la domanda e scrivere la risposta.

Uso:
  python chiedi.py RADICE_REPO                 # risponde davvero (serve GITHUB_TOKEN con models:read)
  Le risposte vanno in invia_risposte.txt nel formato del bot:  ID - nome (squadra): "risposta"
  python chiedi.py RADICE_REPO --dossier        # stampa solo il dossier di ogni domanda (prova locale)
"""
import json, os, re, sys, unicodedata, urllib.request
from collections import defaultdict

MODELLI = os.environ.get("CHIEDI_MODELLI", "openai/gpt-4.1-mini,openai/gpt-4o-mini,meta/Llama-3.3-70B-Instruct").split(",")
RIGA = re.compile(r"^\s*(\d+)\s*-\s*(.+?)\s*\((.+?)\)\s*:\s*(.+?)\s*$")

ISTRUZIONI = """Sei l'archivista della Gazzetta Bocchi League, un fantacalcio tra sei amici.
Un mister ti scrive una domanda su Telegram: rispondi usando SOLO i dati del DOSSIER che segue.

COSA C'È NEL DOSSIER
- Stagione in corso: classifica, ultima e prossima giornata, forma di ogni squadra, rose con costi.
- Storico: albo d'oro, piazzamenti, record, testa a testa tra mister (dal 24-25).
- Giocatori: per il 25-26 ci sono le formazioni giornata per giornata (titolare, entrato dalla
  panchina, voti e fantavoti); per il 26-27 solo rosa, ruolo, costo e quotazione.
- Le squadre cambiano nome da una stagione all'altra: conta il mister, indicato tra parentesi.

COME RISPONDERE
- Italiano, dai del tu a chi chiede e parla della SUA squadra quando c'entra.
- Al massimo 3 frasi, su una sola riga. Niente elenchi, niente virgolette doppie, niente markdown.
- Numeri, nomi e stagioni esattamente come nel dossier. Non fare stime e non inventare.
- Se la domanda è ambigua, scegli l'interpretazione più probabile e dillo in poche parole.
- Se il dato non c'è (per esempio le formazioni del 26-27), dillo chiaramente.
- Se la domanda non riguarda la lega, rispondi che l'archivio parla solo della Bocchi League.

STILE
- Tono da Gazzetta: informato e asciutto, con una frecciata goliardica finale su chi va male.
- Si scherza sul fantacalcio, mai sulla persona. Il mister del Real Betlemme si chiama "il Betlemme".
- Se c'è una pagina del sito utile, chiudi con il suo link (sono indicati nel dossier).

ESEMPIO
Domanda di frab: quante volte ho battuto gpepss?
Risposta: Contro gpepss sei a 6 vittorie, 2 pareggi e 9 sconfitte, gol 32-38. L'ultima l'hai vinta tu, 4-3 alla giornata 6, ma il conto resta in rosso."""

SITO = "https://frab0.github.io/BocchiLeague/"


def norm(s):
    s = unicodedata.normalize("NFD", s.lower())
    return re.sub(r"[^a-z0-9]+", " ", "".join(c for c in s if unicodedata.category(c) != "Mn")).strip()


class Lega:
    def __init__(self, radice):
        d = lambda n: json.load(open(os.path.join(radice, "data", n + ".json"), encoding="utf-8"))
        self.mis = d("mister")
        self.albo = d("albo")
        self.cfg = d("config")
        self.gaz = d("gazzetta")
        self.sid = self.cfg["stagioni"]  # dalla più recente
        self.S = {s: d("stagione-" + s) for s in self.sid}
        self.corrente = self.sid[0]
        self.m_of = {s: self.mis["stagioni"][s] for s in self.sid}  # squadra -> mister
        self.t_of = {s: {m: t for t, m in self.m_of[s].items()} for s in self.sid}  # mister -> squadra
        self.form = {}
        for s in self.sid:
            f = os.path.join(radice, "data", f"formazioni-{s}.json")
            if os.path.exists(f):
                self.form[s] = json.load(open(f, encoding="utf-8"))
        self.schede = self.costruisci_schede()

    def chi_e(self, nome, squadra):
        # il bot scrive "nome (squadra)": si riconosce il mister dalla squadra della stagione in corso
        return self.m_of[self.corrente].get(squadra, nome)

    def nome(self, m):
        return "il Betlemme" if m == "Yara Gambirasio" else m

    def mister_di(self, s, squadra):
        return self.m_of[s].get(squadra, "?")

    # ---- pezzi del dossier ----
    def classifica_corrente(self):
        st = self.S[self.corrente]
        g = st["giornate"][-1]
        righe = [f"{r['pos']}. {r['squadra']} ({self.nome(self.mister_di(self.corrente, r['squadra']))}) {r['pt']} pt, "
                 f"{r['v']}V {r['p']}N {r['s']}P, gol {r['gf']}-{r['gs']}, fantapunti totali {r['fp']}"
                 for r in g["classifica"]]
        return f"CLASSIFICA {self.corrente} dopo la giornata {g['n']}:\n" + "\n".join(righe)

    def partita_txt(self, s, g, p):
        c, t = p["casa"], p["trasferta"]
        return (f"{c} ({self.nome(self.mister_di(s, c))}) {g['punteggi'][c]} fp {p['gc']}-{p['gt']} "
                f"{g['punteggi'][t]} fp {t} ({self.nome(self.mister_di(s, t))})")

    def ultima_e_prossima(self):
        st = self.S[self.corrente]
        g = st["giornate"][-1]
        out = [f"ULTIMA GIORNATA ({g['n']}, stagione {self.corrente}), link {SITO}#giornate-{self.corrente}-{g['n']}:"]
        out += ["- " + self.partita_txt(self.corrente, g, p) for p in g["partite"]]
        nx = (st.get("prossime") or [None])[0]
        if nx:
            out.append(f"PROSSIMA GIORNATA ({nx['n']}): " + "; ".join(f"{p['casa']} - {p['trasferta']}" for p in nx["partite"]))
        return "\n".join(out)

    def forma(self):
        st = self.S[self.corrente]
        G = st["giornate"]
        out = ["FORMA (stagione in corso):"]
        for t in self.m_of[self.corrente]:
            pts = [g["punteggi"][t] for g in G]
            seq = "".join(self.esito(g, t)[0] for g in G[-5:])
            out.append(f"- {t}: ultime 5 {seq} (V vinta, N pari, P persa), media fp {sum(pts)/len(pts):.1f}, "
                       f"ultime 3 {sum(pts[-3:])/len(pts[-3:]):.1f}, max {max(pts)}, min {min(pts)}")
        return "\n".join(out)

    def esito(self, g, t):
        for p in g["partite"]:
            if t in (p["casa"], p["trasferta"]):
                me, ot = (p["gc"], p["gt"]) if p["casa"] == t else (p["gt"], p["gc"])
                avv = p["trasferta"] if p["casa"] == t else p["casa"]
                return ("V" if me > ot else "N" if me == ot else "P"), me, ot, avv
        return ("-", 0, 0, None)

    def albo_txt(self):
        out = ["ALBO D'ORO:"]
        for s, a in sorted(self.albo.items(), reverse=True):
            c, k, u = a.get("campionato", {}), a.get("costruttori", {}), a.get("ultimo", {})
            out.append(f"- {s}: campione {c.get('squadra')} ({self.nome(c.get('mister', ''))}) {c.get('punti')} pt; "
                       f"costruttori {k.get('squadra')} ({self.nome(k.get('mister', ''))}) {k.get('fantapunti')} fp; "
                       f"ultimo {u.get('squadra')} ({self.nome(u.get('mister', ''))}) {u.get('punti')} pt")
        return "\n".join(out)

    def piazzamenti(self):
        out = ["PIAZZAMENTI PER STAGIONE (classifica finale o attuale):"]
        for s in self.sid:
            st = self.S[s]
            cl = st["giornate"][-1]["classifica"] if st.get("giornate") else st.get("finale", {}).get("classifica", [])
            if cl:
                out.append(f"- {s}: " + ", ".join(f"{r['pos']}. {r['squadra']} ({self.nome(self.mister_di(s, r['squadra']))}) {r['pt']} pt" for r in cl))
        return "\n".join(out)

    def tutte_le_partite(self):
        for s in self.sid:
            for g in self.S[s].get("giornate", []):
                for p in g["partite"]:
                    yield s, g, p

    def testa_a_testa(self, a, b):
        v = n = p = gf = gs = 0
        dett = []
        for s, g, x in self.tutte_le_partite():
            ma, mb = self.mister_di(s, x["casa"]), self.mister_di(s, x["trasferta"])
            if {ma, mb} != {a, b}:
                continue
            ga, gb = (x["gc"], x["gt"]) if ma == a else (x["gt"], x["gc"])
            gf += ga; gs += gb
            v, n, p = v + (ga > gb), n + (ga == gb), p + (ga < gb)
            dett.append(f"{s} G{g['n']} {ga}-{gb}")
        if not dett:
            return None
        dett.sort(key=lambda x: (x.split()[0], int(x.split()[1][1:])), reverse=True)
        return (f"TESTA A TESTA {self.nome(a)} contro {self.nome(b)} (tutte le stagioni con dati di giornata, dal 24-25): "
                f"{v} vittorie, {n} pareggi, {p} sconfitte per {self.nome(a)}, gol {gf}-{gs}. "
                f"Partite più recenti: {', '.join(dett[:6])}")

    def record(self):
        punti = [(g["punteggi"][t], s, g["n"], t) for s in self.sid for g in self.S[s].get("giornate", []) for t in g["punteggi"]]
        punti.sort(reverse=True)
        scarti = []
        for s, g, x in self.tutte_le_partite():
            d = abs(x["gc"] - x["gt"])
            w, l = (x["casa"], x["trasferta"]) if x["gc"] >= x["gt"] else (x["trasferta"], x["casa"])
            scarti.append((d, s, g["n"], w, l, max(x["gc"], x["gt"]), min(x["gc"], x["gt"])))
        scarti.sort(reverse=True)
        f = lambda r: f"{r[0]} fp, {r[3]} ({self.nome(self.mister_di(r[1], r[3]))}), {r[1]} G{r[2]}"
        return ("RECORD (dal 24-25):\n- punteggi più alti: " + "; ".join(f(r) for r in punti[:3]) +
                "\n- punteggi più bassi: " + "; ".join(f(r) for r in punti[-3:][::-1]) +
                "\n- vittorie più larghe: " + "; ".join(f"{r[3]} {r[5]}-{r[6]} {r[4]} ({r[1]} G{r[2]})" for r in scarti[:3]))

    def costruisci_schede(self):
        """Per ogni stagione con formazioni: statistiche di ogni giocatore per squadra."""
        schede = {}
        for s, F in self.form.items():
            for n_g, squadre in F.items():
                for t, lista in squadre.items():
                    for x in lista:
                        k = (s, t, x["nome"])
                        c = schede.setdefault(k, {"r": x["r"], "conv": 0, "tit_voto": 0, "tit_sv": 0, "entrato": 0,
                                                   "panca_voto": 0, "panca_fv": 0.0, "v": [], "fv": [], "best": None})
                        c["conv"] += 1
                        if x["tit"] and x["ok"]:
                            c["tit_voto"] += 1
                        elif x["tit"]:
                            c["tit_sv"] += 1
                        elif x["ok"]:
                            c["entrato"] += 1
                        elif x["v"] is not None:
                            c["panca_voto"] += 1
                            c["panca_fv"] += x["fv"] or 0
                        if x["ok"] and x["v"] is not None:
                            c["v"].append(x["v"]); c["fv"].append(x["fv"])
                            if c["best"] is None or x["fv"] > c["best"][0]:
                                c["best"] = (x["fv"], int(n_g))
        return schede

    def scheda_txt(self, k):
        s, t, nome = k
        c = self.schede[k]
        pres = len(c["v"])
        medie = (f"media voto {sum(c['v'])/pres:.2f}, fantamedia {sum(c['fv'])/pres:.2f}, "
                 f"miglior fantavoto {c['best'][0]} (G{c['best'][1]})") if pres else "nessun voto valido"
        return (f"- {nome} ({c['r']}), {s}, {t} ({self.nome(self.mister_di(s, t))}): in distinta {c['conv']} giornate; "
                f"titolare con voto {c['tit_voto']}, titolare senza voto {c['tit_sv']}, entrato dalla panchina {c['entrato']}, "
                f"rimasto in panchina pur avendo preso voto {c['panca_voto']} volte ({c['panca_fv']:.1f} fantapunti non usati); "
                f"partite valide {pres}, {medie}")

    def migliori(self):
        out = []
        for s in self.form:
            cand = [(sum(c["fv"]) / len(c["fv"]), k) for k, c in self.schede.items() if k[0] == s and len(c["fv"]) >= 15]
            cand.sort(reverse=True)
            out.append(f"MIGLIORI FANTAMEDIE {s} (almeno 15 partite valide): " + "; ".join(
                f"{k[2]} {fm:.2f} ({k[1]}, {self.nome(self.mister_di(s, k[1]))})" for fm, k in cand[:5]))
            panca = sorted(((c["panca_fv"], k) for k, c in self.schede.items() if k[0] == s), reverse=True)[:3]
            out.append(f"PANCHINA MALEDETTA {s} (fantapunti presi da giocatori lasciati in panchina): " + "; ".join(
                f"{k[2]} {v:.1f} fp in {self.schede[k]['panca_voto']} giornate ({k[1]}, {self.nome(self.mister_di(s, k[1]))})" for v, k in panca))
            for m in self.mis["mister"]:
                t = self.t_of[s].get(m)
                c2 = sorted(((sum(c["fv"]) / len(c["fv"]), k) for k, c in self.schede.items()
                             if k[0] == s and k[1] == t and len(c["fv"]) >= 10), reverse=True)[:3]
                if c2:
                    out.append(f"- migliori di {self.nome(m)} nel {s}: " + ", ".join(f"{k[2]} {fm:.2f}" for fm, k in c2))
                pc = sorted(((c["panca_fv"], k) for k, c in self.schede.items() if k[0] == s and k[1] == t and c["panca_voto"]), reverse=True)[:3]
                if pc:
                    out.append(f"- panchina di {self.nome(m)} nel {s} (fantapunti presi senza entrare): " + ", ".join(
                        f"{k[2]} {v:.1f} in {self.schede[k]['panca_voto']} giornate" for v, k in pc))
        cur = self.S[self.corrente].get("rose") or {}
        tutti = [(x.get("costo") or 0, x["nome"], t) for fase in cur.values() for t, L in fase.items() for x in L]
        tutti.sort(reverse=True)
        out.append(f"PIÙ PAGATI {self.corrente}: " + "; ".join(f"{n} {c} crediti ({t})" for c, n, t in tutti[:5]))
        return "\n".join(out)

    def rosa_txt(self, m):
        t = self.t_of[self.corrente].get(m)
        rose = self.S[self.corrente].get("rose") or {}
        fase = list(rose)[-1] if rose else None
        if not t or not fase or t not in rose[fase]:
            return None
        return (f"ROSA {self.corrente} di {t} ({self.nome(m)}): " +
                ", ".join(f"{x['nome']} {x['r']} {x.get('costo')}cr" for x in rose[fase][t]))

    def giocatori(self, domanda):
        q = " " + norm(domanda) + " "
        trovati = []
        for s in self.sid:
            for fase, rose in (self.S[s].get("rose") or {}).items():
                for t, lista in rose.items():
                    for x in lista:
                        n = norm(x["nome"])
                        if len(n) >= 4 and (" " + n + " ") in q:
                            q_ = f", quotazione {x['quot']}" if x.get("quot") else ""
                            trovati.append(f"- {x['nome']} ({x['r']}): rosa {s} {fase}, {t} ({self.nome(self.mister_di(s, t))}), costo {x.get('costo')}{q_}")
        for k in self.schede:
            n = norm(k[2])
            if len(n) >= 4 and (" " + n + " ") in q:
                trovati.append(self.scheda_txt(k))
        return ("GIOCATORI NOMINATI:\n" + "\n".join(dict.fromkeys(trovati))) if trovati else None

    def mister_nominati(self, domanda, chi):
        q = norm(domanda)
        trovati = []
        for m in self.mis["mister"]:
            alias = [norm(m)] + [norm(t) for s in self.sid for t, mm in self.m_of[s].items() if mm == m]
            if m == "Yara Gambirasio":
                alias += ["betlemme"]
            if any(a and (" " + a + " ") in (" " + q + " ") for a in alias) and m != chi:
                trovati.append(m)
        return trovati

    def gazzetta(self):
        out = ["ULTIMI ARTICOLI DELLA GAZZETTA:"]
        for a in self.gaz[:3]:
            tipo = "pronostici" if a.get("tipo") == "pronostici" else "cronaca"
            link = f"{SITO}#gazzetta-{a['stagione']}-{a['giornata']}" + ("-pronostici" if tipo == "pronostici" else "")
            out.append(f"- {tipo} G{a['giornata']}: {a['titolo']} ({link})")
        return "\n".join(out)

    def dossier(self, chi, domanda):
        squadra = self.t_of[self.corrente].get(chi, "?")
        parti = [f"CHI CHIEDE: {self.nome(chi)}, squadra attuale {squadra}.",
                 self.classifica_corrente(), self.ultima_e_prossima(), self.forma(),
                 self.albo_txt(), self.piazzamenti(), self.record()]
        altri = self.mister_nominati(domanda, chi) or [m for m in self.mis["mister"] if m != chi]
        for b in altri:
            h = self.testa_a_testa(chi, b)
            if h:
                parti.append(h)
        g = self.giocatori(domanda)
        if g:
            parti.append(g)
        q = norm(domanda)
        if any(w in q.split() for w in ("giocatore", "giocatori", "migliore", "migliori", "peggiore", "panchina", "titolare",
                                          "titolari", "fantamedia", "pagato", "pagati", "rosa", "acquisto", "capitano")):
            parti.append(self.migliori())
        if any(w in q.split() for w in ("rosa", "giocatori", "squadra", "formazione")):
            for m in (self.mister_nominati(domanda, None) or [chi]):
                r = self.rosa_txt(m)
                if r:
                    parti.append(r)
        parti.append(self.gazzetta())
        parti.append(f"SITO: {SITO} (classifica {SITO}#classifica, albo {SITO}#albo, mister {SITO}#mister)")
        return "\n\n".join(parti)


def chiedi_al_modello(dossier, domanda):
    """Prova i modelli gratuiti di GitHub uno dopo l'altro: se uno è esaurito o non c'è, passa al successivo."""
    ultimo = None
    for modello in MODELLI:
        corpo = json.dumps({"model": modello.strip(), "temperature": 0.4, "max_tokens": 300, "messages": [
            {"role": "system", "content": ISTRUZIONI},
            {"role": "user", "content": f"DOSSIER:\n{dossier}\n\nDOMANDA: {domanda}"}]}).encode()
        req = urllib.request.Request("https://models.github.ai/inference/chat/completions", data=corpo, headers={
            "Authorization": "Bearer " + os.environ["GITHUB_TOKEN"], "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                print("Risposta scritta con", modello, file=sys.stderr)
                return json.load(r)["choices"][0]["message"]["content"]
        except Exception as e:
            print(f"{modello} non disponibile: {e}", file=sys.stderr)
            ultimo = e
    raise ultimo


def pulisci(testo):
    testo = re.sub(r"\s+", " ", testo).strip().replace('"', "'")
    return testo[:700]


def main():
    radice = sys.argv[1]
    solo_dossier = "--dossier" in sys.argv
    lega = Lega(radice)
    domande = [RIGA.match(l) for l in open(os.path.join(radice, "domande_ricevute.txt"), encoding="utf-8")]
    f_risp = os.path.join(radice, "invia_risposte.txt")
    gia = open(f_risp, encoding="utf-8").read() if os.path.exists(f_risp) else ""
    risposte = []
    for m in filter(None, domande):
        tid, chi, squadra, domanda = m.groups()
        if not solo_dossier and gia.lstrip().startswith(tid + " "):
            print("Domanda già risposta:", tid, file=sys.stderr)
            continue
        d = lega.dossier(lega.chi_e(chi, squadra), domanda)
        if solo_dossier:
            print(f"===== {chi} ({squadra}): {domanda}\n{d}\n")
            continue
        try:
            testo = pulisci(chiedi_al_modello(d, domanda))
        except Exception as e:  # limite gratuito superato o modello non raggiungibile
            print("Errore dal modello:", e, file=sys.stderr)
            testo = "La redazione ha chiuso per oggi: troppe domande. Riprova più tardi."
        risposte.append(f'{tid} - {chi} ({squadra}): "{testo}"')
    if not solo_dossier and risposte:
        with open(os.path.join(radice, "invia_risposte.txt"), "w", encoding="utf-8") as f:
            f.write("\n".join(risposte) + "\n")
        print("\n".join(risposte))


if __name__ == "__main__":
    main()
