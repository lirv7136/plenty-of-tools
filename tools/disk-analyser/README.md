# What's Eating My Disk

Pick a folder, see what is using the space. Runs entirely in the browser: no install, no
account, no upload and no server to upload to.

## What it does

- **Treemap** of the chosen folder, sized by real usage, clickable into subfolders with a
  breadcrumb back out.
- **Biggest files**, the top fifty, with folder, size and last modified date.
- **By type**: photos, video, audio, documents, archives, code, installers, disk images.
- **Duplicates by content.** Files that share a size are hashed over their first 64 KB;
  only the ones that still match are read in full. A renamed copy is found, and files that
  merely happen to be the same size are not reported as duplicates.
- **Old and forgotten**: large files not modified in 6 months to 5 years.
- **CSV export** of every file.
- **Removing files**, where the browser allows it.

## Two ways in

| | File System Access API | Folder input |
|---|---|---|
| Browsers | Chromium desktop (Chrome, Edge, Brave, Opera) | all modern browsers, including phones |
| Read and analyse | yes | yes |
| Remove files | yes, after the browser's own permission prompt | no |

The page detects which is available and says which one you are getting. Every report is
identical; only removal differs.

## The removal guard

`removeVerified()` re-reads the file immediately before deleting it and refuses unless it
still matches what was scanned:

| Condition | Result |
|---|---|
| same size, same modified time (within 1 s) | removed |
| size differs | `size-changed`, left alone |
| modified since the scan | `changed-since-scan`, left alone |
| file no longer there | `missing` |
| no write permission | `no-access` |

So a stale scan cannot delete the wrong thing. There is no undo and nothing goes to a
recycle bin, which the page says plainly before asking for confirmation.

`tests/disk-analyser.browser.cjs` exercises this against the origin private file system,
which hands out the same `FileSystemDirectoryHandle` API a chosen folder does. It writes
real files, removes one, and checks that the three refusal cases leave their file on disk.

## Limits

- **A browser cannot see your whole disk.** It sees the folder you hand it. System files,
  application caches, iOS backups and anything outside that folder are invisible.
- **Sizes are logical, not on disk.** Block size, compression, sparse files and macOS
  snapshots mean the operating system's own number will differ.
- **Symbolic links and hard links** are followed as ordinary files, so a hard linked file
  can be counted twice. Deduplicating by content will show such a pair as duplicates.
- **Very large folders.** Scanning is incremental and cancellable; 400,000 files is the cap.
  Hashing reads file contents, so finding duplicates across many gigabytes takes time. The
  minimum size selector exists to keep that sensible.
- **The sample folder is invented.** It exists so the reports can be seen without picking a
  real folder, and its duplicate pairs are backed by real bytes so the duplicate finder
  genuinely runs.
- Not opted into the offline precache: the value is in reading a folder, which needs the
  page open anyway.

## Tests

```bash
node --test tests/disk-analyser.test.cjs     # 16 unit tests: the arithmetic and the treemap
node tests/disk-analyser.browser.cjs         # the page, duplicates over real bytes, the removal guard
```

The unit tests assert the treemap's geometry rather than sample output: that the
rectangles fill their box exactly, sit in proportion to their sizes, never overlap, stay
close to square, and survive empty, single item, zero size and wildly lopsided input.
