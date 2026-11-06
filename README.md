# Studio VAD – valutazione emotiva di storie (tesi magistrale)

Web app per raccogliere, frase per frase, come si sente chi legge, con due scale SAM
(**valenza e arousal**), su storie brevi in prima persona tratte da IDEST
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

Ogni partecipante vota **6 storie: 1 estratta a caso da ogni gruppo**, in ordine mescolato
(`PER_GRUPPO = 1` in `index.html`; con 2 si torna a 12 storie).
L'elenco delle 90 storie e il motivo della selezione sono in `selezione_90_storie.csv`.

## Protocollo

0. **Pagina iniziale** breve → pulsante "Compila i questionari".
1. **Questionari anonimi** (una volta sola): PANAS → STAI-Y1 → BSI-18, uno per pagina.
2. **Pagina "Come funziona lo studio"**: spiegazione di valenza e arousal e delle
   istruzioni → pulsante "Inizia".
3. Frase di prova (non salvata) con riscontro sulle risposte date, ripetibile.
4. Stato d'animo iniziale (valenza, arousal), poi **avviso "La prima storia sta per iniziare"**
   con pulsante "Inizia la storia" (il tempo sulla pagina è la riga `avviso_storia` di `tempi_pagine`).
5. 6 storie; ogni frase compare da sola e sotto compaiono **insieme le due scale SAM**
   (valenza, arousal), senza frasi-domanda. Si descrive **come ci si sente dopo aver
   letto la frase**, non si dà un voto alla frase.
6. Finché non sono state date **entrambe** le scale si può **cambiare idea** toccando un'altra figura;
   appena ci sono entrambe si passa automaticamente avanti e la risposta è definitiva. Ogni cambio
   viene contato e datato (solo per la valenza: colonne `n_cambi_valenza` e `t_cambi_valenza_ms`).
7. Dopo ogni storia: pausa obbligatoria di 20 s con timer, poi di nuovo lo stato d'animo
   (due scale). Dopo l'ultima storia, stato d'animo finale.
8. Schermata finale: compare «Sto salvando le tue risposte… non chiudere ancora la pagina» e,
   appena tutti i dati sono nel foglio (di solito pochi secondi), «Risposte salvate: puoi chiudere
   la pagina». L'invio viene ritentato ogni 2 secondi finché non è completo.

Scale: **valenza da −2 a +2** (0 = neutro), arousal da 1 (calmo) a 5 (eccitato). La **dominanza è stata tolta**.
Accanto a ogni scala c'è un pulsante **(i)** che riassume il criterio di valutazione.
Telefono sempre in verticale: su Android (Chrome), al tocco di "Compila i questionari" / "Inizia" /
"Riprendi" la pagina passa a schermo intero e blocca l'orientamento verticale; su tutti i telefoni,
se il telefono è in orizzontale la pagina è coperta da un avviso "tieni il telefono in verticale".
In quei momenti il cronometro dei voti è fermo e la risposta ha `pagina_nascosta` = 1.
Sulle schermate di voto frase e due righe di figure stanno sempre nell'altezza dello schermo.
Le figure hanno una misura FISSA per tutto l'esperimento, che dipende solo dallo schermo: è la più
grande con cui anche la frase più lunga del dataset + due righe di figure stanno in verticale senza
uscire in orizzontale (si ricalcola solo se cambia la finestra). Durante storie, prova e stato d'animo non c'è barra di avanzamento: l'avanzamento (storie completate /
storie totali) compare solo nella schermata della pausa.

Parametri modificabili in cima allo script di `index.html`: `PER_GRUPPO`, `PAUSA_S`,
`APPS_SCRIPT_URL`, `FRASE_PROVA`.

## Profilo di lettura (schermata finale)

Come piccolo riconoscimento, la schermata finale mostra uno di **12 profili di lettura**
(es. "Il Lago Calmo", "Il Raggio di Sole"), calcolato **solo dai voti sulle storie e dallo stato
d'animo, mai dai questionari**, e dichiarato come gioco, non come valutazione psicologica:
- **stile** (4): tendenza più forte tra valenza media alta (ottimista), bassa (profondo), arousal
  alto (intenso), altrimenti equilibrato (soglia 0,25 su scala −1…+1);
- **reattività** (3): cambiamento medio di valenza e arousal tra frasi consecutive (< 0,5 bassa,
  > 1 alta);
- in più: il ritorno dello stato d'animo dopo le pause rispetto a quello iniziale.
Sotto il profilo c'è il grafico **"La traiettoria del tuo mood"** (piano valenza–arousal, come
nel paper di Pardini) di una delle storie lette (quella più spostata nella direzione dello stile;
quale sia non viene detto): **un punto per ogni frase** della storia (○ prima frase, ★ ultima),
uniti nell'ordine, senza ellissi, valori riportati tra 0 e 1 (valenza (v+2)/4, arousal (a−1)/4).
I punti con gli stessi valori sono disegnati leggermente spostati, così si vedono tutti.
Profilo e grafico sono solo mostrati: non vengono salvati nel foglio. Nomi e testi sono
nell'oggetto `PROFILI` dello script.

