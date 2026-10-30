# PDF Editor 3.0 for Android

Same idea as the Windows version: edit text, add text/images/shapes, manage pages. Everything runs on the phone.
The PDF engine is **MuPDF (WebAssembly)**, packaged into an installable Android app with **Capacitor**.

## Get the APK (about 10 minutes, no software to install)

You need a free GitHub account. The APK is built on GitHub's servers.

1. On github.com create a **new repository** (private is fine).
2. Upload **everything in this folder** to it (drag the files in with *Add file → Upload files*).
   Make sure the hidden folder `.github/workflows/build-apk.yml` is included. Easiest: unzip, then drag the
   *contents* of the folder, including `.github`, into the upload page. (Or use git: `git init`, `git add -A`,
   `git commit`, `git push`.)
3. Open the **Actions** tab → **Build Android APK** → **Run workflow**. It also starts on its own after the upload.
4. When it turns green (5–10 min) open the run and download **PDF-Editor-APK** at the bottom. Unzip it:
   inside is `app-debug.apk`.
5. Copy `app-debug.apk` to your phone and tap it. Android will ask to allow *Install unknown apps* for your
   file manager/browser: allow it. Play Protect may warn that the app is unrecognised (it is a debug-signed
   build of your own app): choose *Install anyway*.

If the build fails, open the failed step in the Actions log and send me the red error text.

## Using the app
* **Open PDF** (welcome screen or ⋮ menu). Pinch to zoom, scroll with one finger.
* **Edit text** tool: tap a line, change it, **Apply**. Also: **Select** → tap text → *Edit*, or double-tap it.
* **Add text**: tap where it should go. **Image**: tap where it should go, pick a picture.
* **Shapes**: pick rectangle / ellipse / line, then drag on the page. Shapes can be selected, moved, resized, deleted.
* **Select** tool: tap an object, drag it to move; the bar offers Smaller/Larger, Copy, Cut, Paste, Delete.
* ⋮ menu: Find, Pages (rotate, add blank, move, extract, import, delete), Paste, Fit width, edit by
  line/paragraph, Document properties, Optimize, Import font, theme.
* **Save**: the download button opens Android's share sheet. Choose *Save to Files / Drive / Downloads* (or send it
  to another app). The original file is never overwritten; the saved copy is named `name_edited.pdf`.
* Back button: closes dialogs first; if you have unsaved changes it asks before leaving.

## The character fix (same root cause as on Windows)
Most PDFs embed only the letters their text uses, so J, Z, !, # … may not exist in the document's font. Every line
you edit or add is rewritten with a **complete embedded font** (bundled Liberation / DejaVu), so every letter,
number, punctuation mark and symbol the font contains works, displays, saves and survives reopening.
Menu → *Import font* adds your own .ttf/.otf for the current session.

## Differences from the Windows version
* Shapes are PDF *annotations* (so they can be moved/deleted on a touch screen) rather than page content.
* No printing, no bookmark editing (bookmarks are not shown yet), no "Open with" from other apps (use Open PDF).
* Undo history keeps the last 25 steps (phone memory).
* Same limits as Windows: text is edited line by line (or paragraph by paragraph), keeps original line breaks,
  and uses a full font that can differ slightly from an unusual original typeface.

## What was tested (and what was not)
Tested: the engine in Node (all printable ASCII typed into a PDF whose font lacks J/Z/!/#…, saved, reopened, at page
rotations 0/90/180/270; moving/deleting/adding objects; page operations; password PDFs; read-only detection) and the
whole interface in headless Firefox at a phone-sized window (loading, editing with the problem characters, add text,
select + drag, shapes, undo/redo, search, page manager, zoom). The Android project was generated and synced
successfully with all three plugins.
**Not tested:** the APK build itself (my environment cannot reach the Android SDK), and anything on a real Android
device: pinch-to-zoom with real fingers, the file picker, the share sheet, memory use on very large PDFs.
Please try it and tell me what you see.

## Licences
MuPDF is AGPL-3.0 (source of this app is in this folder, which satisfies the source requirement for personal use).
Liberation fonts: SIL OFL. DejaVu fonts: free licence. Capacitor: MIT.
