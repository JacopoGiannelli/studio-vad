/**
 * Apps Script che riceve le risposte della web app VAD e le scrive nel Google Sheet.
 *
 * Ogni sessione di un partecipante arriva come un'unica richiesta POST (JSON) e
 * diventa:
 *  - N righe nel foglio "risposte": una riga per ogni frase valutata (valenza, arousal, dominanza);
 *  - M righe nel foglio "umore": una riga per ogni rilevazione dello stato d'animo
 *    (protocollo A: all'inizio, dopo la pausa che segue ogni storia, alla fine).
 *
 * Le due web app (solo testi / testi + immagini) scrivono negli stessi fogli:
 * la colonna "versione" dice da quale arriva la riga, la colonna "immagine"
 * il codice dell'immagine mostrata con la frase (es. "IAPS 1050", "OASIS Snake 3").
 *
 * Installazione: Estensioni → Apps Script nel Google Sheet, incolla questo file,
 * poi Distribuisci → Nuova distribuzione → App web (vedi guida).
 * Dopo ogni modifica: Distribuisci → Gestisci distribuzioni → matita →
 * Versione: Nuova versione → Distribuisci (l'URL /exec resta lo stesso).
 */

const NOME_FOGLIO = "risposte";
const INTESTAZIONE = [
  "ricevuto", "sessione", "inizio", "fine", "ordine_storia", "id_storia",
  "n_frase", "frase", "valenza", "arousal", "dominanza", "tempo_ms", "user_agent",
  "versione", "immagine"
];

// Protocollo A: stato d'animo prima di ogni storia e alla fine
const NOME_FOGLIO_UMORE = "umore";
const INTESTAZIONE_UMORE = [
  "ricevuto", "sessione", "momento", "ordine_storia", "id_storia_precedente",
  "id_storia_successiva", "pausa_s", "valenza", "arousal", "tempo_ms", "user_agent",
  "versione"
];

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
    if (!d || !Array.isArray(d.risposte) || d.risposte.length === 0 || d.risposte.length > 500) {
      throw new Error("formato non valido");
    }
    const umore = Array.isArray(d.umore) ? d.umore : [];
    if (umore.length > 50) throw new Error("formato non valido (umore)");

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
        voto_(r.dominanza),
        Number(r.tempo_ms) || "",
        testo_(d.user_agent, 300),
        testo_(d.versione || "testi", 20),
        testo_(r.immagine, 200)
      ];
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
      ];
    });

    scrivi_(foglio_(NOME_FOGLIO, INTESTAZIONE), righe, INTESTAZIONE.length);
    scrivi_(foglio_(NOME_FOGLIO_UMORE, INTESTAZIONE_UMORE), righeUmore, INTESTAZIONE_UMORE.length);
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
  return json_({ ok: true, messaggio: "Web app VAD attiva (protocollo A). Le risposte arrivano via POST." });
}
