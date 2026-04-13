// --- LOGIK-TEIL ---
/** --- GLOBALER ZUSTAND --- **/			
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js'; //laden der Bibliothek
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// Initialisierung von Audio-Kontext für Soundeffekte        
let quizData = [], currentIndex = 0, score = 0, userMistakes = []; 
let isMuted = localStorage.getItem('quiz_muted') === 'true';

/** --- AUDIO LOGIK --- **/
//Aussehen der Schaltfläche Mute/Unmute
function updateMuteUI() {
const btn = document.getElementById('mute-btn'); if (btn) btn.innerText = isMuted ? '🔇' : '🔊'; 
}
//spiechern der Einstellungen im localStorage
function toggleMute() {
isMuted = !isMuted; localStorage.setItem('quiz_muted', isMuted); updateMuteUI(); 
}

// Synthetische Sounds erzeugen (keine externen Dateien nötig)
function playSound(type) {
	if (isMuted) return;
	if (audioCtx.state === 'suspended') audioCtx.resume();
	const osc = audioCtx.createOscillator();
	const gain = audioCtx.createGain();
	osc.connect(gain); gain.connect(audioCtx.destination);
	
	if (type === 'point') { // Kleiner "Ding" Sound
		osc.type = 'sine'; osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
		gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
		osc.start(); osc.stop(audioCtx.currentTime + 0.1);
	} else if (type === 'correct') { // Erfolgs-Sound
		osc.type = 'sine'; osc.frequency.setValueAtTime(523, audioCtx.currentTime); 
		gain.gain.setValueAtTime(0.1, audioCtx.currentTime); 
		osc.start(); osc.stop(audioCtx.currentTime + 0.3);
	} else if (type === 'wrong') { // Fehler-Brummen
		osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, audioCtx.currentTime); 
		gain.gain.setValueAtTime(0.05, audioCtx.currentTime); 
		osc.start(); osc.stop(audioCtx.currentTime + 0.4); 
	}
}

/** --- PDF VORSCHAU --- **/
/**
 * PDF-Analyse via API.
 * Wandelt PDF in Base64 um und sendet sie an den Server zur Fragen-Generierung.
 */
async function previewPDF(input) {
    const file = input.files[0]; 
	if (!file || file.type !== "application/pdf") return;
    document.getElementById('file-name').innerText = file.name;
    document.getElementById('pdf-preview-box').classList.remove('hidden');
    const reader = new FileReader();
    reader.onload = async function() {
        const typedarray = new Uint8Array(this.result);
        const pdf = await pdfjsLib.getDocument(typedarray).promise;
        const page = await pdf.getPage(1);
        const canvas = document.getElementById('pdf-canvas');
        const ctx = canvas.getContext('2d');
        const viewport = page.getViewport({ scale: 0.5 });
        canvas.height = viewport.height; canvas.width = viewport.width;
        await page.render({ canvasContext: ctx, viewport: viewport }).promise;
    };
    reader.readAsArrayBuffer(file);
}

/** --- QUIZ LOGIK --- **/
// --- Core Quiz Flow ---
function resetStats() { currentIndex = 0; score = 0; userMistakes = []; gameDone = false; }

