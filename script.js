/**
 * DNA DATA STORAGE EXPLORER - JAVASCRIPT CONTROLLER
 * Scientific Visualization & Poster Companion Engine
 */

// ============================================================================
// 1. GLOBAL STATE & CONSTANTS
// ============================================================================

const DNA_MAP = {
    '00': 'A',
    '01': 'C',
    '10': 'G',
    '11': 'T'
};

const REV_DNA_MAP = {
    'A': '00',
    'C': '01',
    'G': '10',
    'T': '11'
};

const COMPLEMENT_MAP = {
    'A': 'T',
    'T': 'A',
    'C': 'G',
    'G': 'C'
};

// Theoretical density from Church et al. / Goldman et al. (215 Petabytes/gram)
const THEORETICAL_GB_PER_GRAM = 215_000_000;
// Practical density with 1.6x redundancy, primers, and addressing (~10 PB/g)
const PRACTICAL_GB_PER_GRAM = 10_000_000;

// Application State
const appState = {
    currentTab: 'encoder',
    encodeMode: 'text-to-dna', // 'text-to-dna' or 'dna-to-text'
    helixSpeed: 0.015,
    helixPaused: false,
    currentDnaSequence: 'ATCGGCTA',
    mutationRate: 0,
    pollVotes: {
        trust: { yes: 68, unsure: 24, no: 12 },
        timeline: { soon: 35, decade: 58, distant: 11 },
        bottleneck: { cost: 62, speed: 28, error: 14 }
    },
    userVoted: {
        trust: false,
        timeline: false,
        bottleneck: false
    }
};

// ============================================================================
// 1.5 SHARED UTILITIES
// ============================================================================

/**
 * Clipboard helper with fallback for insecure contexts (file://, http:// on
 * local networks). navigator.clipboard only works on HTTPS / localhost, which
 * poster-presentation setups often don't have.
 */
function copyToClipboard(text, successMessage) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => showToast(successMessage)).catch(() => legacyCopy(text, successMessage));
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
    ta.focus();
    ta.select();
    try {
        const ok = document.execCommand('copy');
        showToast(ok ? successMessage : 'Copy failed — please select the text manually.');
    } catch (e) {
        showToast('Copy failed — please select the text manually.');
    }
    document.body.removeChild(ta);
}

// ============================================================================
// 2. INITIALIZATION & TAB NAVIGATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initCanvasHelix();
    initEncoder();
    initCalculator();
    initPipeline();
    initPoll();
    initQRModal();
    initHelpModal();
    initWelcomeCard();
    loadStoredVotes();
    
    // Initial calculation and preview
    encodeCurrentText();
    updateCalculator();
});

function initTabs() {
    const tabs = ['encoder', 'calculator', 'pipeline', 'poll'];
    tabs.forEach(tab => {
        const btn = document.getElementById(`tab-btn-${tab}`);
        if (!btn) return;
        btn.addEventListener('click', () => switchTab(tab));
    });
}

function switchTab(tabId) {
    appState.currentTab = tabId;
    const tabs = ['encoder', 'calculator', 'pipeline', 'poll'];
    
    tabs.forEach(t => {
        const content = document.getElementById(`tab-${t}`);
        const btn = document.getElementById(`tab-btn-${t}`);
        
        if (content && btn) {
            if (t === tabId) {
                content.classList.add('active');
                btn.classList.remove('border-transparent', 'text-slate-400');
                btn.classList.add('border-bio-cyan', 'text-bio-cyan', 'bg-bio-cyan/10');
            } else {
                content.classList.remove('active');
                btn.classList.remove('border-bio-cyan', 'text-bio-cyan', 'bg-bio-cyan/10');
                btn.classList.add('border-transparent', 'text-slate-400');
            }
        }
    });

    if (tabId === 'calculator') {
        updateCalculator();
    } else if (tabId === 'poll') {
        renderAllPolls();
    }
}

// ============================================================================
// 3. 3D INTERACTIVE DNA DOUBLE HELIX (HTML5 Canvas)
// ============================================================================

let canvas, ctx;
let helixRotation = 0;
let isDragging = false;
let previousMouseX = 0;

function initCanvasHelix() {
    canvas = document.getElementById('helixCanvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    
    function resizeCanvas() {
        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
        // setTransform resets any accumulated scale, so repeated resizes
        // can never compound the DPI scaling
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // Mouse and Touch Interaction
    canvas.addEventListener('mousedown', (e) => {
        isDragging = true;
        previousMouseX = e.clientX;
    });
    window.addEventListener('mouseup', () => isDragging = false);
    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const deltaX = e.clientX - previousMouseX;
        helixRotation += deltaX * 0.01;
        previousMouseX = e.clientX;
    });

    // Touch support
    canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            isDragging = true;
            previousMouseX = e.touches[0].clientX;
        }
    });
    window.addEventListener('touchend', () => isDragging = false);
    window.addEventListener('touchmove', (e) => {
        if (!isDragging || e.touches.length !== 1) return;
        const deltaX = e.touches[0].clientX - previousMouseX;
        helixRotation += deltaX * 0.015;
        previousMouseX = e.touches[0].clientX;
    });

    // Helix Controls
    const pauseBtn = document.getElementById('helix-toggle-pause');
    if (pauseBtn) {
        pauseBtn.addEventListener('click', () => {
            appState.helixPaused = !appState.helixPaused;
            pauseBtn.innerHTML = appState.helixPaused 
                ? '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> Resume' 
                : '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> Pause';
        });
    }

    requestAnimationFrame(renderHelix);
}

const BASE_COLORS = {
    'A': { fill: '#f43f5e', glow: 'rgba(244, 63, 94, 0.6)', name: 'Adenine' },
    'T': { fill: '#f59e0b', glow: 'rgba(245, 158, 11, 0.6)', name: 'Thymine' },
    'C': { fill: '#0284c7', glow: 'rgba(2, 132, 199, 0.6)', name: 'Cytosine' },
    'G': { fill: '#10b981', glow: 'rgba(16, 185, 129, 0.6)', name: 'Guanine' }
};

