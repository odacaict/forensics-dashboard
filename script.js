// Utils
function el(id) { return document.getElementById(id); }
function createEl(tag, className = '') {
    const e = document.createElement(tag);
    if (className) e.className = className;
    return e;
}
function showMsg(msg, color = "#3c3c3c") {
    const log = el('messageLog');
    log.innerHTML = msg;
    log.style.color = color;
    log.scrollTop = log.scrollHeight;
}

// --- Main selectors ---
const mainInput = el('mainInput');
const secInput = el('secInput');
const browseMain = el('browseMain');
const browseSec = el('browseSec');
const loadMain = el('loadMain');
const loadSec = el('loadSec');
const progressMain = el('progressMain');
const secProgressGrid = el('secProgressGrid');
const forensicsPanel = el('forensicsPanel');
const mainScriptBox = el('mainScript');
const raportBox = el('raportBox');
const resetBtn = el('resetBtn');
const pinBtn = el('pinBtn');
const svgConnections = el('svgConnections');

// Modal
const modal = el('modal');
const modalFilename = modal.querySelector('.modal-filename');
const modalText = modal.querySelector('.modal-text');
const closeModal = el('closeModal');

// State
let mainScriptFile = null, mainScriptData = null;
let secScriptFiles = [];
let secScriptData = [];
let miniatures = {}; // id: dom element
let idSeed = 0;

// --- Pin/Board state ---
let pinMode = false;
let pinSource = null;
let pinTarget = null;
let connections = []; // {from, to, svgEl}
const MAX_CONNECTIONS = 400;

// ========== INIT PROGRESS GRID ===========
(function initSecProgressGrid() {
    secProgressGrid.innerHTML = '';
    for (let i = 0; i < 100; ++i) {
        const cell = createEl('div', 'sec-progress-cell');
        cell.dataset.index = i;
        secProgressGrid.appendChild(cell);
    }
})();

// ======= MAIN SCRIPT LOAD =========
browseMain.onclick = () => mainInput.click();
mainInput.onchange = () => {
    if (!mainInput.files.length) return;
    let f = mainInput.files[0];
    if (!f.name.endsWith('.py')) {
        showMsg('⚠️ Doar fișiere .py sunt permise pentru principal!', "#ff2929");
        mainInput.value = '';
        return;
    }
    mainScriptFile = f;
    showMsg('Script principal selectat: ' + f.name, "#229966");
};

loadMain.onclick = () => {
    if (!mainScriptFile) {
        showMsg('⚠️ Selectează un script principal!', "#ff2929");
        return;
    }
    progressMain.value = 0;
    progressMain.max = 100;
    let reader = new FileReader();
    reader.onprogress = e => {
        if (e.lengthComputable) {
            progressMain.value = (e.loaded / e.total) * 100;
        }
    };
    reader.onload = e => {
        mainScriptData = e.target.result;
        progressMain.value = 100;
        showMainScriptPreview(mainScriptFile.name, mainScriptData);
        showMsg('Script principal încărcat cu succes!', "#229966");

        const lines = mainScriptData.split('\n');
        const functions = lines.filter(l => l.trim().startsWith('def'));
        const classes = lines.filter(l => l.trim().startsWith('class'));

        let raport = `Script principal **${mainScriptFile.name}** contine :\n`;
        raport += `1. Functii (${functions.length}):\n`;
        functions.forEach((f, i) => raport += `${String.fromCharCode(97 + i)}) ${f.trim()}\n`);

        raport += `\n2. Clase (${classes.length}):\n`;
        classes.forEach((c, i) => raport += `${String.fromCharCode(97 + i)}) ${c.trim()}\n`);

        raportBox.innerText = raport;

        // === AICI trimiți la backend Flask numele fără .py ===
        const numeFaraExt = mainScriptFile.name.replace(/\.py$/, '');

        fetch('http://localhost:5000/set_principal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: numeFaraExt })
        })
        .then(res => res.json())
        .then(data => {
            if (data.status === "ok") {
                showMsg(`✔️ Denumirea '${numeFaraExt}' a fost salvată pe server!`, "#229966");
            } else {
                showMsg("❌ Eroare la salvare pe server: " + data.message, "#ff2929");
            }
        })
        .catch(() => showMsg("❌ Eroare de rețea la trimiterea către Flask!", "#ff2929"));
    };

    reader.onerror = () => {
        showMsg('❌ Eroare la citirea fișierului principal!', "#ff2929");
    };
    reader.readAsText(mainScriptFile);
};

