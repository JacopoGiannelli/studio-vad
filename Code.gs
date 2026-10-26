/**
 * Apps Script che riceve le risposte della web app VAD e le scrive nel Google Sheet.
 *
 * Le risposte arrivano a "lotti": la web app invia una richiesta POST (JSON) subito dopo
 * ogni risposta, cioè dopo il voto di ogni frase e dopo ogni stato d'animo. Ogni lotto diventa:
 *  - N righe nel foglio "risposte": una riga per ogni frase valutata (valenza, arousal);
 *    la colonna "dominanza" resta per compatibilità con i dati già raccolti, ma ora è vuota;
 *  - M righe nel foglio "umore": una riga per ogni rilevazione dello stato d'animo
 *    (protocollo A: all'inizio, dopo la pausa che segue ogni storia, alla fine).
 *
 * Le due web app (solo testi / testi + immagini) scrivono negli stessi fogli:
 * la colonna "versione" dice da quale arriva la riga, la colonna "immagine"
 * il codice dell'immagine mostrata con la frase (es. "IAPS 1050", "OASIS Snake 3").
 *
 * Oltre ai voti, per ogni frase e ogni stato d'animo arrivano le misure di risposta
 * (colonne in fondo, vedi COLONNE_MISURE): tempo della prima scelta e del voto finale per
 * valenza e arousal (misurati solo mentre quella scala è sullo schermo), prima figura scelta,
 * numero di cambi, pressioni di "Indietro", aperture del pulsante (i), e pagina_nascosta = 1
 * se durante la risposta la persona è passata ad altra scheda o app.
 *
 * Il foglio "lotti" tiene l'elenco dei lotti già scritti: se lo stesso lotto arriva due
 * volte (per esempio perché la risposta di conferma si è persa e la pagina lo rimanda),
 * viene ignorato e le righe non si duplicano.
 *
 * Installazione: Estensioni → Apps Script nel Google Sheet, incolla questo file,
 * poi Distribuisci → Nuova distribuzione → App web (vedi guida).
 * Dopo ogni modifica: Distribuisci → Gestisci distribuzioni → matita →
 * Versione: Nuova versione → Distribuisci (l'URL /exec resta lo stesso).
 */

// Misure di risposta: aggiunte in fondo a "risposte" e "umore" (stessi nomi usati dalla web app).
// I fogli creati con la versione precedente ricevono le colonne nuove in automatico.
const COLONNE_MISURE = [
  "rt_valenza_ms", "rt_arousal_ms", "prima_valenza", "prima_arousal",
  "cambi_valenza", "cambi_arousal", "n_indietro", "n_info", "pagina_nascosta",
  "rt_finale_valenza_ms", "rt_finale_arousal_ms"
];

const NOME_FOGLIO = "risposte";
const INTESTAZIONE = [
  "ricevuto", "sessione", "inizio", "fine", "ordine_storia", "id_storia",
  "n_frase", "frase", "valenza", "arousal", "dominanza", "tempo_ms", "user_agent",
  "versione", "immagine"
].concat(COLONNE_MISURE);

// Registro dei lotti già scritti (serve a scartare gli invii doppi)
const NOME_FOGLIO_LOTTI = "lotti";
const INTESTAZIONE_LOTTI = ["ricevuto", "lotto", "sessione", "righe", "righe_umore"];

// Protocollo A: stato d'animo prima di ogni storia e alla fine
const NOME_FOGLIO_UMORE = "umore";
const INTESTAZIONE_UMORE = [
  "ricevuto", "sessione", "momento", "ordine_storia", "id_storia_precedente",
  "id_storia_successiva", "pausa_s", "valenza", "arousal", "tempo_ms", "user_agent",
  "versione"
].concat(COLONNE_MISURE);

// Restituisce il foglio richiesto, creandolo con l'intestazione se non esiste.
function foglio_(nome, intestazione) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(nome);
  if (!sh) sh = ss.insertSheet(nome);
  if (sh.getLastRow() === 0) {
    sh.appendRow(intestazione);
    sh.setFrozenRows(1);
  } else if (sh.getLastColumn() < intestazione.length) {
    // foglio creato con una versione precedente: aggiunge in fondo le colonne nuove
    sh.getRange(1, 1, 1, intestazione.length).setValues([intestazione]);
  }
  return sh;
}

// Risposta JSON (la pagina legge il campo "ok" per sapere se il salvataggio è riuscito).
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Accetta solo valori interi 1–5: protegge il foglio da dati sporchi o manomessi.
function voto_(v) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 5) throw new Error("voto non valido: " + v);
  return n;
}

