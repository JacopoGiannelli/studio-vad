/**
 * Apps Script che riceve le risposte della web app VAD e le scrive nel Google Sheet.
 * Versione del codice: v5 (90 storie in 6 gruppi, scale VAD, valenza da −2 a +2, niente "Indietro",
 * tempi per parametro, tempo totale per storia, questionari PANAS / STAI / BSI-18).
 *
 * Le risposte arrivano a "lotti": la web app invia una richiesta POST (JSON) subito dopo
 * ogni risposta, cioè dopo i tre voti di ogni frase, dopo ogni stato d'animo e (quando la web app
 * li avrà) alla fine di ogni questionario. Ogni lotto diventa:
 *  - righe nel foglio "risposte": una riga per ogni frase valutata
 *    (valenza da −2 a +2, arousal e dominanza da 1 a 5);
 *  - righe nel foglio "umore": una riga per ogni rilevazione dello stato d'animo
 *    (protocollo A: all'inizio, dopo la pausa che segue ogni storia, alla fine; valenza e arousal);
 *  - righe nel foglio "questionari": una riga per ogni questionario compilato, con l'istante di
 *    inizio, l'istante di fine e la durata della compilazione;
 *  - i VOTI dei questionari in un foglio per questionario ("voti_PANAS", "voti_STAI-Y1",
 *    "voti_BSI-18", …): una riga per partecipante e una colonna per item ("item_1", "item_2", …),
 *    comodo per calcolare i punteggi. Le colonne degli item si creano da sole al primo invio;
 *  - il foglio "tempi_storie" viene AGGIORNATO (non solo riempito): una riga per ogni storia di
 *    ogni partecipante, con la somma dei tempi di voto (vedi sotto).
 *
 * Per ogni frase e ogni stato d'animo arrivano anche le misure di risposta:
 *  - rt_valenza_ms, rt_arousal_ms, rt_dominanza_ms: tempo di risposta su ciascuna scala,
 *    contato solo mentre quella scala era sullo schermo (il voto è definitivo al primo tocco).
 *    Nel foglio "umore" ci sono solo rt_valenza_ms e rt_arousal_ms (lo stato d'animo non chiede la dominanza);
 *  - n_info: quante volte è stato aperto il pulsante (i);
 *  - pagina_nascosta: 1 se durante la risposta la persona è passata ad altra scheda o app.
 * La colonna "ricevuto" è il timestamp di arrivo nel foglio.
 *
 * TEMPO PER STORIA (foglio "tempi_storie"), calcolato qui, senza modifiche alla web app:
 *  - tempo_umore_prima_ms = rt_valenza_ms + rt_arousal_ms della domanda "come ti senti" mostrata
 *    PRIMA di quella storia (all'inizio per la storia 1, dopo la pausa per le altre);
 *  - tempo_frasi_ms = somma di rt_valenza_ms + rt_arousal_ms + rt_dominanza_ms di tutte le frasi
 *    della storia;
 *  - tempo_storia_ms = tempo_umore_prima_ms + tempo_frasi_ms.
 * La riga si aggiorna a ogni frase che arriva: a storia finita contiene il totale.
 * Lo stato d'animo finale (dopo l'ultima storia) non appartiene a nessuna storia e non viene sommato.
 *
 * QUESTIONARI: formato atteso nel lotto (la web app li invierà quando saranno inseriti i testi):
 *   "questionari": [
 *     { "questionario": "PANAS",               // oppure "STAI-Y1", "STAI-Y2", "BSI-18", …
 *       "inizio": "2026-10-27T15:00:00.000Z",  // comparsa della prima domanda del questionario
 *       "fine":   "2026-10-27T15:03:12.500Z",  // conferma dell'ultima risposta
 *       "durata_ms": 192500,                   // facoltativa: se manca si calcola da fine − inizio
 *       "risposte": { "1": 3, "2": 5, … } }    // item → risposta (oppure [{ "item": "1", "risposta": 3 }, …])
 *   ]
 *
 * Il foglio "lotti" tiene l'elenco dei lotti già scritti: se lo stesso lotto arriva due
 * volte (per esempio perché la risposta di conferma si è persa e la pagina lo rimanda),
 * viene ignorato: le righe non si duplicano e i tempi per storia non si sommano due volte.
 *
 * Se un foglio esiste già ma con colonne diverse (versione precedente della web app),
 * NON viene sovrascritto: viene rinominato (es. "risposte_vecchio_2026-10-27_1539") e se ne crea
 * uno nuovo con l'intestazione giusta. Così i dati vecchi restano e quelli nuovi non si mescolano.
 *
 * Installazione: Estensioni → Apps Script nel Google Sheet, incolla questo file,
 * poi Distribuisci → Nuova distribuzione → App web (Esegui come: Me; Chi può accedere: Chiunque).
 * Dopo ogni modifica: Distribuisci → Gestisci distribuzioni → matita →
 * Versione: Nuova versione → Distribuisci (l'URL /exec resta lo stesso).
 */

