export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method not allowed');

    try {
        const { pdfBase64, questionCount } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        // Wir probieren den stabilen v1 Endpunkt mit dem offiziellen Modellnamen
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        const payload = {
            contents: [{
                parts: [
                    { text: `Analysiere das PDF und erstelle exakt ${questionCount} MC-Fragen auf Deutsch. Antworte NUR als JSON-Array: [{"question":"Text","options":["A","B","C","D"],"answer":0}]. Kein Markdown!` },
                    { inlineData: { mimeType: "application/pdf", data: pdfBase64 } }
                ]
            }],
            generationConfig: {
                responseMimeType: "application/json"
            }
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Google API Error Details:", data);
            throw new Error(data.error?.message || "Google API antwortet mit Fehler");
        }

        const rawText = data.candidates[0].content.parts[0].text;
        // Da wir responseMimeType: "application/json" nutzen, 
        // sollte die KI direkt sauberes JSON liefern.
        res.status(200).json(JSON.parse(rawText));

    } catch (error) {
        console.error("Backend Error:", error);
        res.status(500).json({ error: "Fehler: " + error.message });
    }
}
