(function () {
    /**
     * Versiune îmbunătățită: Analiza detaliată cu evidențierea entităților
     */
    function detectFromServerDetailed() {
        const raportBox = document.getElementById('raportBox');
        raportBox.innerHTML = "Se procesează analiza detaliată...";

        // 1. Cere backendului să analizeze și să scrie rezultatele
        fetch('http://localhost:5000/analizeaza_secundare', { method: 'POST' })
            .then(res => res.json())
            .then(data => {
                if (data.status !== 'ok') {
                    raportBox.innerHTML = "Eroare server: " + (data.message || "");
                    return;
                }
                
                // Salvează analiza detaliată global
                if (window.detailedAnalysis !== undefined) {
                    window.detailedAnalysis = data.analysis || {};
                }
                
                // 2. După analiză, citește lista de fișiere care importă
                fetch('http://localhost:5000/get_secundare')
                    .then(resp => resp.text())
                    .then(txt => {
                        // 3. Desenează liniile și pregătește raportul detaliat
                        const secNames = txt.trim().split('\n').map(s => s.trim()).filter(Boolean);
                        let count = 0;
                        let detailedReport = [];

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
                        detailedReport.push(`<strong>Analiză detaliată importuri</strong>\n`);
                        detailedReport.push(`Script principal: ${mainMini.dataset.filename}\n`);
                        detailedReport.push(`═══════════════════════════════════\n`);
                        
                        // Pentru fiecare secundar, găsește miniatura și trasează linia
                        secNames.forEach((secName, idx) => {
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
                            
                            // Adaugă în raport detaliile despre ce importă
                            detailedReport.push(`${idx + 1}. ${secName}`);
                            
                            if (data.analysis && data.analysis[secName]) {
                                const details = data.analysis[secName];
                                const totalImports = details.functions.length + details.classes.length;
                                
                                if (totalImports > 0) {
                                    if (details.functions.length > 0) {
                                        detailedReport.push(`   ├─ Funcții (${details.functions.length}): ${details.functions.join(', ')}`);
                                    }
                                    if (details.classes.length > 0) {
                                        detailedReport.push(`   └─ Clase (${details.classes.length}): ${details.classes.join(', ')}`);
                                    }
                                } else {
                                    detailedReport.push(`   └─ Importă modulul complet`);
                                }
                            } else {
                                detailedReport.push(`   └─ Import detectat (detalii indisponibile)`);
                            }
                            
                            detailedReport.push('');
                        });
                        
                        detailedReport.push(`\n───────────────────────────────────`);
                        detailedReport.push(`Total conexiuni: ${count}`);
                        
                        // Afișează raportul formatat
                        raportBox.innerHTML = detailedReport.join('\n');
                        
                        // Afișează mesaj de succes
                        if (typeof showMsg === 'function') {
                            showMsg(`✔️ Analiză completă! ${count} conexiuni detectate.`, '#2cbb68');
                        }
                        
                        // Actualizează evidențierea pentru toate miniaturile vizibile
                        updateAllHighlights();
                    })
                    .catch(() => {
                        raportBox.innerHTML = 'Nu am putut citi rezultatele analizei!';
                    });
            })
            .catch(() => {
                raportBox.innerHTML = "Eroare la comunicarea cu serverul Flask!";
            });
    }

    /**
     * Actualizează evidențierea pentru toate miniaturile secundare
     */
    function updateAllHighlights() {
        const secMinis = document.querySelectorAll('.miniature.sec-script');
        secMinis.forEach(mini => {
            // Trigger re-render pentru a aplica evidențierea
            if (mini.classList.contains('pin-hover')) {
                const filename = mini.dataset.filename;
                const analysis = window.detailedAnalysis && window.detailedAnalysis[filename];
                if (analysis && typeof window.highlightImportedEntities === 'function') {
                    window.highlightImportedEntities(mini, true);
                }
            }
        });
    }

    /**
     * Funcție auxiliară pentru generarea unui raport sumar
     */
    function generateSummaryReport() {
        const mainMini = document.querySelector('.miniature.main-script:not(.hidden)');
        if (!mainMini || !window.detailedAnalysis) return '';
        
        let summary = [];
        let totalFunctions = 0;
        let totalClasses = 0;
        let uniqueFunctions = new Set();
        let uniqueClasses = new Set();
        
        for (const [filename, analysis] of Object.entries(window.detailedAnalysis)) {
            totalFunctions += analysis.functions.length;
            totalClasses += analysis.classes.length;
            analysis.functions.forEach(f => uniqueFunctions.add(f));
            analysis.classes.forEach(c => uniqueClasses.add(c));
        }
        
        summary.push(`\n═══════════════════════════════════`);
        summary.push(`SUMAR UTILIZARE:`);
        summary.push(`• Total funcții importate: ${totalFunctions}`);
        summary.push(`• Total clase importate: ${totalClasses}`);
        summary.push(`• Funcții unice: ${uniqueFunctions.size}`);
        summary.push(`• Clase unice: ${uniqueClasses.size}`);
        
        if (uniqueFunctions.size > 0) {
            summary.push(`\nTop funcții utilizate:`);
            let functionUsage = {};
            for (const [filename, analysis] of Object.entries(window.detailedAnalysis)) {
                analysis.functions.forEach(f => {
                    functionUsage[f] = (functionUsage[f] || 0) + 1;
                });
            }
            Object.entries(functionUsage)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 5)
                .forEach(([func, count]) => {
                    summary.push(`  • ${func}: ${count} fișiere`);
                });
        }
        
        return summary.join('\n');
    }

    // Setează noua funcție de detecție
    window.detectImportsFromMain = detectFromServerDetailed;
    
    // Exportă funcții auxiliare pentru debugging
    window.updateAllHighlights = updateAllHighlights;
    window.generateSummaryReport = generateSummaryReport;
})();