## Questionari

I testi (istruzioni, etichette delle risposte, item) stanno nel blocco
`<script type="application/json" id="questionari">` di `index.html` e vanno copiati dalle
**versioni italiane validate**, nell'ordine originale degli item (serve per i punteggi).
Se resta un segnaposto `[DA INSERIRE: …]`, sotto il pulsante iniziale compare un avviso arancione.

| questionario | item | risposte | stato dei testi | punteggi |
|---|---|---|---|---|
| PANAS | 20 | 1–5 | **provvisorio**: traduzione corretta da una versione brasiliana; da sostituire con la versione italiana validata (Terracciano et al., 2003) | PA = somma item dispari, NA = somma item pari (ordine attuale) |
| STAI forma Y1 (stato) | 20 | 1–4 | inserito dal modulo italiano con le forme **"o/a"** (es. «Mi sento calmo/a»); istruzioni al **tu** | item 1, 2, 5, 8, 10, 11, 15, 16, 19, 20 invertiti (5 − x), poi somma: 20–80 |
| BSI-18 | 18 | 0–4 | testo **italiano** inserito (istruzioni «Durante gli ultimi 7 giorni, quanto ha sofferto:», risposte Per nulla / Un pochino / Moderatamente / Abbastanza / Moltissimo); da controllare che coincida con la versione italiana validata, e nelle istruzioni c'è ancora la forma di cortesia («ha sofferto») mentre gli altri questionari sono al tu | SOM = 1, 4, 7, 10, 13, 16; DEP = 2, 5, 8, 11, 14, 17; ANX = 3, 6, 9, 12, 15, 18; GSI = somma dei 18 (0–72) |

Per ogni questionario si salvano `inizio` (comparsa della pagina), `fine` (conferma con tutte
le risposte date) e `durata_ms` (foglio `questionari`), e i voti item per item
(fogli `voti_PANAS`, `voti_STAI-Y1`, `voti_BSI-18`, una riga per partecipante).
Se la pagina viene chiusa a metà, si riprende con le risposte già date; chi ha finito i
questionari non li rifà.

## Tempo per storia

Il foglio **tempi_storie** (calcolato da `Code.gs`, una riga per storia di ogni partecipante,
aggiornata a ogni frase) contiene:
`tempo_umore_prima_ms` (valenza + arousal della domanda "come ti senti" mostrata prima della
storia), `tempo_frasi_ms` (somma dei tempi di valenza e arousal di tutte le frasi),
`tempo_storia_ms` (la somma dei due) e `n_frasi_votate`. Lo stato d'animo finale non è sommato.

## Tempo sulle pagine e tempo totale

Il foglio **tempi_pagine** ha una riga per ogni pagina "di passaggio": `intro` (dall'apertura del
sito a "Compila i questionari"), `spiegazione` (pagina "Come funziona lo studio", fino a "Inizia"),
`prova` (frase di prova, fino al terzo voto; una riga per tentativo), `avviso_storia` (avviso prima della prima storia, fino a "Inizia la storia"), `riscontro_prova` (fino a
"Inizia lo studio" o "Rifai la prova") e, a fine sessione, **`totale_web_app`**: tempo totale
dall'apertura del sito all'ultima risposta, pause comprese. Colonne: `inizio`, `fine`,
`durata_ms` (tempo di orologio), `tentativo`, `pagina_nascosta`.

## Misure di risposta

| colonna | significato |
|---|---|
| `ricevuto` | timestamp di arrivo della risposta nel foglio |
| `rt_valenza_ms`, `rt_arousal_ms` | tempo di ciascun voto: le due scale sono insieme, quindi va dal voto precedente (o dalla comparsa della schermata, per il primo) al **primo** tocco della figura; la somma dei due è il tempo della schermata (il cronometro si ferma se la pagina viene nascosta). Uguale per frasi e stato d'animo |
| `ts_valenza`, `ts_arousal` | ora italiana (al millisecondo) del **primo** tocco su ciascuna scala |
| `n_cambi_valenza` | quante volte la persona ha cambiato il voto della valenza dopo il primo tocco (0 se mai); per l'arousal i cambi non si registrano |
| `t_cambi_valenza_ms` | momento di ogni cambio in ms dalla comparsa della schermata, come `rt_…_ms`, separati da ` ; ` (es. `2519 ; 3400`); vuota se non ci sono stati cambi. Le colonne `valenza` e `arousal` contengono sempre il voto **finale** |
| `ordine_voti` | ordine in cui sono state scelte le scale la prima volta, es. `V-A` |
| `n_info` | aperture del pulsante (i) |
| `pagina_nascosta` | 1 se durante la risposta si è passati ad altra scheda/app (tempi non affidabili) |

