// Spielengine und Hauptschleife
// ------------------------------

// Zustand des laufenden Spiels
const gameState = {
	scoreDisplayId: "",
	frames: 0,
	mouse: { x: 150, y: 150 },
	lerp: { x: 150, y: 150 },
	activePointers: new Set(),
	cursorStyle: "#3b82f633",
	touchStart: 0,
	lastHit: 0,
	damageTime: 0,
	recoveringHeart: false,
	maxLives: 3,
	lives: 3,
	gameResult: null,
    continueButtonRect: { x: 100, y: 190, w: 100, h: 40 }, // Position des Buttons

	// Funktion zur Veränderung des Spielstandes
	addScore: function (points) {
		gamePoints = Math.max(0, gamePoints + points);
		const scoreDisplay = document.getElementById(this.scoreDisplayId);
		scoreDisplay.innerText = `${Math.min(maxScore, Math.floor(gamePoints))} / ${maxScore}`;
		
		if (gamePoints >= maxScore) {
				if (scoreDisplay) scoreDisplay.innerText = `${maxScore} P`;
				// Sieg-Zustand setzen
				this.gameResult = "win"; 
				gameActive = false;
				//this.endGameTransition();
				// Cursor wieder einblenden:
				document.getElementById(this.scoreDisplayId === "home-game-score" ? "home-canvas" : "game-canvas").style.cursor = "default";
		}
	},
	
	// Funktion zum Schadensmanagement
	applyDamage: function (scorePenalty) {
		const now = Date.now();
		this.lastHit = now;
		if (this.recoveringHeart && now - this.damageTime < 3000 * difficulty) {
			// Verlust eines Lebens bei zweitem Schaden in kurzem Zeitraum
			this.lives--;
			this.recoveringHeart = false;
			playSound("wrong");
			if (this.lives <= 0) {
				// Niederlage-Zustand setzen
				this.gameResult = "lose";
				gameActive = false;
				//this.endGameTransition();
				// Cursor wieder einblenden:
				document.getElementById(this.scoreDisplayId === "home-game-score" ? "home-canvas" : "game-canvas").style.cursor = "default";
			}
			if (scorePenalty) this.addScore(scorePenalty);
		} else if (!this.recoveringHeart) {
			this.recoveringHeart = true;
			this.damageTime = now;
			playSound("wrong");
		}
		if (scorePenalty) {
			this.addScore(scorePenalty);
		}
	},
	
	// Hilfsfunktion für den Übergang nach dem Spiel
	endGameTransition: function() {
		setTimeout(() => {
			if (this.scoreDisplayId === "home-game-score") {
				showHomeGameSelection();
			} else if (typeof showQuestion === "function") {
				showQuestion();
			}
			// Reset für das nächste Spiel
			this.gameResult = null;
		}, 2000); // Erhöht auf 2 Sek, damit man den Bildschirm sieht
	},
	
	// Neue Funktion zum Verlassen des Spiels
    exitGame: function() {
        if (this.scoreDisplayId === "home-game-score") {
            showHomeGameSelection();
        } else if (typeof showQuestion === "function") {
            showQuestion();
        }
        this.gameResult = null;
		
    }
};

