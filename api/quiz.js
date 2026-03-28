export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method not allowed');
    try {
        const { pdfBase64, questionCount } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ inlineData: { mimeType: "application/pdf", data: pdfBase64 } }, { text: `Erstelle ${questionCount} MC-Fragen auf Deutsch als JSON-Array.` }] }],
                generationConfig: { response_mime_type: "application/json" }
            })
        });
        const data = await response.json();
        res.status(200).json(JSON.parse(data.candidates[0].content.parts[0].text.replace(/```json|```/g, "")));
    } catch (e) { res.status(500).json({ error: e.message }); }
}
