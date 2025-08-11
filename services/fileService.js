// services/fileService.js
const fs = require("fs");
const mammoth = require("mammoth");

async function extractTextFromFile(filePath) {
    if (filePath.endsWith(".txt")) {
        return fs.readFileSync(filePath, "utf8");
    } else if (filePath.endsWith(".docx")) {
        const result = await mammoth.extractRawText({ path: filePath });
        return result.value;
    } else {
        throw new Error("Unsupported file type");
    }
}

module.exports = { extractTextFromFile };
