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

    const clearBtn = document.getElementById('btn-clear-text');
    if (clearBtn) clearBtn.addEventListener('click', () => {
        textInput.value = '';
        encodeTextToDna(); // resets binary + DNA outputs to placeholders
        textInput.focus();
        showToast('Cleared — type something new!');
    });

    if (dnaInput) dnaInput.addEventListener('input', decodeDnaToText);
}

function encodeTextToDna() {
    const inputEl = document.getElementById('textInput');
    const out = document.getElementById('dnaOut');
    const binOut = document.getElementById('binaryOut');
    if (!inputEl || !out) return;

    const input = inputEl.value;
    if (!input) {
        out.innerHTML = '<span class="text-slate-600">Type something above…</span>';
        if (binOut) binOut.innerHTML = '<span class="text-slate-600">…</span>';
        appState.currentDna = '';
        return;
    }

    // UTF-8: works for emoji, accents and any language
    let binary = '';
    for (const byte of new TextEncoder().encode(input)) {
        binary += byte.toString(2).padStart(8, '0');
    }

    // Show the binary layer, grouped in 8-bit bytes for readability
    if (binOut) {
        const bytes = binary.match(/.{1,8}/g) || [];
        binOut.textContent = bytes.join(' ');
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
// 5. LIVE POLL (Supabase — shared, live counts; falls back to per-device)
// ============================================================================

// --- Your Supabase project (Settings -> API) --------------------------------
const SUPABASE_URL = 'https://eittpkiyeublfkewbqlw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_qgZL_hEvHeDm744Jdii4kg_rqKjA7_9'; // anon/publishable key
// ----------------------------------------------------------------------------

const POLL_OPTIONS = {
    trust: ['yes', 'unsure', 'no'],
    timeline: ['soon', 'decade', 'distant'],
    bottleneck: ['cost', 'speed', 'error']
};

let supabaseClient = null;
let liveMode = false;

function getVoterId() {
    let id = localStorage.getItem('dna_voter_id');
    if (!id) {
        id = (crypto.randomUUID ? crypto.randomUUID() : 'v-' + Date.now() + '-' + Math.random().toString(36).slice(2));
        localStorage.setItem('dna_voter_id', id);
    }
    return id;
}

function initPoll() {
    for (const [category, options] of Object.entries(POLL_OPTIONS)) {
        options.forEach(opt => {
            const btn = document.getElementById(`poll-btn-${category}-${opt}`);
            if (btn) btn.addEventListener('click', () => castVote(category, opt));
        });
        const changeBtn = document.getElementById(`poll-change-${category}`);
        if (changeBtn) changeBtn.addEventListener('click', () => changeVote(category));
    }
    setupLivePoll();
}

/* ---------- Live mode (shared counts, visible to everyone) ---------- */

async function setupLivePoll() {
    if (!window.supabase) { setOfflineMode('Live results unavailable — votes saved on this device only.'); return; }
    try {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        const { data, error } = await supabaseClient
            .from('dna_poll_votes')
            .select('question,choice,voter_id');
        if (error) throw error;

        liveMode = true;
        applyServerRows(data || []);

        // Push updates to every connected screen within ~1 second
        supabaseClient
            .channel('dna-poll')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'dna_poll_votes' }, refreshLiveCounts)
            .subscribe();

        renderAllPolls();
    } catch (e) {
        setOfflineMode('Live results unavailable — votes saved on this device only.');
    }
}

async function refreshLiveCounts() {
    if (!liveMode || !supabaseClient) return;
    try {
        const { data, error } = await supabaseClient
            .from('dna_poll_votes')
            .select('question,choice,voter_id');
        if (error) throw error;
        applyServerRows(data || []);
        renderAllPolls();
    } catch (e) { /* keep last known counts */ }
}

/** Rebuild all poll state from the server's single source of truth. */
function applyServerRows(rows) {
    const votes = {
        trust: { yes: 0, unsure: 0, no: 0 },
        timeline: { soon: 0, decade: 0, distant: 0 },
        bottleneck: { cost: 0, speed: 0, error: 0 }
    };
    const voters = new Set();
    const mine = {};

    for (const row of rows) {
        if (votes[row.question] && row.choice in votes[row.question]) {
            votes[row.question][row.choice]++;
        }
        voters.add(row.voter_id);
        if (row.voter_id === getVoterId() && (POLL_OPTIONS[row.question] || []).includes(row.choice)) {
            mine[row.question] = row.choice;
        }
    }

    appState.pollVotes = votes;
    appState.myVotes = { trust: mine.trust || null, timeline: mine.timeline || null, bottleneck: mine.bottleneck || null };
    appState.userVoted = {
        trust: !!mine.trust,
        timeline: !!mine.timeline,
        bottleneck: !!mine.bottleneck
    };

    const note = document.getElementById('poll-live-note');
    if (note) note.innerHTML = `👥 <strong class="text-slate-800">${voters.size}</strong> ${voters.size === 1 ? 'person has' : 'people have'} voted · <span class="text-orange-600 font-semibold">LIVE</span>`;
}

function setOfflineMode(message) {
    liveMode = false;
    const note = document.getElementById('poll-live-note');
    if (note) note.textContent = message;
    renderAllPolls();
}

/* ---------- Voting ---------- */

