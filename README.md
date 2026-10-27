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

0. Frase di prova (non salvata) con riscontro sulle risposte date, ripetibile.
1. Stato d'animo iniziale (valenza, arousal).
2. 12 storie; ogni frase compare da sola e si valuta con tre scale SAM (valenza, arousal,
   dominanza), una alla volta. Si descrive **come ci si sente dopo aver letto la frase**,
   non si dà un voto alla frase.
3. Il primo tocco su una figura è **definitivo**: non si può tornare indietro.
4. Dopo ogni storia: pausa obbligatoria di 20 s con timer, poi di nuovo lo stato d'animo.
5. Stato d'animo finale.

Scale: **valenza da −2 a +2** (0 = neutro), arousal e dominanza da 1 a 5.
Accanto a ogni domanda c'è un pulsante **(i)** che riassume il criterio di valutazione.

Parametri modificabili in cima allo script di `index.html`: `PER_GRUPPO`, `PAUSA_S`,
`APPS_SCRIPT_URL`, `FRASE_PROVA`.

## Misure di risposta

| colonna | significato |
|---|---|
| `ricevuto` | timestamp di arrivo della risposta nel foglio |
| `tempo_ms` | tempo totale dalla comparsa della frase all'ultimo voto |
| `rt_valenza_ms`, `rt_arousal_ms`, `rt_dominanza_ms` | tempo di risposta su ciascuna scala, contato solo mentre quella scala è sullo schermo (si ferma se la pagina viene nascosta) |
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
stato d'animo), **lotti** (lotti ricevuti, contro i duplicati). Se un foglio ha l'intestazione
di una versione precedente, lo script lo rinomina (`…_vecchio_<data>`) e ne crea uno nuovo.

## File

- `index.html`: la web app (storie incluse nel file).
- `Code.gs`: lo script di Google Apps Script che riceve le risposte.
- `storie_IDEST_90.json`: le 90 storie usate, con `gruppo` e `tipo` (StoryType).
- `selezione_90_storie.csv`: come sono state scelte le 90 storie.
- `storie_IDEST_it.json`: tutte le 196 storie IDEST tradotte (≥ 900 caratteri).
