import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method not allowed');

    try {
        const { pdfBase64, questionCount } = req.body;
        
        // Initialisierung
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        
        // WICHTIG: API_VERSION explizit auf v1beta setzen
        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash"
        }, { apiVersion: 'v1beta' }); // <--- Diese Zeile löst den 404 Fehler

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
        const text = response.text();
        
        // JSON-Säuberung (falls die KI Markdown-Backticks ```json mitschickt)
        const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
        
        res.status(200).json(JSON.parse(cleanJson));
    } catch (error) {
        console.error("Gemini API Error:", error);
        res.status(500).json({ error: "Fehler bei der Quiz-Generierung: " + error.message });
    }
}
