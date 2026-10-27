/**
 * Apps Script che riceve le risposte della web app VAD e le scrive nel Google Sheet.
 * Versione del codice: v3 (90 storie in 6 gruppi, scale VAD, valenza da −2 a +2, niente "Indietro").
 *
 * Le risposte arrivano a "lotti": la web app invia una richiesta POST (JSON) subito dopo
 * ogni risposta, cioè dopo i tre voti di ogni frase e dopo ogni stato d'animo. Ogni lotto diventa:
 *  - righe nel foglio "risposte": una riga per ogni frase valutata
 *    (valenza da −2 a +2, arousal e dominanza da 1 a 5);
 *  - righe nel foglio "umore": una riga per ogni rilevazione dello stato d'animo
 *    (protocollo A: all'inizio, dopo la pausa che segue ogni storia, alla fine; valenza e arousal).
 *
 * Per ogni frase e ogni stato d'animo arrivano anche le misure di risposta:
 *  - rt_valenza_ms, rt_arousal_ms, rt_dominanza_ms: tempo di risposta su ciascuna scala,
 *    contato solo mentre quella scala era sullo schermo (il voto è definitivo al primo tocco);
 *  - n_info: quante volte è stato aperto il pulsante (i);
 *  - pagina_nascosta: 1 se durante la risposta la persona è passata ad altra scheda o app.
 * La colonna "ricevuto" è il timestamp di arrivo nel foglio.
 *
 * Il foglio "lotti" tiene l'elenco dei lotti già scritti: se lo stesso lotto arriva due
 * volte (per esempio perché la risposta di conferma si è persa e la pagina lo rimanda),
 * viene ignorato e le righe non si duplicano.
 *
 * Se un foglio esiste già ma con colonne diverse (versione precedente della web app),
 * NON viene sovrascritto: viene rinominato (es. "risposte_vecchio_2026-10-27") e se ne crea
 * uno nuovo con l'intestazione giusta. Così i dati vecchi restano e quelli nuovi non si mescolano.
 *
 * Installazione: Estensioni → Apps Script nel Google Sheet, incolla questo file,
 * poi Distribuisci → Nuova distribuzione → App web (Esegui come: Me; Chi può accedere: Chiunque).
 * Dopo ogni modifica: Distribuisci → Gestisci distribuzioni → matita →
 * Versione: Nuova versione → Distribuisci (l'URL /exec resta lo stesso).
 */

const VERSIONE_CODICE = "v3";

// ID del Google Sheet "Risposte studio VAD" (la parte dell'indirizzo tra /d/ e /edit).
// Serve se lo script NON è stato creato da Estensioni → Apps Script dentro il foglio:
// in quel caso getActiveSpreadsheet() non trova niente e si apre il foglio con questo ID.
const ID_FOGLIO = "1U8CVtfzR4GjcmlcbJHwFXN7Y4bg2x3LxaGHLHW4wMUE";

// Misure di risposta (stessi nomi usati dalla web app)
const COLONNE_MISURE = ["rt_valenza_ms", "rt_arousal_ms", "rt_dominanza_ms", "n_info", "pagina_nascosta"];

const NOME_FOGLIO = "risposte";
const INTESTAZIONE = [
  "ricevuto", "sessione", "inizio", "fine", "ordine_storia", "id_storia", "gruppo", "tipo_storia",
  "n_frase", "frase", "valenza", "arousal", "dominanza", "tempo_ms"
].concat(COLONNE_MISURE, ["user_agent", "versione", "immagine"]);

// Registro dei lotti già scritti (serve a scartare gli invii doppi)
const NOME_FOGLIO_LOTTI = "lotti";
const INTESTAZIONE_LOTTI = ["ricevuto", "lotto", "sessione", "righe", "righe_umore"];

// Protocollo A: stato d'animo prima di ogni storia e alla fine (solo valenza e arousal)
const NOME_FOGLIO_UMORE = "umore";
const INTESTAZIONE_UMORE = [
  "ricevuto", "sessione", "momento", "ordine_storia", "id_storia_precedente",
  "id_storia_successiva", "pausa_s", "valenza", "arousal", "tempo_ms"
].concat(COLONNE_MISURE, ["user_agent", "versione"]);

// Il Google Sheet: quello a cui è collegato lo script, altrimenti quello con ID_FOGLIO.
function ss_() {
  return SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(ID_FOGLIO);
}

