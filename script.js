/**
 * GENO_BYTE — SIMPLE DNA DATA STORAGE DEMO
 * Three features: Text <-> DNA, Data -> weight, Poll.
 * Everything runs locally in the browser.
 */

// ============================================================================
// 1. CONSTANTS & STATE
// ============================================================================

const DNA_MAP = { '00': 'A', '01': 'C', '10': 'G', '11': 'T' };
const REV_DNA_MAP = { A: '00', C: '01', G: '10', T: '11' };

// 215 PB per gram theoretical (Church 2012 / Goldman 2013), ~10 PB/g practical
const THEORETICAL_GB_PER_GRAM = 215_000_000;
const PRACTICAL_GB_PER_GRAM = 10_000_000;

const appState = {
    currentDna: '',
    pollVotes: {
        trust: { yes: 0, unsure: 0, no: 0 },
        timeline: { soon: 0, decade: 0, distant: 0 },
        bottleneck: { cost: 0, speed: 0, error: 0 }
    },
    myVotes: { trust: null, timeline: null, bottleneck: null },
    userVoted: { trust: false, timeline: false, bottleneck: false }
};

// ============================================================================
// 2. UTILITIES
// ============================================================================

function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('opacity-0');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.add('opacity-0'), 2200);
}

/** Clipboard with fallback for file:// and insecure origins */
function copyToClipboard(text, successMessage) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text)
            .then(() => showToast(successMessage))
            .catch(() => legacyCopy(text, successMessage));
    } else {
        legacyCopy(text, successMessage);
    }
}

function legacyCopy(text, successMessage) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
        document.execCommand('copy');
        showToast(successMessage);
    } catch (e) {
        showToast('Copy failed — select the text manually.');
    }
    document.body.removeChild(ta);
}

// ============================================================================
// 3. TEXT -> DNA -> TEXT
// ============================================================================

function initConverter() {
    const textInput = document.getElementById('textInput');
    const dnaInput = document.getElementById('dnaInput');

    if (textInput) {
        textInput.addEventListener('input', encodeTextToDna);
        encodeTextToDna(); // initial example
    }

    const copyBtn = document.getElementById('btn-copy-dna');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            if (appState.currentDna) copyToClipboard(appState.currentDna, 'DNA copied!');
        });
    }

    const roundtripBtn = document.getElementById('btn-roundtrip');
    if (roundtripBtn) {
        roundtripBtn.addEventListener('click', () => {
            if (!appState.currentDna || !dnaInput) return;
            dnaInput.value = appState.currentDna;
            decodeDnaToText();
            showToast('DNA placed below — it reads back as your text!');
            dnaInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
    }

    if (dnaInput) dnaInput.addEventListener('input', decodeDnaToText);
}

function encodeTextToDna() {
    const inputEl = document.getElementById('textInput');
    const out = document.getElementById('dnaOut');
    if (!inputEl || !out) return;

    const input = inputEl.value;
    if (!input) {
        out.innerHTML = '<span class="text-slate-600">Type something above…</span>';
        appState.currentDna = '';
        return;
    }

    // UTF-8: works for emoji, accents and any language
    let binary = '';
    for (const byte of new TextEncoder().encode(input)) {
        binary += byte.toString(2).padStart(8, '0');
    }

    let dna = '';
    for (let i = 0; i < binary.length; i += 2) {
        dna += DNA_MAP[binary.substring(i, i + 2)];
    }
    appState.currentDna = dna;

    // Colored letters keep it fun but simple
    out.innerHTML = [...dna].map(b => `<span class="dna-${b.toLowerCase()}">${b}</span>`).join('');
}

function decodeDnaToText() {
    const dnaInput = document.getElementById('dnaInput');
    const out = document.getElementById('textOut');
    if (!dnaInput || !out) return;

    const raw = dnaInput.value.toUpperCase().replace(/[^ACTG]/g, '');

    // Only rewrite when changed, preserving the caret
    if (dnaInput.value !== raw) {
        const caret = dnaInput.selectionStart;
        dnaInput.value = raw;
        if (caret !== null) dnaInput.setSelectionRange(Math.min(caret, raw.length), Math.min(caret, raw.length));
    }

    if (!raw) {
        out.innerHTML = '<span class="text-slate-600">Paste DNA letters above…</span>';
        return;
    }

    let binary = '';
    for (const c of raw) binary += REV_DNA_MAP[c] || '00';

    const bytes = [];
    for (let i = 0; i + 8 <= binary.length; i += 8) {
        bytes.push(parseInt(binary.substring(i, i + 8), 2));
    }

    let text = bytes.length ? new TextDecoder('utf-8').decode(new Uint8Array(bytes)) : '';

    if (text.includes('\uFFFD') || binary.length % 8 !== 0) {
        text += ' ⚠ (a few DNA letters seem missing or corrupted)';
    }
    out.textContent = text || 'Nothing readable yet…';
}

// ============================================================================
// 4. DATA -> DNA WEIGHT
// ============================================================================

function initCalculator() {
    const gbInput = document.getElementById('gbInput');
    if (gbInput) gbInput.addEventListener('input', () => {
        const v = parseFloat(gbInput.value);
        if (!isNaN(v) && v > 0) updateWeight(v);
    });

    const presets = [
        { id: 'btn-genome', gb: 3 },
        { id: 'btn-phone', gb: 256 },
        { id: 'btn-movies', gb: 50_000_000 },        // ~50 PB
        { id: 'btn-internet', gb: 175_000_000_000 }  // ~175 ZB
    ];
    presets.forEach(({ id, gb }) => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', () => {
            document.getElementById('gbInput').value = gb;
            updateWeight(gb);
        });
    });
}

