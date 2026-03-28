// Erzwungener Umzug der Funktion in die USA (us-east-1)
export const config = {
  runtime: 'edge',
  regions: ['iad1'], // Das ist Washington D.C.
};

export default async function handler(req) {
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

    try {
        const { pdfBase64, questionCount } = await req.json();
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) throw new Error("API Key fehlt!");

        // Wir nutzen die stabilste URL für Flash
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
                        { text: `Erstelle exakt ${questionCount} Multiple-Choice-Fragen auf Deutsch basierend auf diesem PDF. Antwort NUR als JSON-Array: [{"question":"Frage","options":["A","B","C","D"],"answer":0}]` }
                    ]
                }],
                generationConfig: {
                    response_mime_type: "application/json"
                }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return new Response(JSON.stringify({ 
                error: data.error?.message || "Google API Fehler",
                details: data.error 
            }), { status: response.status, headers: { 'Content-Type': 'application/json' } });
        }

        const resultText = data.candidates[0].content.parts[0].text;
        const cleanJson = resultText.replace(/```json|```/g, "").trim();
        
        return new Response(cleanJson, {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { 
            status: 500, 
            headers: { 'Content-Type': 'application/json' } 
        });
    }
}
