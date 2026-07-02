/**
 * Privacy Policy — CalcioLab
 * Versione 1.1 — aggiornata al 24 maggio 2026
 * ⚠️ Testo placeholder: far revisionare da un legale prima del go-live
 */
import { useNavigate } from "react-router-dom";

export default function Privacy() {
  const navigate = useNavigate();
  return (
    <div style={s.page}>
      <header style={s.navbar}>
        <button style={s.logoBtn} onClick={() => navigate("/")}>
          <div style={s.logoBolt}>⚡</div>
          <strong style={{ fontSize: 16, color: "white", fontWeight: 900 }}>CalcioLab</strong>
        </button>
        <button style={s.backBtn} onClick={() => navigate("/")}>← Torna alla home</button>
      </header>
      <div style={s.container}>
        <div style={s.header}>
          <span style={s.eyebrow}>Legale</span>
          <h1 style={s.title}>Privacy Policy</h1>
          <p style={s.meta}>Versione 1.1 · Aggiornata al 24 maggio 2026</p>
        </div>

        <Section title="1. Titolare del trattamento">
          <p>
            Il Titolare del trattamento dei dati personali è:
          </p>
          <ul>
            <li><strong>Ragione sociale:</strong> [RAGIONE SOCIALE DA INSERIRE]</li>
            <li><strong>P.IVA / C.F.:</strong> [PARTITA IVA DA INSERIRE]</li>
            <li><strong>Sede legale:</strong> [INDIRIZZO DA INSERIRE], [CAP] [CITTÀ], Italia</li>
            <li><strong>Email:</strong> <a href="mailto:info@calciolab.org" style={s.link}>info@calciolab.org</a></li>
          </ul>
        </Section>

        <Section title="2. Dati raccolti">
          <p>CalcioLab raccoglie le seguenti categorie di dati:</p>
          <ul>
            <li>
              <strong>Dati di registrazione:</strong> nome, cognome, indirizzo email, password (conservata
              in forma hash), ruolo (allenatore, staff, dirigente).
            </li>
            <li>
              <strong>Dati del workspace:</strong> rosa giocatori (nome, numero, posizione, statistiche),
              sedute di allenamento, report partite, tattiche e schemi.
            </li>
            <li>
              <strong>Dati tecnici:</strong> indirizzo IP, tipo di browser, sistema operativo, log di
              accesso, cookie di sessione necessari al funzionamento del servizio.
            </li>
            <li>
              <strong>Dati di pagamento:</strong> gestiti esclusivamente da Stripe; CalcioLab non
              memorizza numeri di carta o dati bancari.
            </li>
            <li>
              <strong>Preferenze di marketing:</strong> consenso alla newsletter (opt-in esplicito),
              conservato con timestamp.
            </li>
          </ul>
        </Section>

        <Section title="3. Finalità e basi giuridiche">
          <ul>
            <li>
              <strong>Esecuzione del contratto (art. 6.1.b GDPR):</strong> creazione e gestione
              dell'account, erogazione del servizio, comunicazioni di servizio.
            </li>
            <li>
              <strong>Consenso (art. 6.1.a GDPR):</strong> invio di newsletter, comunicazioni
              promozionali e aggiornamenti di prodotto (revocabile in qualsiasi momento).
            </li>
            <li>
              <strong>Obbligo legale (art. 6.1.c GDPR):</strong> conservazione delle fatture e dei
              dati fiscali nei termini di legge.
            </li>
            <li>
              <strong>Interesse legittimo (art. 6.1.f GDPR):</strong> sicurezza della piattaforma,
              prevenzione di frodi, miglioramento del servizio tramite dati aggregati anonimi.
            </li>
          </ul>
        </Section>

        <Section title="4. Dati dei giocatori (categorie particolari)">
          <p>
            I dati relativi ai giocatori (minori di età inclusi) sono inseriti dagli Utenti
            (allenatori/dirigenti) sotto la propria responsabilità. L'Utente dichiara di aver
            ottenuto i consensi necessari dai giocatori o dai loro tutori legali, ai sensi
            dell'art. 9 GDPR. CalcioLab non tratta tali dati per finalità proprie.
          </p>
        </Section>

        <Section title="5. Conservazione dei dati">
          <ul>
            <li>
              <strong>Account attivo:</strong> i dati sono conservati per tutta la durata del rapporto
              contrattuale.
            </li>
            <li>
              <strong>Dopo la cancellazione:</strong> i dati del workspace vengono eliminati entro 30
              giorni dalla cancellazione dell'account, salvo obblighi di legge.
            </li>
            <li>
              <strong>Dati fiscali:</strong> conservati per 10 anni ai sensi della normativa fiscale
              italiana.
            </li>
            <li>
              <strong>Log di accesso:</strong> conservati per 90 giorni per finalità di sicurezza.
            </li>
          </ul>
        </Section>

        <Section title="6. Condivisione con terze parti">
          <p>CalcioLab non vende i dati personali. I dati possono essere condivisi con:</p>
          <ul>
            <li>
              <strong>Supabase Inc.</strong> — infrastruttura database e autenticazione (hosting EU
              disponibile).
            </li>
            <li>
              <strong>Stripe Inc.</strong> — elaborazione pagamenti.
            </li>
            <li>
              <strong>Provider email</strong> (es. Resend, SendGrid) — invio di email transazionali e
              newsletter.
            </li>
            <li>
              <strong>Vercel / hosting provider</strong> — distribuzione dell'applicazione web.
            </li>
          </ul>
          <p>
            Tutti i fornitori sono soggetti ad accordi di trattamento dei dati (DPA) conformi al GDPR.
          </p>
        </Section>

        <Section title="7. Trasferimenti internazionali">
          <p>
            Alcuni fornitori (Supabase, Stripe, Vercel) possono trasferire dati al di fuori dello Spazio
            Economico Europeo. Tali trasferimenti avvengono in base a garanzie adeguate: Clausole
            Contrattuali Standard (SCC) approvate dalla Commissione Europea o certificazione
            Data Privacy Framework (DPF) per i trasferimenti verso gli Stati Uniti.
          </p>
        </Section>

        <Section title="8. Cookie e tecnologie di tracciamento">
          <p>
            CalcioLab utilizza esclusivamente cookie tecnici necessari al funzionamento del servizio
            (sessione di autenticazione). Non vengono utilizzati cookie di profilazione o di terze parti
            per finalità pubblicitarie. Non è necessario il consenso per i cookie strettamente tecnici
            ai sensi del Provvedimento del Garante n. 229/2014.
          </p>
        </Section>

        <Section title="9. Diritti dell'interessato">
          <p>
            Ai sensi degli artt. 15–22 GDPR, l'Utente ha il diritto di:
          </p>
          <ul>
            <li><strong>Accesso:</strong> ottenere conferma e copia dei propri dati trattati.</li>
            <li><strong>Rettifica:</strong> correggere dati inesatti o incompleti.</li>
            <li><strong>Cancellazione ("diritto all'oblio"):</strong> richiedere la cancellazione dei dati.</li>
            <li><strong>Limitazione:</strong> limitare il trattamento in determinati casi.</li>
            <li><strong>Portabilità:</strong> ricevere i propri dati in formato strutturato (JSON/CSV).</li>
            <li><strong>Opposizione:</strong> opporsi al trattamento basato sull'interesse legittimo.</li>
            <li><strong>Revoca del consenso:</strong> revocare il consenso alla newsletter in qualsiasi momento.</li>
          </ul>
          <p>
            Per esercitare i propri diritti: <a href="mailto:info@calciolab.org" style={s.link}>info@calciolab.org</a>.
            Il riscontro sarà fornito entro 30 giorni. In caso di mancata risposta, l'Utente può
            rivolgersi al Garante per la Protezione dei Dati Personali (www.garanteprivacy.it).
          </p>
        </Section>

        <Section title="10. Sicurezza">
          <p>
            CalcioLab adotta misure tecniche e organizzative adeguate per proteggere i dati personali:
            crittografia TLS in transito, crittografia a riposo, accesso ai dati basato sul principio del
            minimo privilegio, backup giornalieri, monitoraggio delle anomalie. In caso di violazione dei
            dati (data breach) che comporti un rischio per i diritti degli interessati, il Garante sarà
            notificato entro 72 ore ai sensi dell'art. 33 GDPR.
          </p>
        </Section>

        <Section title="11. Minori">
          <p>
            Il servizio CalcioLab è rivolto a utenti maggiorenni (allenatori, staff, dirigenti). Non è
            consentita la registrazione diretta di minori di 18 anni. I dati dei giocatori minorenni
            inseriti nell'applicazione sono trattati dall'allenatore/società sotto la propria
            responsabilità, previa acquisizione del consenso dei genitori o tutori legali.
          </p>
        </Section>

        <Section title="12. Modifiche alla Privacy Policy">
          <p>
            La presente Privacy Policy può essere aggiornata. Le modifiche sostanziali saranno
            comunicate via email con almeno 15 giorni di anticipo. La versione aggiornata sarà sempre
            disponibile a questo indirizzo. L'utilizzo continuato della Piattaforma dopo la notifica
            costituisce accettazione delle modifiche.
          </p>
        </Section>

        <Section title="13. Contatti DPO e reclami">
          <p>
            Per qualsiasi questione relativa alla privacy:{" "}
            <a href="mailto:info@calciolab.org" style={s.link}>info@calciolab.org</a>
            <br />
            Autorità di controllo competente: Garante per la Protezione dei Dati Personali,
            Piazza di Monte Citorio 121, 00186 Roma —{" "}
            <a href="https://www.garanteprivacy.it" style={s.link} target="_blank" rel="noopener noreferrer">
              www.garanteprivacy.it
            </a>
          </p>
        </Section>

        <div style={s.footer}>
          <p>© {new Date().getFullYear()} CalcioLab — Tutti i diritti riservati</p>
          <p style={{ marginTop: 4 }}>
            <a href="/terms" style={s.footerLink}>Termini di Servizio</a>
            {" · "}
            <a href="/" style={s.footerLink}>Torna alla home</a>
          </p>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section style={s.section}>
      <h2 style={s.sectionTitle}>{title}</h2>
      <div style={s.sectionBody}>{children}</div>
    </section>
  );
}

