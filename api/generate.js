import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method not allowed');

    try {
        const { pdfBase64, questionCount } = req.body;
        
        // Initialisierung mit dem Key aus Vercel
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        
        // FIX: Wir nutzen den absoluten Pfad 'models/gemini-1.5-flash'
        // Das löst oft den 404 Fehler in bestimmten Regionen
        const model = genAI.getGenerativeModel({ 
            model: "models/gemini-1.5-flash" 
        });

        const prompt = `Analysiere das PDF und erstelle exakt ${questionCount} MC-Fragen auf Deutsch. 
        Antworte NUR als JSON-Array: [{"question":"Text","options":["A","B","C","D"],"answer":0}]. Kein Markdown!`;

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
        
        // JSON-Säuberung
        text = text.replace(/```json/g, "").replace(/```/g, "").trim();
        
        res.status(200).json(JSON.parse(text));
    } catch (error) {
        console.error("DEBUG BACKEND ERROR:", error);
        res.status(500).json({ error: "Backend-Fehler: " + error.message });
    }
}
