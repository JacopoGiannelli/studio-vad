# Studio VAD – valutazione emotiva di storie (tesi magistrale)

Web app per raccogliere valutazioni di **valenza e arousal** (scala SAM a 5 figure)
frase per frase, su storie brevi in prima persona tratte da IDEST
(Kaakinen et al., 2022, *PLOS ONE*) e tradotte in italiano.

Online su GitHub Pages: https://jacopogiannelli.github.io/studio-vad/

## Protocollo

1. Stato d'animo iniziale (valenza, arousal).
2. 10 storie estratte a caso; ogni frase compare da sola e si valuta con due scale SAM
   (valenza, arousal), una alla volta.
3. Dopo ogni storia: pausa obbligatoria di 20 s con timer, poi di nuovo lo stato d'animo.
4. Stato d'animo finale.

Parametri modificabili in cima allo script di `index.html`: `N_STORIE`, `PAUSA_S`, `APPS_SCRIPT_URL`.

## Salvataggio dei dati e ripresa della sessione

- Ogni risposta viene inviata subito, appena data, come un **lotto** (il voto di una frase
  oppure uno stato d'animo) a un Google Apps Script (`Code.gs`) che scrive in un Google Sheet.
  La richiesta è un POST `text/plain`, per evitare il preflight CORS.
- I lotti non inviati (es. connessione assente) restano in coda e vengono rimandati;
  il numero di lotto permette ad Apps Script di scartare gli invii doppi.
- Lo stato della sessione è salvato nel browser (`localStorage`) dopo ogni voto: se la pagina
  viene chiusa, riaprendola dallo stesso browser si riprende dalla frase in cui ci si era fermati.

Fogli del Google Sheet:

- **risposte**: una riga per frase (sessione, storia, frase, valenza, arousal, tempo di
  risposta, `versione`); la colonna `dominanza` resta per i dati raccolti in precedenza ma
  ora è vuota;
- **umore**: una riga per ogni rilevazione dello stato d'animo;
- **lotti**: l'elenco dei lotti ricevuti (serve a evitare righe duplicate).

Se a fine sessione restano lotti non inviati, la pagina offre il download delle risposte in CSV.

## File

- `index.html`: la web app (storie incluse nel file).
- `Code.gs`: lo script di Google Apps Script che riceve le risposte.
- `storie_IDEST_it.json`: le 196 storie IDEST tradotte in italiano (1:1 frase per frase con
  l'inglese), escluse quelle sotto i 900 caratteri come nel criterio del paper IDEST.
