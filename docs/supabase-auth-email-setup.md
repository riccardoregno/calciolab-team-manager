# CalcioLab - Supabase Auth email setup

Questa guida serve per sostituire le email standard di Supabase Auth con email coerenti con CalcioLab.

## 1. Custom SMTP con OVH

In Supabase Dashboard:

Authentication -> Settings -> SMTP Settings

Valori consigliati:

- Sender name: `CalcioLab`
- Sender email: `no-reply@calciolab.org`
- Host: `ssl0.ovh.net`
- Port: `465` con SSL, oppure `587` con STARTTLS
- Username: `no-reply@calciolab.org`
- Password: password della casella OVH

Se la casella dedicata non esiste ancora, crearla prima in OVH.

## 2. Template Auth

In Supabase Dashboard:

Authentication -> Email Templates

Aggiornare almeno questi template:

- Confirm signup
  - Subject: `Conferma il tuo accesso a CalcioLab`
  - HTML: `supabase/templates/auth/confirm-signup.html`
- Reset password / Recovery
  - Subject: `Reimposta la password CalcioLab`
  - HTML: `supabase/templates/auth/recovery.html`
- Magic Link
  - Subject: `Accedi a CalcioLab`
  - HTML: `supabase/templates/auth/magic-link.html`

## 3. Redirect URL da consentire

In Supabase Dashboard:

Authentication -> URL Configuration

Verificare:

- Site URL: `https://www.calciolab.org`
- Redirect URLs:
  - `https://www.calciolab.org`
  - `https://www.calciolab.org/`
  - `https://calciolab.org`
  - `https://calciolab.org/`
  - `https://www.calciolab.org/reset-password`
  - `https://calciolab.org/reset-password`

## 4. Nota inviti giocatori/staff

La registrazione dell'app ora passa un redirect esplicito a CalcioLab quando Supabase invia la conferma account.
Il token invito resta anche nei metadata utente, quindi dopo la conferma il backend puo' collegare il giocatore o lo staff al profilo corretto.
