/**
 * Termini di Servizio — CalcioLab
 * Versione 1.1 — aggiornata al 24 maggio 2026
 * ⚠️ Testo placeholder: far revisionare da un legale prima del go-live
 */
import { useNavigate } from "react-router-dom";

export default function Terms() {
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
          <h1 style={s.title}>Termini di Servizio</h1>
          <p style={s.meta}>Versione 1.1 · Aggiornata al 24 maggio 2026</p>
        </div>

        <Section title="1. Definizioni">
          <p>
            <strong>"Piattaforma"</strong> indica il servizio software CalcioLab, accessibile via web all'indirizzo
            calciolab.org e relative applicazioni. <strong>"Utente"</strong> indica qualsiasi persona fisica o
            giuridica che crea un account e utilizza la Piattaforma. <strong>"Workspace"</strong> indica l'ambiente
            condiviso di gestione della squadra, che può essere usato da più utenti con ruoli differenti.
          </p>
        </Section>

        <Section title="2. Accettazione dei Termini">
          <p>
            L'utilizzo della Piattaforma implica l'accettazione integrale dei presenti Termini di Servizio e della
            Privacy Policy. Se non si accettano le condizioni, non è possibile utilizzare la Piattaforma.
            I Termini possono essere aggiornati: gli Utenti saranno notificati via email con almeno 30 giorni di
            anticipo per le modifiche sostanziali.
          </p>
        </Section>

        <Section title="3. Creazione dell'account">
          <ul>
            <li>Ogni Utente deve fornire informazioni veritiere e aggiornate durante la registrazione.</li>
            <li>È responsabilità dell'Utente mantenere riservate le proprie credenziali di accesso.</li>
            <li>Un singolo account non può essere condiviso tra più persone fisiche diverse.</li>
            <li>CalcioLab si riserva il diritto di sospendere account in caso di violazione dei presenti Termini.</li>
          </ul>
        </Section>

        <Section title="4. Piani e pagamenti">
          <p>
            CalcioLab offre un piano gratuito ("Starter") con funzionalità base e piani a pagamento
            ("Premium Coach", "Club") con funzionalità avanzate. I prezzi sono indicati nella pagina
            dedicata ai piani. I pagamenti vengono processati tramite Stripe. Le fatture sono emesse
            in formato elettronico e inviate all'indirizzo email dell'account.
          </p>
          <p>
            Il rinnovo è automatico salvo disdetta esplicita entro 24 ore prima del rinnovo.
            Non sono previsti rimborsi per frazioni di periodo già fatturate, salvo quanto previsto
            dalla normativa applicabile (D.Lgs. 206/2005 per i consumatori).
          </p>
        </Section>

        <Section title="5. Utilizzo accettabile">
          <p>Gli Utenti si impegnano a non utilizzare la Piattaforma per:</p>
          <ul>
            <li>Attività illegali o fraudolente.</li>
            <li>Violazione di diritti di terzi (proprietà intellettuale, dati personali, ecc.).</li>
            <li>Tentativi di accesso non autorizzato a sistemi informatici.</li>
            <li>Caricamento di contenuti offensivi, diffamatori o violenti.</li>
            <li>Uso di bot, scraper o strumenti automatizzati senza autorizzazione scritta.</li>
          </ul>
        </Section>

        <Section title="6. Dati e contenuti dell'Utente">
          <p>
            I dati inseriti dall'Utente (rosa, sedute, statistiche, ecc.) rimangono di proprietà
            dell'Utente. CalcioLab non rivendica diritti su tali dati. L'Utente concede a CalcioLab
            una licenza limitata, non esclusiva, per elaborare tali dati al fine di erogare il servizio.
          </p>
          <p>
            CalcioLab adotta misure tecniche e organizzative adeguate a proteggere i dati (crittografia
            in transito e a riposo, backup regolari). I dati possono essere esportati dall'Utente in
            qualsiasi momento tramite la funzione "Export" della Piattaforma.
          </p>
        </Section>

        <Section title="7. Disponibilità del servizio">
          <p>
            CalcioLab si impegna a garantire una disponibilità del servizio del 99,5% su base mensile,
            escluse le manutenzioni programmate comunicate con anticipo. Non si garantisce l'assenza di
            interruzioni e non si risponde dei danni diretti o indiretti derivanti da indisponibilità
            del servizio.
          </p>
        </Section>

        <Section title="8. Limitazione di responsabilità">
          <p>
            Nei limiti consentiti dalla legge applicabile, CalcioLab non è responsabile per danni
            indiretti, incidentali o consequenziali derivanti dall'uso o dall'impossibilità di usare
            la Piattaforma. La responsabilità massima di CalcioLab è limitata all'importo pagato
            dall'Utente nei 12 mesi precedenti all'evento.
          </p>
        </Section>

        <Section title="9. Risoluzione e recesso">
          <p>
            L'Utente può cancellare il proprio account in qualsiasi momento dalla sezione Impostazioni.
            CalcioLab può risolvere il contratto con preavviso di 30 giorni, o immediatamente in caso
            di violazione grave dei presenti Termini. In caso di cancellazione, i dati vengono conservati
            per 30 giorni e poi eliminati definitivamente, salvo obblighi di legge.
          </p>
        </Section>

        <Section title="10. Legge applicabile e foro competente">
          <p>
            I presenti Termini sono regolati dalla legge italiana. Per qualsiasi controversia è
            competente il Foro di [Città], salvo diversa disposizione obbligatoria di legge applicabile
            agli Utenti consumatori (D.Lgs. 206/2005).
          </p>
        </Section>

        <Section title="11. Contatti">
          <p>
            Per domande sui presenti Termini: <a href="mailto:info@calciolab.org" style={s.link}>info@calciolab.org</a><br />
            Per supporto tecnico: <a href="mailto:info@calciolab.org" style={s.link}>info@calciolab.org</a>
          </p>
        </Section>

        <div style={s.footer}>
          <p>© {new Date().getFullYear()} CalcioLab — Tutti i diritti riservati</p>
          <p style={{ marginTop: 4 }}>
            <a href="/privacy" style={s.footerLink}>Privacy Policy</a>
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