// KI-Quiz generieren (Server-Anfrage)
async function startQuizGeneration() {
	resetStats();
	const file = document.getElementById('pdf-file').files[0]; 
	if (!file) return alert("PDF fehlt!");
	
	toggleCard('status');
	const statusText = document.getElementById('status-text');
    statusText.innerText = "PDF wird analysiert...";
	
	try {
		const base64 = (await toBase64(file)).split(',')[1];
		
		//Timeout-Schutz vorbereiten 30 Sektionen
		const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);		
				
		const res = await fetch('/api/quiz', { 
			method: 'POST', 
			headers: { 'Content-Type': 'application/json' }, 
			body: JSON.stringify({ 
				pdfBase64: base64, 
				questionCount: document.getElementById('question-count').value 
			}) 
		});
		
		clearTimeout(timeoutId); // Timeout löschen, da Antwort kam
		
		// PRÜFUNG: War der Server-Antwort-Status erfolgreich?
        if (!res.ok) {
            let errorMsg = "Server-Fehler";
            if (res.status === 413) errorMsg = "Die PDF-Datei ist zu groß für die KI-Analyse.";
            if (res.status === 504 || res.status === 500) errorMsg = "Der Server antwortet nicht (Timeout).";
            throw new Error(errorMsg);
        }
		
		let data = await res.json(); 

		// PDF-ERGEBNISSE MISCHEN ---
		shuffleArray(data); // Fragen-Reihenfolge würfeln
		data.forEach(q => {
			const correctText = q.options[q.answer]; // Richtige Antwort sichern
			shuffleArray(q.options); // Antwortmöglichkeiten würfeln
			q.answer = q.options.indexOf(correctText); // Index neu setzen
		});
		
		quizData = data; // Gemischte Daten speichern
		toggleCard('quiz-container'); 
		showQuestion();
		
	} catch (err) { 
		// Differenzierte Fehlermeldung
        let userMessage = "Fehler: ";
        if (err.name === 'AbortError') {
            userMessage += "Die Analyse dauert zu lange. Versuche es mit einer kleineren PDF.";
        } else {
            userMessage += err.message;
        }

        console.error("Quiz-Error:", err); // Für Entwickler in der Konsole
        alert(userMessage); // Für den Endnutzer
        goToHome(); 
    }
}

// Anzeige der aktuellen Frage
function showQuestion() {
    if (currentIndex >= quizData.length) { showRes(); return; }
	
	// Pausen-Trigger bei der Hälfte
    if (currentIndex === Math.floor(quizData.length / 2) && !gameDone && quizData.length > 2) {
        gameDone = true; 
        document.getElementById('quiz-content').classList.add('hidden'); 
        document.getElementById('game-screen').classList.remove('hidden'); 
        document.getElementById('quiz-game-selection').classList.remove('hidden'); 
        document.getElementById('active-game-area').classList.add('hidden'); 
        return;
    }
    document.getElementById('quiz-content').classList.remove('hidden'); 
    document.getElementById('game-screen').classList.add('hidden'); 
    document.getElementById('feedback-area').classList.add('hidden');
    document.getElementById('result-screen').classList.add('hidden');
    const q = quizData[currentIndex];
    document.getElementById('progress-bar').style.width = `${(currentIndex / quizData.length) * 100}%`;
    document.getElementById('q-count').innerText = `Frage ${currentIndex + 1} von ${quizData.length}`;
    document.getElementById('question-text').innerText = q.question;
    const optDiv = document.getElementById('options'); 
    optDiv.innerHTML = '';
    q.options.forEach((opt, i) => {
        const b = document.createElement('button'); 
        b.className = "option-btn w-full text-left p-4 rounded-xl border-2 border-slate-100 transition-all font-medium bg-white hover:border-blue-200 shadow-sm"; 
        b.innerText = opt;
        b.onclick = () => {
		// Antwortprüfung
            document.querySelectorAll('.option-btn').forEach(btn => btn.disabled = true);
            const isCorrect = (i === q.answer); 
            const area = document.getElementById('feedback-area'); 
            const txt = document.getElementById('feedback-text');
            if (isCorrect) { 
                score++; playSound('correct'); 
                b.classList.add('border-green-500', 'bg-green-50'); 
                txt.innerHTML = "✨ Richtig!"; 
                txt.className = "text-green-600 font-bold";
            } else {
                userMistakes.push({ q: q.question, g: opt, c: q.options[q.answer] }); 
                playSound('wrong'); 
                b.classList.add('border-red-500', 'bg-red-50');
                if(q.answer !== -1) document.querySelectorAll('.option-btn')[q.answer].classList.add('border-green-400', 'bg-green-50');
                txt.innerHTML = `
					<span class="text-red-600 font-bold">❌ Falsch.</span><br> 
					<span class="text-green-600 font-bold">Richtig ist: </span>
					<span class="text-black font-bold underline">${q.options[q.answer]}</span>
				`; 
                txt.className = "text-red-600 font-bold";
            }
            area.classList.remove('hidden');
            document.getElementById('next-q-btn').onclick = () => { currentIndex++; showQuestion(); };
        };
        optDiv.appendChild(b);
    });
}

