/**
 * Landing.jsx — pagina pubblica di marketing
 * Visibile a utenti non autenticati su "/"
 * Nessuna dipendenza da auth/Supabase/useTeamData
 */
import { useState } from "react";

/* ─── Dati ────────────────────────────────────────────────────── */
const FEATURES = [
  { icon: "👥", title: "Gestione Rosa",       desc: "Anagrafica completa, status, ruoli, disponibilità e schede individuali per ogni giocatore." },
  { icon: "📋", title: "Allenamenti",          desc: "Pianifica sedute, registra presenze e carico. Libreria esercizi con filtri e categorie." },
  { icon: "⚽", title: "Match Day",            desc: "Distinta ufficiale, piano gara, scouting avversari e report post-partita con statistiche." },
  { icon: "📊", title: "Statistiche",          desc: "Grafici rendimento squadra, top scorer, minutaggio, andamento stagione e gol fatti/subiti." },
  { icon: "🏃", title: "Test Fisici",          desc: "Gacon, Yo-Yo, sprint e lavori individuali. Storico progressi per ogni atleta." },
  { icon: "🎯", title: "Obiettivi Stagione",   desc: "Traguardi di squadra e individuali con avanzamento automatico dai dati partita." },
  { icon: "🤝", title: "Staff Multi-utente",   desc: "Invita assistenti, preparatori e dirigenti. Ogni ruolo vede solo ciò che serve." },
  { icon: "✨", title: "AI Session Builder",   desc: "Genera sedute di allenamento personalizzate basate su obiettivi e disponibilità." },
];

const PLANS = [
  {
    id: "free",
    name: "Starter",
    monthlyPrice: "0",
    yearlyPrice: null,
    badge: null,
    color: "#334155",
    colorEnd: "#1e293b",
    cta: "Inizia gratis",
    ctaVariant: "ghost",
    features: ["Rosa completa con disponibilità", "Calendario stagione", "Sedute base e libreria esercizi", "Lavagna tattica", "Dashboard operativa"],
  },
  {
    id: "premium",
    name: "Premium Coach",
    monthlyPrice: "14,90",
    yearlyPrice: "149",
    badge: "Più scelto",
    color: "#1d4ed8",
    colorEnd: "#1e40af",
    cta: "Prova gratis 14 giorni",
    ctaVariant: "primary",
    features: ["Tutto il piano Starter", "Match Day avanzato", "Report post gara", "Test fisici", "Scouting avversari", "Export PDF", "Statistiche avanzate"],
  },
  {
    id: "club",
    name: "Club",
    monthlyPrice: "49,90",
    yearlyPrice: "449",
    badge: "Completo",
    color: "#15803d",
    colorEnd: "#166534",
    cta: "Contattaci",
    ctaVariant: "ghost",
    features: ["Tutto il piano Premium", "Staff multi-utente", "Area giocatori", "Portale sponsor", "AI Session Builder", "Branding societario"],
  },
];

const FAQS = [
  {
    q: "Posso usare CalcioLab gratis?",
    a: "Sì. Il piano Starter è gratuito per sempre e include rosa completa, calendario, sedute base e lavagna tattica. Non serve carta di credito.",
  },
  {
    q: "Funziona su smartphone?",
    a: "CalcioLab è una Progressive Web App ottimizzata per mobile. Puoi installarla sulla home del tuo telefono direttamente dal browser, senza passare dagli store.",
  },
  {
    q: "Posso cancellare in qualsiasi momento?",
    a: "Assolutamente. Nessun vincolo. Puoi disdire l'abbonamento in qualsiasi momento dal pannello di gestione, e resterai attivo fino alla fine del periodo già pagato.",
  },
  {
    q: "I miei dati sono al sicuro?",
    a: "I dati sono ospitati su Supabase (cloud europeo), crittografati in transito e a riposo. Non vengono mai condivisi con terze parti.",
  },
  {
    q: "Posso invitare il mio staff?",
    a: "Sì, dal piano Club puoi invitare assistenti, preparatori e dirigenti. Ogni membro vede solo le sezioni pertinenti al suo ruolo.",
  },
];

const STATS = [
  { value: "7+",    label: "moduli integrati" },
  { value: "100%",  label: "dati nelle tue mani" },
  { value: "0€",    label: "per iniziare" },
  { value: "14gg",  label: "di trial gratuito" },
];

