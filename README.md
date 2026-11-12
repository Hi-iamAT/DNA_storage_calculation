# GENO_BYTE — DNA Data Storage, Simply

A deliberately simple, offline-capable web demo for poster presentations on
**DNA data storage**. Attendees scan your QR code and see three things — nothing
to install, nothing to break.

## The 3 features

1. **Type words, get DNA** — type any message (any language, emoji included) and
   watch it convert live into DNA letters A/C/G/T. Paste DNA back in and read it
   out as text — a full write/read cycle.
2. **How heavy is your data in DNA?** — pick a preset (human genome, smartphone,
   all movies ever, the whole internet) or type any GB amount, and see the DNA
   mass at the theoretical 215 PB/g limit and a real-world ~10 PB/g estimate,
   with a fun comparison line.
3. **Vote!** — three one-tap poll questions. One vote per person per question,
   saved on their device, with an honest "change my vote" option. Counts start
   at zero.

## Running it

**Option A — just open it:** double-click `index.html`. Works fully offline —
the only library (Tailwind CSS) is vendored in `vendor/`.

**Option B — tiny local server:**

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

**Option C — publish for your poster QR:** push to GitHub → Settings → Pages,
or drag into [Netlify Drop](https://app.netlify.com/drop). Generate the poster
QR with any free online QR generator pointing at the published URL.

> Publish over **HTTPS** so one-tap copy works on phones (a long-press fallback
> is included for insecure contexts).

## Technical notes

- Encoding: 2 bits/nucleotide (`00=A, 01=C, 10=G, 11=T`), full UTF-8 round-trip.
- Densities: 215 PB/g theoretical (Church 2012 / Goldman 2013), ~10 PB/g practical.
- No backend: poll totals are per-device. For a shared live poll, a free
  Firebase Realtime Database can be added later.

No build step, no backend, no tracking.
