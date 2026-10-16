# Studio VAD – valutazione emotiva di storie (tesi magistrale)

Web app per raccogliere valutazioni di **valenza, arousal e dominanza** (scala SAM a 5 figure)
frase per frase, su storie brevi in prima persona tratte da IDEST
(Kaakinen et al., 2022, *PLOS ONE*) e tradotte in italiano.

## Versioni

| Versione | File | Dove gira |
|---|---|---|
| Solo testi | `index.html` | Online su GitHub Pages: https://jacopogiannelli.github.io/studio-vad/ |
| Testi + immagini | `laboratorio/studio_VAD_testi_immagini.html` | **Solo in laboratorio**, in locale |

La versione con immagini usa immagini **IAPS** e **OASIS**. Le immagini **non sono in questo
repository**: la licenza IAPS ne vieta la diffusione pubblica. Per usarla, il file va copiato
nella cartella `Abbinamenti IDEST immagini`, accanto alla cartella `Dataset immagini` che contiene
`Iaps/images` e `OASIS_database_2016/images`. Se aperta da qui, mostra solo i testi e un avviso.

## Protocollo (uguale nelle due versioni)

1. Stato d'animo iniziale (valenza, arousal).
2. 10 storie estratte a caso; ogni frase compare da sola e si valuta con tre scale SAM
   (valenza, arousal, dominanza), una alla volta.
3. Dopo ogni storia: pausa obbligatoria di 20 s con timer, poi di nuovo lo stato d'animo.
4. Stato d'animo finale; invio delle risposte.

Parametri modificabili in cima allo script di `index.html`: `N_STORIE`, `PAUSA_S`, `APPS_SCRIPT_URL`.

## Salvataggio dei dati

Le risposte vengono inviate (POST, `text/plain` per evitare il preflight CORS) a un Google Apps
Script (`apps-script/Code.gs`) che scrive in un Google Sheet:

- foglio **risposte**: una riga per frase (sessione, storia, frase, valenza, arousal, dominanza,
  tempo di risposta, `versione` = testi/immagini, `immagine` = codice es. `IAPS 1050`);
- foglio **umore**: una riga per ogni rilevazione dello stato d'animo.

Se l'invio fallisce, la pagina offre il download delle risposte in CSV e ne conserva una copia
nel browser.

## Dati

- `dati/storie_IDEST_it.json`: le 196 storie IDEST tradotte in italiano (1:1 frase per frase
  con l'inglese), escluse quelle sotto i 900 caratteri come nel criterio del paper IDEST.
