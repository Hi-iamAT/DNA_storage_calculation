# GENO_BYTE — DNA Data Storage Explorer

An interactive, offline-capable web companion for academic poster presentations on
**DNA data storage** and **DNA computing**. Attendees scan the built-in QR code and
explore — no technical knowledge required.

## ✨ What visitors can do

| Tab | Experience |
|---|---|
| **1. Molecular Translator** | Type any message (any language, emoji included) and watch it turn into DNA bases A/C/G/T in real time. Simulate sequencing errors with the mutation slider, then press **"Send to Decoder"** to read the DNA back — a full storage write/read cycle in 10 seconds. |
| **2. Density Calculator** | Pick a data size (a phone, Netflix, the whole internet) and see how few micrograms of DNA it would weigh. Auto-updating fun-fact analogies. |
| **3. Storage Pipeline** | Tap through the 5 real stages of DNA storage: encoding → synthesis → encapsulation → sequencing → error-free recovery. |
| **4. Live Poll** | Attendees vote on the future of DNA storage; results update live (saved per device). |

Extra: animated 3D double-helix, plain-language tooltips on every scientific term,
and a "How to Use" 60-second guide in the header.

## 🚀 Running it

**Option A — just open it:** double-click `index.html`. Works offline — all
libraries are vendored in `vendor/` (Tailwind CSS + QRCode.js). Google Fonts
load online but fall back to system fonts offline.

**Option B — tiny local server (nicer URLs, proper clipboard support):**

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

**Option C — publish for the QR code (recommended):**
1. Push this folder to a GitHub repo → **Settings → Pages → deploy from main branch**.
2. Or drag the folder into [Netlify Drop](https://app.netlify.com/drop) — done.
3. Copy the published URL and generate your poster QR with any free online QR
   generator (e.g., qr-code-generator.com or the QR tool built into Chrome's
   share menu). Print that QR on your poster board.

> ⚠️ Publish over **HTTPS** so the one-tap "copy" buttons work on attendees' phones
> (clipboard API requires a secure context; a fallback for long-press copy is included).

## 🔬 Technical notes

- Encoding: 2 bits per nucleotide (`00=A, 01=C, 10=G, 11=T`), full **UTF-8** round-trip
  (emoji, Arabic, Chinese, accents — all verified).
- Bio-metrics: GC-content, homopolymer run detection, Tm estimation (Marmur–Doty),
  oligo partition estimate (120 nt payload chunks).
- Densities: 215 PB/g theoretical (Church 2012 / Goldman 2013), ~10 PB/g practical.
- Benchmarks cited: Church et al. (Science 2012), Goldman et al. (Nature 2013),
  Erlich & Zielinski (Science 2017), Ceze et al. (Nat. Rev. Genetics 2019).

No build step, no backend, no tracking — everything runs in the visitor's browser.
