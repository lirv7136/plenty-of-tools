# Google OAuth verification pack — Storage Analyser

Everything needed to submit the restricted scope review for the Google Storage Analyser,
in the order Google's Verification Center asks for it. Lachlan submits from
https://console.cloud.google.com/auth/verification signed in as lachieirving@gmail.com.
Written 2026-09-19 after sign in on plentyoftools.io was confirmed working.

## Before submitting: state check

| Item | Required by Google | Status |
|---|---|---|
| Homepage on a verified domain that describes the app | yes | https://plentyoftools.io/ — domain verified in Search Console (personal account) 2026-09-19 |
| Privacy policy on the same domain, linked from the homepage | yes | https://plentyoftools.io/privacy/ — footer link; carries the Google API Services User Data Policy and Limited Use statement |
| Authorised domain on the Branding page | yes | plentyoftools.io added 2026-09-19 |
| Authorised JavaScript origin on the web client | yes | https://plentyoftools.io added 2026-09-19 |
| App works end to end | yes | Signed in and analysed a real account on 2026-09-19 |
| Publishing status | must be In production to request verification | still Testing; publish as part of the submission (see the note at the end) |
| Demo video on YouTube (unlisted is fine) | yes, for restricted scopes | to record, script below |

## Form fields

**App name:** Plenty of Tools

**App homepage:** https://plentyoftools.io/

**Privacy policy:** https://plentyoftools.io/privacy/

**Terms of service:** https://plentyoftools.io/terms/

**Authorised domains:** plentyoftools.io

**Scopes requested:** `https://www.googleapis.com/auth/drive.metadata.readonly` only.

**Scope justification** (paste into "How will the requested scopes be used?"):

> Plenty of Tools is a set of free, browser only utilities. The Google Storage Analyser shows a
> signed in user what is using their Google storage before they pay for more: the split between
> Drive, trash and Gmail/Photos from the About endpoint, and their own files ranked by size,
> grouped by duplicate checksum, by age and by type, each with a link to open the file in Google
> Drive. To do this it needs to list the user's files with name, size, MIME type, modified time,
> checksum, trashed flag and ownership. drive.metadata.readonly is the narrowest scope that
> returns quotaBytesUsed and md5Checksum for all files the user owns; drive.file would only see
> files the app created, which defeats the purpose. The app never reads file contents, never
> modifies or deletes anything, and does not request any other scope.

**Data handling** (paste into the questions about storage and sharing):

> The app has no backend. All API calls are made from the user's browser directly to Google's
> APIs using a token obtained with Google Identity Services. Metadata is processed in the
> browser tab's memory, displayed to the user, and discarded when the tab is closed or the user
> presses Sign out, which also revokes the token. No Google user data is transmitted to, stored
> on, or processed by any server we operate. Nothing is shared with third parties, no advertising
> or profiling uses the data, and no human at Plenty of Tools can access it. The site is static
> hosting (Cloudflare Pages) with Cloudflare Web Analytics, which records page views only.

**Security assessment:** not applicable. Google requires the CASA assessment for apps that
store or transmit restricted scope data through their own servers. This app has no server; the
data never leaves the browser. State this plainly if the form asks.

## Demo video script (about 90 seconds, unlisted YouTube)

Record the screen at 1080p in a normal browser signed out of Google, with the microphone on
or captions added afterwards. Google wants to see the consent screen, the scopes, and the app
using each scope.

1. Open https://plentyoftools.io/. Say: "Plenty of Tools is a set of free, browser only
   utilities. This is the Google Storage Analyser." Scroll briefly so the footer privacy link
   is visible, then open https://plentyoftools.io/tools/drive-storage-analyser/.
2. Read the on page text aloud: "It asks only for read access to file names, sizes and types.
   It cannot read what is inside your files and cannot delete anything."
3. Click **Sign in with Google**. Choose the account. Show the consent screen and pause on
   it so the scope text is readable: "See information about your Google Drive files." Say:
   "The only permission requested is read only Drive metadata." Click Allow.
4. Let the scan run. Show the quota split, the largest files, the duplicates tab and the
   trash tab. Say: "Everything you see is computed in this browser tab from the metadata.
   Nothing is sent anywhere. The links open the file in Google Drive, where the user decides
   what to delete."
5. Click **Sign out and revoke access**. Say: "Signing out revokes the token. The app keeps
   nothing." Reload the page to show it is signed out.
6. Finish on https://plentyoftools.io/privacy/ and read the Limited Use sentence.

Upload as unlisted, paste the link into the form.

## Publishing status note

Requesting verification requires the app to be In production. Once published, anyone who is
not a test user sees the "Google hasn't verified this app" screen until approval, and the
project accrues a lifetime cap of 100 such users. The analyser page is still `hidden` in
`tools.json`: unlisted, noindex, off the sitemap. Almost nobody will reach it during review,
so the cap is not a practical risk. Flip it to `live` only after Google approves.

Expected timeline for restricted scopes: brand verification within a few days, the scope
review over several weeks, usually with one round of questions by email. Reply to those from
the personal account.