function renderHelix() {
    if (!ctx || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    ctx.clearRect(0, 0, width, height);

    if (!appState.helixPaused && !isDragging) {
        helixRotation += appState.helixSpeed;
    }

    const numBasePairs = 22;
    const spacing = width / (numBasePairs - 1);
    const radius = Math.min(height * 0.28, 65);
    const centerY = height / 2;

    // Use current sequence bases or repeat
    const seq = appState.currentDnaSequence && appState.currentDnaSequence.length > 0 
        ? appState.currentDnaSequence 
        : 'ATCGTAGC';

    const pointsA = [];
    const pointsB = [];

    // Calculate 3D projected coordinates along X-axis
    for (let i = 0; i < numBasePairs; i++) {
        const x = i * spacing;
        const angle = helixRotation + (i * 0.45);
        
        // Strand 1
        const y1 = centerY + Math.sin(angle) * radius;
        const z1 = Math.cos(angle); // Depth factor (-1 to +1)

        // Strand 2 (Opposite phase by PI)
        const y2 = centerY + Math.sin(angle + Math.PI) * radius;
        const z2 = Math.cos(angle + Math.PI);

        const baseChar = seq[i % seq.length].toUpperCase();
        const compChar = COMPLEMENT_MAP[baseChar] || 'T';

        pointsA.push({ x, y: y1, z: z1, base: baseChar });
        pointsB.push({ x, y: y2, z: z2, base: compChar });
    }

    // Sort rungs by depth (Z-buffer simulation) so back rungs render behind front rungs
    const rungs = [];
    for (let i = 0; i < numBasePairs; i++) {
        const avgZ = (pointsA[i].z + pointsB[i].z) / 2;
        rungs.push({
            p1: pointsA[i],
            p2: pointsB[i],
            avgZ: avgZ,
            index: i
        });
    }

    // Sort by depth (farthest first)
    rungs.sort((a, b) => a.avgZ - b.avgZ);

    // Draw rungs and base pairs
    rungs.forEach(rung => {
        const p1 = rung.p1;
        const p2 = rung.p2;
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        
        // Depth opacity
        const alpha = 0.35 + (rung.avgZ + 1) * 0.32; // ranges ~0.35 to 0.99

        // Hydrogen bonds line (A-T has 2, C-G has 3)
        const isCG = (rung.p1.base === 'C' || rung.p1.base === 'G');
        ctx.save();
        ctx.strokeStyle = isCG ? `rgba(6, 182, 212, ${alpha * 0.7})` : `rgba(245, 158, 11, ${alpha * 0.7})`;
        ctx.lineWidth = isCG ? 2.5 : 1.8;
        if (isCG) {
            ctx.setLineDash([4, 3]);
        } else {
            ctx.setLineDash([6, 4]);
        }
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        ctx.restore();

        // Draw Base 1 Sphere (Strand A)
        drawBaseSphere(p1.x, p1.y, p1.z, p1.base);

        // Draw Base 2 Sphere (Strand B - Complement)
        drawBaseSphere(p2.x, p2.y, p2.z, p2.base);
    });

    // Draw Sugar-Phosphate Backbones
    drawBackbone(pointsA, '#00f0ff');
    drawBackbone(pointsB, '#a855f7');

    requestAnimationFrame(renderHelix);
}

function drawBackbone(points, glowColor) {
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
    
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = 3;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.restore();
}

function drawBaseSphere(x, y, z, base) {
    const colorInfo = BASE_COLORS[base] || { fill: '#94a3b8', glow: 'rgba(148,163,184,0.5)', name: 'Base' };
    
    // Scale sphere size and brightness based on 3D depth (Z)
    const scale = 0.7 + (z + 1) * 0.28; // ranges 0.7 to 1.26
    const radius = 6.5 * scale;
    const alpha = Math.max(0.4, 0.5 + (z + 1) * 0.25);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);

    // Glowing 3D radial gradient
    const grad = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, radius * 0.1, x, y, radius);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.3, colorInfo.fill);
    grad.addColorStop(1, '#050811');

    ctx.fillStyle = grad;
    ctx.shadowColor = colorInfo.glow;
    ctx.shadowBlur = scale > 1 ? 12 : 4;
    ctx.fill();

    // Base letter label if in front foreground
    if (z > 0.15) {
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.round(8 * scale)}px 'JetBrains Mono', monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(base, x, y);
    }
    ctx.restore();
}

// ============================================================================
// 4. MOLECULAR ENCODER / DECODER & BIOLOGICAL METRICS
// ============================================================================

function initEncoder() {
    const textInput = document.getElementById('textInput');
    if (textInput) {
        textInput.addEventListener('input', encodeCurrentText);
    }

    // Preset Buttons
    const presets = {
        'preset-fair': 'DNA Storage: 215 Petabytes in 1 Gram',
        'preset-nature': 'Nature 2026: Next-Gen Molecular Memories',
        'preset-voyager': 'Sounds of Earth • Voyager Golden Record',
        'preset-quote': 'Data is the lifeblood of science.'
    };

    Object.keys(presets).forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', () => {
                if (textInput) {
                    textInput.value = presets[id];
                    encodeCurrentText();
                }
            });
        }
    });

    // Copy Sequence Button
    const copyBtn = document.getElementById('btn-copy-dna');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            if (appState.currentDnaSequence) {
                copyToClipboard(appState.currentDnaSequence, 'DNA Sequence copied to clipboard!');
            }
        });
    }

    // Copy FASTA format button
    const copyFastaBtn = document.getElementById('btn-copy-fasta');
    if (copyFastaBtn) {
        copyFastaBtn.addEventListener('click', () => {
            if (appState.currentDnaSequence) {
                const header = '>GENO_BYTE_Poster_Sample|length=' + appState.currentDnaSequence.length + 'nt\n';
                copyToClipboard(header + appState.currentDnaSequence, 'FASTA file format copied!');
            }
        });
    }

    // One-click demo flow: push the (possibly mutated) sequence into the decoder
    const sendDecoderBtn = document.getElementById('btn-send-decoder');
    if (sendDecoderBtn) {
        sendDecoderBtn.addEventListener('click', () => {
            if (!appState.currentDnaSequence) return;
            const dnaInput = document.getElementById('dnaInput');
            if (dnaInput) {
                dnaInput.value = appState.currentDnaSequence;
            }
            setEncodeMode('dna-to-text');
            showToast('Sequence sent to decoder — reading it back now!');
        });
    }

    // Noise / Mutation Simulator Slider
    const noiseSlider = document.getElementById('noiseSlider');
    if (noiseSlider) {
        noiseSlider.addEventListener('input', (e) => {
            appState.mutationRate = parseFloat(e.target.value);
            const rateLabel = document.getElementById('noiseRateLabel');
            if (rateLabel) rateLabel.textContent = `${appState.mutationRate}%`;
            encodeCurrentText();
        });
    }

    // Reverse Complement toggle / Strand selector
    const tabEncodeModeText = document.getElementById('mode-text-to-dna');
    const tabEncodeModeDna = document.getElementById('mode-dna-to-text');
    if (tabEncodeModeText && tabEncodeModeDna) {
        tabEncodeModeText.addEventListener('click', () => {
            setEncodeMode('text-to-dna');
        });
        tabEncodeModeDna.addEventListener('click', () => {
            setEncodeMode('dna-to-text');
        });
    }

    const dnaInput = document.getElementById('dnaInput');
    if (dnaInput) {
        dnaInput.addEventListener('input', decodeCurrentDna);
    }
}

