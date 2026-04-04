import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// 1. Ordner als statisch markieren
// Dies ermöglicht den Zugriff auf Dateien via http://.../templates/name.csv
// Es wird sowohl im 'downloads' als auch im 'templates' Ordner gesucht
app.use('/downloads', express.static(path.join(__dirname, 'downloads')));
app.use('/templates', express.static(path.join(__dirname, 'templates')));

/** --- QUIZ ENDPUNKT MIT GEMINI 2.5 FLASH --- **/
app.post('/api/quiz', async (req, res) => {
    try {
        let { pdfBase64, questionCount } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        if (pdfBase64 && pdfBase64.includes(',')) {
            pdfBase64 = pdfBase64.split(',')[1];
        }

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
            return res.status(500).json({ error: "Keine Daten von Gemini erhalten.", details: data });
        }

        let resultText = data.candidates[0].content.parts[0].text;
        resultText = resultText.replace(/```json|```/g, "").trim();
        
        res.status(200).json(JSON.parse(resultText));

    } catch (error) {
        console.error("Server-Fehler:", error.message);
        res.status(500).json({ error: error.message });
    }
});

/** --- DATEI-SYSTEM ENDPUNKTE --- **/

// Endpunkt, der die Dateiliste aus dem 'templates' Ordner zurückgibt
app.get('/api/files', (req, res) => {
    // Wir priorisieren hier den 'templates' Ordner für die automatische Auflistung
    const templatePath = path.join(__dirname, 'templates');
    const downloadsPath = path.join(__dirname, 'downloads');
    
    // Prüfen, ob der Ordner existiert, falls nicht, leeres Array senden
    if (!fs.existsSync(templatePath)) {
        console.warn("Ordner 'templates' nicht gefunden.");
        return res.json([]); 
    }

    fs.readdir(templatePath, (err, files) => {
        if (err) {
            console.error("Fehler beim Lesen des Ordners:", err);
            return res.status(500).json({ error: "Fehler beim Lesen der Dateien" });
        }
        
        // Filtert versteckte Dateien (wie .DS_Store) heraus
        const fileList = files.filter(file => !file.startsWith('.'));
        res.json(fileList);
    });
});

// Server Start
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server läuft auf Port ${PORT}`);
    console.log(`Statische Dateien werden aus /templates und /downloads serviert.`);
});