// Ergebnis-Zusammenfassung anzeigen
function showRes() {
    document.getElementById('quiz-content').classList.add('hidden');
    document.getElementById('result-screen').classList.remove('hidden');
    document.getElementById('progress-bar').style.width = "100%";
    const total = quizData.length;
    const percent = Math.round((score / total) * 100);
    document.getElementById('score-display').innerText = `${score} von ${total} richtig (${percent}%)`;
    const analysis = document.getElementById('mistake-analysis');
    if (userMistakes.length > 0) {
        analysis.innerHTML = userMistakes.map((m, idx) => `
            <div class="mistake-card p-3 bg-white border border-slate-200 rounded-xl text-xs shadow-sm border-l-red-500">
                <p class="font-bold mb-1 text-slate-800">Frage: ${m.q}</p>
                <p class="text-red-500">❌ Deine Wahl: ${m.g}</p>
                <p class="text-green-600 font-bold">✅ Lösung: ${m.c}</p>
            </div>`).join('');
    } else { 
        analysis.innerHTML = '<div class="text-center p-6 bg-green-50 rounded-2xl border-2 border-green-100"><p class="text-green-600 font-black text-lg">PERFEKT! 100% 🌟</p></div>'; 
    }
    const h = JSON.parse(localStorage.getItem('quiz_history') || '[]'); 
    h.unshift({d: new Date().toLocaleDateString(), p: percent}); 
    localStorage.setItem('quiz_history', JSON.stringify(h.slice(0,10))); 
    renderHistory();
}

/** --- DATEN IMPORT / EXPORT --- **/
function importCSV(source) {
    resetStats(); 
    const file = source.files ? source.files[0] : source[0]; 
    if (!file) return; 
    toggleCard('status');
    const r = new FileReader(); 
    r.onload = (e) => parseCSVData(e.target.result);
    r.readAsText(file, 'UTF-8');
}

function exportCSV() {
    let csv = "\uFEFFFrage;Option A;Option B;Option C;Option D;Antwort\n";
    quizData.forEach(q => { csv += `"${q.question}";${q.options.map(o => `"${o}"`).join(';')};"${q.options[q.answer]}"\n`; });
    const b = new Blob([csv], {type: 'text/csv;charset=utf-8;'}); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = "Quiz_Export.csv"; a.click();
}

async function loadTemplate(url) {
    resetStats();
    toggleCard('status');
    try {
        const response = await fetch(url);
		
        if (!response.ok) {
            throw new Error(`Vorlage konnte nicht geladen werden (Status: ${response.status})`);
        }
		
        const text = await response.text();
        parseCSVData(text);
    } catch (err) {
        alert("Fehler beim Laden der Vorlage: " + err.message);
        goToHome();
    }
}

// --- Data Handling ---
//CSV Laden und mischen
function parseCSVData(text) {
	try {
		const lines = text.split(/\r?\n/).filter(l => l.trim()).slice(1);
		quizData = lines.map(l => {
			const c = l.match(/(".*?"|[^;]+)(?=\s*;|\s*$)/g).map(s => s.replace(/^"|"$/g, '').trim());
			const opts = [c[1], c[2], c[3], c[4]];
			const correctText = c[5];
			
			// Sofort beim Import mischen
			shuffleArray(opts);
			
			return { 
				question: c[0], 
				options: opts, 
				answer: opts.indexOf(correctText) 
			};
		}).filter(q => q.answer !== -1);

		// Die Fragenliste selbst mischen
		shuffleArray(quizData);

		if(quizData.length === 0) throw new Error();
		toggleCard('quiz-container'); 
		showQuestion();
	} catch(e) {
		alert("Daten fehlerhaft!"); 
		goToHome();
	}
}

