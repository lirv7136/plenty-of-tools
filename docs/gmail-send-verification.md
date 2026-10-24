# Send with Gmail: Google Cloud setup and verification pack

For the **separate** Google Cloud project `plenty-of-tools-mail` (kept apart from the Storage
Analyser project, whose review is stuck on a CASA audit). Scope: `gmail.send` only, which Google
classes as **sensitive**: verification needed, no CASA security assessment. Until verified, up to
100 users can use it after an "unverified app" warning.

## 1. Project setup (console.cloud.google.com, signed in as lachieirving@gmail.com)

1. **Create project** "Plenty of Tools Mail", ID `plenty-of-tools-mail`. Google asked for a billing
   account on 24 Oct 2026 and the only one offered is "Firebase Payment". Linking it costs
   nothing for this use (Gmail API and OAuth are free), but it is Lachlan's decision.
2. **APIs & Services → Library → Gmail API → Enable.**
3. **Google Auth Platform → Branding:** app name "Plenty of Tools"; support email
   lachieirving@gmail.com; logo `shell/icons/logo-120.png`; home page https://plentyoftools.io;
   privacy policy https://plentyoftools.io/privacy/; terms https://plentyoftools.io/terms/;
   authorised domain `plentyoftools.io` (already verified in Search Console under the same account);
   developer contact lachieirving@gmail.com.
4. **Audience:** External. Publish to "In production" (the unverified cap and warning apply until
   verification passes).
5. **Data Access → Add scope:** `https://www.googleapis.com/auth/gmail.send`. Nothing else.
6. **Clients → Create client → Web application** "Invoice Generator". Authorised JavaScript origins:
   `https://plentyoftools.io` (and `http://127.0.0.1:8765` for local testing). No redirect URIs
   (the token flow uses a popup). Copy the client ID into `site.json` as `gmail_client_id`, build
   and deploy: the "Send with Gmail" button appears only once that is set.

## 2. Scope justification (paste into Data Access)

> Plenty of Tools' Invoice Generator (https://plentyoftools.io/tools/invoice-generator/) lets a
> sole trader or small business create an invoice in the browser and email it to their customer
> with the invoice PDF attached. When the user presses "Send with Gmail", the page requests the
> gmail.send scope and sends that one message, built in the browser, through the Gmail API
> users.messages.send endpoint, from the user's own address, so it appears in their Sent folder.
> The app never reads, lists, modifies or deletes mail; gmail.send is the narrowest scope that
> allows sending. There is no backend: the access token is held only in the memory of the browser
> tab, and the message and PDF go from the user's browser directly to Google. No Google user data
> is stored or transmitted to us. Source code: https://github.com/lirv7136/plenty-of-tools
> (tools/invoice-generator/app.js, static/core.js buildMime).

## 3. Demo video script (about 90 seconds, unlisted YouTube)

1. Show https://plentyoftools.io/tools/invoice-generator/ and the address bar.
2. Click **Try an example**, put **your own second email address** as the customer email.
3. Click **Email to customer**: show the panel with To, Subject and Message.
4. Click **Send with Gmail**: the Google consent screen appears. Pause on it so the app name and
   the single permission ("Send email on your behalf") are readable. Choose the account, Continue.
5. The page says "Sent from your Gmail to …". Switch to Gmail: show the message in **Sent** with
   the PDF attached, then open the PDF.
6. Say (or caption): "The app only sends the message the user writes. It never reads mail. The
   token stays in the browser tab; nothing is sent to our servers."
7. Show https://plentyoftools.io/privacy/ and scroll to the Send with Gmail paragraph.

## 4. After approval

Nothing changes in code. Note the approval date in `docs/STATUS.md`.