// ========= SECONDARY SCRIPTS ===========
browseSec.onclick = () => secInput.click();
secInput.onchange = () => {
    let files = Array.from(secInput.files);
    if (!files.length) return;
    files = files.filter(f => f.name.endsWith('.py'));
    if (files.length === 0) {
        showMsg('⚠️ Doar fișiere .py sunt permise!', "#ff2929");
        secInput.value = '';
        return;
    }
    if (files.length > 100) {
        files = files.slice(0, 100);
        showMsg('Limita maxima este de 100 fișiere secundare!', "#ff2929");
    } else {
        showMsg(`Selectate ${files.length} scripturi secundare.`, "#229966");
    }
    secScriptFiles = files;
    updateSecProgressGrid(0);
};

loadSec.onclick = () => {
    if (!secScriptFiles.length) {
        showMsg(`⚠️ Selectează fișiere secundare!`, "#ff2929");
        return;
    }
    secScriptData = [];
    updateSecProgressGrid(0);

    function loadOne(idx) {
        if (idx >= secScriptFiles.length) {
            showMsg(`Toate fișierele secundare au fost încărcate!`, "#229966");
            showSecScriptsPreview();

            // RAPORT pentru secundare
            let raport = `Fisierele secundare: ${secScriptData.map(f => f.name).join(', ')}\nContin importurile:\n`;

            secScriptData.forEach(f => {
                const lines = f.content.split('\n');
                const imports = lines.filter(l => l.trim().startsWith('import') || l.trim().startsWith('from'));
                raport += `${f.name} (${imports.length}):\n`;
                imports.forEach((imp, i) => raport += `${String.fromCharCode(97 + i)}) ${imp.trim()}\n`);
                raport += '\n';
            });

            raportBox.innerText = raport;

            // === UPLOAD SECUNDARE PE BACKEND ===
            const formData = new FormData();
            secScriptFiles.forEach(f => formData.append('files', f));
            fetch('http://localhost:5000/incarca_secundare', {
                method: 'POST',
                body: formData
            })
            .then(res => res.json())
            .then(data => {
                if (data.status === "ok") {
                    showMsg(`✔️ ${data.files.length} fișiere secundare urcate pe server!`, "#229966");
                } else {
                    showMsg("❌ Eroare la upload: " + data.message, "#ff2929");
                }
            })
            .catch(() => showMsg("❌ Eroare rețea la uploadul fișierelor secundare!", "#ff2929"));

            return; // GATA
        }

        let f = secScriptFiles[idx];
        let reader = new FileReader();
        reader.onload = e => {
            secScriptData.push({
                name: f.name,
                content: e.target.result
            });
            updateSecProgressGrid(idx + 1);
            setTimeout(() => loadOne(idx + 1), 25);
        };
        reader.onerror = () => {
            showMsg(`Eroare la citirea fișierului secundar: ${f.name}`, "#ff2929");
            updateSecProgressGrid(idx + 1);
            setTimeout(() => loadOne(idx + 1), 25);
        };
        reader.readAsText(f);
    }

    loadOne(0);
};

