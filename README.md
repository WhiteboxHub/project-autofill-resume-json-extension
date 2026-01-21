# AutoFill Job Applications Extension

A Chrome Extension that helps you auto-fill job application forms using your resume data in JSON format. It parses a standard [JSON Resume](https://jsonresume.org/) schema and intelligently maps fields to form inputs on job boards and company websites.

## 🚀 Features Implemented

- **JSON Resume Support**: fully supports the JSON Resume schema (Basics, Work, Education, Skills, etc.).
- **Smart Autofill**: Heuristically matches resume fields to form inputs using name, ID, label, and aria-label attributes.
    - Matches common fields: Name, Email, Phone, Address, City, Zip, LinkedIn, Website, etc.
- **Modern UI**: Clean, responsive popup interface for managing your resume.
- **Preview Mode**: View your parsed resume data directly in the extension.
- **Framework Compatible**: Dispatches native `input`, `change`, and `blur` events to ensure compatibility with React, Vue, and Angular forms.
- **Secure Storage**: Resume data is stored locally in your browser (`chrome.storage.local`).

## 🛠️ Installation

1.  Clone this repository or download the source code.
2.  Open Chrome and navigate to `chrome://extensions/`.
3.  Toggle **Developer mode** in the top right corner.
4.  Click **Load unpacked**.
5.  Select the directory containing this project.

## 📖 Usage

1.  **Prepare your Resume**: Create a `resume.json` file. You can use the `resume.json` included in this repo as a template.
2.  **Upload**: Click the extension icon, then click "Import Resume.json" to load your file.
3.  **Navigate**: Go to a job application page (e.g., a "Apply Now" page).
4.  **Fill**: Click the extension icon and hit **Auto-Fill Form**.
5.  **Review**: Check the filled fields (highlighted in green) and submit!

## 📂 Project Structure

- `manifest.json`: Manifest V3 configuration.
- `background.js`: Service worker.
- `popup.html` / `styles.css` / `popup.js`: The extension popup UI and logic.
- `content.js`: The script that injects into pages to find and fill forms.
- `resume.json`: Sample resume data.
- `AI_INTEGRATION.md`: Logic and guide for future AI features.

## ✅ To-Do / Roadmap

- [ ] **Complex Form Support**: Better handling for radio buttons, checkboxes, and complex date pickers.
- [ ] **AI Integration**:
    - [ ] Add support for Ollama (local LLM) or Gemini API to generate custom answers.
    - [ ] Implement "Generate Cover Letter" feature based on job description.
- [ ] **Multiple Profiles**: Support saving multiple resume versions (e.g., "Frontend Developer", "Backend Developer").
- [ ] **Custom Mappings**: Allow users to manually map specific form fields to resume data if auto-detection fails.
- [ ] **Job Board Specifics**: specialized parsers for easy-apply flows on LinkedIn/Indeed.
