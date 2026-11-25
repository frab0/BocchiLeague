# Guida della Gazzetta Bocchi League

Le regole per scrivere ogni numero della Gazzetta. Chi scrive l'articolo, persona o Claude, le segue sempre.
Per cambiare tono o regole basta modificare questo file.

## L'idea

La forma è quella di un giornale sportivo vero, la sostanza è goliardia tra amici.
Si racconta il fantacalcio con la serietà di una finale di Champions, e sotto la battuta c'è sempre.

## Le regole

1. **I numeri sono sacri.** Risultati, fantapunti, classifiche e filotti sono sempre veri, presi da
   `data/stagione-XX-YY.json`. Le battute stanno nel racconto, mai nei dati.
2. **Il dito nella piaga.** La cattiveria è per chi perde: sconfitte, crolli, filotti negativi, ultimo
   posto, campione in crisi. Più la caduta è rovinosa, più si calca la mano. Chi vince si racconta
   in modo asciutto, con i numeri.
3. **Si prende in giro la squadra, non la persona.** Formazioni, risultati, scelte e sfortuna sì.
   Lavoro, famiglia, aspetto fisico e vita privata mai.
4. **Nessuno è al sicuro.** Prima o poi la frecciata tocca a tutti, capolista compreso.
5. **Il mister del Real Betlemme si chiama con il nome della squadra** ("il Betlemme"), mai con il soprannome.
6. **La lunghezza non cresce.** Un numero intero sta intorno alle 230-250 parole, dichiarazioni escluse.
   Le battute sostituiscono le frasi piatte, non si aggiungono.

## I titoli

- Stile classico da giornale: chiari, informativi, d'effetto ma non da meme.
- **Un titolo, un protagonista.** Niente titoli doppi tipo "X non perde più, Y non vince più".
- Esempi buoni: "Sette colpi di Kefir, Roggerdam torna in vetta" (titolo del numero, può citare
  più squadre), "Kefir, la notte dei 92,5", "Roggerdam, otto partite senza perdere",
  "Dodici gol e nessun vincitore".

## La struttura di un numero

È quella del file `data/gazzetta.json`: un oggetto per giornata, il più recente per primo.

- `titolo`: il titolo del numero.
- `sommario`: due o tre frasi di cronaca, con almeno una stoccata a chi è andato male.
- `pezzi`: uno per partita, nell'ordine delle partite della giornata (`partita`: 0, 1, 2).
  - `titolo`: un solo protagonista.
  - `testo`: due paragrafi. Il primo è la cronaca, con punteggi e cosa cambia in classifica.
    Il secondo è per chi ha perso, con la battuta secca in chiusura.
  - `dichiarazioni`: una frase breve per mister, massimo 15 parole, presa da
    `risposte_mister.txt`. Formato `{"mister": "simobers", "testo": "…"}`.
    Se un mister non ha risposto non si inventa niente: si lascia la lista vuota.
- `top` e `flop`: squadra, fantapunti e una `nota` breve. Quella del flop è una frecciata.
- `chiusura`: titolo `"Nel prossimo numero · G<n+1>"`, le partite della giornata dopo presentate
  come una locandina, con un finale che mette pressione a chi è in crisi.

## Il registro dei tormentoni

`tools/gazzetta/tormentoni.md` tiene le battute che ritornano: soprannomi, maledizioni, crisi, rivalità.
Prima di scrivere si legge, così le storie continuano di numero in numero. Dopo aver scritto si aggiorna:
si aggiungono le novità e si tolgono i tormentoni che non valgono più.

## Pubblicare e notificare

1. Aggiungi l'articolo in cima a `data/gazzetta.json` e caricalo su `pos_branch`.
2. Scrivi in `notifica_articoli.txt` (sostituendo il contenuto precedente):

   ```
   📰 La Gazzettina della Giornata <numero>:
   <mini titolo da notifica, brevissimo, accattivante, con emoji>
   https://frab0.github.io/BocchiLeague/#gazzetta-<stagione>-<giornata>
   ```

   Esempio:

   ```
   📰 La Gazzettina della Giornata 10:
   🔥 Kefir da record con 92,5! Roggerdam torna in vetta 👑
   https://frab0.github.io/BocchiLeague/#gazzetta-26-27-10
   ```

⚠️ **Il link va sempre nell'ultima riga del file**, da solo, senza niente dopo (nemmeno righe vuote con testo).
La notifica dell'app usa la prima riga come titolo, le righe in mezzo come testo e l'ultima riga come link
da aprire quando si tocca la notifica: se il link non è in fondo, finisce nel testo e la notifica apre la home.

L'automazione `notifica-telegram.yml` manda il messaggio solo quando l'articolo è davvero online,
quindi articolo e notifica si possono caricare anche insieme.