const VERSIONE_CODICE = "v5";

// ID del Google Sheet "Risposte studio VAD" (la parte dell'indirizzo tra /d/ e /edit).
// Serve se lo script NON è stato creato da Estensioni → Apps Script dentro il foglio:
// in quel caso getActiveSpreadsheet() non trova niente e si apre il foglio con questo ID.
const ID_FOGLIO = "1U8CVtfzR4GjcmlcbJHwFXN7Y4bg2x3LxaGHLHW4wMUE";

// Misure di risposta (stessi nomi usati dalla web app)
const COLONNE_MISURE = ["rt_valenza_ms", "rt_arousal_ms", "rt_dominanza_ms", "n_info", "pagina_nascosta"];
// nello stato d'animo la dominanza non si chiede: niente rt_dominanza_ms
const COLONNE_MISURE_UMORE = ["rt_valenza_ms", "rt_arousal_ms", "n_info", "pagina_nascosta"];

const NOME_FOGLIO = "risposte";
const INTESTAZIONE = [
  "ricevuto", "sessione", "inizio", "fine", "ordine_storia", "id_storia", "gruppo", "tipo_storia",
  "n_frase", "frase", "valenza", "arousal", "dominanza"
].concat(COLONNE_MISURE, ["user_agent", "versione", "immagine"]);

// Registro dei lotti già scritti (serve a scartare gli invii doppi)
const NOME_FOGLIO_LOTTI = "lotti";
const INTESTAZIONE_LOTTI = ["ricevuto", "lotto", "sessione", "righe", "righe_umore"];

// Protocollo A: stato d'animo prima di ogni storia e alla fine (solo valenza e arousal)
const NOME_FOGLIO_UMORE = "umore";
const INTESTAZIONE_UMORE = [
  "ricevuto", "sessione", "momento", "ordine_storia", "id_storia_precedente",
  "id_storia_successiva", "pausa_s", "valenza", "arousal"
].concat(COLONNE_MISURE_UMORE, ["user_agent", "versione"]);

// Tempo totale per storia: una riga per (sessione, storia), aggiornata a ogni frase.
// "chiave" = sessione|ordine_storia, serve allo script per ritrovare la riga da aggiornare.
const NOME_FOGLIO_TEMPI = "tempi_storie";
const INTESTAZIONE_TEMPI = [
  "aggiornato", "sessione", "ordine_storia", "id_storia", "gruppo", "tipo_storia", "n_frasi_votate",
  "tempo_umore_prima_ms", "tempo_frasi_ms", "tempo_storia_ms", "chiave"
];
const COL_TEMPI = {};   // nome colonna → numero di colonna (1 = A)
INTESTAZIONE_TEMPI.forEach(function (c, i) { COL_TEMPI[c] = i + 1; });