//zurück zu Hauptmenu
function goToHome() {
    resetStats();
    quizData = [];
    toggleCard('setup-card');
    const modus = document.getElementById('Modus');
    modus.value = "PDF";
    document.getElementById('section-pdf').classList.remove('hidden');
    document.getElementById('section-csv').classList.add('hidden');
    document.getElementById('section-template').classList.add('hidden');
    document.getElementById('pdf-preview-box').classList.add('hidden');
    document.getElementById('file-name').innerText = "PDF WÄHLEN / DROP";
    document.getElementById('pdf-file').value = "";
    document.getElementById('csv-import').value = "";
	document.getElementById('section-downloads').classList.add('hidden');
}

//Downlaod ausblenden
function toggleDownloads(show) {
    const downloadSection = document.getElementById('section-downloads');
    if (downloadSection) {
        if (show) {
            downloadSection.classList.remove('hidden');
        } else {
            downloadSection.classList.add('hidden');
        }
    }
}


//aktuelles Quiz Neustarten
function restartCurrentQuiz() {
	if (quizData.length === 0) return goToHome();
	
	// Alles neu mischen vor dem Neustart
	shuffleArray(quizData);
	quizData.forEach(q => {
		const correctText = q.options[q.answer];
		shuffleArray(q.options);
		q.answer = q.options.indexOf(correctText);
	});

	resetStats();
	document.getElementById('result-screen').classList.add('hidden');
	document.getElementById('quiz-content').classList.remove('hidden');
	showQuestion();
}

//Verlauf rendern
function renderHistory() { 
    const h = JSON.parse(localStorage.getItem('quiz_history') || '[]'); 
    const list = document.getElementById('history-list');
    if (h.length === 0) { list.innerHTML = '<p class="text-slate-400 text-sm italic text-center py-4">Kein Verlauf.</p>'; return; }
    list.innerHTML = h.map(e => `
        <div class="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-100 hover:bg-blue-50 transition-colors">
            <span class="font-bold text-slate-600 text-sm">${e.d}</span>
            <span class="font-black text-blue-600 bg-white px-3 py-1 rounded-lg shadow-sm border border-blue-50">${e.p}%</span>
        </div>`).join(''); 
}

function toggleCard(id) { 
    ['setup-card', 'status', 'quiz-container'].forEach(c => document.getElementById(c)?.classList.add('hidden')); 
    document.getElementById(id)?.classList.remove('hidden'); 
}	

//Hilsfunktion mischen bei neustart
function shuffleArray(array) {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}
	return array;
}

//Verlauf löschen
function clearHistory() { localStorage.removeItem('quiz_history'); renderHistory(); }



	document.getElementById('Modus').onchange = function() {
	
	//aktuelle Wahl
	const val = this.value;
	
    document.getElementById('section-pdf').classList.toggle('hidden', this.value !== 'PDF'); 
    document.getElementById('section-csv').classList.toggle('hidden', this.value !== 'CSV'); 
    document.getElementById('section-template').classList.toggle('hidden', this.value !== 'TEMPLATE'); 
	document.getElementById('section-training').classList.toggle('hidden', this.value !== 'TRAINING'); // NEU
	document.getElementById('section-downloads').classList.toggle('hidden', this.value !== 'DOWNLOADS');
	
	// Liste laden, wenn Downloads ODER Vorlagen gewählt werden
    if(val === 'DOWNLOADS' || val === 'TEMPLATE') {
        loadDownloadFiles();
    }
	
	// Falls ein Spiel auf dem Home-Canvas läuft, stoppen wenn man den Modus wechselt
	if(this.value !== 'TRAINING') {
		gameActive = false;
		clearInterval(gameInterval);
	}
};

// Utility: Drag & Drop und Base64
const toBase64 = f => new Promise((res) => { const r = new FileReader(); r.readAsDataURL(f); r.onload = () => res(r.result); });
function handleDragOver(e) { e.preventDefault(); }
function handleDrop(e) { e.preventDefault(); document.getElementById('pdf-file').files = e.dataTransfer.files; previewPDF(document.getElementById('pdf-file')); }
function handleDragOverCSV(e) { e.preventDefault(); }
function handleDropCSV(e) { e.preventDefault(); importCSV(e.dataTransfer.files); }

