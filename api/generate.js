export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method not allowed');

    try {
        const { pdfBase64, questionCount } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        // Wir nutzen v1 (stabil) statt v1beta, das ist oft zuverlässiger
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: `Erstelle ${questionCount} MC-Fragen zum PDF auf Deutsch. Antwort NUR als JSON-Array: [{"question":"T","options":["A","B","C","D"],"answer":0}]` },
                        { inlineData: { mimeType: "application/pdf", data: pdfBase64 } }
                    ]
                }],
                generationConfig: { responseMimeType: "application/json" }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            // Dies gibt uns im Vercel-Log die exakte Fehlermeldung von Google aus
            console.error("Google Error:", JSON.stringify(data));
            throw new Error(data.error?.message || "Google verweigert den Zugriff.");
        }

        const resultText = data.candidates[0].content.parts[0].text;
        res.status(200).json(JSON.parse(resultText));

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
