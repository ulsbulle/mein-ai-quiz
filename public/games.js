/** --- SPIELE ENGINE --- **/
let gamePoints = 0;
let gameActive = false;
let gameDone = false;
let gameInterval;

//Hilfsfunktionen//
/** --- SPIELE ENGINE (CANVAS) Hauptmenu --- **/		
function showHomeGameSelection() {
	gameActive = false;
	clearInterval(gameInterval);
	document.getElementById('home-game-selection').classList.remove('hidden');
	document.getElementById('home-active-game').classList.add('hidden');
}

// Score im Spiel aktualisieren
function updateScore(p, displayId) {
    gamePoints += p; document.getElementById(displayId).innerText = `${Math.floor(gamePoints)} / 10`;
    if (gamePoints >= 10) { gameActive = false; clearInterval(gameInterval); setTimeout(() => (displayId === 'home-game-score' ? showHomeGameSelection() : showQuestion()), 800); }
}

// --- Minispiele Logik (Haupt-Logik)---
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
	


// Main Game Loop (60 FPS)
	gameInterval = setInterval(() => {
		if(!gameActive) return;
		
		ctx.clearRect(0, 0, 300, 300);
		ctx.font = "bold 40px serif";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";

		/** 1.Minispiel Pferderennen (Sidescroller) **/
		if (type === 'horse') {
			// Boden Zeichnen
			ctx.fillStyle = "#e2e8f0";
			ctx.fillRect(0, 280, 300, 20);
			
			// Physik Gravitation & Sprung
			player.vY += 0.7; 
			player.y += player.vY; // Gravitation
			if (player.y > 250) { player.y = 250; player.vY = 0; }
			
			// Hindernisse
			frames++;
			if(frames % 70 === 0) objects.push({x: 320, y: 265, passed: false });// Neu: Tracker für Punktvergabe (passed)
			
			// Pferd Zeichnen
			ctx.fillText("🐎", 50, player.y);
			
			// Hindernisse verarbeiten
			objects.forEach((obj, i) => {
				obj.x -= 5; // Geschwindigkeit der Hindernisse
				ctx.fillText("🚧", obj.x, obj.y);
			
			// KOLLISIONSPRÜFUNG
			if (obj.x > 30 && obj.x < 70 && player.y > 220) {
                gamePoints = Math.max(0, gamePoints - 0.5); // Punktabzug bei Kollision
                ctx.fillStyle = "rgba(255,0,0,0.2)";
                ctx.fillRect(0, 0, 300, 300);
                playSound('wrong');
            }
			// PUNKTVERGABE: Wenn das Hindernis erfolgreich passiert wurde
            if (obj.x < 30 && !obj.passed) {
                obj.passed = true; 
                updateScore(1, scoreDisplay); // Gibt 1 Punkt pro Hindernis
                playSound('point');
            }

            // Entfernen von Hindernissen außerhalb des Bildschirms
            if(obj.x < -50) objects.splice(i, 1);
            });
		}

		/** 2.Minispiel Apfelfänger (Steuerung) **/
		if (type === 'catcher') {
			target.y += 4;
			ctx.fillStyle = "#e2e8f0";
			
			// Apfel hat den Boden berührt (Verfehlt)
			if (target.y > 300) { 
				playSound('wrong'); // Sound für Fehler abspielen
				hitEffect = 0.3;    // Optional: Kurzes rotes Aufleuchten
				target.y = -20; 
				target.x = Math.random() * 260 + 20; 
				gamePoints = Math.max(0, gamePoints - 0.5); // Optional: Punktabzug bei Verfehlen
			}
			// Zeichnen
			ctx.fillText("🍎", target.x, target.y);
			
			// Apfel gefangen (Treffer)
			if (Math.abs(mouse.x - target.x) < 35 && Math.abs(mouse.y - target.y) < 35) {
				playSound('point');
				updateScore(1, scoreDisplay);
				target.y = -50;
				target.x = Math.random() * 260 + 20;
			}
		}

		/** 3.Minispiel (Flappy Style) **/
		if (type === 'dodger') {
			ctx.fillStyle = "#e2e8f0"; //volle Farben
			ctx.fillText("🛸", mouse.x, mouse.y);
			
			//Kometen Zeichnen
			if(Math.random() < 0.05) objects.push({x: Math.random()*300, y: -20});
			objects.forEach((en, i) => {
				en.y += 4;
				ctx.fillText("☄️", en.x, en.y);

				if(Math.sqrt((en.x-mouse.x)**2 + (en.y-mouse.y)**2) < 30) {
					gamePoints = Math.max(0, gamePoints - 0.1);
					playSound('wrong'); // Sound für Fehler abspielen
				}
				if(en.y > 320) objects.splice(i, 1);
			});
			updateScore(0.02, scoreDisplay);
		}

		/** 4.Minispiel Bubble Grow (Präzision) **/
		if (type === 'grower') {
			ctx.fillStyle = "#e2e8f0";
			ctx.fillText("🫧", target.x, target.y);
			ctx.beginPath();
			ctx.arc(target.x, target.y, target.r, 0, Math.PI*2);
			ctx.strokeStyle = "#2563eb";
			ctx.lineWidth = 4;
			ctx.stroke();
		}

		// Maus-Cursor (Highlight)
		ctx.globalCompositeOperation = 'destination-over';
		ctx.beginPath();
		ctx.arc(mouse.x, mouse.y, 20, 0, Math.PI*2);
		ctx.fillStyle = "rgba(59, 130, 246, 0.2)";
		ctx.fill();
		ctx.globalCompositeOperation = 'source-over';

	}, 1000/60);
}