function setEncodeMode(mode) {
    appState.encodeMode = mode;
    const viewText = document.getElementById('view-text-to-dna');
    const viewDna = document.getElementById('view-dna-to-text');
    const btnText = document.getElementById('mode-text-to-dna');
    const btnDna = document.getElementById('mode-dna-to-text');

    if (mode === 'text-to-dna') {
        viewText.classList.remove('hidden');
        viewDna.classList.add('hidden');
        btnText.classList.add('bg-bio-cyan/20', 'text-bio-cyan', 'border-bio-cyan');
        btnText.classList.remove('text-slate-400', 'border-transparent');
        btnDna.classList.remove('bg-bio-cyan/20', 'text-bio-cyan', 'border-bio-cyan');
        btnDna.classList.add('text-slate-400', 'border-transparent');
        encodeCurrentText();
    } else {
        viewText.classList.add('hidden');
        viewDna.classList.remove('hidden');
        btnDna.classList.add('bg-bio-cyan/20', 'text-bio-cyan', 'border-bio-cyan');
        btnDna.classList.remove('text-slate-400', 'border-transparent');
        btnText.classList.remove('bg-bio-cyan/20', 'text-bio-cyan', 'border-bio-cyan');
        btnText.classList.add('text-slate-400', 'border-transparent');
        decodeCurrentDna();
    }
}

function encodeCurrentText() {
    const inputEl = document.getElementById('textInput');
    const input = inputEl ? inputEl.value : 'Hello DNA!';
    
    const elAscii = document.getElementById('out-ascii');
    const elBinary = document.getElementById('out-binary');
    const elDnaSense = document.getElementById('out-dna-sense');
    const elDnaAntisense = document.getElementById('out-dna-antisense');
    const elHbonds = document.getElementById('out-dna-hbonds');

    if (!input || input.trim() === '') {
        if (elAscii) elAscii.innerHTML = '<span class="text-slate-500">Awaiting input...</span>';
        if (elBinary) elBinary.innerHTML = '<span class="text-slate-500">Awaiting input...</span>';
        if (elDnaSense) elDnaSense.innerHTML = '<span class="text-slate-500">Awaiting input...</span>';
        if (elDnaAntisense) elDnaAntisense.innerHTML = '<span class="text-slate-500">Awaiting input...</span>';
        if (elHbonds) elHbonds.innerHTML = '';
        updateBioMetrics('');
        return;
    }

    let asciiArr = [];
    let binaryStr = '';
    let pristineDna = '';

    // UTF-8 encode: works for ANY text (emoji, accents, non-Latin scripts),
    // not just ASCII. Every character becomes one or more 8-bit bytes.
    const utf8Bytes = new TextEncoder().encode(input);
    asciiArr = Array.from(utf8Bytes);

    for (const byte of utf8Bytes) {
        binaryStr += byte.toString(2).padStart(8, '0');
    }

    for (let i = 0; i < binaryStr.length; i += 2) {
        const pair = binaryStr.substring(i, i + 2);
        pristineDna += DNA_MAP[pair] || 'A';
    }

    // Apply simulated mutation / sequencing noise if slider > 0
    let synthesizedDna = pristineDna;
    let mutatedIndices = new Set();
    if (appState.mutationRate > 0) {
        const bases = ['A', 'C', 'G', 'T'];
        let mutatedArr = pristineDna.split('');
        for (let i = 0; i < mutatedArr.length; i++) {
            if (Math.random() * 100 < appState.mutationRate) {
                const altBases = bases.filter(b => b !== mutatedArr[i]);
                mutatedArr[i] = altBases[Math.floor(Math.random() * altBases.length)];
                mutatedIndices.add(i);
            }
        }
        synthesizedDna = mutatedArr.join('');
    }

    appState.currentDnaSequence = synthesizedDna;

    // Display ASCII
    if (elAscii) {
        elAscii.textContent = asciiArr.join(' ');
    }

    // Display Binary grouped in bytes
    if (elBinary) {
        const byteChunks = binaryStr.match(/.{1,8}/g) || [];
        elBinary.innerHTML = byteChunks.map(b => `<span class="inline-block px-1 bg-slate-800/80 rounded mx-0.5 text-bio-cyan">${b}</span>`).join(' ');
    }

    // Render Double-Strand with Watson-Crick Complementary pairing
    renderDoubleStrand(synthesizedDna, mutatedIndices);

    // Update Biological Feasibility Metrics (GC%, Homopolymers, Tm)
    updateBioMetrics(synthesizedDna);
}

