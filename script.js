let currentProfile = null;
let currentProfileName = null;
let extractedFileTexts = [];

// Token management
const MAX_TOKENS = 5000;
const CHARS_PER_TOKEN = 4;
const MAX_CHARS = MAX_TOKENS * CHARS_PER_TOKEN;

function truncateText(text, maxChars = MAX_CHARS) {
  if (text.length <= maxChars) return text;
  const truncated = text.substring(0, maxChars);
  const lastSentence = truncated.lastIndexOf('.');
  if (lastSentence > maxChars * 0.8) {
    return truncated.substring(0, lastSentence + 1);
  }
  const lastSpace = truncated.lastIndexOf(' ');
  return truncated.substring(0, lastSpace) + '...';
}

function getTextSample(text, maxChars = 2000) {
  if (text.length <= maxChars) return text;
  const sampleSize = Math.floor(maxChars / 3);
  const start = text.substring(0, sampleSize);
  const middle = text.substring(Math.floor(text.length / 2) - sampleSize / 2,
    Math.floor(text.length / 2) + sampleSize / 2);
  const end = text.substring(text.length - sampleSize);
  return `${start}\n\n[...MIDDLE SECTION...]\n\n${middle}\n\n[...END SECTION...]\n\n${end}`;
}

async function extractTextFromFile(file) {
  return new Promise((resolve, reject) => {
    const fileType = file.type;
    const fileName = file.name.toLowerCase();

    if (fileType === 'text/plain' || fileName.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsText(file);
    } else if (fileType.includes('wordprocessingml') || fileName.endsWith('.docx')) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target.result;
          const result = await mammoth.extractRawText({ arrayBuffer });
          resolve(result.value);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    } else if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target.result;
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          let fullText = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + '\n';
          }
          resolve(fullText);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    } else {
      reject(new Error(`Unsupported file type: ${fileType}`));
    }
  });
}

async function handleFileUpload() {
  const fileInput = document.getElementById("fileInput");
  const files = fileInput.files;
  if (files.length === 0) return;

  const filePreview = document.getElementById("filePreview");
  filePreview.innerHTML = '<div style="color: #00BFA6; margin: 10px 0;"><i class="fas fa-spinner fa-spin"></i> Processing files...</div>';

  extractedFileTexts = [];

  for (let file of files) {
    try {
      const text = await extractTextFromFile(file);
      const processedText = getTextSample(text, 3000);
      extractedFileTexts.push({
        name: file.name,
        text: processedText,
        originalLength: text.length,
        processedLength: processedText.length,
        size: file.size,
        wasTruncated: text.length > 3000
      });
    } catch (error) {
      extractedFileTexts.push({
        name: file.name,
        text: '',
        error: error.message
      });
    }
  }

  displayFilePreview();
}

function displayFilePreview() {
  const filePreview = document.getElementById("filePreview");
  if (extractedFileTexts.length === 0) {
    filePreview.innerHTML = '';
    return;
  }

  let previewHTML = '<div style="margin: 10px 0;"><h4 style="color: #00BFA6; margin-bottom: 10px;">Uploaded Files:</h4>';
  extractedFileTexts.forEach(fileData => {
    const wordCount = fileData.text ? fileData.text.split(' ').length : 0;
    const status = fileData.error ? 'Error' : 'Ready';
    const statusColor = fileData.error ? '#ff4444' : '#00BFA6';

    previewHTML += `
      <div style="background: var(--charcoal); padding: 10px; margin: 5px 0; border-radius: 6px; border-left: 3px solid ${statusColor};">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: bold;">${fileData.name}</span>
          <span style="color: ${statusColor}; font-size: 0.9em;">${status}</span>
        </div>
        ${fileData.error ?
        `<div style="color: #ff4444; font-size: 0.8em; margin-top: 5px;">${fileData.error}</div>` :
        `<div style="color: #ccc; font-size: 0.8em; margin-top: 5px;">
            ${wordCount} words • ${(fileData.size / 1024).toFixed(1)} KB
            ${fileData.wasTruncated ? ' • <span style="color: #ffa500;">Sampled for analysis</span>' : ''}
          </div>`}
      </div>
    `;
  });

  previewHTML += '</div>';
  filePreview.innerHTML = previewHTML;
}

