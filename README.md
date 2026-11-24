# Bocchi League

Sito ufficiale della lega. È un sito statico per GitHub Pages: niente build, niente server.

## Struttura

- `index.html`: l'unica pagina; le sezioni si aprono con l'indirizzo dopo `#` (`#classifica`, `#giornate-25-26-38`, `#mister-frab`…)
- `assets/`: stile, script, logo e immagini
- `data/`: tutti i dati della lega in JSON
  - `config.json`: stagione in corso, colori dei Mister, sigle, **stemmi**, documenti scaricabili
  - `mister.json`: quale Mister guida quale squadra in ogni stagione
  - `albo.json`: Scudetto, Costruttori e ultimo classificato per stagione
  - `bollettino.json`: comunicati della Federazione
  - `stagione-XX-YY.json`: punteggi, partite, classifiche e rose
  - `formazioni-XX-YY.json`: formazioni con voti di ogni giornata
- `common/`: i file originali (PDF, Excel, immagini) delle stagioni
- `tools/`: gli script che aggiornano i dati (`leghe_fc.py`), creano la locandina (`locandina.py`) e rigenerano le vecchie stagioni dai PDF (`aggiorna.py`)
- `.github/workflows/notifica-telegram.yml`: avvisa il gruppo Telegram a ogni modifica del sito
- `comunicati.txt` e `invia_domande.txt`: i file usati dal bot Telegram
- le vecchie pagine (`albo.html`, `comunicati.html`, `storico…html`) ora rimandano alle nuove sezioni

## Aggiungere gli stemmi

Metti le immagini in `assets/img/stemmi/` e aggiungi il nome squadra in `data/config.json`, per esempio:

```json
"stemmi": { "Kefir FC": "assets/img/stemmi/kefir.png" }
```

## Aggiornare la stagione 26/27 (Leghe Fantacalcio)

Dal 26/27 la lega gioca su Leghe Fantacalcio. I dati si leggono dal sito della lega
(calendario, risultati, classifica, rose) e finiscono in `tools/leghe/`:

- `calendario.json`: giornate giocate con gol e fantapunti
- `rose.json`: rose e crediti residui

`python tools/leghe_fc.py` ricostruisce `data/stagione-26-27.json` (classifiche giornata per
giornata, prossimi turni). Poi si lancia `python tools/locandina.py` e si caricano su GitHub i file cambiati:
GitHub Pages pubblica il sito in un paio di minuti. Non c'è nessuna automazione che lo faccia da sola:
l'aggiornamento si fa a mano dopo ogni giornata.

## Stagioni con export PDF (FantaMaster, fino al 25/26)

Le stagioni chiuse sono già nei JSON. Se servisse rigenerarle (per esempio aggiungendo il PDF di una
giornata mancante), le stagioni in `fonti` dentro `data/config.json` si ricostruiscono con `python tools/aggiorna.py`.

### A fine stagione

- aggiungi la stagione chiusa in `data/albo.json` (Scudetto, Costruttori, ultimo)
- per la nuova stagione: aggiungila in testa a `stagioni` e in `fonti` dentro `data/config.json`, aggiorna `stagioneCorrente` e aggiungi le squadre in `data/mister.json`

## Locandina della giornata

`python tools/locandina.py` crea l'immagine da condividere dell'ultima giornata
(`assets/img/locandine/`) e aggiorna l'anteprima dei link (`assets/img/og.jpg`).
Per una giornata precisa: `python tools/locandina.py 26-27 10`.