// Dominanza: non più richiesta dalla web app; se manca la cella resta vuota.
function votoFacoltativo_(v) {
  return (v === undefined || v === null || v === "") ? "" : voto_(v);
}

// Numero (anche 0) oppure cella vuota: per le misure, dove 0 è un valore valido
// (es. 0 cambi), a differenza di Number(x) || "" che trasformerebbe 0 in vuoto.
function numero_(v) {
  if (v === undefined || v === null || v === "") return "";
  const n = Number(v);
  return isFinite(n) ? n : "";
}
function misure_(r) {
  return COLONNE_MISURE.map(function (k) { return numero_(r[k]); });
}

// Testo "pulito": tronca i campi lunghi ed evita che una cella venga
// interpretata come formula (=, +, -, @ all'inizio).
function testo_(s, max) {
  let t = String(s == null ? "" : s).slice(0, max || 2000);
  if (/^[=+\-@]/.test(t)) t = "'" + t;
  return t;
}

// Scrive tutte le righe con una sola operazione: più veloce di tanti appendRow.
function scrivi_(sh, righe, ncol) {
  if (righe.length) sh.getRange(sh.getLastRow() + 1, 1, righe.length, ncol).setValues(righe);
}

function doPost(e) {
  // Il lock evita che due partecipanti che finiscono nello stesso istante
  // scrivano righe mescolate.
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const d = JSON.parse(e.postData.contents);
    if (!d || !Array.isArray(d.risposte) || d.risposte.length > 500) {
      throw new Error("formato non valido");
    }
    const umore = Array.isArray(d.umore) ? d.umore : [];
    if (umore.length > 50) throw new Error("formato non valido (umore)");
    if (d.risposte.length === 0 && umore.length === 0) throw new Error("lotto vuoto");

    // lotto già ricevuto? allora è un doppio invio: si conferma senza riscrivere
    const lotto = testo_(d.lotto, 100);
    const shLotti = foglio_(NOME_FOGLIO_LOTTI, INTESTAZIONE_LOTTI);
    if (lotto && shLotti.getRange("B:B").createTextFinder(lotto).matchEntireCell(true).findNext()) {
      return json_({ ok: true, duplicato: true });
    }

    const ora = new Date();
    // le righe vengono preparate e controllate tutte PRIMA di scrivere:
    // se un voto non è valido non si scrive niente, né nelle frasi né nell'umore
    const righe = d.risposte.map(function (r) {
      return [
        ora,
        testo_(d.sessione, 64),
        testo_(d.inizio, 40),
        testo_(d.fine, 40),
        Number(r.ordine) || "",
        testo_(r.id_storia, 100),
        Number(r.n_frase) || "",
        testo_(r.frase, 2000),
        voto_(r.valenza),
        voto_(r.arousal),
        votoFacoltativo_(r.dominanza),
        Number(r.tempo_ms) || "",
        testo_(d.user_agent, 300),
        testo_(d.versione || "testi", 20),
        testo_(r.immagine, 200)
      ].concat(misure_(r));
    });
    const righeUmore = umore.map(function (u) {
      return [
        ora,
        testo_(d.sessione, 64),
        testo_(u.momento, 20),
        Number(u.ordine_storia) || "",
        testo_(u.id_storia_precedente, 100),
        testo_(u.id_storia_successiva, 100),
        Number(u.pausa_s) || 0,
        voto_(u.valenza),
        voto_(u.arousal),
        Number(u.tempo_ms) || "",
        testo_(d.user_agent, 300),
        testo_(d.versione || "testi", 20)
      ].concat(misure_(u));
    });

    scrivi_(foglio_(NOME_FOGLIO, INTESTAZIONE), righe, INTESTAZIONE.length);
    scrivi_(foglio_(NOME_FOGLIO_UMORE, INTESTAZIONE_UMORE), righeUmore, INTESTAZIONE_UMORE.length);
    if (lotto) shLotti.appendRow([ora, lotto, testo_(d.sessione, 64), righe.length, righeUmore.length]);
    return json_({ ok: true, righe: righe.length, righe_umore: righeUmore.length });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

// Aprendo l'URL /exec nel browser si vede questo messaggio: utile per controllare
// che la distribuzione funzioni.
function doGet() {
  return json_({ ok: true, messaggio: "Web app VAD attiva (protocollo A, invio a lotti, misure di risposta v2). Le risposte arrivano via POST." });
}
