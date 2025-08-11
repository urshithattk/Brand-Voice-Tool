const express = require("express");
const { generateContent } = require("../services/openaiService");

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        const { toneProfile, topic, intensity } = req.body;

        if (!toneProfile || !topic) {
            return res.status(400).json({ error: "toneProfile and topic are required" });
        }

        const content = await generateContent(toneProfile, topic, intensity || 100);
        res.json({ content });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Content generation failed" });
    }
});

module.exports = router;
