import express from 'express';
import cors from 'cors';

const app = express();

// CORS aktivieren für Frontend-Zugriff
app.use(cors());

// Limits für große PDF-Uploads erhöhen
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Ping-Route gegen den Render-Schlafmodus
app.get('/api/ping', (req, res) => res.status(200).send('Bereit'));

app.post('/api/quiz', async (req, res) => {
    console.log("--- Quiz-Anfrage gestartet ---");
    
    try {
        // 1. Variablen aus dem Request extrahieren
        const { pdfBase64, questionCount, custom_prompt } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        // 2. Validierung
        if (!apiKey) {
            return res.status(500).json({ error: "API-Key fehlt in den Umgebungsvariablen." });
        }
        if (!pdfBase64) {
            return res.status(400).json({ error: "Keine PDF-Daten empfangen." });
        }

        // 3. Base64 säubern
        const sanitizedPdf = pdfBase64.includes(",") ? pdfBase64.split(",")[1] : pdfBase64;

        // 4. URL definieren (Stabile Version nutzen)
        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        // 5. API-Anfrage senden
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

        const data = await response.json();

        // 6. Spezifische Fehlerbehandlung für Quota (429)
        if (response.status === 429) {
            console.error("Quota-Limit überschritten.");
            return res.status(429).json({ 
                error: "Dein API-Limit ist für heute erschöpft. Bitte versuche es später wieder oder nutze einen anderen Key." 
            });
        }

        if (!response.ok) {
            console.error("Google API Fehler:", data);
            return res.status(response.status).json({ error: data.error?.message || "API Fehler" });
        }

        // 7. Ergebnis verarbeiten
        const resultText = data.candidates[0].content.parts[0].text;
        
        try {
            const quizData = JSON.parse(resultText);
            console.log("Erfolgreich generiert.");
            res.status(200).json(quizData);
        } catch (parseError) {
            console.error("JSON-Parse Fehler:", resultText);
            res.status(500).json({ error: "Die KI hat kein gültiges JSON geliefert." });
        }

    } catch (error) {
        console.error("Server-Fehler:", error.message);
        res.status(500).json({ error: "Interner Fehler: " + error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server läuft auf Port ${PORT}`);
});
