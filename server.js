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

// --- QUIZ ENDPUNKT MIT GEMINI 2.5 FLASH ---
app.post('/api/quiz', async (req, res) => {
    try {
        let { pdfBase64, questionCount } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        if (pdfBase64 && pdfBase64.includes(',')) {
            pdfBase64 = pdfBase64.split(',')[1];
        }

        // AKTUALISIERTE URL: Nutzt das Modell aus deinem Log
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        console.log("Anfrage an Gemini 2.5 Flash wird gesendet...");

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
                        { text: `Erstelle exakt ${questionCount} Multiple-Choice-Fragen auf Deutsch basierend auf diesem Dokument. 
                                 Antworte NUR als JSON-Array: [{"question":"Frage","options":["A","B","C","D"],"answer":0}]` }
                    ]
                }],
                generationConfig: { 
                    response_mime_type: "application/json",
                    temperature: 0.7 
                }
            })
        });

        const data = await response.json();

        if (!data.candidates || data.candidates.length === 0) {
            console.error("Fehler von Google:", JSON.stringify(data));
            return res.status(500).json({ error: "Keine Daten von Gemini 2.5 erhalten.", details: data });
        }

        let resultText = data.candidates[0].content.parts[0].text;
        resultText = resultText.replace(/```json|```/g, "").trim();
        
        res.status(200).json(JSON.parse(resultText));

    } catch (error) {
        console.error("Server-Fehler:", error.message);
        res.status(500).json({ error: error.message });
    }
});

import fs from 'fs'; // Dateisystem-Modul importieren

// 1. Ordner als statisch markieren (damit Dateien direkt verlinkbar sind)
app.use('/downloads', express.static(path.join(__dirname, 'downloads')));

// 2. Endpunkt erstellen, der die Dateiliste zurückgibt
app.get('/api/files', (req, res) => {
    //const downloadPath = path.join(__dirname, 'downloads');
    // Nutze den absoluten Pfad zum downloads-Ordner
    const downloadPath = path.resolve(__dirname, 'downloads');
    
    // Prüfen, ob Ordner existiert
    if (!fs.existsSync(downloadPath)) {
        return res.json([]); 
    }

    fs.readdir(downloadPath, (err, files) => {
        if (err) return res.status(500).json({ error: "Fehler beim Lesen" });
        // Nur echte Dateien zurückgeben (keine versteckten Systemdateien)
        const fileList = files.filter(file => !file.startsWith('.'));
        res.json(fileList);
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server läuft auf Port ${PORT} mit Gemini 2.5 Support`);
});
