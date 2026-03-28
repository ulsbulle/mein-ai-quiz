export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method not allowed');

    try {
        const { pdfBase64, questionCount } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        // Wir nutzen v1beta, weil NUR diese Version PDF-Uploads via API stabil unterstützt
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: `Erstelle exakt ${questionCount} Multiple-Choice-Fragen auf Deutsch basierend auf diesem PDF. Antwort NUR als JSON-Array: [{"question":"Text","options":["A","B","C","D"],"answer":0}]` },
                        { inlineData: { mimeType: "application/pdf", data: pdfBase64 } }
                    ]
                }],
                generationConfig: {
                    responseMimeType: "application/json"
                }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            // Wenn es hier wieder 404 sagt, liegt es definitiv an der Region oder dem Key-Status
            throw new Error(data.error?.message || "Google API Fehler");
        }

        const resultText = data.candidates[0].content.parts[0].text;
        res.status(200).json(JSON.parse(resultText));

    } catch (error) {
        console.error("DEBUG:", error.message);
        res.status(500).json({ error: error.message });
    }
}
