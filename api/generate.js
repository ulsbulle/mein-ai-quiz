import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method not allowed');

    try {
        const { pdfBase64, questionCount } = req.body;
        
        // 1. Initialisierung mit dem Key aus deinen Vercel-Umgebungsvariablen
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        
        // 2. Wir nutzen einfach "gemini-1.5-flash". 
        // Es ist das stabilste Modell für PDF-Analysen.
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `Analysiere das PDF und erstelle exakt ${questionCount} Multiple-Choice-Fragen auf Deutsch.
        Antworte NUR als valides JSON-Array im Format: 
        [{"question":"Text","options":["A","B","C","D"],"answer":0}]
        Kein Markdown, keine Einleitung!`;

        // 3. Generierung starten
        const result = await model.generateContent([
            {
                inlineData: {
                    mimeType: "application/pdf",
                    data: pdfBase64
                }
            },
            { text: prompt }
        ]);

        const response = await result.response;
        let text = response.text();
        
        // Sicherheits-Check: Falls die KI Markdown-Code-Blöcke (```json) mitschickt, entfernen wir sie
        text = text.replace(/```json/g, "").replace(/```/g, "").trim();
        
        // 4. Das fertige Objekt zurück an dein Frontend schicken
        res.status(200).json(JSON.parse(text));
        
    } catch (error) {
        console.error("Fehler im Backend:", error);
        res.status(500).json({ error: "KI-Service aktuell nicht erreichbar. Bitte erneut versuchen." });
    }
}
