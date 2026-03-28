// Region Fix US-East-1
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method not allowed');

    try {
        const { pdfBase64, questionCount } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) throw new Error("API Key fehlt!");

        // FIX: Wir nutzen die stabilere v1 Version für das Flash-Modell
        // Falls v1beta nötig ist, stellen wir sicher, dass das Modell-Präfix stimmt
        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
                        { text: `Erstelle ${questionCount} Multiple-Choice-Fragen auf Deutsch basierend auf diesem PDF. Antwort NUR als JSON-Array: [{"question":"Frage","options":["A","B","C","D"],"answer":0}]` }
                    ]
                }],
                generationConfig: {
                    responseMimeType: "application/json"
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

        const resultText = data.candidates[0].content.parts[0].text;
        res.status(200).json(JSON.parse(resultText));

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
