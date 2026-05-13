import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

function Auth() {
  const [mode, setMode] = useState("login");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    if (!email || !password) {
      alert("Inserisci email e password");
      return;
    }

    if (mode === "register" && (!firstName || !lastName)) {
      alert("Inserisci nome e cognome");
      return;
    }

    setLoading(true);

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          alert(error.message);
          return;
        }
      }

      if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: firstName,
              last_name: lastName,
            },
          },
        });

        if (error) {
          alert(error.message);
          return;
        }

        const user = data.user;

        if (user) {
          const { error: profileError } = await supabase.from("profiles").upsert([
            {
              id: user.id,
              first_name: firstName,
              last_name: lastName,
              email: email,
            },
          ]);

          if (profileError) {
            console.error(profileError);
            alert("Utente creato, ma errore nel salvataggio del profilo.");
            return;
          }
        }

        alert("Registrazione completata. Controlla la mail per confermare l'account.");
        setMode("login");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>CalcioLab</h1>

        <p style={styles.subtitle}>
          {mode === "login"
            ? "Accedi alla tua area allenatore"
            : "Crea il tuo account allenatore"}
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          {mode === "register" && (
            <>
              <input
                style={styles.input}
                type="text"
                placeholder="Nome"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />

              <input
                style={styles.input}
                type="text"
                placeholder="Cognome"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </>
          )}

          <input
            style={styles.input}
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            style={styles.input}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button style={styles.button} type="submit" disabled={loading}>
            {loading
              ? "Attendere..."
              : mode === "login"
              ? "Accedi"
              : "Registrati"}
          </button>
        </form>

        <button
          style={styles.linkButton}
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login"
            ? "Non hai un account? Registrati"
            : "Hai già un account? Accedi"}
        </button>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#0f1115",
    color: "white",
    fontFamily: "Inter, Arial, sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: 420,
    background: "#151922",
    border: "1px solid #252b36",
    borderRadius: 24,
    padding: 32,
  },
  title: {
    fontSize: 34,
    margin: 0,
  },
  subtitle: {
    color: "#9ca3af",
    marginTop: 8,
    marginBottom: 28,
  },
  form: {
    display: "grid",
    gap: 14,
  },
  input: {
    padding: "14px 16px",
    borderRadius: 14,
    border: "1px solid #2c3444",
    background: "#0f1115",
    color: "white",
    fontSize: 15,
    outline: "none",
  },
  button: {
    padding: "14px 16px",
    borderRadius: 14,
    border: "none",
    background: "#22c55e",
    color: "#06130a",
    fontWeight: 700,
    cursor: "pointer",
  },
  linkButton: {
    marginTop: 18,
    background: "transparent",
    border: "none",
    color: "#9ca3af",
    cursor: "pointer",
    fontSize: 14,
  },
};

export default Auth;