// Questionari: una riga per questionario (tempi) e una riga per item (risposte)
const NOME_FOGLIO_QUEST = "questionari";
const INTESTAZIONE_QUEST = [
  "ricevuto", "sessione", "questionario", "inizio", "fine", "durata_ms", "n_item", "user_agent", "versione"
];
// Voti dei questionari: un foglio per questionario, "voti_" + nome (es. "voti_PANAS")
const PREFISSO_VOTI = "voti_";

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
// come numero_, ma una cella vuota vale 0: serve per sommare i tempi
function zero_(v) { const n = numero_(v); return n === "" ? 0 : n; }
function misure_(r, colonne) {
  return (colonne || COLONNE_MISURE).map(function (k) { return numero_(r[k]); });
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

// ---------- tempo per storia ----------
// Aggiunge tempi alla riga (sessione, ordine_storia) del foglio "tempi_storie", creandola se manca.
// agg = { id_storia, gruppo, tipo_storia, umore_ms, frasi_ms, n_frasi } (i campi assenti non cambiano)
function aggiornaTempoStoria_(sh, ora, sessione, ordine, agg) {
  const chiave = sessione + "|" + ordine;
  const trovata = sh.getRange(1, COL_TEMPI.chiave, Math.max(sh.getLastRow(), 1), 1)
                    .createTextFinder(chiave).matchEntireCell(true).findNext();
  let riga, valori;
  if (trovata) {
    riga = trovata.getRow();
    valori = sh.getRange(riga, 1, 1, INTESTAZIONE_TEMPI.length).getValues()[0];
  } else {
    riga = sh.getLastRow() + 1;
    valori = INTESTAZIONE_TEMPI.map(function () { return ""; });
    valori[COL_TEMPI.sessione - 1] = sessione;
    valori[COL_TEMPI.ordine_storia - 1] = ordine;
    valori[COL_TEMPI.chiave - 1] = chiave;
  }
  const v = function (c) { return zero_(valori[COL_TEMPI[c] - 1]); };
  const metti = function (c, x) { valori[COL_TEMPI[c] - 1] = x; };
  if (agg.id_storia) metti("id_storia", agg.id_storia);
  if (agg.gruppo !== undefined && agg.gruppo !== "") metti("gruppo", agg.gruppo);
  if (agg.tipo_storia !== undefined && agg.tipo_storia !== "") metti("tipo_storia", agg.tipo_storia);
  metti("n_frasi_votate", v("n_frasi_votate") + (agg.n_frasi || 0));
  metti("tempo_umore_prima_ms", v("tempo_umore_prima_ms") + (agg.umore_ms || 0));
  metti("tempo_frasi_ms", v("tempo_frasi_ms") + (agg.frasi_ms || 0));
  metti("tempo_storia_ms", v("tempo_umore_prima_ms") + v("tempo_frasi_ms"));
  metti("aggiornato", ora);
  sh.getRange(riga, 1, 1, INTESTAZIONE_TEMPI.length).setValues([valori]);
}

// ---------- questionari ----------
// Trasforma le risposte di un questionario in una lista [{item, risposta}]:
// accetta sia un oggetto { "1": 3, "2": 5 } sia una lista [{ item: "1", risposta: 3 }].
function itemQuestionario_(r) {
  let lista = [];
  if (Array.isArray(r)) lista = r.map(function (x) { return { item: x && x.item, risposta: x && x.risposta }; });
  else if (r && typeof r === "object") lista = Object.keys(r).map(function (k) { return { item: k, risposta: r[k] }; });
  if (lista.length > 100) throw new Error("questionario con troppi item");
  return lista.map(function (x) {
    const n = numero_(x.risposta);
    return { item: testo_(x.item, 40), risposta: n !== "" ? n : testo_(x.risposta, 200) };
  });
}
// Foglio dei voti di un questionario: una riga per partecipante, una colonna per item.
// Le colonne "item_<n>" che mancano vengono aggiunte in fondo all'intestazione, così il foglio
// si adatta da solo al numero di item (20 per PANAS e STAI-Y1, 18 per BSI-18, …).
function scriviVoti_(ora, sessione, nome, item) {
  const ss = ss_();
  const nomeFoglio = PREFISSO_VOTI + nome.replace(/[^A-Za-z0-9_\-]/g, "_");
  let sh = ss.getSheetByName(nomeFoglio);
  if (!sh) { sh = ss.insertSheet(nomeFoglio); }
  if (sh.getLastRow() === 0) { sh.appendRow(["ricevuto", "sessione"]); sh.setFrozenRows(1); }
  let testa = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  const nuove = item.map(function (x) { return "item_" + x.item; })
                    .filter(function (c, i, a) { return testa.indexOf(c) === -1 && a.indexOf(c) === i; });
  if (nuove.length) {
    testa = testa.concat(nuove);
    sh.getRange(1, 1, 1, testa.length).setValues([testa]);
  }
  const riga = testa.map(function () { return ""; });
  riga[testa.indexOf("ricevuto")] = ora;
  riga[testa.indexOf("sessione")] = sessione;
  item.forEach(function (x) { riga[testa.indexOf("item_" + x.item)] = x.risposta; });
  sh.getRange(sh.getLastRow() + 1, 1, 1, testa.length).setValues([riga]);
}

// Durata della compilazione: quella misurata dalla web app, altrimenti fine − inizio.
function durataQuestionario_(q) {
  const d = numero_(q.durata_ms);
  if (d !== "") return Math.round(d);
  const t0 = new Date(q.inizio).getTime(), t1 = new Date(q.fine).getTime();
  return (isFinite(t0) && isFinite(t1) && t1 >= t0) ? t1 - t0 : "";
}

function doPost(e) {
  // Il lock evita che due partecipanti che rispondono nello stesso istante
  // scrivano righe mescolate (e che la stessa riga dei tempi venga aggiornata da due invii insieme).
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const d = JSON.parse(e.postData.contents);
    if (!d || typeof d !== "object") throw new Error("formato non valido");
    const risposte = Array.isArray(d.risposte) ? d.risposte : [];
    const umore = Array.isArray(d.umore) ? d.umore : [];
    const questionari = Array.isArray(d.questionari) ? d.questionari : [];
    if (risposte.length > 500) throw new Error("formato non valido");
    if (umore.length > 50) throw new Error("formato non valido (umore)");
    if (questionari.length > 10) throw new Error("formato non valido (questionari)");
    if (risposte.length === 0 && umore.length === 0 && questionari.length === 0) throw new Error("lotto vuoto");

    // lotto già ricevuto? allora è un doppio invio: si conferma senza riscrivere
    const lotto = testo_(d.lotto, 100);
    const shLotti = foglio_(NOME_FOGLIO_LOTTI, INTESTAZIONE_LOTTI);
    if (lotto && shLotti.getRange("B:B").createTextFinder(lotto).matchEntireCell(true).findNext()) {
      return json_({ ok: true, duplicato: true, codice: VERSIONE_CODICE });
    }

    const ora = new Date();   // timestamp di arrivo ("ricevuto")
    const sessione = testo_(d.sessione, 64);
    // le righe vengono preparate e controllate tutte PRIMA di scrivere:
    // se un voto non è valido non si scrive niente, né nelle frasi né nell'umore né nei questionari
    const righe = risposte.map(function (r) {
      return [
        ora,
        sessione,
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
        scala5_(r.dominanza)
      ].concat(misure_(r), [
        testo_(d.user_agent, 300),
        testo_(d.versione || "testi", 20),
        testo_(r.immagine, 200)
      ]);
    });
    const righeUmore = umore.map(function (u) {
      return [
        ora,
        sessione,
        testo_(u.momento, 20),
        Number(u.ordine_storia) || "",
        testo_(u.id_storia_precedente, 100),
        testo_(u.id_storia_successiva, 100),
        Number(u.pausa_s) || 0,
        valenza_(u.valenza),
        scala5_(u.arousal)
      ].concat(misure_(u, COLONNE_MISURE_UMORE), [
        testo_(d.user_agent, 300),
        testo_(d.versione || "testi", 20)
      ]);
    });
    const righeQuest = [], votiQuest = [];
    questionari.forEach(function (q) {
      const nome = testo_(q && q.questionario, 30);
      if (!nome) throw new Error("questionario senza nome");
      const item = itemQuestionario_(q.risposte);
      righeQuest.push([ora, sessione, nome, testo_(q.inizio, 40), testo_(q.fine, 40), durataQuestionario_(q),
                       item.length, testo_(d.user_agent, 300), testo_(d.versione || "testi", 20)]);
      votiQuest.push({ nome: nome, item: item });
    });

    if (righe.length) scrivi_(foglio_(NOME_FOGLIO, INTESTAZIONE), righe, INTESTAZIONE.length);
    if (righeUmore.length) scrivi_(foglio_(NOME_FOGLIO_UMORE, INTESTAZIONE_UMORE), righeUmore, INTESTAZIONE_UMORE.length);
    if (righeQuest.length) {
      scrivi_(foglio_(NOME_FOGLIO_QUEST, INTESTAZIONE_QUEST), righeQuest, INTESTAZIONE_QUEST.length);
      votiQuest.forEach(function (q) { scriviVoti_(ora, sessione, q.nome, q.item); });
    }

    // tempo per storia: stato d'animo PRIMA della storia + tutte le sue frasi
    if (righe.length || righeUmore.length) {
      const shTempi = foglio_(NOME_FOGLIO_TEMPI, INTESTAZIONE_TEMPI);
      umore.forEach(function (u) {
        const ordine = Number(u.ordine_storia);
        if (!ordine || u.momento === "fine") return;          // lo stato d'animo finale non è di nessuna storia
        aggiornaTempoStoria_(shTempi, ora, sessione, ordine, {
          id_storia: testo_(u.id_storia_successiva, 100),
          umore_ms: zero_(u.rt_valenza_ms) + zero_(u.rt_arousal_ms)
        });
      });
      risposte.forEach(function (r) {
        const ordine = Number(r.ordine);
        if (!ordine) return;
        aggiornaTempoStoria_(shTempi, ora, sessione, ordine, {
          id_storia: testo_(r.id_storia, 100), gruppo: numero_(r.gruppo), tipo_storia: numero_(r.tipo_storia),
          n_frasi: 1,
          frasi_ms: zero_(r.rt_valenza_ms) + zero_(r.rt_arousal_ms) + zero_(r.rt_dominanza_ms)
        });
      });
    }

    if (lotto) shLotti.appendRow([ora, lotto, sessione, righe.length, righeUmore.length]);
    return json_({ ok: true, righe: righe.length, righe_umore: righeUmore.length,
                   questionari: righeQuest.length, codice: VERSIONE_CODICE });
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
    const voti = ss.getSheets().map(function (sh) { return sh.getName(); })
                   .filter(function (n) { return n.indexOf(PREFISSO_VOTI) === 0; });
    [NOME_FOGLIO, NOME_FOGLIO_UMORE, NOME_FOGLIO_TEMPI, NOME_FOGLIO_QUEST].concat(voti, [NOME_FOGLIO_LOTTI])
      .forEach(function (n) {
        const sh = ss.getSheetByName(n);
        righe[n] = sh ? Math.max(sh.getLastRow() - 1, 0) : "non ancora creato";
      });
  } catch (err) {
    foglio = "ERRORE: " + (err && err.message || err);
  }
  return json_({
    ok: true,
    messaggio: "Web app VAD attiva (codice " + VERSIONE_CODICE + ": 90 storie, VAD, valenza da -2 a +2, tempi per parametro, " +
               "tempi per storia, questionari). Le risposte arrivano via POST.",
    foglio: foglio,
    righe: righe
  });
}
