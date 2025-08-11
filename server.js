import express from "express";
import multer from "multer";
import dotenv from "dotenv";
import fs from "fs";
import cors from "cors";
import Groq from "groq-sdk";
import path from "path";
import { fileURLToPath } from "url";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(cors());
app.use(express.json());

app.use(express.static(__dirname));
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

//Extract JSON safely
function extractJSON(text) {
  console.log("Attempting to extract JSON from:", text); // Debug log
  
  try {
    return JSON.parse(text.trim());
  } catch (err1) {
    try {
      let match = text.match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(match[0]);
      }
    } catch (err2) {
      try {
        const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
        return JSON.parse(cleaned);
      } catch (err3) {
        console.error("All JSON parse methods failed:", { err1, err2, err3 });
      }
    }
  }
  return null;
}

// Serve index.html on root
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Endpoint: Analyze Voice
app.post("/analyze", upload.array("files"), async (req, res) => {
  try {
    let textSamples = [];

    if (req.body.textSamples) {
      const pasted = Array.isArray(req.body.textSamples)
        ? req.body.textSamples
        : [req.body.textSamples];
      textSamples.push(...pasted);
    }

    for (let file of req.files) {
      const content = fs.readFileSync(file.path, "utf8");
      textSamples.push(content);
      fs.unlinkSync(file.path);
    }

    if (!textSamples.length) {
      return res.status(400).json({ error: "No text provided" });
    }

    const combinedText = textSamples.join("\n\n---\n\n");
    const prompt = `
You are a brand voice analyzer. Analyze the following text and return ONLY a valid JSON object with no additional text, explanations, or formatting.

Required JSON format:
{
  "formality": "formal",
  "tone": "professional and friendly",
  "sentence_length": "medium",
  "vocabulary_patterns": ["technical terms", "clear explanations", "direct language"],
  "tone_keywords": ["professional", "helpful", "clear", "direct", "informative"]
}

Rules:
- formality must be: "formal", "semi-formal", or "informal"
- tone should be 2-4 descriptive words
- sentence_length must be: "short", "medium", "long", or "varied"
- vocabulary_patterns should be an array of 3-5 patterns you notice
- tone_keywords should be an array of 5 descriptive words

Text to analyze:
${combinedText}

Return ONLY the JSON object:
`;

    const response = await groq.chat.completions.create({
      model: "llama3-8b-8192",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
    });

    const output = response.choices[0].message.content;
    console.log("Raw LLM Response:", output);
    
    const jsonData = extractJSON(output);
    console.log("Extracted JSON:", jsonData);

    if (jsonData) {
      res.json(jsonData);
    } else {
      res.json({ error: "Tone analysis failed", raw: output });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Tone analysis failed" });
  }
});

// Endpoint: Generate Content
app.post("/generate", async (req, res) => {
  try {
    const { profile, topic } = req.body;

    if (!profile || !topic) {
      return res.status(400).json({ error: "Missing profile or topic" });
    }

    const prompt = `
Write a SHORT piece of content about "${topic}" using the following brand voice profile (MAX 100 words):

Formality: ${profile.formality}
Tone: ${profile.tone}
Sentence length: ${profile.sentence_length}
Vocabulary patterns: ${Array.isArray(profile.vocabulary_patterns) ? profile.vocabulary_patterns.join(", ") : profile.vocabulary_patterns}
Tone keywords: ${Array.isArray(profile.tone_keywords) ? profile.tone_keywords.join(", ") : profile.tone_keywords}

Requirements:
- Keep it concise and punchy
- Maximum 2-3 short paragraphs
- Focus on the key message
- Match the voice profile exactly
- No meta-commentary, just the content
`;

    const response = await groq.chat.completions.create({
      model: "llama3-8b-8192",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    const generatedText = response.choices[0].message.content;
    res.json({ generated: generatedText });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Content generation failed" });
  }
});
//Start server
app.listen(process.env.PORT || 5000, () => {
  console.log(`Server running on http://localhost:${process.env.PORT || 5000}`);
});
