# Studio VAD – valutazione emotiva di storie (tesi magistrale)

Web app per raccogliere, frase per frase, come si sente chi legge, con le tre scale SAM
(**valenza, arousal, dominanza**), su storie brevi in prima persona tratte da IDEST
(Kaakinen et al., 2022, *PLOS ONE*) e tradotte in italiano.

Online su GitHub Pages: https://jacopogiannelli.github.io/studio-vad/
(aggiungendo `?debug` all'indirizzo compare in basso l'esito di ogni invio al foglio).

## Storie

90 storie IDEST, 15 per ciascuno di 6 gruppi di arco emotivo (`StoryType` IDEST):

| gruppo | arco emotivo | StoryType |
|---|---|---|
| 1 | Costante | 1 |
| 2 | Tragedia | 2 |
| 3 | Rags-to-riches | 3 |
| 4 | Man-in-a-hole | 4 |
| 5 | Icarus | 5 |
| 6 | Oedipus + Cinderella + nessun arco chiaro | 6, 7, 8 |

Ogni partecipante vota **12 storie: 2 estratte a caso da ogni gruppo**, in ordine mescolato.
L'elenco delle 90 storie e il motivo della selezione sono in `selezione_90_storie.csv`.

## Protocollo

0. **Questionari anonimi** (una volta sola, all'inizio): PANAS → STAI-Y1 → BSI-18, uno per pagina,
   pulsante "Compila i questionari"; finiti tutti, pulsante "Inizia".
1. Frase di prova (non salvata) con riscontro sulle risposte date, ripetibile.
2. Stato d'animo iniziale (valenza, arousal).
3. 12 storie; ogni frase compare da sola e si valuta con tre scale SAM (valenza, arousal,
   dominanza), una alla volta. Si descrive **come ci si sente dopo aver letto la frase**,
   non si dà un voto alla frase.
4. Il primo tocco su una figura è **definitivo**: non si può tornare indietro.
5. Dopo ogni storia: pausa obbligatoria di 20 s con timer, poi di nuovo lo stato d'animo.
6. Stato d'animo finale.

Scale: **valenza da −2 a +2** (0 = neutro), arousal e dominanza da 1 a 5.
Accanto a ogni domanda c'è un pulsante **(i)** che riassume il criterio di valutazione.

Parametri modificabili in cima allo script di `index.html`: `PER_GRUPPO`, `PAUSA_S`,
`APPS_SCRIPT_URL`, `FRASE_PROVA`.

## Questionari

I testi (istruzioni, etichette delle risposte, item) stanno nel blocco
`<script type="application/json" id="questionari">` di `index.html` e vanno copiati dalle
**versioni italiane validate**, nell'ordine originale degli item (serve per i punteggi).
Se resta un segnaposto `[DA INSERIRE: …]`, sotto il pulsante iniziale compare un avviso arancione.

| questionario | item | risposte | stato dei testi | punteggi |
|---|---|---|---|---|
| PANAS | 20 | 1–5 | **provvisorio**: traduzione corretta da una versione brasiliana; da sostituire con la versione italiana validata (Terracciano et al., 2003) | PA = somma item dispari, NA = somma item pari (ordine attuale) |
| STAI forma Y1 (stato) | 20 | 1–4 | inserito dal modulo italiano, **forma femminile** (da decidere: forme "o/a" o versione maschile) | item 1, 2, 5, 8, 10, 11, 15, 16, 19, 20 invertiti (5 − x), poi somma: 20–80 |
| BSI-18 | 18 | 0–4 | **da sostituire**: ora è la versione **inglese** del modulo cartaceo; serve la versione italiana validata | SOM = 1, 4, 7, 10, 13, 16; DEP = 2, 5, 8, 11, 14, 17; ANX = 3, 6, 9, 12, 15, 18; GSI = somma dei 18 (0–72) |

Per ogni questionario si salvano `inizio` (comparsa della pagina), `fine` (conferma con tutte
le risposte date) e `durata_ms` (foglio `questionari`), e i voti item per item
(fogli `voti_PANAS`, `voti_STAI-Y1`, `voti_BSI-18`, una riga per partecipante).
Se la pagina viene chiusa a metà, si riprende con le risposte già date; chi ha finito i
questionari non li rifà.

## Tempo per storia

Il foglio **tempi_storie** (calcolato da `Code.gs`, una riga per storia di ogni partecipante,
aggiornata a ogni frase) contiene:
`tempo_umore_prima_ms` (valenza + arousal della domanda "come ti senti" mostrata prima della
storia), `tempo_frasi_ms` (somma dei tempi di valenza, arousal e dominanza di tutte le frasi),
`tempo_storia_ms` (la somma dei due) e `n_frasi_votate`. Lo stato d'animo finale non è sommato.

## Misure di risposta

| colonna | significato |
|---|---|
| `ricevuto` | timestamp di arrivo della risposta nel foglio |
| `rt_valenza_ms`, `rt_arousal_ms`, `rt_dominanza_ms` | tempo di risposta su ciascuna scala, contato solo mentre quella scala è sullo schermo (si ferma se la pagina viene nascosta); nel foglio umore solo valenza e arousal |
| `n_info` | aperture del pulsante (i) |
| `pagina_nascosta` | 1 se durante la risposta si è passati ad altra scheda/app (tempi non affidabili) |

## Salvataggio dei dati e ripresa della sessione

- Ogni risposta viene inviata subito come un **lotto** (i voti di una frase oppure uno stato
  d'animo) a un Google Apps Script (`Code.gs`) che scrive in un Google Sheet.
  La richiesta è un POST `text/plain`, per evitare il preflight CORS.
- I lotti non inviati (es. connessione assente) restano in coda e vengono rimandati;
  il numero di lotto permette ad Apps Script di scartare gli invii doppi.
- Lo stato della sessione è salvato nel browser (`localStorage`) dopo ogni voto: se la pagina
  viene chiusa, riaprendola dallo stesso browser si riprende dalla frase in cui ci si era fermati.

Fogli del Google Sheet: **risposte** (una riga per frase), **umore** (una riga per ogni
stato d'animo), **tempi_storie** (tempo totale di voto per storia), **questionari** e
**voti_…** (questionari), **lotti** (lotti ricevuti, contro i duplicati). Se un foglio ha l'intestazione
di una versione precedente, lo script lo rinomina (`…_vecchio_<data>`) e ne crea uno nuovo.

## File

- `index.html`: la web app (storie incluse nel file).
- `Code.gs`: lo script di Google Apps Script che riceve le risposte (versione **v5**: aprendo
  l'URL `/exec` deve comparire "codice v5"). Su GitHub è solo una copia di riferimento: quello
  che conta è il codice incollato in Apps Script e distribuito con "Nuova versione".
- `storie_IDEST_90.json`: le 90 storie usate, con `gruppo` e `tipo` (StoryType); sono le stesse
  incluse in `index.html`.
- `selezione_90_storie.csv`: come sono state scelte le 90 storie.
- `storie_IDEST_it.json`: tutte le 196 storie IDEST tradotte (≥ 900 caratteri). Le 4 storie
  reintegrate nei gruppi 4 e 5 (SW022, SW023, SW024, FR37) non sono in questo file perché in
  italiano sono sotto i 900 caratteri.
