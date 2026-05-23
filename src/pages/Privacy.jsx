/**
 * Privacy Policy — CalcioLab
 * Versione 1.0 — aggiornata al 2025
 * ⚠️ Testo placeholder: far revisionare da un legale prima del go-live
 */
export default function Privacy() {
  return (
    <div style={s.page}>
      <div style={s.container}>
        <div style={s.header}>
          <div style={s.logoRow}>
            <div style={s.brandMark}>CL</div>
            <strong style={{ fontSize: 18, color: "white" }}>CalcioLab</strong>
          </div>
          <h1 style={s.title}>Privacy Policy</h1>
          <p style={s.meta}>Versione 1.0 · Aggiornata al 1 gennaio 2025</p>
          <a href="/" style={s.backLink}>← Torna al login</a>
        </div>

        <Section title="1. Titolare del trattamento">
          <p>
            Il Titolare del trattamento dei dati personali è <strong>CalcioLab S.r.l.</strong> (o il soggetto
            giuridico responsabile del servizio), con sede in Via Esempio 1, 00000 Città (IT),
            P.IVA IT00000000000, contattabile all'indirizzo{" "}
            <a href="mailto:privacy@calciolab.org" style={s.link}>privacy@calciolab.org</a>.
          </p>
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
            Per esercitare i propri diritti: <a href="mailto:privacy@calciolab.org" style={s.link}>privacy@calciolab.org</a>.
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
            <a href="mailto:privacy@calciolab.org" style={s.link}>privacy@calciolab.org</a>
            <br />
            Autorità di controllo competente: Garante per la Protezione dei Dati Personali,
            Piazza di Monte Citorio 121, 00186 Roma —{" "}
            <a href="https://www.garanteprivacy.it" style={s.link} target="_blank" rel="noopener noreferrer">
              www.garanteprivacy.it
            </a>
          </p>
        </Section>

        <div style={s.footer}>
          <p>CalcioLab · P.IVA IT00000000000 · Via Esempio 1, 00000 Città (IT)</p>
          <p style={{ marginTop: 4 }}>
            <a href="/terms" style={s.footerLink}>Termini di Servizio</a>
            {" · "}
            <a href="/" style={s.footerLink}>Torna al login</a>
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
    background: "#0f1115",
    color: "white",
    fontFamily: "Inter, Arial, sans-serif",
    padding: "0 0 60px",
  },
  container: { maxWidth: 780, margin: "0 auto", padding: "0 24px" },
  header: {
    padding: "40px 0 32px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    marginBottom: 36,
  },
  logoRow: {
    display: "flex", alignItems: "center", gap: 12, marginBottom: 28,
  },
  brandMark: {
    width: 38, height: 38, display: "grid", placeItems: "center",
    borderRadius: 11, background: "rgba(255,255,255,0.1)",
    border: "1px solid rgba(255,255,255,0.15)",
    color: "#e0f2fe", fontWeight: 900, fontSize: 14, flexShrink: 0,
  },
  title:    { fontSize: 36, fontWeight: 900, margin: "0 0 8px", lineHeight: 1.1 },
  meta:     { color: "#64748b", fontSize: 13, margin: "0 0 20px" },
  backLink: { color: "#38bdf8", fontSize: 13, textDecoration: "none", fontWeight: 700 },
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
