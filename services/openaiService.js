
const OpenAI = require("openai");
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function analyzeTone(text) {
    const prompt = `
Analyze the brand voice from the given text.
Return a JSON object with:
- formality (0-100)
- tone (e.g., playful, serious, inspiring)
- sentence_length (short, medium, long)
- common_phrases (array of strings)
- vocabulary_patterns (description)

Text:
${text}
`;

    const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }]
    });

    try {
        return JSON.parse(response.choices[0].message.content);
    } catch {
        throw new Error("Invalid JSON from AI");
    }
}

async function generateContent(toneProfile, topic, intensity = 100) {
    const prompt = `
You are a content creator. Write about "${topic}" in the brand voice described below.
Adjust tone intensity to ${intensity}% of the original style.

Brand Voice Profile:
${JSON.stringify(toneProfile)}

Output:
`;

    const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }]
    });

    return response.choices[0].message.content;
}

module.exports = { analyzeTone, generateContent };