//CSV-DROP verlassen
function handleDragLeaveCSV(e) { 
    e.preventDefault(); 
}

/** --- DATEN IMPORT / EXPORT / DOWNLOADS --- **/
async function loadDownloadFiles() {
    const downloadList = document.getElementById('file-list'); 		// Bereich Lernmaterialien
	const downloadList2 = document.getElementById('file2-list');	// Bereich Sonstiges
	const templateList = document.getElementById('template-list');	// Vorlagen-Bereich (Vorlagen vom Server)
	
try {
        // Daten von beiden Endpunkten parallel abrufen
        const [resT, resD] = await Promise.all([
            fetch('/api/files/templates'),
            fetch('/api/files/downloads')
        ]);
        
        const templates = await resT.json();
        const downloads = await resD.json();

        // --- 1. VERFÜGBARE LERNMATERIALIEN (aus /templates) ---
        if (downloadList) {
            downloadList.innerHTML = templates.length > 0 ? templates.map(file => `
                <li class="flex justify-between items-center p-3 bg-slate-50 rounded-lg hover:bg-blue-50 transition-colors">
                    <span class="text-slate-700 font-medium truncate">📄 ${file}</span>
                    <a href="/templates/${file}" download class="bg-blue-100 text-blue-600 px-3 py-1 rounded-md text-xs font-bold hover:bg-blue-600 hover:text-white transition-all">Laden ↓</a>
                </li>
            `).join('') : '<li class="text-slate-400 text-sm italic">Keine Lernmaterialien gefunden.</li>';
        }

        // --- 2. VORLAGEN-BUTTONS (nur .csv aus /templates) ---
        if (templateList) {
            const csvFiles = templates.filter(f => f.toLowerCase().endsWith('.csv'));
            templateList.innerHTML = csvFiles.length > 0 ? csvFiles.map(file => `
                <button onclick="loadTemplate('/templates/${file}')" class="w-full p-4 border-2 rounded-xl bg-white hover:border-blue-500 hover:bg-blue-50 text-left font-bold transition-all flex justify-between items-center group">
                    <span>📊 ${file.replace('.csv', '')}</span>
                    <span class="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">Starten →</span>
                </button>
            `).join('') : '<p class="text-slate-400 text-center">Keine CSV-Vorlagen gefunden.</p>';
        }

        // --- 3. SONSTIGE DOWNLOADS (aus /downloads) ---
        if (downloadList2) {
            downloadList2.innerHTML = downloads.length > 0 ? downloads.map(file => `
                <li class="flex justify-between items-center p-3 bg-slate-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <span class="text-slate-700 font-medium truncate">📦 ${file}</span>
                    <a href="/downloads/${file}" download class="bg-slate-800 text-white px-3 py-1 rounded-md text-xs font-bold hover:bg-black transition-all">Download ↓</a>
                </li>
            `).join('') : '<li class="text-slate-400 text-sm italic">Keine sonstigen Dateien gefunden.</li>';
        }

    } catch (error) {
        console.error("Fehler beim Laden der Listen:", error);
    }
}
			

// Initialisierung beim Laden
window.onload = () => {
	// Setzt das Dropdown beim Laden explizit auf PDF
	const modusSelect = document.getElementById('Modus');
	if(modusSelect) modusSelect.value = 'PDF';
	
	//Downloadbereich
	loadDownloadFiles(); // Einfach direkt hier aufrufen
	
	// Stellt sicher, dass die richtigen Sektionen (PDF ein, Rest aus) angezeigt werden
	document.getElementById('section-pdf').classList.remove('hidden');
	document.getElementById('section-csv').classList.add('hidden');
	document.getElementById('section-template').classList.add('hidden');
	document.getElementById('section-training').classList.add('hidden');
	document.getElementById('section-downloads').classList.add('hidden');

	renderHistory(); 
	updateMuteUI();

};
		