async function castVote(category, choice) {
    if (appState.userVoted[category]) {
        showToast('Already voted — use "change" to switch.');
        return;
    }

    if (liveMode && supabaseClient) {
        const { error } = await supabaseClient
            .from('dna_poll_votes')
            .insert({ question: category, choice, voter_id: getVoterId() });
        if (error) {
            showToast(String(error.code) === '23505' ? 'Already voted in this question!' : 'Vote failed — please try again.');
            return;
        }
        await refreshLiveCounts();
        showToast('Vote counted — live on every screen!');
        return;
    }

    // Offline fallback: per-device counting (previous behaviour)
    appState.pollVotes[category][choice]++;
    appState.myVotes[category] = choice;
    appState.userVoted[category] = true;
    saveVotes();
    renderAllPolls();
    showToast('Vote counted — thanks!');
}

async function changeVote(category) {
    if (liveMode && supabaseClient) {
        await supabaseClient
            .from('dna_poll_votes')
            .delete()
            .eq('voter_id', getVoterId())
            .eq('question', category);
        await refreshLiveCounts();
        showToast('Vote removed — pick a new answer.');
        return;
    }

    // Offline fallback
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
// 6. DNA HELIX BANNER (lightweight, auto-spinning, shows YOUR sequence)
// ============================================================================

const HELIX_BASE_COLORS = {
    A: { fill: '#fb7185', glow: 'rgba(225,29,72,0.30)' },
    C: { fill: '#60a5fa', glow: 'rgba(37,99,235,0.35)' },
    G: { fill: '#34d399', glow: 'rgba(5,150,105,0.30)' },
    T: { fill: '#fbbf24', glow: 'rgba(249,115,22,0.35)' }
};

function initHelix() {
    const canvas = document.getElementById('helixCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let rotation = 0;
    const COMPLEMENT = { A: 'T', T: 'A', C: 'G', G: 'C' };

    function draw() {
        const rect = canvas.getBoundingClientRect();
        const w = rect.width, h = rect.height;
        if (w === 0 || h === 0) { requestAnimationFrame(draw); return; }

        // Keep the backing store matched to size & device pixel ratio
        const dpr = window.devicePixelRatio || 1;
        const bw = Math.round(w * dpr), bh = Math.round(h * dpr);
        if (canvas.width !== bw || canvas.height !== bh) {
            canvas.width = bw;
            canvas.height = bh;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);

        rotation += 0.018;

        // The helix displays the user's own encoded message
        const seq = (appState.currentDna || 'ATCGCGTA').slice(0, 26);
        const count = 24;
        const spacing = w / (count - 1);
        const radius = Math.min(h * 0.30, 58);
        const centerY = h / 2;

        const strandA = [], strandB = [];
        for (let i = 0; i < count; i++) {
            const angle = rotation + i * 0.45;
            const base = seq[i % seq.length] || 'A';
            const comp = COMPLEMENT[base] || 'T';
            strandA.push({ x: i * spacing, y: centerY + Math.sin(angle) * radius, z: Math.cos(angle), base });
            strandB.push({ x: i * spacing, y: centerY + Math.sin(angle + Math.PI) * radius, z: Math.cos(angle + Math.PI), base: comp });
        }

        // Draw rungs back-to-front for a 3D feel
        const rungs = strandA.map((p1, i) => ({ p1, p2: strandB[i], z: (p1.z + strandB[i].z) / 2 }))
            .sort((a, b) => a.z - b.z);

        for (const { p1, p2, z } of rungs) {
            const alpha = 0.45 + (z + 1) * 0.3;
            const isCG = p1.base === 'C' || p1.base === 'G';
            ctx.strokeStyle = isCG ? `rgba(59,130,246,${alpha * 0.7})` : `rgba(249,115,22,${alpha * 0.65})`;
            ctx.lineWidth = isCG ? 2.2 : 1.6;
            ctx.setLineDash(isCG ? [4, 3] : [6, 4]);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
            ctx.setLineDash([]);
            drawBase(ctx, p1, alpha);
            drawBase(ctx, p2, alpha);
        }

        drawStrand(ctx, strandA, '#3b82f6');
        drawStrand(ctx, strandB, '#f97316');

        requestAnimationFrame(draw);
    }

    function drawBase(ctx, p, alpha) {
        const color = HELIX_BASE_COLORS[p.base] || { fill: '#94a3b8', glow: 'rgba(148,163,184,0.5)' };
        const scale = 0.7 + (p.z + 1) * 0.26;
        const r = 6 * scale;
        ctx.save();
        ctx.globalAlpha = Math.max(0.4, 0.5 + (p.z + 1) * 0.24);
        const grad = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.3, r * 0.1, p.x, p.y, r);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.35, color.fill);
        grad.addColorStop(1, '#5b6b80');
        ctx.fillStyle = grad;
        ctx.shadowColor = color.glow;
        ctx.shadowBlur = scale > 1 ? 8 : 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
        if (p.z > 0.2) {
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#1c1917';
            ctx.font = `bold ${Math.round(7.5 * scale)}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(p.base, p.x, p.y);
        }
        ctx.restore();
    }

    function drawStrand(ctx, points, color) {
        if (points.length < 2) return;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            const xc = (points[i].x + points[i - 1].x) / 2;
            const yc = (points[i].y + points[i - 1].y) / 2;
            ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, xc, yc);
        }
        ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.restore();
    }

    requestAnimationFrame(draw);
}

// ============================================================================
// 7. WELCOME POPUP (shown on every visit)
// ============================================================================

function initWelcome() {
    const modal = document.getElementById('welcome-modal');
    const startBtn = document.getElementById('btn-start');
    if (!modal) return;

    const open = () => {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    };
    const close = () => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    };

    if (startBtn) startBtn.addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) close();
    });

    open(); // greet every visitor
}

// ============================================================================
// 8. BOOT
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    loadVotes();
    initConverter();
    initCalculator();
    initPoll();
    initHelix();
    initWelcome();
    updateWeight(256); // sensible starting example
});
