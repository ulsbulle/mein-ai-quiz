import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// --- AUTOMATISCHER VERBINDUNGSTEST ---
async function checkGoogleConnection() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("❌ FEHLER: GEMINI_API_KEY ist nicht in Railway gesetzt!");
        return;
    }

    try {
        // Wir nutzen hier die v1beta mit dem Standard-Modellnamen
        const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        const response = await fetch(testUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: "Hi" }] }] })
        });
        
        const data = await response.json();
        if (response.ok) {
            console.log("✅ GOOGLE API CHECK: Verbindung steht! Modell gemini-1.5-flash ist bereit.");
        } else {
            console.error("❌ GOOGLE API CHECK FEHLGESCHLAGEN:", JSON.stringify(data.error || data));
        }
    } catch (err) {
        console.error("❌ NETZWERK-FEHLER beim Check:", err.message);
    }
}

// API ENDPUNKT FÜR DAS QUIZ
app.post('/api/quiz', async (req, res) => {
    try {
        const { pdfBase64, questionCount } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!pdfBase64) {
            return res.status(400).json({ error: "Kein PDF-Inhalt empfangen." });
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
                        { text: `Erstelle exakt ${questionCount} Multiple-Choice-Fragen auf Deutsch basierend auf diesem Dokument. 
                                 Antworte AUSSCHLIESSLICH als JSON-Array in diesem Format: 
                                 [{"question":"Frage","options":["A","B","C","D"],"answer":0}]` }
                    ]
                }],
                safetySettings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                ],
                generationConfig: { 
                    response_mime_type: "application/json",
                    temperature: 0.7 
                }
            })
        });

        const data = await response.json();

        if (!data.candidates || data.candidates.length === 0) {
            console.error("Google verweigert Antwort:", JSON.stringify(data));
            return res.status(500).json({ 
                error: "Google liefert keine Daten. Prüfe die Railway-Logs für Details.",
                details: data 
            });
        }

        let resultText = data.candidates[0].content.parts[0].text;
        
        // Bereinigung falls Google Markdown-Codeblöcke mitsendet
        resultText = resultText.replace(/```json|```/g, "").trim();
        
        res.status(200).json(JSON.parse(resultText));

    } catch (error) {
        console.error("KRITISCHER FEHLER:", error.message);
        res.status(500).json({ error: "Server-Fehler: " + error.message });
    }
});

// START
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 Server gestartet auf Port ${PORT}`);
    await checkGoogleConnection();
});
