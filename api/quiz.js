export default async function handler(req, res) {
    // Nur POST-Anfragen erlauben
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Daten aus dem Body extrahieren
        const { pdfBase64, questionCount, customPrompt } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) throw new Error("API-Key fehlt in den Umgebungsvariablen!");

        // Den individuellen Prompt vorbereiten, falls vorhanden
        const extraInstructions = (customPrompt && customPrompt.trim().length > 0) 
            ? ` Beachte unbedingt diese zusätzliche Benutzeranweisung: "${customPrompt.trim()}".` 
            : "";

        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
                        { 
                            text: `Erstelle exakt ${questionCount} Multiple-Choice-Fragen auf Deutsch basierend auf diesem PDF.${extraInstructions} Antwort NUR als JSON-Array: [{"question":"Frage","options":["A","B","C","D"],"answer":0}]` 
                        }
                    ]
                }],
                generationConfig: { 
                    responseMimeType: "application/json" // Verhindert Fehler 500 durch erzwungenes JSON-Format
                }
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            return res.status(response.status).json({ 
                error: data.error?.message || "Google API Fehler",
                status: response.status 
            });
        }

        // Ergebnis extrahieren und bereinigen
        const resultText = data.candidates[0].content.parts[0].text;
        
        try {
            // Entferne potenzielle Markdown-Code-Blöcke (```json ... ```)
            const cleanJson = resultText.replace(/```json/g, "").replace(/```/g, "").trim();
            const parsedData = JSON.parse(cleanJson);
            res.status(200).json(parsedData);
        } catch (parseError) {
            console.error("JSON-Parsing fehlgeschlagen:", resultText);
            res.status(500).json({ error: "Die KI hat kein gültiges JSON-Format geliefert." });
        }

    } catch (error) {
        console.error("Server-Fehler:", error.message);
        res.status(500).json({ error: error.message });
    }
}