function renderDoubleStrand(dnaSeq, mutatedIndices = new Set()) {
    const elSense = document.getElementById('out-dna-sense');
    const elAntisense = document.getElementById('out-dna-antisense');
    const elHbonds = document.getElementById('out-dna-hbonds');

    if (!elSense || !elAntisense || !elHbonds) return;

    let senseHtml = '';
    let antisenseHtml = '';
    let hbondsHtml = '';

    for (let i = 0; i < dnaSeq.length; i++) {
        const base = dnaSeq[i];
        const comp = COMPLEMENT_MAP[base] || 'T';
        const isMutated = mutatedIndices.has(i);
        const mutateStyle = isMutated ? 'border-pink-500 bg-pink-500/20 text-pink-300 animate-pulse' : '';

        const badgeClassBase = `base-badge base-badge-${base.toLowerCase()} ${mutateStyle}`;
        const badgeClassComp = `base-badge base-badge-${comp.toLowerCase()} ${mutateStyle}`;

        senseHtml += `<span class="${badgeClassBase}" title="Pos ${i+1}: ${base}">${base}</span>`;
        antisenseHtml += `<span class="${badgeClassComp}" title="Pos ${i+1}: ${comp}">${comp}</span>`;

        // Hydrogen bonds: A-T has 2 (represented as = or ⁞), C-G has 3 (represented as ≡ or ⫶)
        const isCG = (base === 'C' || base === 'G');
        const bondSymbol = isCG ? '⫶' : '∶';
        const bondClass = isCG ? 'h-bonds-3' : 'h-bonds-2';
        hbondsHtml += `<span class="inline-flex items-center justify-center w-[22px] text-xs font-mono select-none ${bondClass}">${bondSymbol}</span>`;
    }

    elSense.innerHTML = senseHtml;
    elAntisense.innerHTML = antisenseHtml;
    elHbonds.innerHTML = hbondsHtml;
}

function updateBioMetrics(dnaSeq) {
    const countEl = document.getElementById('metric-nt-count');
    const gcEl = document.getElementById('metric-gc-content');
    const gcStatusEl = document.getElementById('metric-gc-status');
    const homoEl = document.getElementById('metric-homopolymers');
    const tmEl = document.getElementById('metric-tm');
    const oligosEl = document.getElementById('metric-oligo-count');

    if (!dnaSeq || dnaSeq.length === 0) {
        if (countEl) countEl.textContent = '0 nt';
        if (gcEl) gcEl.textContent = '0%';
        if (homoEl) homoEl.textContent = 'None';
        if (tmEl) tmEl.textContent = '-- °C';
        if (oligosEl) oligosEl.textContent = '0';
        return;
    }

    const len = dnaSeq.length;
    if (countEl) countEl.textContent = `${len} nt (${(len * 2)} bits)`;

    // GC Content Calculation
    let gcCount = 0;
    for (let char of dnaSeq) {
        if (char === 'G' || char === 'C') gcCount++;
    }
    const gcPct = Math.round((gcCount / len) * 100);
    if (gcEl) gcEl.textContent = `${gcPct}%`;

    // GC Feasibility Assessment (Optimal is 40% - 60%)
    if (gcStatusEl) {
        if (gcPct >= 40 && gcPct <= 60) {
            gcStatusEl.className = 'text-[11px] font-semibold text-emerald-400';
            gcStatusEl.textContent = '✓ Optimal Synthesis Range (40-60%)';
        } else if (gcPct < 35 || gcPct > 65) {
            gcStatusEl.className = 'text-[11px] font-semibold text-rose-400';
            gcStatusEl.textContent = '⚠ High Dropout Risk (Requires Primer Shuffling)';
        } else {
            gcStatusEl.className = 'text-[11px] font-semibold text-amber-400';
            gcStatusEl.textContent = 'Moderate Bias (Acceptable)';
        }
    }

    // Homopolymer Run Detection (e.g. AAAA or GGGG)
    let maxRun = 1;
    let currentRun = 1;
    let runBase = dnaSeq[0];
    let worstRun = '';

    for (let i = 1; i < dnaSeq.length; i++) {
        if (dnaSeq[i] === dnaSeq[i - 1]) {
            currentRun++;
            if (currentRun > maxRun) {
                maxRun = currentRun;
                runBase = dnaSeq[i];
                worstRun = runBase.repeat(maxRun);
            }
        } else {
            currentRun = 1;
        }
    }

    if (homoEl) {
        if (maxRun >= 4) {
            homoEl.innerHTML = `<span class="text-rose-400 font-bold">${worstRun} (${maxRun}x)</span> - Run Alert`;
        } else {
            homoEl.innerHTML = `<span class="text-emerald-400 font-bold">Safe (${maxRun}x max)</span>`;
        }
    }

    // Melting Temperature (Tm) estimation:
    // Marmur & Doty formula: Tm = 64.9 + 41 * (yG + zC - 16.4) / (wA + xT + yG + zC)
    // For oligos < 14nt: (wA + xT) * 2 + (yG + zC) * 4
    let tm = 0;
    const aCount = (dnaSeq.match(/A/g) || []).length;
    const tCount = (dnaSeq.match(/T/g) || []).length;
    const gCount = (dnaSeq.match(/G/g) || []).length;
    const cCount = (dnaSeq.match(/C/g) || []).length;

    if (len < 14) {
        tm = (aCount + tCount) * 2 + (gCount + cCount) * 4;
    } else {
        tm = 64.9 + 41 * (gCount + cCount - 16.4) / len;
    }
    if (tmEl) tmEl.textContent = `${tm.toFixed(1)} °C`;

    // Oligos partition estimation (Standard 150nt synthesis limit with 20nt primers and 10nt index)
    const payloadPerOligo = 120; // 120 nt payload per oligonucleotide
    const estimatedOligos = Math.ceil(len / payloadPerOligo);
    if (oligosEl) oligosEl.textContent = `${estimatedOligos} oligo${estimatedOligos > 1 ? 's' : ''}`;
}