// ===== MINIATURI & LAYOUT =====
function assignMiniId() {
    return "mini_" + (++idSeed);
}
function showMainScriptPreview(filename, content) {
    mainScriptBox.classList.remove('hidden');
    mainScriptBox.querySelector('.mini-filename').value = filename;
    mainScriptBox.querySelector('.mini-content').innerHTML = previewWordsContent(content, 5);

    let boxW = 132, boxH = 115;
    let midX = forensicsPanel.clientWidth / 2 - boxW / 2;
    let midY = forensicsPanel.clientHeight / 2 - boxH / 2;
    mainScriptBox.style.left = midX + "px";
    mainScriptBox.style.top = midY + "px";
    mainScriptBox.dataset.filename = filename;
    mainScriptBox.dataset.fullcontent = content;

    if (!mainScriptBox.dataset.miniid) {
        mainScriptBox.dataset.miniid = assignMiniId();
        miniatures[mainScriptBox.dataset.miniid] = mainScriptBox;
    }
    mainScriptBox.onclick = (e) => {
        if (pinMode) handleMiniaturePinClick(mainScriptBox, e);
        else showMagnify(filename, content);
    };
    mainScriptBox.onmouseenter = () => highlightMiniAndLines(mainScriptBox, true);
    mainScriptBox.onmouseleave = () => highlightMiniAndLines(mainScriptBox, false);
    updateAllForensicsUI();
}
function showSecScriptsPreview() {
    Array.from(forensicsPanel.querySelectorAll('.miniature.sec-script')).forEach(e => {
        if (e.dataset.miniid) delete miniatures[e.dataset.miniid];
        e.remove();
    });
    let total = secScriptData.length;
    if (total === 0) return;
    let w = forensicsPanel.clientWidth;
    let h = forensicsPanel.clientHeight;
    let margin = 10;
    // Dimensiuni miniaturi secundare
    let boxW = 264, boxH = 230;
    // Număr maxim pe fiecare latură (fără colțuri)
    let maxTop = Math.floor((w - 2 * margin) / boxW);
    let maxSide = Math.floor((h - 2 * margin) / boxH);
    // Împărțim cât mai egal pe laturi
    let topN = Math.min(maxTop, Math.ceil(total / 4));
    let rightN = Math.min(maxSide, Math.ceil((total - topN) / 3));
    let bottomN = Math.min(maxTop, Math.ceil((total - topN - rightN) / 2));
    let leftN = total - (topN + rightN + bottomN);
    let idx = 0;
    // Sus (stânga -> dreapta)
    for (let i = 0; i < topN && idx < total; ++i, ++idx) {
        let x = margin + i * ((w - 2 * margin - boxW) / Math.max(1, topN - 1));
        let y = margin;
        addMiniSecundar(idx, x, y);
    }
    // Dreapta (sus -> jos)
    for (let i = 0; i < rightN && idx < total; ++i, ++idx) {
        let x = w - margin - boxW;
        let y = margin + i * ((h - 2 * margin - boxH) / Math.max(1, rightN - 1));
        addMiniSecundar(idx, x, y);
    }
    // Jos (dreapta -> stânga)
    for (let i = 0; i < bottomN && idx < total; ++i, ++idx) {
        let x = w - margin - boxW - i * ((w - 2 * margin - boxW) / Math.max(1, bottomN - 1));
        let y = h - margin - boxH;
        addMiniSecundar(idx, x, y);
    }
    // Stânga (jos -> sus)
    for (let i = 0; i < leftN && idx < total; ++i, ++idx) {
        let x = margin;
        let y = h - margin - boxH - i * ((h - 2 * margin - boxH) / Math.max(1, leftN - 1));
        addMiniSecundar(idx, x, y);
    }
    updateAllForensicsUI();
    function addMiniSecundar(i, x, y) {
        let data = secScriptData[i];
        let mini = createEl('div', 'miniature sec-script');
        mini.style.left = x + "px";
        mini.style.top = y + "px";
        let miniid = assignMiniId();
        mini.dataset.miniid = miniid;
        miniatures[miniid] = mini;
        let filenameBox = createEl('input', 'mini-filename');
        filenameBox.value = data.name;
        filenameBox.setAttribute('readonly', true);
        mini.appendChild(filenameBox);
        let cont = createEl('div', 'mini-content');
        cont.innerHTML = previewWordsContent(data.content, 10); // 10 linii
        mini.appendChild(cont);
        mini.dataset.filename = data.name;
        mini.dataset.fullcontent = data.content;
        mini.onclick = (e) => {
            if (pinMode) handleMiniaturePinClick(mini, e);
            else showMagnify(data.name, data.content);
        };
        mini.onmouseenter = () => highlightMiniAndLines(mini, true);
        mini.onmouseleave = () => highlightMiniAndLines(mini, false);
        forensicsPanel.appendChild(mini);
    }
}

// ========== PIN & SVG LINES ==========
pinBtn.onclick = () => {
    pinMode = !pinMode;
    pinBtn.classList.toggle('active', pinMode);
    showMsg(pinMode ? "Modul Pin activat! Selectează două miniaturi pentru a crea o conexiune." : "Modul Pin dezactivat.", pinMode ? "#2cbb68" : "#f79a42");
    if (!pinMode) clearPinSelection();
};

function handleMiniaturePinClick(mini, event) {
    if (!pinSource) {
        pinSource = mini;
        mini.classList.add('pin-selected');
        showMsg("Selectează a doua miniatură (destinație).", "#faea42");
        return;
    }
    if (mini === pinSource) {
        showMsg("Nu poți conecta la aceeași miniatură!", "#ff2929");
        return;
    }
    pinTarget = mini;
    let srcID = pinSource.dataset.miniid, tgtID = pinTarget.dataset.miniid;
    if (connections.some(c => (c.from === srcID && c.to === tgtID))) {
        showMsg("Conexiunea deja există!", "#ff2929");
        clearPinSelection();
        return;
    }
    if (connections.length >= MAX_CONNECTIONS) {
        showMsg("S-a atins limita de conexiuni (400)!", "#ff2929");
        clearPinSelection();
        return;
    }
    createConnection(srcID, tgtID);
    clearPinSelection();
    showMsg("Conexiune creată!", "#22bb44");
}
function clearPinSelection() {
    pinSource = null; pinTarget = null;
    Object.values(miniatures).forEach(m => m.classList.remove('pin-selected'));
}
function createConnection(fromID, toID) {
    connections.push({ from: fromID, to: toID });
    updateSVGConnections();
    updateReport();
}
function removeConnection(fromID, toID) {
    connections = connections.filter(c => !(c.from === fromID && c.to === toID));
    updateSVGConnections();
    updateReport();
}