const s = {
  page: {
    minHeight: "100vh",
    background: "#080b12",
    color: "white",
    fontFamily: "Inter, Arial, sans-serif",
    padding: "0 0 60px",
  },
  navbar: {
    position: "sticky", top: 0, zIndex: 100,
    background: "rgba(8,11,18,0.92)", backdropFilter: "blur(16px)",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
    padding: "0 24px", height: 60,
    display: "flex", alignItems: "center", justifyContent: "space-between",
  },
  logoBtn: {
    display: "flex", alignItems: "center", gap: 10,
    background: "none", border: "none", cursor: "pointer", padding: 0,
  },
  logoBolt: {
    width: 30, height: 30,
    background: "linear-gradient(135deg,#2563eb,#7c3aed)",
    borderRadius: 8, display: "grid", placeItems: "center", fontSize: 14,
  },
  backBtn: {
    background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
    color: "#64748b", fontSize: 13, fontWeight: 700,
    borderRadius: 10, padding: "6px 14px", cursor: "pointer",
  },
  container: { maxWidth: 780, margin: "0 auto", padding: "0 24px" },
  header: {
    padding: "40px 0 32px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    marginBottom: 36,
  },
  eyebrow: {
    display: "inline-block", fontSize: 11, fontWeight: 900,
    textTransform: "uppercase", letterSpacing: 1.5,
    color: "#38bdf8", marginBottom: 12,
  },
  title:    { fontSize: "clamp(28px,5vw,42px)", fontWeight: 900, margin: "0 0 8px", lineHeight: 1.1 },
  meta:     { color: "#64748b", fontSize: 13, margin: 0 },
  section:  { marginBottom: 36 },
  sectionTitle: {
    fontSize: 18, fontWeight: 900, margin: "0 0 14px",
    color: "#e2e8f0", lineHeight: 1.2,
    paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  sectionBody: {
    color: "#94a3b8", lineHeight: 1.75, fontSize: 14,
  },
  link:     { color: "#38bdf8" },
  footer: {
    marginTop: 48, paddingTop: 24,
    borderTop: "1px solid rgba(255,255,255,0.08)",
    color: "#475569", fontSize: 12, lineHeight: 1.6,
  },
  footerLink: { color: "#64748b" },
};