// Reverse Decoding: DNA -> Binary -> UTF-8 Text
function decodeCurrentDna() {
    const dnaInput = document.getElementById('dnaInput');
    const outDecodedText = document.getElementById('out-decoded-text');
    const outDecodedBinary = document.getElementById('out-decoded-binary');
    const decodeErrorWarning = document.getElementById('decode-error-warning');

    if (!dnaInput || !outDecodedText) return;

    let rawDna = dnaInput.value.toUpperCase().replace(/[^ACTG]/g, '');

    // Rewrite input only when it actually changed, preserving the caret
    // position so users can edit in the middle of the sequence comfortably.
    if (dnaInput.value !== rawDna) {
        const caret = dnaInput.selectionStart;
        dnaInput.value = rawDna;
        if (caret !== null && caret !== undefined) {
            const pos = Math.min(caret, rawDna.length);
            dnaInput.setSelectionRange(pos, pos);
        }
    }

    if (rawDna.length === 0) {
        outDecodedText.textContent = 'Awaiting DNA sequence...';
        outDecodedBinary.textContent = '00000000';
        if (decodeErrorWarning) decodeErrorWarning.classList.add('hidden');
        return;
    }

    // Each nucleotide is 2 bits
    let binary = '';
    for (let char of rawDna) {
        binary += REV_DNA_MAP[char] || '00';
    }

    if (outDecodedBinary) {
        outDecodedBinary.textContent = binary;
    }

    // Group bits into 8-bit bytes (UTF-8) and decode back to text
    let byteValues = [];
    for (let i = 0; i + 8 <= binary.length; i += 8) {
        byteValues.push(parseInt(binary.substring(i, i + 8), 2));
    }

    let decodedText = '';
    let hasMalformedByte = false;

    if (byteValues.length > 0) {
        decodedText = new TextDecoder('utf-8').decode(new Uint8Array(byteValues));
        // U+FFFD replacement character means the bytes were not valid UTF-8
        if (decodedText.includes('\uFFFD')) {
            decodedText = decodedText.replace(/\uFFFD/g, '�');
            hasMalformedByte = true;
        }
    }

    outDecodedText.textContent = decodedText || '[Incomplete Byte Stream]';

    if (decodeErrorWarning) {
        if (hasMalformedByte || binary.length % 8 !== 0) {
            decodeErrorWarning.classList.remove('hidden');
        } else {
            decodeErrorWarning.classList.add('hidden');
        }
    }
}

// ============================================================================
// 5. STORAGE DENSITY & CARBON FOOTPRINT CALCULATOR
// ============================================================================

function initCalculator() {
    const slider = document.getElementById('storageSlider');
    if (slider) {
        slider.addEventListener('input', updateCalculator);
    }

    // Presets for poster discussions
    const calcPresets = [
        { id: 'btn-calc-phone', gb: 256 },
        { id: 'btn-calc-genome', gb: 3 },
        { id: 'btn-calc-loc', gb: 20000 }, // Library of Congress: 20 TB
        { id: 'btn-calc-netflix', gb: 50000000 }, // Netflix global catalog: ~50 PB
        { id: 'btn-calc-sphere', gb: 175000000000 } // Global Datasphere 2026: 175 ZB
    ];

    calcPresets.forEach(item => {
        const btn = document.getElementById(item.id);
        if (btn) {
            btn.addEventListener('click', () => {
                setCustomGb(item.gb);
            });
        }
    });

    const customInput = document.getElementById('customGbInput');
    if (customInput) {
        customInput.addEventListener('change', () => {
            const val = parseFloat(customInput.value);
            if (!isNaN(val) && val > 0) {
                setCustomGb(val);
            }
        });
    }
}

function setCustomGb(gb) {
    const slider = document.getElementById('storageSlider');
    if (slider) {
        // Slider max is 2048 for standard range, but custom can exceed
        slider.value = Math.min(gb, 2048);
    }
    updateCalculatorWithGb(gb);
}

function updateCalculator() {
    const slider = document.getElementById('storageSlider');
    if (!slider) return;
    const gb = parseFloat(slider.value);
    updateCalculatorWithGb(gb);
}