function formatMass(grams) {
    if (grams < 1e-9) return `${(grams * 1e12).toFixed(2)} picograms`;
    if (grams < 1e-6) return `${(grams * 1e9).toFixed(2)} nanograms`;
    if (grams < 1e-3) return `${(grams * 1e6).toFixed(3)} micrograms`;
    if (grams < 1) return `${(grams * 1e3).toFixed(2)} milligrams`;
    if (grams < 1000) return `${grams.toFixed(2)} grams`;
    return `${(grams / 1000).toFixed(2)} kilograms`;
}

function updateWeight(gb) {
    const theoEl = document.getElementById('result-theoretical');
    const pracEl = document.getElementById('result-practical');
    const cmpEl = document.getElementById('result-comparison');

    if (theoEl) theoEl.textContent = formatMass(gb / THEORETICAL_GB_PER_GRAM);
    if (pracEl) pracEl.textContent = formatMass(gb / PRACTICAL_GB_PER_GRAM);

    if (cmpEl) {
        let line;
        if (gb <= 8) {
            line = 'That is lighter than a single grain of sand — your data would fit on a speck of DNA you could barely see.';
        } else if (gb <= 2048) {
            const grains = ((gb / THEORETICAL_GB_PER_GRAM * 1e6) / 50).toFixed(3);
            line = `A grain of sand weighs about 50 micrograms — your data would need only <strong>${grains}× a grain of sand</strong> worth of DNA.`;
        } else if (gb <= 1_000_000) {
            line = 'That is less than a crystal of table salt. A whole Petabyte fits in something you could lose in your pocket.';
        } else if (gb <= 100_000_000) {
            line = 'Every movie ever made would fit inside a single drop of liquid.';
        } else {
            line = 'The entire world\'s data would weigh under <strong>1 kilogram</strong> of DNA — a shoebox could hold all of humanity\'s digital life.';
        }
        cmpEl.innerHTML = line;
    }
}

// ============================================================================
// 5. POLL (one vote per person per question, saved on this device)
// ============================================================================

const POLL_OPTIONS = {
    trust: ['yes', 'unsure', 'no'],
    timeline: ['soon', 'decade', 'distant'],
    bottleneck: ['cost', 'speed', 'error']
};

function initPoll() {
    for (const [category, options] of Object.entries(POLL_OPTIONS)) {
        options.forEach(opt => {
            const btn = document.getElementById(`poll-btn-${category}-${opt}`);
            if (btn) btn.addEventListener('click', () => castVote(category, opt));
        });
        const changeBtn = document.getElementById(`poll-change-${category}`);
        if (changeBtn) changeBtn.addEventListener('click', () => changeVote(category));
    }
    renderAllPolls();
}

function castVote(category, choice) {
    if (appState.userVoted[category]) {
        showToast('Already voted — use "change" to switch.');
        return;
    }
    appState.pollVotes[category][choice]++;
    appState.myVotes[category] = choice;
    appState.userVoted[category] = true;
    saveVotes();
    renderAllPolls();
    showToast('Vote counted — thanks!');
}

function changeVote(category) {
    const prev = appState.myVotes[category];
    if (prev && appState.pollVotes[category][prev] > 0) {
        appState.pollVotes[category][prev]--;
    }
    appState.myVotes[category] = null;
    appState.userVoted[category] = false;
    saveVotes();
    renderAllPolls();
    showToast('Vote removed — pick a new answer.');
}

function renderAllPolls() {
    for (const [category, options] of Object.entries(POLL_OPTIONS)) {
        const votes = appState.pollVotes[category];
        const total = options.reduce((s, o) => s + (votes[o] || 0), 0);

        const totalEl = document.getElementById(`total-votes-${category}`);
        if (totalEl) totalEl.textContent = total;

        options.forEach(opt => {
            const count = votes[opt] || 0;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            const pctEl = document.getElementById(`pct-${category}-${opt}`);
            const barEl = document.getElementById(`bar-${category}-${opt}`);
            if (pctEl) pctEl.textContent = `${pct}%`;
            if (barEl) barEl.style.width = `${pct}%`;
        });

        const statusEl = document.getElementById(`poll-status-${category}`);
        if (statusEl) {
            statusEl.classList.toggle('hidden', !appState.userVoted[category]);
        }
    }
}

function saveVotes() {
    try {
        localStorage.setItem('dna_poster_votes', JSON.stringify(appState.pollVotes));
        localStorage.setItem('dna_my_votes', JSON.stringify(appState.myVotes));
        localStorage.setItem('dna_user_voted', JSON.stringify(appState.userVoted));
    } catch (e) { /* storage may be unavailable */ }
}

function loadVotes() {
    try {
        const v = localStorage.getItem('dna_poster_votes');
        const m = localStorage.getItem('dna_my_votes');
        const u = localStorage.getItem('dna_user_voted');
        if (v) {
            const p = JSON.parse(v);
            appState.pollVotes = {
                trust: { yes: 0, unsure: 0, no: 0, ...p.trust },
                timeline: { soon: 0, decade: 0, distant: 0, ...p.timeline },
                bottleneck: { cost: 0, speed: 0, error: 0, ...p.bottleneck }
            };
        }
        if (m) appState.myVotes = { trust: null, timeline: null, bottleneck: null, ...JSON.parse(m) };
        if (u) appState.userVoted = { trust: false, timeline: false, bottleneck: false, ...JSON.parse(u) };
    } catch (e) { /* corrupted storage: keep defaults */ }
}

// ============================================================================
// 6. BOOT
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    loadVotes();
    initConverter();
    initCalculator();
    initPoll();
    updateWeight(256); // sensible starting example
});
