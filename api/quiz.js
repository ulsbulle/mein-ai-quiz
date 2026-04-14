export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // 1. Alle Daten aus dem Frontend empfangen
        const { pdfBase64, questionCount, customPrompt } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) throw new Error("API-Key fehlt!");

        // 2. Den Zusatz-Prompt vorbereiten (Nur wenn Text eingegeben wurde)
        // Wir setzen ihn in Anführungszeichen, damit die KI ihn als klare Anweisung erkennt.
        const extraInstructions = (customPrompt && customPrompt.trim().length > 0) 
            ? ` Beachte unbedingt diese zusätzliche Benutzeranweisung für den Inhalt der Fragen: "${customPrompt.trim()}".` 
            : "";

        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

        // 3. Den Request an Google senden
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
                        { 
                            // HIER wurde extraInstructions in den Text-String eingefügt:
                            text: `Erstelle exakt ${questionCount} Multiple-Choice-Fragen auf Deutsch basierend auf diesem PDF.${extraInstructions} Antwort NUR als JSON-Array: [{"question":"Frage","options":["A","B","C","D"],"answer":0}]` 
                        }
                    ]
                }],
                generationConfig: { 
                    responseMimeType: "application/json" // Sorgt für stabileres JSON-Format
                }
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            return res.status(response.status).json({ 
                error: data.error?.message || "Google API Fehler" 
            });
        }

        const resultText = data.candidates[0].content.parts[0].text;
        const cleanJson = resultText.replace(/```json|```/g, "").trim();
        res.status(200).json(JSON.parse(cleanJson));

    } catch (error) {
        console.error("Fehler im Backend:", error.message);
        res.status(500).json({ error: error.message });
    }
}