function updateCalculatorWithGb(gb) {
    const storageValueEl = document.getElementById('storageValue');
    const calcTheoreticalEl = document.getElementById('calc-result-theoretical');
    const calcPracticalEl = document.getElementById('calc-result-practical');
    const calcPerspectiveEl = document.getElementById('calc-context');
    const calcSiliconWeightEl = document.getElementById('calc-silicon-weight');
    const calcCarbonSavedEl = document.getElementById('calc-carbon-saved');
    const calcDurabilityEl = document.getElementById('calc-durability-compare');

    if (storageValueEl) {
        if (gb >= 1_000_000_000) {
            storageValueEl.textContent = `${(gb / 1_000_000_000).toFixed(1)} ZB`;
        } else if (gb >= 1_000_000) {
            storageValueEl.textContent = `${(gb / 1_000_000).toFixed(1)} PB`;
        } else if (gb >= 1000) {
            storageValueEl.textContent = `${(gb / 1000).toFixed(1)} TB`;
        } else {
            storageValueEl.textContent = `${gb} GB`;
        }
    }

    // 1 Gram = 215,000,000 GB (Theoretical)
    const gramsTheoretical = gb / THEORETICAL_GB_PER_GRAM;
    const gramsPractical = gb / PRACTICAL_GB_PER_GRAM;

    // Format Mass
    function formatMass(grams) {
        if (grams < 1e-9) {
            return `${(grams * 1e12).toFixed(2)} picograms`;
        } else if (grams < 1e-6) {
            return `${(grams * 1e9).toFixed(2)} nanograms`;
        } else if (grams < 1e-3) {
            return `${(grams * 1e6).toFixed(3)} micrograms`;
        } else if (grams < 1) {
            return `${(grams * 1e3).toFixed(2)} milligrams`;
        } else if (grams < 1000) {
            return `${grams.toFixed(2)} grams`;
        } else {
            return `${(grams / 1000).toFixed(2)} kilograms`;
        }
    }

    if (calcTheoreticalEl) {
        calcTheoreticalEl.textContent = formatMass(gramsTheoretical);
    }
    if (calcPracticalEl) {
        calcPracticalEl.textContent = formatMass(gramsPractical);
    }

    // Perspective Analogy Generation
    if (calcPerspectiveEl) {
        let analogy = '';
        if (gb <= 128) {
            analogy = `Lighter than a <strong>single human skin cell</strong> (~1 nanogram). Your entire phone's photos and operating system would vanish onto the tip of an eyelash.`;
        } else if (gb <= 2048) {
            const sandGrains = ((gramsTheoretical * 1e6) / 50).toFixed(3);
            analogy = `A single grain of beach sand weighs 50 micrograms. Your digital life is equivalent to <strong>${sandGrains}x of a single sand grain</strong>.`;
        } else if (gb <= 1_000_000) {
            analogy = `A Petabyte of enterprise cloud data shrinks down to <strong>${(gramsTheoretical * 1000).toFixed(2)} milligrams</strong> — smaller than a standard crystal of table salt.`;
        } else if (gb <= 100_000_000) {
            analogy = `All movies and cultural archives in human history (~50 PB) would fit in a <strong>single drop of saline water</strong> (~0.23 grams).`;
        } else {
            analogy = `The ENTIRE world's digital sphere (175 Zettabytes in 2026) would weigh roughly <strong>813 grams (~1.8 lbs)</strong>. A shoebox of DNA could store all of human civilization's digital creation!`;
        }
        calcPerspectiveEl.innerHTML = analogy;
    }

    // Silicon Comparison
    // 1 TB HDD ~ 450 grams; 1 TB NVMe SSD ~ 8 grams
    const siliconKg = (gb / 1000) * 0.008; // NVMe baseline
    if (calcSiliconWeightEl) {
        if (siliconKg < 1) {
            calcSiliconWeightEl.textContent = `${(siliconKg * 1000).toFixed(0)} grams (Silicon SSDs)`;
        } else if (siliconKg < 1000) {
            calcSiliconWeightEl.textContent = `${siliconKg.toFixed(1)} kg of server drives`;
        } else {
            calcSiliconWeightEl.textContent = `${(siliconKg / 1000).toFixed(1)} Metric Tons of hardware`;
        }
    }

    // Energy / Carbon comparison (DNA requires 0 Watts continuous power)
    if (calcCarbonSavedEl) {
        // Data centers consume ~20-30 kWh per TB per year
        const annualKwh = (gb / 1000) * 25;
        if (annualKwh < 1000) {
            calcCarbonSavedEl.textContent = `${annualKwh.toFixed(0)} kWh/year avoided`;
        } else {
            calcCarbonSavedEl.textContent = `${(annualKwh / 1000).toFixed(1)} MWh/year saved (0 Watt cold storage)`;
        }
    }

    // Durability comparison
    if (calcDurabilityEl) {
        calcDurabilityEl.innerHTML = `<span class="text-emerald-400 font-bold">1,000+ Years</span> (in silica capsules) vs <span class="text-rose-400 font-bold">5-7 Years</span> (magnetic tape / SSDs)`;
    }
}

// ============================================================================
// 6. END-TO-END MOLECULAR PIPELINE (Poster Flowchart Walkthrough)
// ============================================================================

const PIPELINE_DATA = {
    1: {
        title: 'Step 1: Digital Encoding & Error Correction (Informatics)',
        summary: 'Binary file data (0s & 1s) is converted to quaternary nucleotide bases (A, C, G, T) using fountain codes or Reed-Solomon redundancy.',
        chemistry: 'Algorithmic constraint filtering avoids GC bias (<40% or >60%) and prevents homopolymer runs (e.g. AAAAA) that disrupt chemical synthesis.',
        specs: {
            density: 'Up to 1.98 bits/nucleotide (Theoretical max: 2.0)',
            redundancy: '10% - 25% error-correction overhead',
            bottleneck: 'Software encoding is instantaneous (<0.1s)'
        }
    },
    2: {
        title: 'Step 2: Chemical De Novo Synthesis (Writing)',
        summary: 'Synthetic oligonucleotides (~150 to 200 base pairs each) are printed base-by-base on silicon microarrays.',
        chemistry: 'Technologies: Phosphoramidite chemical cycle (yield drops exponentially past 200nt) or enzymatic synthesis via Terminal Deoxynucleotidyl Transferase (TdT).',
        specs: {
            cost: '~$0.0001 - $0.001 per base pair (Targeting $100/TB)',
            speed: '1-10 hours per synthesis batch',
            bottleneck: 'High cost of phosphoramidite reagents'
        }
    },
    3: {
        title: 'Step 3: Physical Encapsulation & Cold Storage (Archiving)',
        summary: 'Dehydrated (lyophilized) synthetic DNA strands are embedded inside microscopic anoxic silica spheres or stainless steel micro-capsules.',
        chemistry: 'Without water, oxygen, or UV light, phosphodiester bonds cannot hydrolyze, resisting thermal degradation for geological timescales.',
        specs: {
            power: '0 Watts (Completely passive zero-power storage)',
            halfLife: 'Over 1,000 years at room temp; 500,000+ years at -20°C',
            footprint: 'Millions of times smaller than magnetic tape vaults'
        }
    },
    4: {
        title: 'Step 4: Targeted PCR Retrieval & Sequencing (Reading)',
        summary: 'Strands with matching primer sequences are amplified via Polymerase Chain Reaction (PCR) and read through Next-Generation Sequencing.',
        chemistry: 'Methods: Illumina Sequencing-by-Synthesis (SBS, high accuracy) or Oxford Nanopore Technologies (portable, real-time electrical current translocation).',
        specs: {
            throughput: 'Up to 6 Terabases per run (NovaSeq 6000)',
            errorRate: '0.1% (Illumina) to 1-3% (Nanopore raw reads)',
            randomAccess: 'Achieved via specific barcode primer pairs'
        }
    },
    5: {
        title: 'Step 5: Bioinformatics Decoding & Bitstream Verification',
        summary: 'Raw sequencing FASTQ reads are aligned, multiple reads of each oligo form a consensus sequence, and error-correcting codes fix mutations.',
        chemistry: 'Bit-perfect extraction: The pristine digital byte sequence (PDF, JPEG, Operating System) is reconstructed with 100% fidelity.',
        specs: {
            accuracy: 'Bit error rate: 0.00000000% (100% loss-free recovery)',
            verification: 'Cryptographic SHA-256 hash match',
            readoutTime: 'Minutes to hours depending on sequencing run'
        }
    }
};

