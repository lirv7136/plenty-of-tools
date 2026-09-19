# Post drafts — for Lachlan to rewrite in his own words

Rules that keep these welcome rather than deleted: answer the question the thread actually
asked, first and fully. Say you built the tool. Say what it does not do. One link, at the end,
only if the thread allows links. No superlatives. Reply to follow ups.

**Do not post a claim you have not checked yourself.** The bracketed sentences below are
placeholders: replace them with what actually happened when you tried the tool, or delete
them. Before Post 1, drop a folder of your own HEIC photos into the converter so you can say
how it went. Before Post 2, run your own bank CSV through the finder.

## Post 1 · HEIC photos on Windows · Image Converter

**Where.** Microsoft Community Hub, "How do I convert HEIC files to JPEGs in Windows?"
(techcommunity.microsoft.com/discussions/windows10space/how-do-i-convert-heic-files-to-jpegs-in-windows/4508209).
Posted 2 April 2026, marked solved, still open with a dozen replies. The asker has about
1,000 HEIC photos from an iPhone 16 Pro Max and wants a fast batch conversion on Windows 10.
Existing answers: the HEIF extension plus Paint or Photos (needs the paid HEVC codec), a
desktop converter marked as the solution, a browser converter, a PowerShell script. The
Apple Discussions thread "How to import iPhone photos as JPG instead of HEIC on Windows 11?"
(discussions.apple.com/thread/255973242) is the same question from the other side and takes
the same reply with the first paragraph adjusted.

**Draft.**

> Late to this one, but for anyone landing here with the same problem: the reason the built in
> route is annoying is that Windows needs the HEVC codec to decode HEIC, and Microsoft charges
> for it. Everything else in this thread is a way around that.
>
> I built a free one that avoids the codec entirely. It is a web page, so nothing to install,
> and the decoding happens in your browser rather than on a server, so the photos never
> leave your PC. Drop the folder of HEICs in, choose JPG, pick a size if you want them smaller
> for email, download them one by one or as a ZIP. It also strips the location data on the way
> out, which matters if you are sending photos to strangers, and it tells you which ones had
> GPS in them. It converts one photo at a time in the tab, so a big batch takes a few minutes.
> [Replace with your own result: how many photos you tried and how long it took.]
>
> What it does not do: it will not convert the Live Photo video halves, and it will not keep
> the EXIF, because removing it is the point. If you want to keep the camera data, the HEIF
> extension route above is the right one. Link if useful: plentyoftools.io/tools/image-converter/
> Disclosure, it is my project, open source, no ads or sign up.

## Post 2 · Is a subscription tracker worth paying for · Subscription Finder

**Where.** Search results cannot reach Reddit from here, so find the thread yourself. The
live ones this month are in r/personalfinance and r/AusFinance with titles like "Is Rocket
Money worth it?", "Best app to find subscriptions I forgot about?", or "How do you track
subscriptions?". Pick one from the last two weeks with under 50 comments so a reply is read.
Australian threads are better: Rocket Money does not connect to most Australian banks, which
is a genuine point in the answer.

**Draft.**

> Depends what you want from it. Rocket Money's actual subscription finding is free; the
> Premium tier (about US$7 to 14 a month, you pick) is for the cancellation concierge, the bill
> negotiation and the budgeting. If the question is "what am I paying for that I forgot", you
> do not need to pay anyone, and in Australia most of these apps cannot connect to your bank
> anyway.
>
> The low tech version: export a few months of transactions from your bank as CSV and look for
> anything that repeats at the same amount roughly monthly or yearly. I got tired of doing that
> in a spreadsheet and built a page that does the pattern matching: you drop the CSV in, it
> finds the recurring charges, groups them, and totals them per month. It runs in the browser,
> the CSV is not uploaded anywhere, and there is no account. [Replace with what it found in
> your own CSV, or delete this sentence.]
>
> It will not cancel anything for you and it will not connect to your bank live; you export the
> CSV yourself, which is the trade for it being private. If you want the concierge, that is what
> the paid apps are for. Page is plentyoftools.io/tools/subscription-finder/ , mine, free, open
> source.

## After posting

Note the URL and time of each post in `~/dev/idea-engine/PORTFOLIO.md` under the status log.
Check back the next day and answer replies. The 30 day clock for those two tools starts at the
post, so the first review of them is around 19 October.
