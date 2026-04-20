import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.get('/api/ping', (req, res) => res.status(200).send('Bereit'));

app.post('/api/quiz', async (req, res) => {
    // Render/Node sagen, dass wir bis zu 2.5 Min Zeit brauchen
    req.setTimeout(150000); 
    console.log("--- Quiz-Anfrage gestartet ---");
    
    try {
        const { pdfBase64, questionCount, custom_prompt } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) return res.status(500).json({ error: "Server-Konfigurationsfehler: API-Key fehlt." });
        if (!pdfBase64) return res.status(400).json({ error: "Bitte lade zuerst ein PDF hoch." });

        const sanitizedPdf = pdfBase64.includes(",") ? pdfBase64.split(",")[1] : pdfBase64;
        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        // API-Anfrage senden
        let response;
        try {
            response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { inlineData: { mimeType: "application/pdf", data: sanitizedPdf } },
                            { text: `Erstelle exakt ${questionCount || 3} MC-Fragen auf Deutsch. ${custom_prompt || ""} Antwort NUR JSON-Array: [{"question":"Frage","options":["A","B","C","D"],"answer":0}]` }
                        ]
                    }],
                    generationConfig: { response_mime_type: "application/json" }
                })
            });
        } catch (fetchError) {
            // FALL: Gemini ist gar nicht erreichbar (DNS, Netzwerk)
            console.error("Netzwerkfehler zur Google API:", fetchError.message);
            return res.status(503).json({ 
                error: "Die KI-Schnittstelle ist aktuell nicht erreichbar. Bitte prüfe deine Internetverbindung oder versuche es später erneut." 
            });
        }

        const data = await response.json();

        // FEHLERBEHANDLUNG FÜR DEN BENUTZER
        
        // 1. Quota erreicht (429)
        if (response.status === 429) {
            console.error("Quota-Limit überschritten.");
            return res.status(429).json({ 
                error: "Das tägliche Limit für kostenlose Quiz-Erstellungen ist erreicht. Bitte versuche es morgen wieder oder kontaktiere den Admin." 
            });
        }

        // 2. Gemini überlastet oder Wartungsarbeiten (500, 502, 503, 504)
        if (!response.ok) {
            console.error("Google API Fehler:", data);
            return res.status(response.status).json({ 
                error: "Gemini (KI) ist gerade überlastet oder antwortet nicht. Bitte warte kurz und klicke dann erneut auf Generieren." 
            });
        }

        // Ergebnis verarbeiten
        const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!resultText) throw new Error("Keine Antwort von der KI erhalten.");

        try {
            const quizData = JSON.parse(resultText);
            res.status(200).json(quizData);
        } catch (parseError) {
            res.status(500).json({ error: "Die KI hat ein ungültiges Datenformat gesendet. Bitte versuche es mit einem anderen PDF-Abschnitt." });
        }

    } catch (error) {
        console.error("Allgemeiner Fehler:", error.message);
        res.status(500).json({ error: "Ein unerwarteter Fehler ist aufgetreten: " + error.message });
    }
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));
server.timeout = 150000; // Server-Timeout erhöhen
