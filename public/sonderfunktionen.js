//Sonderfunktionen

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// Initialisierung von Audio-Kontext für Soundeffekte
let quizData = [],
	currentIndex = 0,
	score = 0,
	userMistakes = [];
let isMuted = localStorage.getItem("quiz_muted") === "true";

/** --- AUDIO LOGIK --- **/
//Aussehen der Schaltfläche Mute/Unmute
function updateMuteUI() {
	const btn = document.getElementById("mute-btn");
	if (btn) btn.innerText = isMuted ? "🔇" : "🔊";
}
//spiechern der Einstellungen im localStorage
function toggleMute() {
	isMuted = !isMuted;
	localStorage.setItem("quiz_muted", isMuted);
	updateMuteUI();
}

// Synthetische Sounds erzeugen (keine externen Dateien nötig)
function playSound(type) {
	if (isMuted) return;
	if (audioCtx.state === "suspended") audioCtx.resume();
	const osc = audioCtx.createOscillator();
	const gain = audioCtx.createGain();
	osc.connect(gain);
	gain.connect(audioCtx.destination);

	if (type === "point") {
		// Kleiner "Ding" Sound
		osc.type = "sine";
		osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
		gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
		osc.start();
		osc.stop(audioCtx.currentTime + 0.1);
	} else if (type === "correct") {
		// Erfolgs-Sound
		osc.type = "sine";
		osc.frequency.setValueAtTime(523, audioCtx.currentTime);
		gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
		osc.start();
		osc.stop(audioCtx.currentTime + 0.3);
	} else if (type === "wrong") {
		// Fehler-Brummen
		osc.type = "sawtooth";
		osc.frequency.setValueAtTime(150, audioCtx.currentTime);
		gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
		osc.start();
		osc.stop(audioCtx.currentTime + 0.4);
	}
}