// Restituisce il foglio richiesto, creandolo con l'intestazione se non esiste.
// Se esiste ma ha un'intestazione diversa, lo rinomina e ne crea uno nuovo.
function foglio_(nome, intestazione) {
  const ss = ss_();
  let sh = ss.getSheetByName(nome);
  if (sh && sh.getLastRow() > 0) {
    const ncol = Math.max(sh.getLastColumn(), intestazione.length);
    const attuale = sh.getRange(1, 1, 1, ncol).getValues()[0].map(String);
    const uguale = intestazione.every(function (c, i) { return attuale[i] === c; }) &&
                   attuale.slice(intestazione.length).every(function (c) { return c === ""; });
    if (!uguale) {
      const data = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "Europe/Rome", "yyyy-MM-dd_HHmm");
      sh.setName(nome + "_vecchio_" + data);
      sh = null;
    }
  }
  if (!sh) sh = ss.insertSheet(nome);
  if (sh.getLastRow() === 0) {
    sh.appendRow(intestazione);
    sh.setFrozenRows(1);
  }
  return sh;
}

// Risposta JSON (la pagina legge il campo "ok" per sapere se il salvataggio è riuscito).
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Accetta solo valori interi nell'intervallo [min, max]: protegge il foglio da dati sporchi.
function voto_(v, min, max) {
  const n = Number(v);
  if (v === "" || v === null || v === undefined || !Number.isInteger(n) || n < min || n > max) {
    throw new Error("voto non valido: " + v);
  }
  return n;
}
const valenza_ = function (v) { return voto_(v, -2, 2); };   // −2 … +2 (0 = neutro)
const scala5_ = function (v) { return voto_(v, 1, 5); };     // 1 … 5 (arousal, dominanza)

// Numero (anche 0) oppure cella vuota: per le misure, dove 0 è un valore valido
// (es. pagina_nascosta = 0), a differenza di Number(x) || "" che trasformerebbe 0 in vuoto.
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
  // Il lock evita che due partecipanti che rispondono nello stesso istante
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
      return json_({ ok: true, duplicato: true, codice: VERSIONE_CODICE });
    }

    const ora = new Date();   // timestamp di arrivo ("ricevuto")
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
        numero_(r.gruppo),
        numero_(r.tipo_storia),
        Number(r.n_frase) || "",
        testo_(r.frase, 2000),
        valenza_(r.valenza),
        scala5_(r.arousal),
        scala5_(r.dominanza),
        Number(r.tempo_ms) || ""
      ].concat(misure_(r), [
        testo_(d.user_agent, 300),
        testo_(d.versione || "testi", 20),
        testo_(r.immagine, 200)
      ]);
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
        valenza_(u.valenza),
        scala5_(u.arousal),
        Number(u.tempo_ms) || ""
      ].concat(misure_(u), [
        testo_(d.user_agent, 300),
        testo_(d.versione || "testi", 20)
      ]);
    });

    scrivi_(foglio_(NOME_FOGLIO, INTESTAZIONE), righe, INTESTAZIONE.length);
    scrivi_(foglio_(NOME_FOGLIO_UMORE, INTESTAZIONE_UMORE), righeUmore, INTESTAZIONE_UMORE.length);
    if (lotto) shLotti.appendRow([ora, lotto, testo_(d.sessione, 64), righe.length, righeUmore.length]);
    return json_({ ok: true, righe: righe.length, righe_umore: righeUmore.length, codice: VERSIONE_CODICE });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err), codice: VERSIONE_CODICE });
  } finally {
    lock.releaseLock();
  }
}

// Aprendo l'URL /exec nel browser si vede questo messaggio: utile per controllare
// che la distribuzione funzioni, quale versione del codice gira e su quale foglio scrive.
function doGet() {
  let foglio = "", righe = {};
  try {
    const ss = ss_();
    foglio = ss.getName();
    [NOME_FOGLIO, NOME_FOGLIO_UMORE, NOME_FOGLIO_LOTTI].forEach(function (n) {
      const sh = ss.getSheetByName(n);
      righe[n] = sh ? Math.max(sh.getLastRow() - 1, 0) : "non ancora creato";
    });
  } catch (err) {
    foglio = "ERRORE: " + (err && err.message || err);
  }
  return json_({
    ok: true,
    messaggio: "Web app VAD attiva (codice " + VERSIONE_CODICE + ": 90 storie, VAD, valenza da -2 a +2). Le risposte arrivano via POST.",
    foglio: foglio,
    righe: righe
  });
}
