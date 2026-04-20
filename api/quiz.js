import express from 'express';
import cors from 'cors';

const app = express();

// CORS-Konfiguration: Erlaubt deinem Frontend den Zugriff
app.use(cors());

// Body-Limits: PDFs sind im Base64-Format ca. 33% größer als das Original
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Wake-up Route: Hilft gegen den Render "Schlafmodus"
app.get('/api/ping', (req, res) => res.status(200).send('Server ist wach!'));

app.post('/api/quiz', async (req, res) => {
	console.log("--- NEUE ANFRAGE START ---");
	console.time("Gesamtdauer-Backend");
	
	// Timeout für den HTTP-Request auf 2.5 Minuten setzen
	req.setTimeout(150000); 

	try {
		const { pdfBase64, questionCount, custom_prompt } = req.body;
		const apiKey = process.env.GEMINI_API_KEY;

		// Validierung
		if (!apiKey) {
			console.error("DEBUG: GEMINI_API_KEY fehlt in den Environment Variables!");
			return res.status(500).json({ error: "API-Konfiguration fehlt." });
		}

		if (!pdfBase64) {
			console.error("DEBUG: Body erhalten, aber pdfBase64 ist leer.");
			return res.status(400).json({ error: "Keine PDF-Daten übertragen." });
		}

		// Base64 säubern (Präfix entfernen)
		const sanitizedPdf = pdfBase64.includes(",") ? pdfBase64.split(",")[1] : pdfBase64;
		
		// Größe loggen, um Payload-Probleme zu erkennen
		const sizeInMB = (sanitizedPdf.length * 0.75 / 1024 / 1024).toFixed(2);
		console.log(`DEBUG: PDF-Größe erkannt: ~${sizeInMB} MB`);

		const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5:generateContent?key=${apiKey}`;

		console.log("DEBUG: Sende Daten an Gemini API...");
		console.time("Gemini-Antwortzeit");

		const response = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				contents: [{
					parts: [
						{ inlineData: { mimeType: "application/pdf", data: sanitizedPdf } },
						{ 
							text: `Erstelle exakt ${questionCount || 3} Multiple-Choice-Fragen auf Deutsch basierend auf diesem PDF. ${custom_prompt || ""} Antwort NUR als JSON-Array: [{"question":"Frage","options":["A","B","C","D"],"answer":0}]` 
						}
					]
				}],
				generationConfig: {
					response_mime_type: "application/json"
				}
			})
		});

		console.timeEnd("Gemini-Antwortzeit");

		if (!response.ok) {
			const errorData = await response.json();
			console.error("DEBUG: Gemini API hat Fehler gemeldet:", JSON.stringify(errorData));
			return res.status(response.status).json({ 
				error: "Google API Fehler", 
				details: errorData 
			});
		}

		const data = await response.json();
		const resultText = data.candidates[0].content.parts[0].text;
		
		console.timeEnd("Gesamtdauer-Backend");
		console.log("--- ANFRAGE ERFOLGREICH ---");
		
		res.status(200).json(JSON.parse(resultText));

	} catch (error) {
		console.error("DEBUG: Schwerer Fehler im Backend-Ablauf:", error.message);
		console.timeEnd("Gesamtdauer-Backend");
		res.status(500).json({ error: "Server-Fehler: " + error.message });
	}
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
	console.log(`>>> Render Server läuft auf Port ${PORT} <<<`);
});

// Verhindert, dass Node die Verbindung kappt, während Gemini noch rechnet
server.timeout = 150000;