## Salvataggio dei dati e ripresa della sessione

- I dati partono a **lotti** verso un Google Apps Script (`Code.gs`) che scrive in un Google Sheet,
  in tutto circa 8 invii a persona: **uno dopo i questionari** (con la pagina iniziale), **uno per ogni
  storia finita** (tutte le sue frasi, lo stato d'animo che la precede e i tempi delle pagine passate)
  e **uno alla fine** (stato d'animo finale e tempo totale). Gli invii si fanno prima della pausa di 20 s,
  così a fine studio resta pochissimo da inviare.
  La richiesta è un POST `text/plain`, per evitare il preflight CORS.
- I lotti non inviati (es. connessione assente) restano in coda e vengono rimandati;
  il numero di lotto permette ad Apps Script di scartare gli invii doppi. Se la pagina viene chiusa
  con lotti ancora in coda, il browser prova a mandarli subito (`keepalive`); quelli non arrivati
  restano salvati e partono alla riapertura.
- Lo stato della sessione è salvato nel browser (`localStorage`): se la pagina viene chiusa, riaprendola
  dallo stesso browser si riprende dalla **storia in cui ci si era fermati, ricominciandola dall'inizio**
  (le frasi di una storia non finita non vengono salvate). Le storie già finite sono al sicuro.

Fogli del Google Sheet: **risposte** (una riga per frase), **umore** (una riga per ogni
stato d'animo), **tempi_storie** (tempo totale di voto per storia), **tempi_pagine** (pagine e tempo totale), **questionari** e
**voti_…** (questionari), **lotti** (lotti ricevuti, contro i duplicati). Se un foglio ha l'intestazione
di una versione precedente, lo script lo rinomina (`…_vecchio_<data>`) e ne crea uno nuovo.

## File

- `index.html`: la web app (storie incluse nel file), con due scale (valenza e arousal).
- `index_dominanza.html`: la stessa web app con tre scale (aggiunge la dominanza), vedi sotto.
- `Code.gs`: lo script di Google Apps Script che riceve le risposte (versione **v10**: aprendo
  l'URL `/exec` deve comparire "codice v10"). Su GitHub è solo una copia di riferimento: quello
  che conta è il codice incollato in Apps Script e distribuito con "Nuova versione".
- `storie_IDEST_90.json`: le 90 storie usate, con `gruppo` e `tipo` (StoryType); sono le stesse
  incluse in `index.html`.
- `selezione_90_storie.csv`: come sono state scelte le 90 storie.
- `storie_IDEST_it.json`: tutte le 196 storie IDEST tradotte (≥ 900 caratteri). Le 4 storie
  reintegrate nei gruppi 4 e 5 (SW022, SW023, SW024, FR37) non sono in questo file perché in
  italiano sono sotto i 900 caratteri.

## Profilo come immagine

Nella schermata finale (e solo lì) il pulsante **"Salva il tuo profilo come immagine"**
crea un PNG con profilo e grafico. Sul telefono apre la condivisione (Salva immagine, Instagram…),
sul computer scarica il file. L'immagine resta sul dispositivo: non viene inviata al foglio.

## Versione con la dominanza (`index_dominanza.html`)

Copia della web app con **tre scale SAM** (valenza, arousal e **dominanza**, da 1 a 5), tutto il resto uguale
(stessi questionari, stesse storie, stesso salvataggio per storia, stessa schermata finale). Online all'indirizzo
https://jacopogiannelli.github.io/studio-vad/index_dominanza.html (accanto a `index.html`, che resta con due scale).

- Scrive **nello stesso Google Sheet** e con lo stesso `Code.gs` (v10). La colonna `versione` distingue le due
  web app: `testi` (due scale) e `testi_dom` (tre scale).
- Per la dominanza `Code.gs` aggiunge **in fondo** ai fogli `risposte` e `umore` tre colonne: `dominanza`,
  `rt_dominanza_ms` (tempo del primo tocco) e `ts_dominanza` (ora del tocco). Per la versione a due scale restano
  vuote. In `ordine_voti` compare anche la sigla `D` (es. `V-A-D`) e `tempi_storie` somma anche il tempo della dominanza.
- Se un foglio esiste già con l'intestazione della v9 (senza queste colonne), `Code.gs` aggiunge le colonne mancanti
  in fondo senza rinominare il foglio e senza toccare i dati già presenti.
- Le due versioni hanno una sessione salvata nel browser separata (chiave diversa), quindi non si mescolano.
- Il profilo finale torna ad avere 15 profili, con lo stile «timoniere» (dominanza alta).