// Spielstartfunktion (durch HTML aufgerufen)
function setupGame(type, canvasId) {
	gameActive = true;
	gamePoints = 0;
	gameState.gameResult = null; // "win", "lose" oder null
	
	// Schwierigkeitsgrad und Ziel-Punktzahl speichern
    localStorage.setItem("gameDifficulty", difficulty);
    localStorage.setItem("gameMaxScore", maxScore);

	// UI-Wechsel: Auswahl verstecken, Spielbereich zeigen
	if (canvasId === "home-canvas") {
		const activeArea = document.getElementById("home-active-game"); // Variable definieren
		document.getElementById("home-game-selection").classList.add("hidden");
		document.getElementById("home-active-game").classList.remove("hidden");
		
		// NEU: Sanft zum Spielfeld scrollen
       setTimeout(() => {
			activeArea.scrollIntoView({ behavior: "smooth", block: "center" });
		}, 100);
		
		toggleTrainingControls(true);
	}
	if (canvasId === "game-canvas") {
		const activeArea = document.getElementById("home-active-game"); // Variable definieren
		document.getElementById("quiz-game-selection").classList.add("hidden");
		document.getElementById("active-game-area").classList.remove("hidden");
		
		// NEU: Sanft zum Spielfeld scrollen
       setTimeout(() => {
			activeArea.scrollIntoView({ behavior: "smooth", block: "center" });
		}, 100);
		
		toggleTrainingControls(true);
	}
	const scoreDisplayId = canvasId === "home-canvas" ? "home-game-score" : "game-score";
	document.getElementById(scoreDisplayId).innerText = `0 / ${maxScore}`;

	// Canvas vorbereiten und skalieren
	const canvas = document.getElementById(canvasId);
	canvas.style.cursor = type === "grower" ? "crosshair" : "none"; // Fadenkreuz im BubbleBlow-Spiel
	const ctx = canvas.getContext("2d");
	const dpr = window.devicePixelRatio || 1;
	const rect = canvas.getBoundingClientRect();
	canvas.width = rect.width * dpr;
	canvas.height = rect.height * dpr;
	ctx.scale(canvas.width / 300, canvas.height / 300);

	// Spielzustand initialisieren
	gameState.scoreDisplayId = scoreDisplayId;
	if (pointerStart.x !== null) {
		// Pointer auf letzte Koordinaten vor Spielaufruf setzen
		gameState.mouse = {
			x: (pointerStart.x - rect.left) * (300 / rect.width),
			y: (pointerStart.y - rect.top) * (300 / rect.height),
		};
	}
	gameState.lerp.x = gameState.mouse.x;
	gameState.lerp.y = gameState.mouse.y;
	gameState.activePointers.clear();
	gameState.touchStart = 0;
	gameState.cursorStyle = "#3b82f633";
	gameState.lastHit = 0;
	gameState.damageTime = 0;
	gameState.recoveringHeart = false;
	gameState.frames = 0;
	gameState.maxLives = difficulty == 0.6 ? 3 : difficulty == 1 ? 2 : 1;
	gameState.lives = gameState.maxLives;

	// Logik und Konfiguration des jeweiligen Spiels initialisieren
	const activeGame = gamesConfig[type];
	activeGame.init(gameState);

	// Event Listener initialisieren
	canvas.oncontextmenu = (e) => e.preventDefault();
	canvas.onpointermove = (e) => {
		if (e.pointerType === "touch") e.preventDefault();
		const r = canvas.getBoundingClientRect();
		gameState.mouse.x = (e.clientX - r.left) * (300 / r.width);
		gameState.mouse.y = (e.clientY - r.top) * (300 / r.height);
	};
	

	canvas.onpointerdown = (e) => {
		e.preventDefault();
		gameState.activePointers.add(e.pointerId);
		const r = canvas.getBoundingClientRect();

	// Aktuelle Klick-Koordinaten berechnen
    const clickX = (e.clientX - r.left) * (300 / r.width);
    const clickY = (e.clientY - r.top) * (300 / r.height);
    
    // Prüfung für den "Weiter"-Button, wenn das Spiel vorbei ist
    if (!gameActive && gameState.gameResult) {
        const btn = gameState.continueButtonRect;
        if (clickX >= btn.x && clickX <= btn.x + btn.w &&
            clickY >= btn.y && clickY <= btn.y + btn.h) {
            gameState.exitGame(); 
            return;
        }
    }
		
		if (gameState.activePointers.size === 1) {
			// Nicht bei Multitouch im Sternenslalom auszuführen
			gameState.mouse.x = (e.clientX - r.left) * (300 / r.width);
			gameState.mouse.y = (e.clientY - r.top) * (300 / r.height);
			gameState.touchStart = Date.now();
		}
		if (gameActive && activeGame && activeGame.onPointerDown) {
			activeGame.onPointerDown(e, gameState);
		}

	};
	canvas.onpointerup = (e) => {
		e.preventDefault();
		if (gameActive && activeGame && activeGame.onPointerUp) {
			activeGame.onPointerUp(e, gameState);
		}
		gameState.activePointers.delete(e.pointerId);
		if (canvas.hasPointerCapture(e.pointerId)) {
			canvas.releasePointerCapture(e.pointerId);
		}
	};

	// Hauptschleife (Start der Spielanimation)
	let lastTime = Date.now();
	
	let now = Date.now();
    let deltaTime = (now - lastTime) / 16.66;
    lastTime = now;
	
	function loop() {
		if (!gameActive) {
			if (gameState.gameResult) {
				drawEndScreen(ctx, gameState.gameResult);
			// OPTIONAL: Zeige den Finger-Pointer, wenn man über dem Button ist
            const r = canvas.getBoundingClientRect();
            const btn = gameState.continueButtonRect;
            // Wir prüfen die aktuelle Mausposition im gameState
            if (gameState.mouse.x >= btn.x && gameState.mouse.x <= btn.x + btn.w &&
                gameState.mouse.y >= btn.y && gameState.mouse.y <= btn.y + btn.h) {
                canvas.style.cursor = "pointer";
            } else {
                canvas.style.cursor = "default";
            }

            gameAnimationId = requestAnimationFrame(loop);
        }
			return; 
		}
		let now = Date.now();
		let deltaTime = (now - lastTime) / 16.66; // Faktor 1.0 bei 60 FPS
		lastTime = now;

		// Herz ~3s blinkend nach Schaden
		if (gameState.recoveringHeart && Date.now() - gameState.damageTime > 3000 * difficulty) {
			gameState.recoveringHeart = false;
		}

		// Cursor-Highlight 200ms rot nach Schaden
		if (Date.now() - gameState.lastHit < 200) {
			gameState.cursorStyle = "#ff00004d";
		} else {
			gameState.cursorStyle = "#3b82f633";
		}

		// Interpolation (lerp) der Mausbewegung
		gameState.lerp.x += (Math.max(20, Math.min(280, gameState.mouse.x)) - gameState.lerp.x) * 0.2 * deltaTime;
		gameState.lerp.y += (Math.max(20, Math.min(280, gameState.mouse.y)) - gameState.lerp.y) * 0.2 * deltaTime;

		// Spezifische Spiele-Logik ausführen und zeichnen
		if (activeGame) {
			if (activeGame.update) activeGame.update(gameState, deltaTime);
			if (activeGame.draw) activeGame.draw(ctx, gameState);
		}

		// Lebensanzeige darüber zeichnen
		drawHearts(ctx, gameState);

		gameAnimationId = requestAnimationFrame(loop);
	}
	
	function drawEndScreen(ctx, result) {
	// Hintergrund-Overlay mit Farbverlauf statt Schwarz
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    if (result === "win") {
        gradient.addColorStop(0, "rgba(20, 50, 20, 0.95)"); // Dunkelgrün oben
        gradient.addColorStop(1, "rgba(40, 100, 60, 0.9)"); // Etwas helleres Grün unten
    } else {
        gradient.addColorStop(0, "rgba(30, 20, 50, 0.95)"); // Dunkles Indigo/Violett oben
        gradient.addColorStop(1, "rgba(60, 40, 90, 0.9)");  // Etwas helleres Violett unten
    }
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 300, 300);

    // Weißer Rahmen oder Glanz-Effekt (optional für mehr "Tiefe")
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, 280, 280);

	ctx.textAlign = "center";
	ctx.textBaseline = "middle";

	// Titel (Sieg oder Niederlage)
	ctx.shadowBlur = 10;
    if (result === "win") {
        ctx.fillStyle = "#4ade80"; 
        ctx.font = "bold 28px sans-serif";
        ctx.fillText("🎉 GEWONNEN! 🎉", 150, 70);
    } else {
        ctx.fillStyle = "#f87171"; 
        ctx.font = "bold 28px sans-serif";
        ctx.fillText("😔 GAME OVER 😔", 150, 70);
    }

    // Punktzahl anzeigen
    ctx.fillStyle = "#fbbf24"; // Gold-gelb für die Punkte
    ctx.font = "bold 22px sans-serif";
    // Nutzt die globalen Variablen gamePoints und maxScore
    ctx.fillText(`${Math.floor(gamePoints)} / ${maxScore} Punkte`, 150, 110);

    // Motivationstext (Mehrzeilig)
    ctx.font = "14px sans-serif";
    ctx.fillStyle = "white";
    if (result === "win") {
        ctx.fillText("👏 Super gemacht! Gib weiterhin so viel", 150, 145); 
        ctx.fillText("Gas wie beim Lernen! 🥳", 150, 165);
    } else {
        ctx.fillText("Bleib am Ball,", 150, 145);
        ctx.fillText("genau wie beim Lernen! 😉", 150, 165);
    }
    
    //Button (Modernes Design mit Abrundung)
    const btn = gameState.continueButtonRect;
    
    // Button-Schatten
    ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 3;

    ctx.fillStyle = "#3b82f6"; 
    ctx.beginPath();
    ctx.roundRect(btn.x, btn.y, btn.w, btn.h, 12); // Stärker abgerundet
    ctx.fill();
    
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Button Text
    ctx.fillStyle = "white";
    ctx.font = "bold 16px sans-serif";
    ctx.fillText("Weiter", btn.x + btn.w/2, btn.y + btn.h/2);
}



	// Alte Schleife anhalten und neue starten
	if (gameAnimationId) cancelAnimationFrame(gameAnimationId);
	gameAnimationId = requestAnimationFrame(loop);
}