function initPipeline() {
    const steps = [1, 2, 3, 4, 5];
    steps.forEach(num => {
        const btn = document.getElementById(`pipeline-btn-${num}`);
        if (btn) {
            btn.addEventListener('click', () => selectPipelineStep(num));
        }
    });
    // Default open step 1
    selectPipelineStep(1);
}

function selectPipelineStep(stepNum) {
    const data = PIPELINE_DATA[stepNum];
    if (!data) return;

    for (let i = 1; i <= 5; i++) {
        const btn = document.getElementById(`pipeline-btn-${i}`);
        if (btn) {
            if (i === stepNum) {
                btn.classList.add('active-step');
            } else {
                btn.classList.remove('active-step');
            }
        }
    }

    const titleEl = document.getElementById('pipeline-detail-title');
    const summaryEl = document.getElementById('pipeline-detail-summary');
    const chemEl = document.getElementById('pipeline-detail-chem');
    const spec1El = document.getElementById('pipeline-spec-1');
    const spec2El = document.getElementById('pipeline-spec-2');
    const spec3El = document.getElementById('pipeline-spec-3');

    if (titleEl) titleEl.textContent = data.title;
    if (summaryEl) summaryEl.textContent = data.summary;
    if (chemEl) chemEl.textContent = data.chemistry;
    if (spec1El) spec1El.innerHTML = `<strong>Performance / Density:</strong> ${data.specs.density || data.specs.cost || data.specs.power || data.specs.throughput || data.specs.accuracy}`;
    if (spec2El) spec2El.innerHTML = `<strong>Lifespan / Accuracy:</strong> ${data.specs.redundancy || data.specs.speed || data.specs.halfLife || data.specs.errorRate || data.specs.verification}`;
    if (spec3El) spec3El.innerHTML = `<strong>State of Art:</strong> ${data.specs.bottleneck || data.specs.footprint || data.specs.randomAccess || data.specs.readoutTime}`;
}

// ============================================================================
// 7. AUDIENCE POLLING & POSTER ENGAGEMENT
// ============================================================================

function initPoll() {
    // Poll 1: Trust
    setupPollButtons('trust', ['yes', 'unsure', 'no']);
    // Poll 2: Timeline
    setupPollButtons('timeline', ['soon', 'decade', 'distant']);
    // Poll 3: Bottleneck
    setupPollButtons('bottleneck', ['cost', 'speed', 'error']);

    const resetBtn = document.getElementById('btn-reset-poll');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            localStorage.removeItem('dna_poster_votes');
            localStorage.removeItem('dna_user_voted');
            appState.pollEpoch = (appState.pollEpoch || 0) + 1; // cancel pending simulated votes
            appState.pollVotes = {
                trust: { yes: 68, unsure: 24, no: 12 },
                timeline: { soon: 35, decade: 58, distant: 11 },
                bottleneck: { cost: 62, speed: 28, error: 14 }
            };
            appState.userVoted = { trust: false, timeline: false, bottleneck: false };
            renderAllPolls();
            showToast('Poll reset to initial conference baseline!');
        });
    }
}

function setupPollButtons(pollCategory, options) {
    options.forEach(opt => {
        const btn = document.getElementById(`poll-btn-${pollCategory}-${opt}`);
        if (btn) {
            btn.addEventListener('click', () => {
                castVote(pollCategory, opt);
            });
        }
    });
}

function castVote(category, choice) {
    if (appState.userVoted[category]) {
        showToast('You already voted in this category! Thanks for participating.');
        return;
    }

    if (!appState.pollVotes[category][choice]) {
        appState.pollVotes[category][choice] = 0;
    }
    appState.pollVotes[category][choice]++;
    appState.userVoted[category] = true;

    // Epoch guard: a scheduled "simulated attendee" must never fire after
    // the poll has been reset mid-wait.
    const epoch = appState.pollEpoch || 0;

    saveVotesToStorage();
    renderAllPolls();
    showToast('Vote counted! Results updated in real time.');

    // Simulated attendees voting after 2 seconds
    setTimeout(() => {
        if ((appState.pollEpoch || 0) === epoch) {
            simulateAttendeeVote(category);
        }
    }, 2000);
}

function simulateAttendeeVote(category) {
    const keys = Object.keys(appState.pollVotes[category]);
    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    appState.pollVotes[category][randomKey]++;
    saveVotesToStorage();
    renderAllPolls();
}

function renderAllPolls() {
    renderSinglePoll('trust', ['yes', 'unsure', 'no']);
    renderSinglePoll('timeline', ['soon', 'decade', 'distant']);
    renderSinglePoll('bottleneck', ['cost', 'speed', 'error']);
}

function renderSinglePoll(category, options) {
    const votes = appState.pollVotes[category];
    const total = options.reduce((sum, opt) => sum + (votes[opt] || 0), 0);

    const totalEl = document.getElementById(`total-votes-${category}`);
    if (totalEl) totalEl.textContent = total;

    options.forEach(opt => {
        const count = votes[opt] || 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        
        const pctEl = document.getElementById(`pct-${category}-${opt}`);
        const barEl = document.getElementById(`bar-${category}-${opt}`);
        
        if (pctEl) pctEl.textContent = `${pct}%`;
        if (barEl) {
            barEl.style.width = `${pct}%`;
        }
    });

    const statusEl = document.getElementById(`poll-status-${category}`);
    if (statusEl && appState.userVoted[category]) {
        statusEl.classList.remove('hidden');
    }
}

function saveVotesToStorage() {
    try {
        localStorage.setItem('dna_poster_votes', JSON.stringify(appState.pollVotes));
        localStorage.setItem('dna_user_voted', JSON.stringify(appState.userVoted));
    } catch (e) {
        // LocalStorage might be disabled in sandboxed contexts
    }
}