function highlightMiniAndLines(mini, active) {
    if (!mini) return;
    if (active) mini.classList.add('pin-hover');
    else mini.classList.remove('pin-hover');
    connections.forEach(conn => {
        if (conn.from === mini.dataset.miniid || conn.to === mini.dataset.miniid) {
            if (conn.svgEl) {
                if (active) conn.svgEl.classList.add('selected');
                else conn.svgEl.classList.remove('selected');
            }
        }
    });
}

// ======= SVG LINES RENDERING ======
function getMiniCenter(mini) {
    let rect = mini.getBoundingClientRect();
    let panelRect = forensicsPanel.getBoundingClientRect();
    let x = rect.left - panelRect.left + rect.width / 2;
    let y = rect.top - panelRect.top + rect.height / 2;
    return [x, y];
}
function updateSVGConnections() {
    svgConnections.innerHTML = '';
    connections.forEach((conn, idx) => {
        let fromEl = miniatures[conn.from];
        let toEl = miniatures[conn.to];
        if (!fromEl || !toEl) return;
        let [x1, y1] = getMiniCenter(fromEl);
        let [x2, y2] = getMiniCenter(toEl);

        // Linie
        let line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute('x1', x1); line.setAttribute('y1', y1);
        line.setAttribute('x2', x2); line.setAttribute('y2', y2);
        line.setAttribute('class', 'connection-line');
        if (conn.selected) line.classList.add('selected');
        line.onmouseenter = () => {
            highlightMiniAndLines(fromEl, true);
            highlightMiniAndLines(toEl, true);
            line.classList.add('selected');
            showMsg(`Conexiune: ${fromEl.dataset.filename} → ${toEl.dataset.filename}`, "#5bcfff");
        };
        line.onmouseleave = () => {
            highlightMiniAndLines(fromEl, false);
            highlightMiniAndLines(toEl, false);
            line.classList.remove('selected');
            showMsg('', "#3c3c3c");
        };
        line.onclick = (e) => {
            e.stopPropagation();
            if (confirm(`Ștergi conexiunea?\n${fromEl.dataset.filename} → ${toEl.dataset.filename}`)) {
                removeConnection(conn.from, conn.to);
            }
        };
        svgConnections.appendChild(line);

        // Pin bolt la capăt
        let pinCirc = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        pinCirc.setAttribute('cx', x2);
        pinCirc.setAttribute('cy', y2);
        pinCirc.setAttribute('r', 8.3);
        pinCirc.setAttribute('class', 'connection-pin');
        pinCirc.style.cursor = 'pointer';
        pinCirc.title = "Șterge conexiunea";
        pinCirc.onclick = (e) => {
            e.stopPropagation();
            if (confirm(`Ștergi conexiunea?\n${fromEl.dataset.filename} → ${toEl.dataset.filename}`)) {
                removeConnection(conn.from, conn.to);
            }
        };
        svgConnections.appendChild(pinCirc);

        // Săgeată la capătul liniei (SVG Polygon)
        let arrow = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        let dir = Math.atan2(y2 - y1, x2 - x1);
        let arrowLen = 18, arrowW = 9;
        let ax = x2 - Math.cos(dir) * 12, ay = y2 - Math.sin(dir) * 12;
        let points = [
            [ax, ay],
            [ax - Math.cos(dir - 0.5) * arrowLen, ay - Math.sin(dir - 0.5) * arrowLen],
            [ax - Math.cos(dir + 0.5) * arrowLen, ay - Math.sin(dir + 0.5) * arrowLen]
        ].map(p => p.join(',')).join(' ');
        arrow.setAttribute('points', points);
        arrow.setAttribute('class', 'connection-arrow');
        svgConnections.appendChild(arrow);

        conn.svgEl = line;
    });
}

