/** --- SPIELE ENGINE --- **/
let gamePoints = 0;
let gameActive = false;
let gameDone = false;
let gameInterval;

// --- Minispiele Logik ---
function setupGame(type, canvasId) {
	// UI-Reset für Spielstart
	if(canvasId === 'home-canvas') {
		document.getElementById('home-game-selection').classList.add('hidden');
		document.getElementById('home-active-game').classList.remove('hidden');
	}
	gameActive = true; 
	gamePoints = 0;
	const scoreDisplay = canvasId === 'home-canvas' ? 'home-game-score' : 'game-score';
	document.getElementById(scoreDisplay).innerText = "0 / 10";

	// UI-Wechsel: Auswahl verstecken, Spielbereich zeigen
	if(canvasId === 'game-canvas') { 
		document.getElementById('quiz-game-selection').classList.add('hidden'); 
		document.getElementById('active-game-area').classList.remove('hidden'); 
	}

	const canvas = document.getElementById(canvasId);
	const ctx = canvas.getContext('2d');
	
	// Spiel-Variablen, Spiel-Objekte & Physik
	let objects = []; 
	let player = { 	x: 150, y: 150, vY: 0 }; // vY für Sprungphysik
	let target = { 	x: Math.random() * 200 + 50, 
					y: Math.random() * 200 + 50, 
					r: 25 }; 
	let mouse = { 	x: 150, y: 150 };
	let frames = 	0;

	// Steuerung, Eingabe-Events (Maus & Touch)
	canvas.onpointermove = (e) => {
		const r = canvas.getBoundingClientRect();
		mouse.x = e.clientX - r.left;
		mouse.y = e.clientY - r.top;
	};

	canvas.onpointerdown = (e) => {
		// PFERDE-SPRUNG
		if (type === 'horse' && player.y >= 250) {
			player.vY = -12;
			//updateScore(1, scoreDisplay); // <--- Hier einfügen für 1 Punkt pro Sprung
		}
		// BLASEN-WACHSTUM (Grower)
		if (type === 'grower') {
			const d = Math.sqrt((mouse.x - target.x)**2 + (mouse.y - target.y)**2);
			if (d < target.r) {
				target.r += 15;
				if(target.r > 70) {
					playSound('point');
					updateScore(1, scoreDisplay);
					target.r = 25;
					target.x = Math.random() * 200 + 50;
					target.y = Math.random() * 200 + 50;
				}
			}
		}
	};
	
	/** --- SPIELE ENGINE (CANVAS) Hauptmenu --- **/		
function showHomeGameSelection() {
	gameActive = false;
	clearInterval(gameInterval);
	document.getElementById('home-game-selection').classList.remove('hidden');
	document.getElementById('home-active-game').classList.add('hidden');
}