function loadStoredVotes() {
    try {
        const storedVotes = localStorage.getItem('dna_poster_votes');
        const storedVoted = localStorage.getItem('dna_user_voted');
        if (storedVotes) {
            const parsed = JSON.parse(storedVotes);
            // Merge over defaults so missing/stale keys never break rendering
            appState.pollVotes = {
                trust: { yes: 0, unsure: 0, no: 0, ...parsed.trust },
                timeline: { soon: 0, decade: 0, distant: 0, ...parsed.timeline },
                bottleneck: { cost: 0, speed: 0, error: 0, ...parsed.bottleneck }
            };
        }
        if (storedVoted) {
            appState.userVoted = { trust: false, timeline: false, bottleneck: false, ...JSON.parse(storedVoted) };
        }
    } catch (e) {}
}

// ============================================================================
// 8. POSTER QR CODE MODAL & PRINT/SHARING UTILITIES
// ============================================================================

function initQRModal() {
    const openBtn = document.getElementById('btn-open-qr');
    const closeBtn = document.getElementById('btn-close-qr');
    const modal = document.getElementById('qr-modal');
    const qrInput = document.getElementById('qr-url-input');
    const generateBtn = document.getElementById('btn-generate-qr');
    const copyUrlBtn = document.getElementById('btn-copy-url');
    const downloadQrBtn = document.getElementById('btn-download-qr');

    if (openBtn && modal) {
        openBtn.addEventListener('click', () => {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            // Populate current URL if empty
            if (qrInput && (!qrInput.value || qrInput.value === '')) {
                qrInput.value = window.location.href.split('#')[0];
            }
            generateQRCode(qrInput ? qrInput.value : window.location.href);
        });
    }

    if (closeBtn && modal) {
        closeBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        });
    }

    // Click outside to close
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }
        });
    }

    if (generateBtn && qrInput) {
        generateBtn.addEventListener('click', () => {
            generateQRCode(qrInput.value);
        });
    }

    if (copyUrlBtn && qrInput) {
        copyUrlBtn.addEventListener('click', () => {
            copyToClipboard(qrInput.value, 'URL copied to clipboard!');
        });
    }

    if (downloadQrBtn) {
        downloadQrBtn.addEventListener('click', downloadQRImage);
    }
}

/**
 * Robust Standalone QR Code Generator
 * Uses standard qrcode.js if available via CDN, or draws a crisp vector SVG QR matrix
 */
function generateQRCode(textToEncode) {
    const container = document.getElementById('qrcode-target');
    if (!container) return;
    container.innerHTML = '';

    const text = textToEncode && textToEncode.trim().length > 0 
        ? textToEncode.trim() 
        : window.location.href;

    // The QRCode library is vendored locally (vendor/qrcode.min.js), so it
    // should always be available — even fully offline.
    if (typeof QRCode !== 'undefined') {
        new QRCode(container, {
            text: text,
            width: 190,
            height: 190,
            colorDark: "#070b14",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.M
        });
    } else {
        container.innerHTML = '<p class="text-xs text-red-400 text-center px-4">QR library failed to load.<br>Open this page over a network connection once, then it will work offline too.</p>';
    }
}

/**
 * Download the generated QR image (PNG from qrcode.js, or SVG fallback)
 */
function downloadQRImage() {
    const container = document.getElementById('qrcode-target');
    if (!container) return;

    // Check if it's an <img> (from qrcode.js) or <canvas> or <svg>
    const img = container.querySelector('img');
    const canvas = container.querySelector('canvas');
    const svg = container.querySelector('svg');

    if (img && img.src) {
        triggerDownload(img.src, 'dna-storage-poster-qr.png');
    } else if (canvas) {
        triggerDownload(canvas.toDataURL('image/png'), 'dna-storage-poster-qr.png');
    } else if (svg) {
        const svgData = new XMLSerializer().serializeToString(svg);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const svgUrl = URL.createObjectURL(svgBlob);
        triggerDownload(svgUrl, 'dna-storage-poster-qr.svg');
    } else {
        showToast('Please generate QR first.');
    }
}

function triggerDownload(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast(`Downloaded ${filename} for your poster!`);
}

// ============================================================================
// 8.5 HELP / HOW-TO-USE MODAL & WELCOME CARD (non-technical onboarding)
// ============================================================================

function initHelpModal() {
    const openBtn = document.getElementById('btn-open-help');
    const closeBtn = document.getElementById('btn-close-help');
    const modal = document.getElementById('help-modal');

    if (openBtn && modal) {
        openBtn.addEventListener('click', () => {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        });
    }

    if (closeBtn && modal) {
        closeBtn.addEventListener('click', () => closeModal(modal));
    }

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal(modal);
        });
    }

    // ESC closes any open modal (help or QR)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (modal && !modal.classList.contains('hidden')) closeModal(modal);
            const qrModal = document.getElementById('qr-modal');
            if (qrModal && !qrModal.classList.contains('hidden')) closeModal(qrModal);
        }
    });
}

function closeModal(modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function initWelcomeCard() {
    const card = document.getElementById('welcome-card');
    const dismissBtn = document.getElementById('btn-dismiss-welcome');
    if (!card || !dismissBtn) return;

    // Remember dismissal, but always show it again on a fresh visit to the
    // poster page the next day (so new attendees still see the guide).
    const dismissedOn = localStorage.getItem('dna_welcome_dismissed');
    const today = new Date().toDateString();
    if (dismissedOn === today) {
        card.classList.add('hidden');
    }

    dismissBtn.addEventListener('click', () => {
        card.classList.add('hidden');
        try {
            localStorage.setItem('dna_welcome_dismissed', today);
        } catch (e) {}
    });
}

// ============================================================================
// 9. TOAST NOTIFICATIONS
// ============================================================================

function showToast(message) {
    let toast = document.getElementById('app-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'app-toast';
        toast.className = 'fixed bottom-5 right-5 z-50 bg-slate-900 border border-bio-cyan text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 transform transition-all duration-300 translate-y-12 opacity-0 text-sm font-medium';
        document.body.appendChild(toast);
    }

    toast.innerHTML = `
        <svg class="w-5 h-5 text-bio-cyan shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        <span>${message}</span>
    `;

    toast.classList.remove('translate-y-12', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');

    setTimeout(() => {
        toast.classList.add('translate-y-12', 'opacity-0');
        toast.classList.remove('translate-y-0', 'opacity-100');
    }, 2800);
}

