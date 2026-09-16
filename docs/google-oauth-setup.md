# Google Storage Analyser — one time setup (Lachlan, ~15 min, then a verification wait)

The tool is built and deployed but stays hidden (unlisted, noindex) until a Google
OAuth client id is in `site.json`. It only needs read only Drive metadata.

1. **Google Cloud project** — console.cloud.google.com, personal Google account
   (not CIM). New project, e.g. `plenty-of-tools`.
2. **Enable the API** — APIs & Services → Library → *Google Drive API* → Enable.
3. **OAuth consent screen** — APIs & Services → OAuth consent screen (Google Auth Platform).
   User type **External**. App name = the brand. Support email = yours.
   App home page = the site URL. **Privacy policy = `<site>/privacy/`** (already built).
   Authorised domain = `plentyoftools.io`.
   Scopes: add `https://www.googleapis.com/auth/drive.metadata.readonly`. Google's Drive
   scope table classes it **restricted** (every Drive scope except `drive.file`, `drive.appdata`
   and `drive.install` is). Restricted means the full app review; the annual security
   assessment only applies to apps that store or transmit the data through their own servers,
   which this tool does not.
4. **Credentials** — Create credentials → OAuth client ID → *Web application*.
   Authorised JavaScript origins: `https://plentyoftools.io` (and later the
   brand domain). No redirect URIs needed (token flow is popup based).
5. Paste the client id into `site.json` → `"google_client_id"`, flip the tool's status in
   `tools.json` from `hidden` to `live`, run `scripts/deploy.sh`.
6. **Publishing status.** In *Testing*, only the test users you list can sign in (max 100)
   and each consent expires after seven days. Switching to *In production* unverified shows
   the "Google hasn't verified this app" screen and caps the project at **100 users for its
   whole lifetime**, so do not publish before verifying. **Submit for verification** with the
   privacy policy URL on the same domain as the home page, a justification for the scope
   ("lists file metadata so the user can see what is using their storage; read only; nothing
   leaves the browser") and a short demo video of the sign in and the tool. Restricted
   scope reviews take weeks. Start it only once the brand domain is live: the verification is
   tied to the authorised domain and a domain change restarts it.

Note: the verification is tied to the authorised domain. Deciding the brand domain before
submitting avoids doing this twice.
