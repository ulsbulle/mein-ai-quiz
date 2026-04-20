import express from 'express';
import cors from 'cors';

const app = express();

// CORS für den Zugriff vom Frontend erlauben
app.use(cors());

// Limit erhöhen, damit große PDFs nicht blockiert werden
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Test-Route, um den Server "wachzuküssen"
app.get('/api/ping', (req, res) => res.send('Server ist bereit!'));

app.post('/api/quiz', async (req, res) => {
    console.log("--- NEUE ANFRAGE START ---");
    console.time("Gesamtdauer-Backend"); // Zeitmessung Start
    
    // Erlaubt eine lange Antwortzeit (bis zu 2.5 Minuten)
    req.setTimeout(150000); 

    try {
        const { pdfBase64, questionCount, custom_prompt } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            console.error("DEBUG: API-Key fehlt!");
            return res.status(500).json({ error: "API-Key nicht konfiguriert." });
        }

        if (!pdfBase64) {
            console.error("DEBUG: Kein PDF im Body erhalten.");
            return res.status(400).json({ error: "Keine PDF-Daten." });
        }

        // Base64-String bereinigen
        const sanitizedPdf = pdfBase64.includes(",") ? pdfBase64.split(",")[1] : pdfBase64;
        const sizeInMB = (sanitizedPdf.length * 0.75 / 1024 / 1024).toFixed(2);
        console.log(`DEBUG: PDF-Größe: ca. ${sizeInMB} MB`);

        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

        console.log("DEBUG: Sende Anfrage an Gemini API...");
        console.time("Gemini-Antwortzeit"); // API Zeitmessung Start

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

        console.timeEnd("Gemini-Antwortzeit"); // Zeit stoppen, wenn API antwortet

        const data = await response.json();

        if (!response.ok) {
            console.error("DEBUG: Gemini API Fehler Details:", JSON.stringify(data));
            return res.status(response.status).json(data);
        }

        const resultText = data.candidates[0].content.parts[0].text;
        
        console.timeEnd("Gesamtdauer-Backend"); // Gesamte Bearbeitungszeit stoppen
        console.log("--- ANFRAGE ERFOLGREICH ABGESCHLOSSEN ---");
        
        res.status(200).json(JSON.parse(resultText));

    } catch (error) {
        console.error("DEBUG: Kritischer Fehler im Backend:", error.message);
        console.timeEnd("Gesamtdauer-Backend");
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log(`>>> Server läuft auf Port ${PORT} <<<`);
});

// Verhindert das Schließen der Verbindung durch Node.js selbst
server.timeout = 150000;
