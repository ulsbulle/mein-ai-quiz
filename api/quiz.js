export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method not allowed');

    try {
        const { pdfBase64, questionCount } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) throw new Error("API Key fehlt in Vercel Environment Variables!");

        // KORREKTUR: Der Modellpfad wird direkt in die URL eingebaut, v1beta bleibt
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        // Wichtig: Erst die Daten (PDF), dann die Anweisung (Text)
                        { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
                        { text: `Erstelle exakt ${questionCount} Multiple-Choice-Fragen basierend auf diesem Dokument auf Deutsch. 
                                 Format: JSON-Array. Jedes Objekt muss 'question', 'options' (Array mit 4 Strings) 
                                 und 'answer' (Index 0-3) enthalten.` }
                    ]
                }],
                generationConfig: { 
                    responseMimeType: "application/json",
                    temperature: 0.7 
                }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({ 
                error: data.error?.message || "Google API Fehler",
                details: data.error 
            });
        }

        // Gemini liefert bei JSON-Mode manchmal das Array direkt oder in einem Text-Feld
        let resultText = data.candidates[0].content.parts[0].text;
        
        // Sicherheitshalber parsen, falls Gemini Markdown-Backticks ```json nutzt
        const cleanJson = resultText.replace(/```json|```/g, "").trim();
        res.status(200).json(JSON.parse(cleanJson));

    } catch (error) {
        console.error("Backend Error:", error);
        res.status(500).json({ error: error.message });
    }
}
