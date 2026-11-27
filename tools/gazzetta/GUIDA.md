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
    Con `"dopo": 0` (o 1) la frase va subito sotto quel paragrafo del pezzo, quello che parla
    della squadra di quel mister: così le citazioni non stanno tutte attaccate in fondo.
- `top` e `flop`: squadra, fantapunti e una `nota` breve. Quella del flop è una frecciata.
- `chiusura`: titolo `"Nel prossimo numero · G<n+1>"`, le partite della giornata dopo presentate
  come una locandina, con un finale che mette pressione a chi è in crisi.

## I pronostici (prima della giornata)

Per ogni giornata escono due articoli: i **pronostici**, la mattina in cui comincia la giornata di Serie A,
e la **cronaca**, la mattina dopo l'ultima partita. Sul sito i pronostici sono in oro, la cronaca in rosso.

Un articolo di pronostici in `data/gazzetta.json` ha `"tipo": "pronostici"` e:
- `pezzi`: uno per partita, con `partita` (posizione nella giornata, da `prossime` in `data/stagione-XX-YY.json`),
  `pronostico` (es. `"3-1"`, casa-trasferta), `titolo` e due paragrafi di `testo`: forma, medie e precedenti veri,
  più la frecciata.
- `rubriche`: `copertina` e `disastro` (squadra + testo), `vetta` (chi sarà primo dopo la giornata, coerente con i
  pronostici), `follia` (un pronostico azzardato, solo testo).
- `chiusura`: il rimando al dopo-partita.

La schedina 1X2 e la classifica alla vigilia il sito le costruisce da solo.
Il link dei pronostici finisce con `-pronostici`: `https://frab0.github.io/BocchiLeague/#gazzetta-26-27-11-pronostici`.

**Nessun "Mago" o pronosticatore con un nome.** I pronostici sono della Gazzetta, senza presentare personaggi
e senza frasi sul fatto che "si pagheranno" o "si faranno i conti" ai pronostici.

**Le notizie della settimana.** Prima di scrivere i pronostici si cercano online infortunati, squalificati e
giocatori in dubbio per la giornata di Serie A (fonti aggiornate alla settimana, per esempio Sky Sport,
fantacalcio.it, Fantamaster) e si incrociano con le rose in `data/stagione-XX-YY.json` (`rose`).
Solo notizie vere e recenti, con il nome come compare nella rosa. Pesano anche sui pronostici.

**Le trame della settimana.** Accanto alle notizie vere si raccontano, con tono serissimo, settimane che una
squadra di fantacalcio non può avere: sedute tattiche, ritiri anticipati, allenamenti a porte chiuse, partitelle,
telefonate con lo staff medico. Sembrano cronaca sportiva normale, ma sono impossibili: è lì che sta la battuta.

Nella cronaca della stessa giornata si aggiunge `"mago": {"indovinati": 2, "totali": 5, "nota": "…"}`
(sul sito compare come "Pronostici azzeccati"): quanti pronostici sono stati presi (i 3 risultati 1X2, la vetta
e la follia) e una battuta. Se sono sbagliati, la Gazzetta prende in giro anche se stessa, sempre senza dirlo apertamente.

## Le domande ai mister (`invia_domande.txt`)

Il bot di Telegram legge `invia_domande.txt`, manda a ogni mister la sua domanda, poi svuota il file e cancella
le risposte vecchie in `risposte_mister.txt`. Quindi **prima si scrive l'articolo con le risposte raccolte,
e solo dopo si mandano le domande nuove**. Non si cancella mai niente a mano in questi due file.

Formato, una riga per mister, e in fondo la riga di conferma:

```
gpepss (FC OverPerformers): "domanda"
frab (SC CortoMuso): "domanda"
Pistolero (Franciscum FC): "domanda"
Nico Pus (Kefir FC): "domanda"
simobers (SPARA ROGGERDAM): "domanda"
Yara (Real Betlemme): "domanda"
Conferma: messaggio che il bot manda a chi risponde
```

- Una domanda diversa per ogni mister, la più ironica possibile, sul fantacalcio e mai sulla persona.
- **La riga `Conferma:` va sempre per ultima.** È uguale per tutti e si può cambiare ogni volta.
- Pronostici: domande la mattina del giorno della prima partita (di solito il venerdì), articolo online prima del fischio d'inizio. Cronaca: domande la sera dell'ultima partita.

**Quello che dicono i mister non è un fatto.** Annunci di formazione, promesse e confessioni possono essere
pretattica o battute: nell'articolo si riportano come dichiarazioni ("giura che...", "assicura che..."), mai come
notizie, e non si usano come dati nelle domande successive. I fatti vengono solo dai dati della lega.
**Mai mettere in bocca a un mister cose che non ha detto.** Ogni "dice", "annuncia", "non teme", "promette"
deve corrispondere a una sua frase in `risposte_mister.txt`; un riassunto fedele va bene ("ci sono i numeri
per tre attaccanti" → "annuncia il tridente"), un'intenzione che non ha espresso no.

Le risposte arrivano in `risposte_mister.txt` come `nome (squadra): testo`, anche mischiate. Si raggruppano per mister,
si uniscono i messaggi nell'ordine in cui sono arrivati, si scartano saluti e messaggi senza senso, e diventano
le `dichiarazioni` sotto la partita di quel mister.

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