async function analyzeVoice() {
  const formData = new FormData();
  const text = document.getElementById("textInput").value;
  let allTexts = [];

  if (text) allTexts.push(truncateText(text, 2000));
  extractedFileTexts.forEach(fileData => {
    if (fileData.text && !fileData.error) allTexts.push(fileData.text);
  });

  if (allTexts.length === 0) {
    alert("Please provide text or upload files for analysis!");
    return;
  }

  let combinedText = allTexts.join('\n\n---\n\n');
  combinedText = truncateText(combinedText, MAX_CHARS);
  formData.append("textSamples", combinedText);

  try {
    const analyzeBtn = document.querySelector('button[onclick="analyzeVoice()"]');
    const originalText = analyzeBtn.textContent;
    analyzeBtn.textContent = 'Analyzing...';
    analyzeBtn.disabled = true;

    const res = await fetch("/analyze", { // ✅ relative path
      method: "POST",
      body: formData
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error.message || data.error);

    currentProfile = data;
    currentProfileName = null;

    // ✅ Only show Save Profile on Analyzer page
    if (!document.getElementById('analyzerSection').classList.contains('hidden')) {
      document.getElementById('saveProfileSection').classList.remove('hidden');
    }

    displayAnalysisTable(data);
    updateProfileNameDisplay();

    analyzeBtn.textContent = originalText;
    analyzeBtn.disabled = false;
    showNotification('Analysis completed successfully!', 'success');
  } catch (error) {
    console.error("Analysis failed:", error);
    showNotification(`Analysis failed: ${error.message}`, 'error');
    const analyzeBtn = document.querySelector('button[onclick="analyzeVoice()"]');
    analyzeBtn.textContent = 'Analyze Voice';
    analyzeBtn.disabled = false;
  }
}

function displayAnalysisTable(data) {
  const container = document.getElementById("analysisTable");
  container.innerHTML = "";
  if (!data || typeof data !== "object") {
    container.textContent = "No analysis data available.";
    return;
  }
  const table = document.createElement("table");
  const headerRow = document.createElement("tr");
  headerRow.innerHTML = "<th>Attribute</th><th>Value</th>";
  table.appendChild(headerRow);
  for (let key in data) {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${key}</td><td>${typeof data[key] === "object" ? JSON.stringify(data[key], null, 2) : data[key]}</td>`;
    table.appendChild(row);
  }
  container.appendChild(table);
}

async function generateContent() {
  const topic = document.getElementById("topicInput").value;
  if (!currentProfile) return showNotification("Analyze voice first!", "error");
  if (!topic.trim()) return showNotification("Please enter a topic!", "error");

  try {
    const generateBtn = document.querySelector('button[onclick="generateContent()"]');
    const originalText = generateBtn.textContent;
    generateBtn.textContent = 'Generating...';
    generateBtn.disabled = true;

    const res = await fetch("/generate", { // ✅ relative path
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile: currentProfile, topic })
    });

    const data = await res.json();
    const outputElement = document.getElementById("generatedResult");
    const copyContainer = document.getElementById("copyContainer");

    if (data.generated) {
      let content = data.generated.trim();
      const maxWords = 200;
      const words = content.split(/\s+/);
      if (words.length > maxWords) {
        content = words.slice(0, maxWords).join(' ') + '...';
      }
      outputElement.textContent = content;
      outputElement.style.whiteSpace = "pre-wrap";
      copyContainer.classList.remove('hidden');
      showNotification('Content generated successfully!', 'success');
    } else {
      outputElement.textContent = data.error || "No content generated.";
      copyContainer.classList.add('hidden');
      showNotification('Generation failed!', 'error');
    }

    generateBtn.textContent = originalText;
    generateBtn.disabled = false;
  } catch (error) {
    console.error("Generation failed:", error);
    showNotification(`Generation failed: ${error.message}`, 'error');
    const generateBtn = document.querySelector('button[onclick="generateContent()"]');
    generateBtn.textContent = 'Generate';
    generateBtn.disabled = false;
  }
}

async function copyGeneratedText() {
  const outputElement = document.getElementById("generatedResult");
  const text = outputElement.textContent;
  if (!text.trim()) return showNotification('No text to copy!', 'error');
  try {
    await navigator.clipboard.writeText(text);
    showNotification('Text copied to clipboard!', 'success');
  } catch {
    showNotification('Failed to copy text', 'error');
  }
}

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed; top: 20px; right: 20px; padding: 12px 20px;
    border-radius: 6px; color: white; font-weight: bold;
    z-index: 10000; background: ${type === 'success' ? '#00BFA6' : type === 'error' ? '#ff4444' : '#666'};
    transform: translateX(100%); transition: transform 0.3s ease;
  `;
  notification.textContent = message;
  document.body.appendChild(notification);
  setTimeout(() => { notification.style.transform = 'translateX(0)'; }, 100);
  setTimeout(() => {
    notification.style.transform = 'translateX(100%)';
    setTimeout(() => notification.remove(), 300);
  }, 4000);
}

function deleteProfile(index) {
  if (confirm('Delete this profile?')) {
    const profiles = JSON.parse(localStorage.getItem('profiles') || '[]');
    profiles.splice(index, 1);
    localStorage.setItem('profiles', JSON.stringify(profiles));
    loadProfiles();
    showNotification('Profile deleted!', 'info');
  }
}

function updateProfileNameDisplay() {
  const analyzerTitle = document.querySelector('#analyzerSection h3');
  const generatorTitle = document.querySelector('#generatorSection h3');
  if (currentProfileName) {
    analyzerTitle.innerHTML = `Step 1: Analyze Voice <span style="color: #00BFA6; font-size: 0.9em;">(${currentProfileName})</span>`;
    generatorTitle.innerHTML = `Step 2: Generate Content <span style="color: #00BFA6; font-size: 0.9em;">(${currentProfileName})</span>`;
  } else {
    analyzerTitle.innerHTML = 'Step 1: Analyze Voice';
    generatorTitle.innerHTML = 'Step 2: Generate Content';
  }
}

document.getElementById('saveProfileBtn').addEventListener('click', () => {
  const name = document.getElementById('profileName').value.trim();
  if (!name || !currentProfile) return;
  const profiles = JSON.parse(localStorage.getItem('profiles') || '[]');
  profiles.push({ name, data: currentProfile });
  localStorage.setItem('profiles', JSON.stringify(profiles));
  loadProfiles();
  document.getElementById('profileName').value = '';
  showNotification('Profile saved successfully!', 'success');
});

function loadProfiles() {
  const savedProfilesDiv = document.getElementById('savedProfiles');
  savedProfilesDiv.innerHTML = '';
  const profiles = JSON.parse(localStorage.getItem('profiles') || '[]');
  profiles.forEach((p, index) => {
    const div = document.createElement('div');
    div.className = 'profile-card';
    const nameSpan = document.createElement('span');
    nameSpan.textContent = p.name;
    nameSpan.style.flex = '1';
    nameSpan.addEventListener('click', () => {
      currentProfile = p.data;
      currentProfileName = p.name;
      displayAnalysisTable(currentProfile);
      updateProfileNameDisplay();
      document.getElementById('textInput').value = '';
    });
    const deleteBtn = document.createElement('i');
    deleteBtn.className = 'fas fa-trash';
    deleteBtn.style.cursor = 'pointer';
    deleteBtn.style.color = '#ff4444';
    deleteBtn.addEventListener('click', e => {
      e.stopPropagation();
      deleteProfile(index);
    });
    div.style.display = 'flex';
    div.style.alignItems = 'center';
    div.style.justifyContent = 'space-between';
    div.appendChild(nameSpan);
    div.appendChild(deleteBtn);
    savedProfilesDiv.appendChild(div);
  });
}

loadProfiles();

const sidebar = document.getElementById('sidebar');
document.getElementById('openSidebar').addEventListener('click', () => sidebar.classList.add('active'));
document.getElementById('closeSidebar').addEventListener('click', () => sidebar.classList.remove('active'));

document.getElementById('navAnalyzer').addEventListener('click', () => {
  document.getElementById('analyzerSection').classList.remove('hidden');
  document.getElementById('generatorSection').classList.add('hidden');
  document.getElementById('saveProfileSection').classList.remove('hidden'); // ✅ show here
});
document.getElementById('navGenerator').addEventListener('click', () => {
  document.getElementById('generatorSection').classList.remove('hidden');
  document.getElementById('analyzerSection').classList.add('hidden');
  document.getElementById('saveProfileSection').classList.add('hidden'); // ✅ hide here
});

updateProfileNameDisplay();
document.getElementById('fileInput').addEventListener('change', handleFileUpload);
