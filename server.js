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

// --- DER AUTOMATISCHE SELBSTTEST BEIM START ---
async function checkGoogleConnection() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("❌ FEHLER: GEMINI_API_KEY fehlt in den Variablen!");
        return;
    }

    try {
        const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        const response = await fetch(testUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: "Hi" }] }] })
        });
        
        const data = await response.json();
        if (response.ok) {
            console.log("✅ GOOGLE API CHECK: Verbindung erfolgreich! Key ist gültig.");
        } else {
            console.error("❌ GOOGLE API CHECK FEHLGESCHLAGEN:", data.error?.message || "Unbekannter Fehler");
        }
    } catch (err) {
        console.error("❌ NETZWERK-FEHLER beim Google-Check:", err.message);
    }
}

// API Endpunkt
app.post('/api/quiz', async (req, res) => {
    try {
        const { pdfBase64, questionCount } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
                        { text: `Erstelle exakt ${questionCount} Multiple-Choice-Fragen auf Deutsch. JSON-Format: [{"question":"Frage","options":["A","B","C","D"],"answer":0}]` }
                    ]
                }],
                safetySettings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                ],
                generationConfig: { response_mime_type: "application/json" }
            })
        });

        const data = await response.json();

        if (!data.candidates || data.candidates.length === 0) {
            console.error("Google verweigert Antwort:", JSON.stringify(data));
            return res.status(500).json({ error: "Google liefert keine Daten. Safety-Filter oder Region-Lock?", details: data });
        }

        const resultText = data.candidates[0].content.parts[0].text;
        res.json(JSON.parse(resultText.replace(/```json|```/g, "").trim()));

    } catch (error) {
        console.error("API Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// Server Starten & Test ausführen
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 Server aktiv auf Port ${PORT}`);
    await checkGoogleConnection(); // Hier wird der Test getriggert
});