// ======= PROGRESS CELLS UPDATE ======
function updateSecProgressGrid(numLoaded) {
    const cells = secProgressGrid.querySelectorAll('.sec-progress-cell');
    cells.forEach((c, i) => {
        c.classList.toggle('loaded', i < numLoaded);
    });
}
resetBtn.onclick = () => {
    mainScriptFile = null;
    mainScriptData = null;
    secScriptFiles = [];
    secScriptData = [];
    mainInput.value = '';
    secInput.value = '';
    progressMain.value = 0;
    mainScriptBox.classList.add('hidden');
    Object.values(miniatures).forEach(e => e.remove());
    miniatures = {};
    idSeed = 0;
    connections = [];
    svgConnections.innerHTML = '';
    updateSecProgressGrid(0);
    showMsg('Panoul a fost resetat! 🧽', "#229966");
    raportBox.value = '';
};

// ======= PREVIEW LINES WORDS ======
function previewWordsContent(content, numLines = 5) {
    let lines = content.split('\n');
    let preview = [];
    for (let i = 0; i < Math.min(numLines, lines.length); i++) {
        let words = lines[i].trim().split(/\s+/).slice(0, 4).join(' ');
        preview.push(`<span style="display:block; font-size:0.97em; font-weight:700; margin-bottom:0.2em">${words}${words.length < lines[i].trim().length ? ' ...' : ''}</span>`);
    }
    if (lines.length > numLines) preview.push("<span style='font-weight:normal'>...</span>");
    return preview.join('');
}

// ======= RAPORT LOGIC ======
/*function updateReport() {
    let lines = [];
    if (mainScriptFile) lines.push(`Script principal: ${mainScriptFile.name}`);
    if (secScriptData.length) {
        lines.push(`Scripturi secundare: ${secScriptData.map(s => s.name).join(", ")}`);
    }
    if (connections.length) {
        lines.push('\nConexiuni:');
        connections.forEach(conn => {
            let fromEl = miniatures[conn.from], toEl = miniatures[conn.to];
            if (fromEl && toEl) {
                lines.push(`  ${fromEl.dataset.filename} -> ${toEl.dataset.filename}`);
            }
        });
    }
    raportBox.value = lines.join('\n');
}
*/

function updateReport() {
    fetch('raport.txt')
        .then(response => response.text())
        .then(text => {
            raportBox.value = text;
        })
        .catch(err => {
            raportBox.value = 'nu detectez.';
        });
}

// ======= EVENTS & RESIZE =======
document.addEventListener('mousedown', e => {
    if (e.target.classList.contains('mini-filename')) e.preventDefault();
});
window.addEventListener('resize', () => {
    if (secScriptData.length) showSecScriptsPreview();
    if (mainScriptData) showMainScriptPreview(mainScriptFile.name, mainScriptData);
    updateSVGConnections();
});
mainScriptBox.ondblclick = () => {
    if (mainScriptFile) {
        raportBox.value = `Raport pentru: ${mainScriptFile.name}\n\nPrimele linii:\n${mainScriptData.split('\n').slice(0,10).join('\n')}`;
    }
};
function updateAllForensicsUI() {
    updateSVGConnections();
}

// Modal logic
function showMagnify(filename, content) {
    modal.classList.remove('hidden');
    modalFilename.value = filename;
    modalText.textContent = content;
    setTimeout(() => modalText.scrollTop = 0, 20);
}
closeModal.onclick = () => modal.classList.add('hidden');
modal.onclick = e => { if (e.target === modal) modal.classList.add('hidden'); }
// === RAPORT LA START ===
function generateImportReport() {
    let lines = [];

    // Script p1rincipal
    if (mainScriptData && mainScriptFile) {
        const importCount = mainScriptData.split('\n').filter(l => l.trim().startsWith('import')).length;
        const fromCount = mainScriptData.split('\n').filter(l => l.trim().startsWith('from')).length;
        lines.push(`Script principal: ${mainScriptFile.name}`);
        lines.push(`  - import: ${importCount} linii`);
        lines.push(`  - from: ${fromCount} linii`);
        lines.push('');
    }

    // Scripturi secundare
    secScriptData.forEach(f => {
        const importCount = f.content.split('\n').filter(l => l.trim().startsWith('import')).length;
        const fromCount = f.content.split('\n').filter(l => l.trim().startsWith('from')).length;
        lines.push(`Script secundar: ${f.name}`);
        lines.push(`  - import: ${importCount} linii`);
        lines.push(`  - from: ${fromCount} linii`);
        lines.push('');
    });

    raportBox.value = lines.join('\n');
}
el("butonStart").addEventListener("click", detectImportsFromMain);
window.addEventListener('load', updateReport);
window.mainScriptFile = mainScriptFile;
window.mainScriptData = mainScriptData;
window.secScriptData = secScriptData;
window.raportBox = raportBox;
window.mainScriptBox = mainScriptBox;
window.miniatures = miniatures;
