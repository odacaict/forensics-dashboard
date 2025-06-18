(function () {
    /**
     * Variantă NOUĂ: Analiza și conexiunile se fac pe baza răspunsului de la server (secundare.txt)
     */
    function detectFromServer() {
        const raportBox = document.getElementById('raportBox');
        raportBox.innerHTML = "Se procesează...";

        // 1. Cere backendului să scrie denumirile în secundare.txt
        fetch('http://localhost:5000/analizeaza_secundare', { method: 'POST' })
            .then(res => res.json())
            .then(data => {
                if (data.status !== 'ok') {
                    raportBox.innerHTML = "Eroare server: " + (data.message || "");
                    return;
                }
                // 2. După ce s-a scris secundare.txt, îl citim
                fetch('http://localhost:5000/get_secundare')
                    .then(resp => resp.text())
                    .then(txt => {
                        // 3. Desenează liniile/conexiunile pe baza denumirilor din secundare.txt
                        const secNames = txt.trim().split('\n').map(s => s.trim()).filter(Boolean);
                        let count = 0;

                        // Șterge toate conexiunile vechi
                        if (typeof window.connections !== 'undefined') window.connections = [];
                        if (typeof window.updateSVGConnections === 'function') window.updateSVGConnections();

                        // Miniatura principală
                        const mainMini = document.querySelector('.miniature.main-script:not(.hidden)');
                        if (!mainMini) {
                            raportBox.innerHTML = "⚠️ Script principal lipsă în UI!";
                            return;
                        }
                        const miniatures = window.miniatures || {};
                        // Pentru fiecare secundar, găsește miniatura și trasează linia
                        secNames.forEach(secName => {
                            // Caută miniatura secundară după data-filename
                            let miniSec = null;
                            for (const key in miniatures) {
                                if (
                                    miniatures[key].dataset &&
                                    miniatures[key].dataset.filename &&
                                    miniatures[key].dataset.filename.trim() === secName
                                ) {
                                    miniSec = miniatures[key];
                                    break;
                                }
                            }
                            if (miniSec && typeof window.createConnection === 'function') {
                                window.createConnection(mainMini.dataset.miniid, miniSec.dataset.miniid);
                                count++;
                            }
                        });
                        raportBox.innerHTML = `Legături detectate: ${count}\n\n${secNames.join('\n')}`;
                        if (typeof showMsg === 'function') showMsg('✔️ Analiză importuri din secundare finalizată!', '#2cbb68');
                    })
                    .catch(() => {
                        raportBox.innerHTML = 'Nu am putut citi secundare.txt!';
                    });
            })
            .catch(() => {
                raportBox.innerHTML = "Eroare la comunicarea cu serverul Flask!";
            });
    }

    // Vechea funcție locală, dacă vrei să o folosești pe viitor (nu mai e activă la butonul START)
    function detectImportsFromMainLocal() {
        const raportBox = document.getElementById('raportBox');

        // 1. Miniatura principală
        const mainMini = document.querySelector('.miniature.main-script:not(.hidden)');
        if (!mainMini) {
            raportBox.innerHTML = "<span style='color:red'>⚠️ Încarcă mai întâi scriptul principal!</span>";
            return;
        }
        const mainFilename = mainMini.dataset.filename;    // ex: "principal.py"
        const mainName = mainFilename.replace(/\.py$/i, '');
        const mainContent = mainMini.dataset.fullcontent; // codul sursă

        // 2. Extragem entitățile (def/class) și păstrăm primul al doilea cuvânt
        const entities = []; // { type: 'Functia'|'Clasa', name: string }
        mainContent.split(/\r?\n/).forEach(line => {
            const t = line.trim();
            if (t.startsWith('def ') || t.startsWith('class ')) {
                const parts = t.split(/\s+/);
                const type = parts[0] === 'def' ? 'Functia' : 'Clasa';
                entities.push({ type, name: parts[1] });
            }
        });

        // 3. Miniaturile secundare și filtrul pe linii de import
        const secMinis = Array.from(document.querySelectorAll('.miniature.sec-script'));
        const importedFiles = secMinis
            .map(mini => {
                const content = mini.dataset.fullcontent;
                const lines = content.split(/\r?\n/);
                // găsim liniile care încep cu import/from *și* conțin mainName (chiar cu punct înainte)
                const imp = lines.filter(l => {
                    const tr = l.trim();
                    return  (tr.startsWith('import ' + mainName) ||
                             tr.startsWith('from ' + mainName)   ||
                             tr.startsWith('import ' + mainName + '.') ||
                             tr.startsWith('from ' + mainName + '.'));
                });
                return imp.length ? { mini, imports: imp } : null;
            })
            .filter(x => x);

        // 4. Construim raportul text
        const reportLines = [];
        reportLines.push(`Principal: ${mainName}`);
        entities.forEach((e, i) => {
            reportLines.push(`${i + 1}. ${e.type} : ${e.name}`);
        });
        reportLines.push('========================');
        reportLines.push('Fisiere care fac importuri:');

        if (importedFiles.length === 0) {
            reportLines.push('Niciun fișier secundar nu importă modulul principal.');
        } else {
            importedFiles.forEach((item, idx) => {
                const fname = item.mini.dataset.filename;
                // 4.1 Pentru fiecare entitate cautăm apariția în tot codul fișierului
                const matches = entities.filter(e => {
                    return new RegExp(`\\b${e.name}\\b`).test(item.mini.dataset.fullcontent);
                });
                if (matches.length) {
                    reportLines.push(`${idx + 1}. ${fname}, importa functia/clasa:`);
                    matches.forEach((e, j) => {
                        reportLines.push(`${String.fromCharCode(97 + j)}) ${e.name}`);
                    });
                } else {
                    reportLines.push(`${idx + 1}. ${fname}`);
                }
            });
        }

        // 5. Afișăm raportul
        raportBox.innerHTML = `<pre>${reportLines.join('\n')}</pre>`;
        // (opțional) notificăm utilizatorul
        if (typeof showMsg === 'function') {
            showMsg('Raport generat cu succes!', '#2cbb68');
        }
    }

    // Setează detecția server la butonul START
    window.detectImportsFromMain = detectFromServer;
    // Pentru fallback sau debug:
    window.detectImportsFromMainLocal = detectImportsFromMainLocal;
})();