/* ─── Componente principale ────────────────────────────────────── */
export default function Landing() {
  const [billingPeriod, setBillingPeriod] = useState("monthly");
  const [openFaq, setOpenFaq] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Landing vive in un BrowserRouter separato da App.jsx — usiamo
  // window.location per forzare una navigazione reale verso il login.
  function goToLogin()  { window.location.assign("/login"); }
  function goToSignup() { window.location.assign("/login?mode=register"); }

  return (
    <div style={l.root}>
      <style>{`
        .lnd-nav-links, .lnd-nav-ctas { display: flex; }
        .lnd-hamburger { display: none; }
        @media (max-width: 768px) {
          .lnd-nav-links, .lnd-nav-ctas { display: none !important; }
          .lnd-hamburger { display: flex !important; }
        }
      `}</style>

      {/* ── Navbar ── */}
      <header style={l.nav}>
        <div style={l.navInner}>
          <div style={l.logo}>
            <div style={l.logoBolt}>⚡</div>
            <span style={l.logoText}>CalcioLab</span>
          </div>

          {/* Desktop links */}
          <nav style={l.navLinks} className="lnd-nav-links">
            <a href="#features" style={l.navLink}>Funzioni</a>
            <a href="#pricing" style={l.navLink}>Prezzi</a>
            <a href="#faq" style={l.navLink}>FAQ</a>
          </nav>

          {/* Desktop CTA */}
          <div style={l.navCtas} className="lnd-nav-ctas">
            <button style={l.btnNavLogin} onClick={goToLogin}>Accedi</button>
            <button style={l.btnNavSignup} onClick={goToSignup}>Inizia gratis →</button>
          </div>

          {/* Mobile hamburger */}
          <button
            style={l.hamburger}
            className="lnd-hamburger"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Menu"
          >
            {mobileMenuOpen ? "✕" : "☰"}
          </button>
        </div>

        {/* Mobile dropdown */}
        {mobileMenuOpen && (
          <div style={l.mobileMenu}>
            <a href="#features" style={l.mobileMenuLink} onClick={() => setMobileMenuOpen(false)}>Funzioni</a>
            <a href="#pricing" style={l.mobileMenuLink} onClick={() => setMobileMenuOpen(false)}>Prezzi</a>
            <a href="#faq" style={l.mobileMenuLink} onClick={() => setMobileMenuOpen(false)}>FAQ</a>
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <button style={{ ...l.btnNavLogin, width: "100%", textAlign: "center" }} onClick={() => { goToLogin(); setMobileMenuOpen(false); }}>Accedi</button>
              <button style={{ ...l.btnNavSignup, width: "100%", textAlign: "center" }} onClick={() => { goToSignup(); setMobileMenuOpen(false); }}>Inizia gratis →</button>
            </div>
          </div>
        )}
      </header>

      {/* ── Hero ── */}
      <section style={l.hero}>
        <div style={l.heroInner}>
          <div style={l.heroBadge}>⚽ Piattaforma per allenatori di calcio</div>
          <h1 style={l.heroTitle}>
            Gestisci la squadra<br />
            <span style={l.heroAccent}>come uno staff professionista</span>
          </h1>
          <p style={l.heroSubtitle}>
            Rosa, allenamenti, partite, statistiche e obiettivi stagione — tutto in un'unica piattaforma.
            Gratis per iniziare, potente quando cresci.
          </p>
          <div style={l.heroActions}>
            <button style={l.btnHeroPrimary} onClick={goToSignup}>
              Crea account gratuito →
            </button>
            <button style={l.btnHeroGhost} onClick={goToLogin}>
              Ho già un account
            </button>
          </div>
          <p style={l.heroNote}>Nessuna carta di credito richiesta · Piano gratuito per sempre</p>

          {/* Dashboard mockup */}
          <div style={l.mockup}>
            <div style={l.mockupBar}>
              <span style={{ ...l.mockupDot, background: "#f87171" }} />
              <span style={{ ...l.mockupDot, background: "#fbbf24" }} />
              <span style={{ ...l.mockupDot, background: "#4ade80" }} />
              <span style={l.mockupUrl}>calciolab.it/dashboard</span>
            </div>
            <div style={l.mockupBody}>
              <MockDashboard />
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section style={l.statsSection}>
        <div style={l.statsGrid}>
          {STATS.map((s) => (
            <div key={s.label} style={l.statItem}>
              <strong style={l.statValue}>{s.value}</strong>
              <span style={l.statLabel}>{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" style={l.section}>
        <div style={l.sectionInner}>
          <div style={l.sectionHeader}>
            <span style={l.sectionEyebrow}>Funzionalità</span>
            <h2 style={l.sectionTitle}>Tutto quello che serve a bordo campo</h2>
            <p style={l.sectionSubtitle}>
              Dalla gestione quotidiana della rosa all'analisi post-partita, CalcioLab copre ogni aspetto del lavoro di uno staff tecnico.
            </p>
          </div>
          <div style={l.featuresGrid}>
            {FEATURES.map((f) => (
              <div key={f.title} style={l.featureCard}>
                <div style={l.featureIcon}>{f.icon}</div>
                <h3 style={l.featureTitle}>{f.title}</h3>
                <p style={l.featureDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" style={{ ...l.section, background: "rgba(255,255,255,0.015)" }}>
        <div style={l.sectionInner}>
          <div style={l.sectionHeader}>
            <span style={l.sectionEyebrow}>Prezzi</span>
            <h2 style={l.sectionTitle}>Semplice, trasparente, senza sorprese</h2>
            <p style={l.sectionSubtitle}>Inizia gratis. Upgrada solo quando ne hai bisogno.</p>
          </div>

          {/* Toggle mensile / annuale */}
          <div style={l.periodToggle}>
            <button
              style={{ ...l.periodBtn, ...(billingPeriod === "monthly" ? l.periodBtnActive : {}) }}
              onClick={() => setBillingPeriod("monthly")}
            >
              Mensile
            </button>
            <button
              style={{ ...l.periodBtn, ...(billingPeriod === "yearly" ? l.periodBtnActive : {}) }}
              onClick={() => setBillingPeriod("yearly")}
            >
              Annuale
              <span style={l.savingChip}>fino a –25%</span>
            </button>
          </div>

          <div style={l.pricingGrid}>
            {PLANS.map((plan) => {
              const isFeatured = plan.id === "premium";
              const isYearly = billingPeriod === "yearly" && plan.yearlyPrice;
              const monthlyEq = isYearly
                ? `≈ €${(parseFloat(plan.yearlyPrice) / 12).toFixed(2).replace(".", ",")} / mese`
                : null;
              const discountPct = isYearly
                ? Math.round((1 - parseFloat(plan.yearlyPrice) / (parseFloat(plan.monthlyPrice.replace(",", ".")) * 12)) * 100)
                : null;

              return (
                <div
                  key={plan.id}
                  style={{
                    ...l.planCard,
                    ...(isFeatured ? l.planCardFeatured : {}),
                  }}
                >
                  <div style={{
                    ...l.planHeader,
                    background: `linear-gradient(145deg, ${plan.color}, ${plan.colorEnd})`,
                  }}>
                    <div style={l.planHeaderTop}>
                      <span style={l.planName}>{plan.name}</span>
                      {plan.badge && <span style={l.planBadge}>{plan.badge}</span>}
                    </div>

                    {plan.monthlyPrice === "0" ? (
                      <div style={l.priceBlock}>
                        <strong style={l.priceAmount}>Gratis</strong>
                      </div>
                    ) : isYearly ? (
                      <>
                        <div style={l.priceBlock}>
                          <strong style={l.priceAmount}>€ {plan.yearlyPrice}</strong>
                          <span style={l.pricePer}>/ anno</span>
                          <span style={l.discountBadge}>–{discountPct}%</span>
                        </div>
                        <p style={l.priceMonthlyEq}>{monthlyEq}</p>
                      </>
                    ) : (
                      <div style={l.priceBlock}>
                        <strong style={l.priceAmount}>€ {plan.monthlyPrice}</strong>
                        <span style={l.pricePer}>/ mese</span>
                      </div>
                    )}
                  </div>

                  <div style={l.planBody}>
                    <ul style={l.featureList}>
                      {plan.features.map((f) => (
                        <li key={f} style={l.featureItem}>
                          <span style={l.featureCheck}>✓</span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <button
                      style={{
                        ...l.planCta,
                        ...(plan.ctaVariant === "primary"
                          ? { background: `linear-gradient(135deg, ${plan.color}, ${plan.colorEnd})`, color: "white", border: "none" }
                          : { background: "transparent", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.12)" }),
                      }}
                      onClick={goToSignup}
                    >
                      {plan.cta}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section style={l.ctaBanner}>
        <div style={l.ctaBannerInner}>
          <h2 style={l.ctaBannerTitle}>Pronto a portare il tuo staff al livello successivo?</h2>
          <p style={l.ctaBannerSubtitle}>
            Unisciti a CalcioLab. Inizia gratis, nessun impegno.
          </p>
          <button style={l.btnCtaBig} onClick={goToSignup}>
            Crea account gratuito →
          </button>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" style={l.section}>
        <div style={{ ...l.sectionInner, maxWidth: 720 }}>
          <div style={l.sectionHeader}>
            <span style={l.sectionEyebrow}>Domande frequenti</span>
            <h2 style={l.sectionTitle}>Hai domande?</h2>
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            {FAQS.map((faq, i) => (
              <div key={i} style={l.faqItem}>
                <button
                  style={l.faqQuestion}
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span>{faq.q}</span>
                  <span style={{ fontSize: 18, color: "#475569", transition: "transform 0.2s", transform: openFaq === i ? "rotate(45deg)" : "none" }}>+</span>
                </button>
                {openFaq === i && (
                  <p style={l.faqAnswer}>{faq.a}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={l.footer}>
        <div style={l.footerInner}>
          <div style={l.footerBrand}>
            <div style={l.logo}>
              <div style={l.logoBolt}>⚡</div>
              <span style={{ ...l.logoText, fontSize: 16 }}>CalcioLab</span>
            </div>
            <p style={l.footerTagline}>La piattaforma per allenatori di calcio.</p>
          </div>
          <div style={l.footerLinks}>
            <a href="/terms" style={l.footerLink}>Termini di servizio</a>
            <a href="/privacy" style={l.footerLink}>Privacy Policy</a>
            <button style={l.footerLinkBtn} onClick={goToLogin}>Accedi</button>
            <button style={l.footerLinkBtn} onClick={goToSignup}>Registrati</button>
          </div>
        </div>
        <p style={l.footerCopyright}>© {new Date().getFullYear()} CalcioLab — Tutti i diritti riservati</p>
      </footer>
    </div>
  );
}

/* ─── Mock dashboard ────────────────────────────────────────────── */
function MockDashboard() {
  return (
    <div style={{ display: "grid", gap: 10, padding: "16px" }}>
      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        {[
          { label: "Giocatori", value: "24", color: "#38bdf8" },
          { label: "Partite",   value: "18",  color: "#4ade80" },
          { label: "Gol fatti", value: "34",  color: "#a78bfa" },
          { label: "% Presenze", value: "87%", color: "#fbbf24" },
        ].map((k) => (
          <div key={k.label} style={{ background: "rgba(255,255,255,0.05)", borderRadius: 10, padding: "10px 12px", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p style={{ margin: "0 0 4px", fontSize: 9, color: "#475569", fontWeight: 700, textTransform: "uppercase" }}>{k.label}</p>
            <strong style={{ fontSize: 20, color: k.color, lineHeight: 1 }}>{k.value}</strong>
          </div>
        ))}
      </div>
      {/* Content row */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 8 }}>
        {/* Chart placeholder */}
        <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "12px", border: "1px solid rgba(255,255,255,0.06)", height: 100 }}>
          <p style={{ margin: "0 0 8px", fontSize: 9, color: "#475569", fontWeight: 700, textTransform: "uppercase" }}>Andamento stagione</p>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 56, paddingTop: 4 }}>
            {[40, 55, 50, 70, 65, 80, 75, 90, 85, 95].map((h, i) => (
              <div key={i} style={{ flex: 1, background: `rgba(56,189,248,${0.3 + i * 0.07})`, borderRadius: "3px 3px 0 0", height: `${h}%` }} />
            ))}
          </div>
        </div>
        {/* Players list */}
        <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "12px", border: "1px solid rgba(255,255,255,0.06)", height: 100, overflow: "hidden" }}>
          <p style={{ margin: "0 0 8px", fontSize: 9, color: "#475569", fontWeight: 700, textTransform: "uppercase" }}>Rosa</p>
          {["Bianchi M.", "Rossi F.", "Verdi L."].map((name, i) => (
            <div key={name} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: "#94a3b8" }}>{name}</span>
              <span style={{ fontSize: 10, color: i === 1 ? "#fbbf24" : "#4ade80", fontWeight: 700 }}>{i === 1 ? "Indis." : "Disp."}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Stili ─────────────────────────────────────────────────────── */
const l = {
  root: {
    minHeight: "100vh",
    background: "#080b12",
    color: "white",
    fontFamily: "Inter, Arial, sans-serif",
    overflowX: "hidden",
  },

  /* Navbar */
  nav: {
    position: "sticky",
    top: 0,
    zIndex: 100,
    background: "rgba(8,11,18,0.85)",
    backdropFilter: "blur(16px)",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
  },
  navInner: {
    maxWidth: 1100,
    margin: "0 auto",
    padding: "0 24px",
    height: 64,
    display: "flex",
    alignItems: "center",
    gap: 32,
  },
  logo: { display: "flex", alignItems: "center", gap: 10, flexShrink: 0 },
  logoBolt: {
    width: 34, height: 34,
    background: "linear-gradient(135deg,#2563eb,#7c3aed)",
    borderRadius: 9,
    display: "grid", placeItems: "center",
    fontSize: 16,
  },
  logoText: { fontWeight: 900, fontSize: 18, color: "white" },
  navLinks: { display: "flex", gap: 28, flex: 1 },
  navLink: {
    color: "#64748b", fontSize: 14, fontWeight: 700,
    textDecoration: "none",
    transition: "color 0.15s",
  },
  navCtas: { display: "flex", gap: 10, alignItems: "center", marginLeft: "auto" },
  btnNavLogin: {
    background: "transparent", border: "1px solid rgba(255,255,255,0.15)",
    color: "#94a3b8", borderRadius: 10, padding: "8px 16px",
    fontSize: 13, fontWeight: 700, cursor: "pointer",
  },
  btnNavSignup: {
    background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
    border: "none", color: "white", borderRadius: 10, padding: "8px 18px",
    fontSize: 13, fontWeight: 800, cursor: "pointer",
    boxShadow: "0 4px 16px rgba(37,99,235,0.35)",
  },

  /* Mobile menu */
  hamburger: {
    /* visible only on mobile — toggled via .lnd-hamburger CSS class */
    marginLeft: "auto",
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.15)",
    color: "white",
    fontSize: 20,
    lineHeight: 1,
    cursor: "pointer",
    borderRadius: 10,
    padding: "6px 12px",
    flexShrink: 0,
  },
  mobileMenu: {
    position: "absolute",
    top: 64,
    left: 0,
    right: 0,
    background: "rgba(8,11,18,0.97)",
    backdropFilter: "blur(20px)",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
    padding: "16px 24px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    zIndex: 200,
  },
  mobileMenuLink: {
    color: "#94a3b8",
    fontSize: 16,
    fontWeight: 700,
    textDecoration: "none",
    padding: "10px 0",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
  },

  /* Hero */
  hero: {
    padding: "100px 24px 80px",
    background: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(37,99,235,0.18), transparent)",
  },
  heroInner: { maxWidth: 860, margin: "0 auto", textAlign: "center" },
  heroBadge: {
    display: "inline-block",
    padding: "5px 14px", borderRadius: 999,
    background: "rgba(37,99,235,0.15)",
    border: "1px solid rgba(96,165,250,0.3)",
    color: "#93c5fd", fontSize: 13, fontWeight: 700,
    marginBottom: 28,
  },
  heroTitle: {
    fontSize: "clamp(36px, 6vw, 64px)",
    fontWeight: 900, lineHeight: 1.1,
    margin: "0 0 24px", letterSpacing: -0.5,
  },
  heroAccent: {
    background: "linear-gradient(135deg,#38bdf8,#a78bfa)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  heroSubtitle: {
    fontSize: "clamp(15px, 2vw, 19px)",
    color: "#94a3b8", lineHeight: 1.65,
    maxWidth: 620, margin: "0 auto 36px",
  },
  heroActions: {
    display: "flex", gap: 12, justifyContent: "center",
    flexWrap: "wrap", marginBottom: 16,
  },
  btnHeroPrimary: {
    background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
    border: "none", color: "white", borderRadius: 14,
    padding: "15px 32px", fontSize: 16, fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 8px 32px rgba(37,99,235,0.4)",
  },
  btnHeroGhost: {
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.15)",
    color: "#94a3b8", borderRadius: 14,
    padding: "15px 28px", fontSize: 15, fontWeight: 700,
    cursor: "pointer",
  },
  heroNote: { color: "#334155", fontSize: 12, fontWeight: 600, margin: "0 0 48px" },

  /* Mockup */
  mockup: {
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.10)",
    overflow: "hidden",
    boxShadow: "0 40px 100px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)",
    background: "rgba(15,17,21,0.97)",
    maxWidth: 780, margin: "0 auto",
  },
  mockupBar: {
    height: 36,
    background: "rgba(255,255,255,0.04)",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
    display: "flex", alignItems: "center", gap: 6, padding: "0 14px",
  },
  mockupDot: { width: 10, height: 10, borderRadius: "50%" },
  mockupUrl: {
    flex: 1, textAlign: "center", fontSize: 11,
    color: "#334155", fontFamily: "monospace",
  },
  mockupBody: { minHeight: 180 },

  /* Stats */
  statsSection: {
    borderTop: "1px solid rgba(255,255,255,0.06)",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    padding: "32px 24px",
  },
  statsGrid: {
    maxWidth: 860, margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 16,
  },
  statItem: {
    display: "flex", flexDirection: "column", alignItems: "center",
    gap: 6, padding: "16px 8px",
  },
  statValue: { fontSize: 36, fontWeight: 900, color: "white", lineHeight: 1 },
  statLabel: { fontSize: 13, color: "#475569", fontWeight: 600 },

  /* Sections */
  section: { padding: "80px 24px" },
  sectionInner: { maxWidth: 1100, margin: "0 auto" },
  sectionHeader: { textAlign: "center", marginBottom: 56 },
  sectionEyebrow: {
    display: "inline-block", fontSize: 11, fontWeight: 900,
    textTransform: "uppercase", letterSpacing: 1.5,
    color: "#38bdf8", marginBottom: 14,
  },
  sectionTitle: {
    fontSize: "clamp(26px, 4vw, 40px)", fontWeight: 900,
    margin: "0 0 14px", lineHeight: 1.2,
  },
  sectionSubtitle: {
    color: "#64748b", fontSize: 16, lineHeight: 1.65,
    maxWidth: 600, margin: "0 auto",
  },

  /* Features grid */
  featuresGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))",
    gap: 16,
  },
  featureCard: {
    padding: "24px 22px",
    background: "rgba(255,255,255,0.035)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 18,
    transition: "border-color 0.2s",
  },
  featureIcon: { fontSize: 28, marginBottom: 12 },
  featureTitle: { margin: "0 0 8px", fontSize: 16, fontWeight: 800 },
  featureDesc: { margin: 0, color: "#64748b", fontSize: 13, lineHeight: 1.6 },

  /* Pricing */
  periodToggle: {
    display: "flex", gap: 0, justifyContent: "center", marginBottom: 40,
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 14, overflow: "hidden", width: "fit-content",
    margin: "0 auto 40px",
  },
  periodBtn: {
    padding: "10px 24px", background: "transparent",
    border: "none", color: "#64748b", fontWeight: 800,
    fontSize: 13, cursor: "pointer",
    display: "flex", alignItems: "center", gap: 8,
  },
  periodBtnActive: {
    background: "rgba(56,189,248,0.14)",
    color: "#38bdf8",
  },
  savingChip: {
    background: "rgba(34,197,94,0.2)", color: "#86efac",
    fontSize: 11, fontWeight: 900, padding: "2px 7px",
    borderRadius: 999,
  },
  pricingGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))",
    gap: 18, alignItems: "stretch",
  },
  planCard: {
    display: "flex", flexDirection: "column",
    borderRadius: 20, overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(21,25,34,0.96)",
    boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
  },
  planCardFeatured: {
    border: "1px solid rgba(56,189,248,0.4)",
    boxShadow: "0 0 0 1px rgba(56,189,248,0.2), 0 16px 50px rgba(37,99,235,0.2)",
    transform: "scale(1.02)",
  },
  planHeader: { padding: "24px 22px 20px", color: "white" },
  planHeaderTop: {
    display: "flex", alignItems: "center", gap: 10,
    marginBottom: 14, flexWrap: "wrap",
  },
  planName: { fontSize: 18, fontWeight: 900 },
  planBadge: {
    background: "rgba(255,255,255,0.2)", color: "white",
    fontSize: 10, fontWeight: 900, padding: "3px 9px",
    borderRadius: 999, textTransform: "uppercase",
  },
  priceBlock: { display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 },
  priceAmount: { fontSize: 40, fontWeight: 900, lineHeight: 1 },
  pricePer: { fontSize: 13, opacity: 0.75, fontWeight: 700 },
  discountBadge: {
    background: "rgba(34,197,94,0.22)", color: "#86efac",
    fontSize: 11, fontWeight: 900, padding: "3px 8px",
    borderRadius: 999, alignSelf: "center",
  },
  priceMonthlyEq: {
    margin: "2px 0 0", fontSize: 13,
    fontWeight: 700, color: "rgba(255,255,255,0.6)",
  },
  planBody: {
    flex: 1, display: "flex", flexDirection: "column",
    padding: "20px 22px 22px",
  },
  featureList: {
    flex: 1, listStyle: "none", padding: 0,
    margin: "0 0 20px", display: "grid", gap: 10,
  },
  featureItem: {
    display: "flex", gap: 10, fontSize: 13,
    color: "#cbd5e1", lineHeight: 1.4,
  },
  featureCheck: { color: "#22c55e", fontWeight: 900, flexShrink: 0 },
  planCta: {
    width: "100%", padding: "13px",
    borderRadius: 14, fontWeight: 900,
    fontSize: 15, cursor: "pointer",
    marginTop: "auto", transition: "opacity 0.15s",
  },

  /* CTA Banner */
  ctaBanner: {
    padding: "80px 24px",
    background: "radial-gradient(ellipse 70% 80% at 50% 50%, rgba(37,99,235,0.22), transparent)",
    borderTop: "1px solid rgba(37,99,235,0.2)",
    borderBottom: "1px solid rgba(37,99,235,0.2)",
    textAlign: "center",
  },
  ctaBannerInner: { maxWidth: 600, margin: "0 auto" },
  ctaBannerTitle: {
    fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 900,
    margin: "0 0 14px", lineHeight: 1.2,
  },
  ctaBannerSubtitle: {
    color: "#64748b", fontSize: 16, margin: "0 0 32px", lineHeight: 1.6,
  },
  btnCtaBig: {
    background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
    border: "none", color: "white", borderRadius: 14,
    padding: "16px 40px", fontSize: 17, fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 12px 40px rgba(37,99,235,0.45)",
  },

  /* FAQ */
  faqItem: {
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.025)",
    overflow: "hidden",
  },
  faqQuestion: {
    width: "100%", display: "flex", justifyContent: "space-between",
    alignItems: "center", gap: 16,
    padding: "16px 20px", background: "transparent",
    border: "none", color: "#e2e8f0", fontSize: 15,
    fontWeight: 700, cursor: "pointer", textAlign: "left",
  },
  faqAnswer: {
    margin: 0, padding: "0 20px 18px",
    color: "#64748b", fontSize: 14, lineHeight: 1.7,
  },

  /* Footer */
  footer: {
    borderTop: "1px solid rgba(255,255,255,0.07)",
    padding: "40px 24px 24px",
  },
  footerInner: {
    maxWidth: 1100, margin: "0 auto",
    display: "flex", justifyContent: "space-between",
    alignItems: "flex-start", gap: 24, flexWrap: "wrap",
    marginBottom: 24,
  },
  footerBrand: { display: "flex", flexDirection: "column", gap: 10 },
  footerTagline: { margin: 0, color: "#334155", fontSize: 13 },
  footerLinks: {
    display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap",
  },
  footerLink: { color: "#475569", fontSize: 13, fontWeight: 600, textDecoration: "none" },
  footerLinkBtn: {
    background: "none", border: "none", color: "#475569",
    fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0,
  },
  footerCopyright: {
    maxWidth: 1100, margin: "0 auto",
    color: "#1e293b", fontSize: 12, textAlign: "center",
  },
};
