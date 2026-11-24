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
- `tools/aggiorna.py`: rigenera i JSON dai PDF esportati dall'app
- `.github/workflows/pubblica.yml`: l'automazione che aggiorna e pubblica il sito a ogni caricamento
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
giornata, prossimi turni). Poi basta caricare su GitHub i file cambiati e il sito si pubblica da solo.

## Stagioni con export PDF (FantaMaster, fino al 25/26)

Le stagioni in `fonti` dentro `data/config.json` si rigenerano dai PDF con `python tools/aggiorna.py`,
che l'automazione lancia a ogni caricamento.

### Configurazione iniziale (una volta sola)

In **Settings → Pages → Build and deployment → Source** scegli **GitHub Actions**.

### A fine stagione

- aggiungi la stagione chiusa in `data/albo.json` (Scudetto, Costruttori, ultimo)
- per la nuova stagione: aggiungila in testa a `stagioni` e in `fonti` dentro `data/config.json`, aggiorna `stagioneCorrente` e aggiungi le squadre in `data/mister.json`

## Locandina della giornata

`python tools/locandina.py` crea l'immagine da condividere dell'ultima giornata
(`assets/img/locandine/`) e aggiorna l'anteprima dei link (`assets/img/og.jpg`).
Per una giornata precisa: `python tools/locandina.py 26-27 10`. L'automazione la rigenera da sola.
