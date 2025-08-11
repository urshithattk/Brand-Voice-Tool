// routes/analyzeTone.js
const express = require("express");
const multer = require("multer");
const path = require("path");
const { extractTextFromFile } = require("../services/fileService");
const { analyzeTone } = require("../services/openaiService");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post("/", upload.single("file"), async (req, res) => {
    try {
        let text = "";

        if (req.file) {
            const filePath = path.join(__dirname, "..", req.file.path);
            text = await extractTextFromFile(filePath);
        } else if (req.body.text) {
            text = req.body.text;
        } else {
            return res.status(400).json({ error: "No text or file provided" });
        }

        const toneProfile = await analyzeTone(text);
        res.json(toneProfile);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Tone analysis failed" });
    }
});

module.exports = router;
