// content.js - Enhanced Jobright-style Autofill

// ============================================================================
// COMPREHENSIVE FIELD MAPPING DICTIONARY
// ============================================================================
const FIELD_MAPPING = {
    // Name fields
    "firstName": ["first name", "firstname", "first_name", "first", "given name", "given", "forename", "fname", "prenom"],
    "lastName": ["last name", "lastname", "last_name", "surname", "last", "family name", "family", "lname", "nom"],
    "fullName": ["full name", "fullname", "your name", "name (as on", "name as on", "applicant name", "candidate name", "legal name"],

    // Contact fields
    "email": ["email", "e-mail", "mail", "email address", "e mail"],
    "phone": [
        "phone", "phone number", "mobile", "mobile number", "contact", "contact number",
        "contact no", "telephone", "tel", "cell", "cell phone", "whatsapp",
        "primary contact", "personal phone", "home phone", "work phone"
    ],

    // Location fields
    "location.address": ["address", "street", "address line 1", "address1", "address 1", "line 1", "street address"],
    "location.address2": ["address line 2", "address2", "address 2", "line 2", "apt", "apartment", "suite", "unit"],
    "location.city": ["city", "town", "municipality"],
    "location.postalCode": ["zip", "postal", "code", "zip code", "postal code", "postcode"],
    "location.region": ["state", "province", "region", "county"],
    "location.countryCode": ["country"],

    // Social/Web profiles
    "linkedin": ["linkedin", "linkedin url", "linkedin profile"],
    "github": ["github", "github url", "github profile"],
    "portfolio": ["website", "web site", "url", "portfolio", "link", "personal website"],

    // Work fields
    "company": ["current company", "company", "employer", "organization", "company name", "employer name"],
    "position": ["current position", "job title", "designation", "role", "current role", "current title", "position title"],
    "totalExperience": ["years of experience", "total experience", "experience", "total years", "overall experience", "work experience"],
    "currentExperience": ["current experience", "years in current", "time in role", "years at company"],

    // Education fields
    "degree": ["degree", "highest degree", "qualification", "education level"],
    "institution": ["university", "college", "institution", "school", "alma mater"],
    "graduationYear": ["graduation year", "year of graduation", "passing year", "completion year"],
    "major": ["major", "field of study", "area of study", "specialization"],

    // Skills & Summary
    "skills": ["skills", "technical skills", "key skills", "core skills", "competencies"],
    "summary": ["summary", "about", "bio", "description", "professional summary", "about yourself"],

    // Work Authorization
    "workAuthorization": ["work authorization", "visa status", "authorized to work", "work permit", "sponsorship", "require sponsorship"],
    "citizenship": ["citizenship", "citizen", "nationality"],

    // Resume/CV upload
    "resume": ["resume", "cv", "curriculum vitae", "upload resume", "attach resume"]
};

// ============================================================================
// GLOBAL STATE
// ============================================================================
let resumeData = null;
let resumeFile = null;
let retryCount = 0;
const MAX_RETRIES = 3;
let advancedAutofillCompleted = false; // Flag to prevent infinite loops

// ============================================================================
// MESSAGE LISTENER
// ============================================================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "fill_form") {
        resumeData = request.data;
        resumeFile = request.resumeFile;
        fillFormWithRetry();
        sendResponse({ status: "done" });
    }

    if (request.action === "get_question_text") {
        handleAIQuestionGeneration();
    }

    return true;
});

// ============================================================================
// MAIN AUTOFILL FUNCTION WITH RETRY LOGIC
// ============================================================================
function fillFormWithRetry() {
    retryCount = 0;
    advancedAutofillCompleted = false; // Reset flag for new autofill session
    performFill();

    // Setup MutationObserver for dynamic forms (React, Workday, etc.)
    setupDynamicFormObserver();

    // Retry mechanism for late-loading forms
    const retryInterval = setInterval(() => {
        retryCount++;
        if (retryCount >= MAX_RETRIES) {
            clearInterval(retryInterval);
            showCompletionMessage();
        } else {
            performFill();
        }
    }, 1500); // Retry every 1.5 seconds

    // Stop retrying after max attempts
    setTimeout(() => {
        clearInterval(retryInterval);
        showCompletionMessage();
    }, MAX_RETRIES * 1500);
}

// ============================================================================
// PERFORM FILL OPERATION
// ============================================================================
function performFill() {
    const inputs = document.querySelectorAll('input, textarea, select');
    let filledCount = 0;

    inputs.forEach(input => {
        // Skip hidden, disabled, readonly, or already filled fields
        if (input.type === 'hidden' || input.disabled || input.readOnly) return;
        if (isFieldAlreadyFilled(input)) return;

        // Handle different input types
        if (input.type === 'file') {
            handleFileInput(input);
        } else if (input.type === 'checkbox' || input.type === 'radio') {
            handleCheckboxRadio(input);
        } else if (input.tagName === 'SELECT') {
            handleSelectDropdown(input);
        } else {
            // Regular text inputs
            const value = findValueForInput(input);
            if (value) {
                setInputValue(input, value);
                filledCount++;
            }
        }
    });

    console.log(`[Autofill] Filled ${filledCount} fields in this pass`);
}

// ============================================================================
// CHECK IF FIELD IS ALREADY FILLED
// ============================================================================
function isFieldAlreadyFilled(input) {
    if (input.tagName === 'SELECT') {
        return input.selectedIndex > 0; // Assuming first option is placeholder
    }
    if (input.type === 'checkbox' || input.type === 'radio') {
        return false; // Always check these
    }
    return input.value && input.value.trim().length > 0;
}

// ============================================================================
// HANDLE FILE INPUT (RESUME UPLOAD)
// ============================================================================
function handleFileInput(input) {
    const fieldIdentifiers = getFieldIdentifiers(input).toLowerCase();

    // Check if this is a resume upload field
    if (/resume|cv|curriculum|upload|attach|document/.test(fieldIdentifiers)) {
        chrome.storage.local.get(['resumeFile'], (result) => {
            if (result.resumeFile) {
                // Convert base64 to File object
                const { data, name, type } = result.resumeFile;
                const byteString = atob(data.split(',')[1]);
                const ab = new ArrayBuffer(byteString.length);
                const ia = new Uint8Array(ab);
                for (let i = 0; i < byteString.length; i++) {
                    ia[i] = byteString.charCodeAt(i);
                }
                const blob = new Blob([ab], { type: type });
                const file = new File([blob], name, { type: type });

                // Create a DataTransfer object to set files
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                input.files = dataTransfer.files;

                // Dispatch events
                input.dispatchEvent(new Event('change', { bubbles: true }));
                input.dispatchEvent(new Event('input', { bubbles: true }));

                // Visual feedback
                highlightField(input);
                console.log(`[Autofill] Attached resume: ${name}`);
            }
        });
    }
}

// ============================================================================
// HANDLE CHECKBOX AND RADIO BUTTONS
// ============================================================================
function handleCheckboxRadio(input) {
    const labelText = getLabelText(input).toLowerCase();
    const latestWork = resumeData?.work?.[0];

    // "Currently working here" checkbox
    if (latestWork && !latestWork.endDate) {
        if (/current|present|currently|still working|ongoing/.test(labelText)) {
            input.checked = true;
            input.dispatchEvent(new Event('change', { bubbles: true }));
            highlightField(input);
        }
    }

    // Work authorization
    if (/authorized.*work|work.*authorization|sponsorship/.test(labelText)) {
        const authorized = resumeData?.basics?.workAuthorization;
        if (authorized) {
            if (labelText.includes('yes') || labelText.includes('authorized')) {
                input.checked = true;
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    }
}

// ============================================================================
// HANDLE SELECT DROPDOWNS
// ============================================================================
function handleSelectDropdown(input) {
    const fieldIdentifiers = getFieldIdentifiers(input).toLowerCase();

    // Experience dropdown (years)
    if (/experience|years/.test(fieldIdentifiers) && !/total/.test(fieldIdentifiers)) {
        const latest = resumeData?.work?.[0];
        if (latest?.startDate) {
            const years = calculateYearsFromDate(latest.startDate);
            selectBestOption(input, years);
        }
    }

    // Total experience dropdown
    if (/total.*experience|overall.*experience/.test(fieldIdentifiers)) {
        const totalYears = calculateTotalExperience();
        selectBestOption(input, totalYears);
    }

    // Country dropdown
    if (/country/.test(fieldIdentifiers) && !/code/.test(fieldIdentifiers)) {
        const country = resumeData?.basics?.location?.countryCode;
        if (country) {
            selectOptionByText(input, country);
        }
    }

    // State/Region dropdown
    if (/state|province|region/.test(fieldIdentifiers)) {
        const region = resumeData?.basics?.location?.region;
        if (region) {
            selectOptionByText(input, region);
        }
    }

    // Degree dropdown
    if (/degree|education.*level/.test(fieldIdentifiers)) {
        const degree = resumeData?.education?.[0]?.studyType;
        if (degree) {
            selectOptionByText(input, degree);
        }
    }
}

// ============================================================================
// FIND VALUE FOR INPUT FIELD
// ============================================================================
function findValueForInput(input) {
    const fieldIdentifiers = getFieldIdentifiers(input);
    const normalized = normalizeText(fieldIdentifiers);

    // Try exact pattern matching first (most reliable)
    const exactMatch = matchExactPatterns(fieldIdentifiers);
    if (exactMatch) return exactMatch;

    // Try fuzzy keyword matching
    const fuzzyMatch = matchFuzzyKeywords(normalized);
    if (fuzzyMatch) return fuzzyMatch;

    return null;
}

// ============================================================================
// GET FIELD IDENTIFIERS (name, id, placeholder, label, aria-label)
// ============================================================================
function getFieldIdentifiers(input) {
    const identifiers = [
        input.name,
        input.id,
        input.getAttribute('aria-label'),
        input.getAttribute('aria-labelledby') ? document.getElementById(input.getAttribute('aria-labelledby'))?.innerText : '',
        input.getAttribute('autocomplete'),
        input.placeholder,
        getLabelText(input),
        input.title
    ].filter(Boolean);

    return identifiers.join(' ');
}

// ============================================================================
// GET LABEL TEXT
// ============================================================================
function getLabelText(input) {
    // Check if input is inside a label
    if (input.parentElement?.tagName === 'LABEL') {
        return input.parentElement.innerText;
    }

    // Check for label with 'for' attribute
    if (input.id) {
        const label = document.querySelector(`label[for="${input.id}"]`);
        if (label) return label.innerText;
    }

    // Check for closest label (for nested structures)
    const closestLabel = input.closest('label');
    if (closestLabel) return closestLabel.innerText;

    // Check previous sibling
    const prevSibling = input.previousElementSibling;
    if (prevSibling && (prevSibling.tagName === 'LABEL' || prevSibling.tagName === 'SPAN')) {
        return prevSibling.innerText;
    }

    return '';
}

// ============================================================================
// NORMALIZE TEXT (lowercase, remove special chars)
// ============================================================================
function normalizeText(text) {
    return (text || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// ============================================================================
// EXACT PATTERN MATCHING (using regex)
// ============================================================================
function matchExactPatterns(fieldText) {
    const ft = fieldText.toLowerCase();

    // Full name (must come before first/last name)
    if (/full.*name|your.*name|applicant.*name|legal.*name|candidate.*name/.test(ft) && !/first|last/.test(ft)) {
        return resumeData?.basics?.name;
    }

    // First name
    if (/first.*name|given.*name|fname|forename/.test(ft) && !/last/.test(ft)) {
        return resumeData?.basics?.name?.split(' ')[0];
    }

    // Last name
    if (/last.*name|surname|lname|family.*name/.test(ft) && !/first/.test(ft)) {
        const nameParts = resumeData?.basics?.name?.split(' ') || [];
        return nameParts.slice(1).join(' ');
    }

    // Email
    if (/email|e-mail|e mail/.test(ft)) {
        return resumeData?.basics?.email;
    }

    // Phone
    if (/phone|mobile|tel|contact.*number|cell/.test(ft) && !/country|code/.test(ft)) {
        return resumeData?.basics?.phone;
    }

    // Country code
    if (/country.*code|dial.*code|phone.*code/.test(ft)) {
        const countryCode = resumeData?.basics?.location?.countryCode;
        if (countryCode === 'US') return '+1';
        if (countryCode === 'IN') return '+91';
        if (countryCode === 'UK') return '+44';
        return countryCode;
    }

    // Address
    if (/address.*line.*1|street.*address|address(?!.*2)/.test(ft) && !/line.*2/.test(ft)) {
        return resumeData?.basics?.location?.address;
    }

    if (/address.*line.*2|apt|apartment|suite|unit/.test(ft)) {
        return resumeData?.basics?.location?.address2;
    }

    // City
    if (/city|town/.test(ft)) {
        return resumeData?.basics?.location?.city;
    }

    // State/Region
    if (/state|province|region/.test(ft) && !/country/.test(ft)) {
        return resumeData?.basics?.location?.region;
    }

    // Postal code
    if (/zip|postal|postcode/.test(ft)) {
        return resumeData?.basics?.location?.postalCode;
    }

    // Country
    if (/country/.test(ft) && !/code/.test(ft)) {
        return resumeData?.basics?.location?.countryCode;
    }

    // LinkedIn
    if (/linkedin/.test(ft)) {
        return resumeData?.basics?.profiles?.find(p =>
            p.network?.toLowerCase().includes('linkedin')
        )?.url;
    }

    // GitHub
    if (/github/.test(ft)) {
        return resumeData?.basics?.profiles?.find(p =>
            p.network?.toLowerCase().includes('github')
        )?.url;
    }

    // Portfolio/Website
    if (/portfolio|website|personal.*site/.test(ft) && !/linkedin|github/.test(ft)) {
        return resumeData?.basics?.url;
    }

    // Company
    if (/current.*company|employer|organization|company.*name/.test(ft)) {
        return resumeData?.work?.[0]?.name;
    }

    // Job title/Position
    if (/job.*title|current.*title|position|designation|current.*role/.test(ft)) {
        return resumeData?.work?.[0]?.position;
    }

    // Total experience
    if (/total.*experience|overall.*experience|years.*experience|work.*experience/.test(ft) && !/current/.test(ft)) {
        return calculateTotalExperience().toString();
    }

    // Current experience
    if (/current.*experience|years.*current|time.*role/.test(ft)) {
        const job = resumeData?.work?.[0];
        if (job?.startDate) {
            return calculateYearsFromDate(job.startDate).toString();
        }
    }

    // Skills
    if (/skills|technical.*skills|key.*skills|competencies/.test(ft)) {
        return resumeData?.skills?.flatMap(s => s.keywords).join(', ');
    }

    // Summary
    if (/summary|about.*you|bio|professional.*summary/.test(ft)) {
        return resumeData?.basics?.summary;
    }

    // Education - Degree
    if (/degree|highest.*degree|education.*level/.test(ft)) {
        return resumeData?.education?.[0]?.studyType;
    }

    // Education - Institution
    if (/university|college|institution|school|alma.*mater/.test(ft)) {
        return resumeData?.education?.[0]?.institution;
    }

    // Education - Graduation year
    if (/graduation.*year|year.*graduation|completion.*year/.test(ft)) {
        return resumeData?.education?.[0]?.endDate?.slice(0, 4);
    }

    // Education - Major/Field of study
    if (/major|field.*study|area.*study|specialization/.test(ft)) {
        return resumeData?.education?.[0]?.area;
    }

    return null;
}

// ============================================================================
// FUZZY KEYWORD MATCHING
// ============================================================================
function matchFuzzyKeywords(normalizedText) {
    const tokens = new Set(normalizedText.split(' ').filter(Boolean));
    let bestKey = null;
    let bestScore = 0;

    for (const [key, keywords] of Object.entries(FIELD_MAPPING)) {
        let score = 0;
        keywords.forEach(keyword => {
            const normalizedKeyword = normalizeText(keyword);
            const keywordTokens = normalizedKeyword.split(' ');

            // Check if all keyword tokens are present
            const allTokensPresent = keywordTokens.every(kt => tokens.has(kt));
            if (allTokensPresent) {
                score += 50 * keywordTokens.length; // Higher score for multi-word matches
            }

            // Partial match
            keywordTokens.forEach(kt => {
                if (tokens.has(kt)) score += 10;
            });
        });

        if (score > bestScore) {
            bestScore = score;
            bestKey = key;
        }
    }

    if (bestKey && bestScore >= 30) {
        return getValueForKey(bestKey);
    }

    return null;
}

// ============================================================================
// GET VALUE FOR KEY
// ============================================================================
function getValueForKey(key) {
    const basics = resumeData?.basics || {};
    const location = basics.location || {};
    const profiles = basics.profiles || [];
    const latestWork = resumeData?.work?.[0];
    const latestEducation = resumeData?.education?.[0];

    const mapping = {
        'firstName': basics.name?.split(' ')[0],
        'lastName': basics.name?.split(' ').slice(1).join(' '),
        'fullName': basics.name,
        'email': basics.email,
        'phone': basics.phone,
        'location.address': location.address,
        'location.address2': location.address2,
        'location.city': location.city,
        'location.postalCode': location.postalCode,
        'location.region': location.region,
        'location.countryCode': location.countryCode,
        'linkedin': profiles.find(p => p.network?.toLowerCase().includes('linkedin'))?.url,
        'github': profiles.find(p => p.network?.toLowerCase().includes('github'))?.url,
        'portfolio': basics.url,
        'company': latestWork?.name,
        'position': latestWork?.position,
        'totalExperience': calculateTotalExperience().toString(),
        'currentExperience': latestWork?.startDate ? calculateYearsFromDate(latestWork.startDate).toString() : null,
        'skills': resumeData?.skills?.flatMap(s => s.keywords).join(', '),
        'summary': basics.summary,
        'degree': latestEducation?.studyType,
        'institution': latestEducation?.institution,
        'graduationYear': latestEducation?.endDate?.slice(0, 4),
        'major': latestEducation?.area
    };

    return mapping[key] || null;
}

// ============================================================================
// CALCULATE TOTAL EXPERIENCE (in years)
// ============================================================================
function calculateTotalExperience() {
    if (!Array.isArray(resumeData?.work)) return 0;

    const ranges = resumeData.work
        .filter(job => job.startDate)
        .map(job => {
            const start = new Date(job.startDate);
            const end = job.endDate ? new Date(job.endDate) : new Date();
            return [start.getTime(), end.getTime()];
        })
        .sort((a, b) => a[0] - b[0]);

    if (!ranges.length) return 0;

    // Merge overlapping ranges
    let merged = [];
    let [currStart, currEnd] = ranges[0];

    for (let i = 1; i < ranges.length; i++) {
        const [nextStart, nextEnd] = ranges[i];
        if (nextStart <= currEnd) {
            currEnd = Math.max(currEnd, nextEnd);
        } else {
            merged.push([currStart, currEnd]);
            currStart = nextStart;
            currEnd = nextEnd;
        }
    }
    merged.push([currStart, currEnd]);

    // Sum total time
    let totalMs = 0;
    merged.forEach(([s, e]) => totalMs += (e - s));

    return Math.floor(totalMs / 31536000000); // Convert to years
}

// ============================================================================
// CALCULATE YEARS FROM DATE
// ============================================================================
function calculateYearsFromDate(startDate) {
    const start = new Date(startDate);
    const now = new Date();
    return Math.floor((now - start) / 31536000000);
}

// ============================================================================
// SELECT BEST OPTION (for numeric dropdowns)
// ============================================================================
function selectBestOption(selectElement, targetValue) {
    let bestOption = null;
    let bestDiff = Infinity;

    [...selectElement.options].forEach(option => {
        const num = parseInt(option.value || option.text);
        if (!isNaN(num)) {
            const diff = Math.abs(num - targetValue);
            if (diff < bestDiff) {
                bestDiff = diff;
                bestOption = option;
            }
        }
    });

    if (bestOption) {
        selectElement.value = bestOption.value;
        selectElement.dispatchEvent(new Event('change', { bubbles: true }));
        selectElement.dispatchEvent(new Event('input', { bubbles: true }));
        highlightField(selectElement);
    }
}

// ============================================================================
// SELECT OPTION BY TEXT (for text dropdowns)
// ============================================================================
function selectOptionByText(selectElement, searchText) {
    const normalized = normalizeText(searchText);

    [...selectElement.options].forEach(option => {
        const optionText = normalizeText(option.text);
        if (optionText.includes(normalized) || normalized.includes(optionText)) {
            selectElement.value = option.value;
            selectElement.dispatchEvent(new Event('change', { bubbles: true }));
            selectElement.dispatchEvent(new Event('input', { bubbles: true }));
            highlightField(selectElement);
        }
    });
}

// ============================================================================
// SET INPUT VALUE (simulate real user input)
// ============================================================================
function setInputValue(input, value) {
    if (!value) return;

    // Use native setter to bypass React/Vue detection
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
    ).set;

    const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value'
    ).set;

    if (input.tagName === 'TEXTAREA') {
        nativeTextAreaValueSetter.call(input, value);
    } else {
        nativeInputValueSetter.call(input, value);
    }

    // Dispatch events to trigger framework reactivity
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));

    // Visual feedback
    highlightField(input);
}

// ============================================================================
// HIGHLIGHT FILLED FIELD
// ============================================================================
function highlightField(input) {
    input.style.backgroundColor = '#e6fffa';
    input.style.border = '2px solid #059669';
    input.style.transition = 'all 0.3s ease';
}

// ============================================================================
// SETUP MUTATION OBSERVER (for dynamic forms)
// ============================================================================
function setupDynamicFormObserver() {
    const observer = new MutationObserver((mutations) => {
        let shouldRefill = false;

        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) { // Element node
                    if (node.matches('input, textarea, select') ||
                        node.querySelector('input, textarea, select')) {
                        shouldRefill = true;
                    }
                }
            });
        });

        if (shouldRefill) {
            console.log('[Autofill] Detected new form fields, refilling...');
            setTimeout(performFill, 500); // Small delay to let DOM settle
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Disconnect after 30 seconds to avoid performance issues
    setTimeout(() => observer.disconnect(), 30000);
}

// ============================================================================
// SHOW COMPLETION MESSAGE
// ============================================================================
function showCompletionMessage() {
    console.log('[Autofill] Autofill complete!');

    // Create a toast notification
    const toast = document.createElement('div');
    toast.textContent = '✓ AutoFill complete! Please review before submitting.';
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #059669;
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 999999;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 14px;
        font-weight: 500;
        animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ============================================================================
// AI QUESTION GENERATION (existing functionality)
// ============================================================================
function handleAIQuestionGeneration() {
    const el = document.activeElement;
    const label = el?.closest('div')?.innerText || el?.placeholder || '';

    chrome.storage.local.get(['resumeData'], (res) => {
        const prompt = `
You are a job applicant assistant.
Using this resume:
${JSON.stringify(res.resumeData)}

Answer this question professionally and concisely:
${label}
`;

        chrome.runtime.sendMessage(
            { action: 'generate_ai_answer', prompt },
            (aiRes) => {
                if (aiRes?.text) {
                    setInputValue(el, aiRes.text);
                }
            }
        );
    });
}

// Add CSS animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
    }
`;
document.head.appendChild(style);

// ============================================================================
// ADVANCED AUTOFILL: EDUCATION, WORK EXPERIENCE, SKILLS (JOBRIGHT-STYLE)
// ============================================================================

// ============================================================================
// EDUCATION AUTOFILL WITH AUTO-CLICK "ADD" BUTTONS
// ============================================================================
async function autofillEducation() {
    if (!resumeData?.education || !Array.isArray(resumeData.education)) {
        console.log('[Autofill] No education data found');
        return;
    }

    console.log(`[Autofill] Starting education autofill for ${resumeData.education.length} entries`);

    for (let i = 0; i < resumeData.education.length; i++) {
        const edu = resumeData.education[i];
        console.log(`[Autofill] Filling education entry ${i + 1}/${resumeData.education.length}`);

        // If this is not the first entry, click "Add Education" button
        if (i > 0) {
            const addButton = findAddButton('education');
            if (addButton) {
                console.log('[Autofill] Clicking "Add Education" button');
                addButton.click();
                await sleep(800); // Wait for new section to render
            } else {
                console.log('[Autofill] No "Add Education" button found, checking for existing sections');
            }
        }

        // Find and fill education fields for this entry
        await fillEducationEntry(edu, i);
        await sleep(300); // Small delay between entries
    }

    console.log('[Autofill] Education autofill complete');
}

async function fillEducationEntry(edu, index) {
    // Find all education entry containers
    const educationEntries = document.querySelectorAll('.education-entry, .edu-entry, [class*="education"][class*="entry"], [class*="edu"][class*="entry"]');

    // If we have specific education entry containers, target the one at this index
    let targetContainer = null;
    if (educationEntries.length > index) {
        targetContainer = educationEntries[index];
        console.log(`[Autofill] Targeting education entry container ${index + 1}`);
    } else {
        console.log(`[Autofill] No specific container found for entry ${index + 1}, using global search`);
    }

    // Get inputs - either from specific container or all inputs
    const inputs = targetContainer ?
        targetContainer.querySelectorAll('input, select, textarea') :
        document.querySelectorAll('input, select, textarea');

    let filledInThisEntry = 0;

    inputs.forEach(input => {
        if (input.type === 'hidden' || input.disabled || input.readOnly) return;

        // For targeted container, don't skip already filled (we're filling a new entry)
        // For global search, skip already filled
        if (!targetContainer && isFieldAlreadyFilled(input)) return;

        const fieldText = getFieldIdentifiers(input).toLowerCase();

        // Degree/Study Type
        if (/degree|education.*level|study.*type|qualification/.test(fieldText)) {
            if (!input.value || targetContainer) {
                if (input.tagName === 'SELECT') {
                    selectOptionByText(input, edu.studyType || '');
                } else {
                    setInputValue(input, edu.studyType || '');
                }
                filledInThisEntry++;
            }
        }

        // Institution/School/University
        if (/institution|university|college|school|alma.*mater/.test(fieldText) && !/field|major|area/.test(fieldText)) {
            if (!input.value || targetContainer) {
                setInputValue(input, edu.institution || '');
                filledInThisEntry++;
            }
        }

        // Field of Study/Major/Area
        if (/field.*study|major|area.*study|specialization|concentration/.test(fieldText)) {
            if (!input.value || targetContainer) {
                setInputValue(input, edu.area || '');
                filledInThisEntry++;
            }
        }

        // Start Date
        if (/start.*date|from.*date|begin.*date/.test(fieldText) && !/end/.test(fieldText)) {
            if (!input.value || targetContainer) {
                const startDate = edu.startDate ? formatDate(edu.startDate) : '';
                setInputValue(input, startDate);
                filledInThisEntry++;
            }
        }

        // End Date / Graduation Date
        if (/end.*date|to.*date|graduation.*date|completion.*date|finish.*date/.test(fieldText)) {
            if (!input.value || targetContainer) {
                const endDate = edu.endDate ? formatDate(edu.endDate) : '';
                setInputValue(input, endDate);
                filledInThisEntry++;
            }
        }

        // Graduation Year (specific field)
        if (/graduation.*year|year.*graduation|completion.*year/.test(fieldText) && !/date/.test(fieldText)) {
            if (!input.value || targetContainer) {
                const year = edu.endDate ? edu.endDate.slice(0, 4) : '';
                setInputValue(input, year);
                filledInThisEntry++;
            }
        }

        // GPA/Score
        if (/gpa|grade|score/.test(fieldText)) {
            if (!input.value || targetContainer) {
                setInputValue(input, edu.score || '');
                filledInThisEntry++;
            }
        }

        // Location
        if (/location|city|state/.test(fieldText) && /education|school|university/.test(document.body.innerText.toLowerCase())) {
            // Only fill if we're in an education context
            const parentSection = input.closest('div[class*="education"], section[class*="education"], fieldset');
            if (parentSection && (!input.value || targetContainer)) {
                setInputValue(input, edu.location || '');
                filledInThisEntry++;
            }
        }
    });

    console.log(`[Autofill] Filled ${filledInThisEntry} fields in education entry ${index + 1}`);
}

// ============================================================================
// WORK EXPERIENCE AUTOFILL WITH AUTO-CLICK "ADD" BUTTONS
// ============================================================================
async function autofillWorkExperience() {
    if (!resumeData?.work || !Array.isArray(resumeData.work)) {
        console.log('[Autofill] No work experience data found');
        return;
    }

    console.log(`[Autofill] Starting work experience autofill for ${resumeData.work.length} entries`);

    for (let i = 0; i < resumeData.work.length; i++) {
        const job = resumeData.work[i];
        console.log(`[Autofill] Filling work entry ${i + 1}/${resumeData.work.length}`);

        // If this is not the first entry, click "Add Experience" button
        if (i > 0) {
            const addButton = findAddButton('experience');
            if (addButton) {
                console.log('[Autofill] Clicking "Add Experience" button');
                addButton.click();
                await sleep(800); // Wait for new section to render
            } else {
                console.log('[Autofill] No "Add Experience" button found, checking for existing sections');
            }
        }

        // Find and fill work experience fields for this entry
        await fillWorkExperienceEntry(job, i);
        await sleep(300); // Small delay between entries
    }

    console.log('[Autofill] Work experience autofill complete');
}

async function fillWorkExperienceEntry(job, index) {
    // Find all work entry containers
    const workEntries = document.querySelectorAll('.work-entry, .experience-entry, [class*="work"][class*="entry"], [class*="experience"][class*="entry"]');

    // If we have specific work entry containers, target the one at this index
    let targetContainer = null;
    if (workEntries.length > index) {
        targetContainer = workEntries[index];
        console.log(`[Autofill] Targeting work entry container ${index + 1}`);
    } else {
        console.log(`[Autofill] No specific container found for entry ${index + 1}, using global search`);
    }

    // Get inputs - either from specific container or all inputs
    const inputs = targetContainer ?
        targetContainer.querySelectorAll('input, select, textarea') :
        document.querySelectorAll('input, select, textarea');

    let filledInThisEntry = 0;

    inputs.forEach(input => {
        if (input.type === 'hidden' || input.disabled || input.readOnly) return;

        // For targeted container, don't skip already filled (we're filling a new entry)
        // For global search, skip already filled
        if (!targetContainer && isFieldAlreadyFilled(input)) return;

        const fieldText = getFieldIdentifiers(input).toLowerCase();

        // Company Name
        if (/company|employer|organization/.test(fieldText) && !/current|previous/.test(fieldText)) {
            if (!input.value || targetContainer) {
                setInputValue(input, job.name || '');
                filledInThisEntry++;
            }
        }

        // Job Title/Position
        if (/job.*title|position|role|designation/.test(fieldText) && !/current|previous/.test(fieldText)) {
            if (!input.value || targetContainer) {
                setInputValue(input, job.position || '');
                filledInThisEntry++;
            }
        }

        // Start Date
        if (/start.*date|from.*date|begin.*date/.test(fieldText) && !/end/.test(fieldText)) {
            if (!input.value || targetContainer) {
                const startDate = job.startDate ? formatDate(job.startDate) : '';
                setInputValue(input, startDate);
                filledInThisEntry++;
            }
        }

        // End Date
        if (/end.*date|to.*date|finish.*date/.test(fieldText)) {
            if (!input.value || targetContainer) {
                if (job.endDate) {
                    const endDate = formatDate(job.endDate);
                    setInputValue(input, endDate);
                    filledInThisEntry++;
                }
                // Leave empty if currently working
            }
        }

        // Currently Working checkbox
        if (input.type === 'checkbox' && /current|present|still.*working|ongoing/.test(fieldText)) {
            if (!job.endDate) {
                input.checked = true;
                input.dispatchEvent(new Event('change', { bubbles: true }));
                highlightField(input);
                filledInThisEntry++;
            }
        }

        // Description/Responsibilities
        if (input.tagName === 'TEXTAREA' && /description|responsibilities|duties|summary|highlights/.test(fieldText)) {
            if (!input.value || targetContainer) {
                const description = job.summary || (job.highlights ? job.highlights.join('\n• ') : '');
                setInputValue(input, description);
                filledInThisEntry++;
            }
        }

        // Location
        if (/location|city|state/.test(fieldText) && /work|experience|employment/.test(document.body.innerText.toLowerCase())) {
            const parentSection = input.closest('div[class*="work"], div[class*="experience"], section[class*="work"], fieldset');
            if (parentSection && (!input.value || targetContainer)) {
                setInputValue(input, job.location || '');
                filledInThisEntry++;
            }
        }
    });

    console.log(`[Autofill] Filled ${filledInThisEntry} fields in work entry ${index + 1}`);
}

// ============================================================================
// SKILLS AUTOFILL WITH SEARCH-AND-SELECT (JOBRIGHT-STYLE)
// ============================================================================
async function autofillSkills() {
    if (!resumeData) {
        console.log('[Autofill] No resume data found');
        return;
    }

    // Extract skills from various possible formats
    let allSkills = [];

    // Format 1: JSON Resume format - skills: [{ name: "Web Development", keywords: ["HTML", "CSS"] }]
    if (resumeData.skills && Array.isArray(resumeData.skills)) {
        allSkills = resumeData.skills.flatMap(s => {
            if (s.keywords && Array.isArray(s.keywords)) {
                return s.keywords;
            } else if (typeof s === 'string') {
                return [s];
            } else if (s.name) {
                return [s.name];
            }
            return [];
        });
    }

    // Format 2: Simple array - skills: ["Python", "JavaScript", "React"]
    if (allSkills.length === 0 && Array.isArray(resumeData.skills)) {
        allSkills = resumeData.skills.filter(s => typeof s === 'string');
    }

    // Format 3: Comma-separated string - skills: "Python, JavaScript, React"
    if (allSkills.length === 0 && typeof resumeData.skills === 'string') {
        allSkills = resumeData.skills.split(',').map(s => s.trim()).filter(s => s.length > 0);
    }

    // Format 4: Check for skillsArray or similar field
    if (allSkills.length === 0 && resumeData.skillsArray) {
        allSkills = resumeData.skillsArray;
    }

    if (allSkills.length === 0) {
        console.log('[Autofill] No skills found in resume data');
        console.log('[Autofill] Resume data structure:', resumeData);
        return;
    }

    console.log(`[Autofill] Extracted ${allSkills.length} skills from resume:`, allSkills);

    // Find skills input field
    const skillsInput = findSkillsInput();

    if (!skillsInput) {
        console.log('[Autofill] No skills input field found');
        return;
    }

    console.log('[Autofill] Found skills input, starting search-and-select');

    // Fill each skill individually with search-and-select
    for (let i = 0; i < allSkills.length; i++) {
        const skill = allSkills[i];
        console.log(`[Autofill] Adding skill ${i + 1}/${allSkills.length}: ${skill}`);

        await addSkillWithSearchAndSelect(skillsInput, skill);
        await sleep(500); // Wait between skills
    }

    console.log('[Autofill] Skills autofill complete');
}

function findSkillsInput() {
    // Look for skills input fields
    const inputs = document.querySelectorAll('input[type="text"], input:not([type])');

    for (const input of inputs) {
        const fieldText = getFieldIdentifiers(input).toLowerCase();

        if (/skill|competenc|technolog|expertise/.test(fieldText)) {
            // Check if it's an autocomplete/chip input
            const parent = input.closest('div');
            if (parent && (
                parent.className.includes('chip') ||
                parent.className.includes('tag') ||
                parent.className.includes('autocomplete') ||
                parent.className.includes('multi') ||
                input.getAttribute('role') === 'combobox'
            )) {
                return input;
            }

            // Also return if it's a regular skills input
            if (!input.closest('textarea')) {
                return input;
            }
        }
    }

    return null;
}

async function addSkillWithSearchAndSelect(input, skillName) {
    // Focus the input
    input.focus();
    await sleep(100);

    // Type the skill name character by character (simulate human typing)
    for (let i = 0; i < skillName.length; i++) {
        const char = skillName[i];

        // Set value incrementally
        const currentValue = skillName.substring(0, i + 1);
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            'value'
        ).set;
        nativeInputValueSetter.call(input, currentValue);

        // Dispatch keyboard events
        input.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true }));
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));

        await sleep(50); // Small delay between characters
    }

    // Wait for autocomplete dropdown to appear
    await sleep(300);

    // Try to find and click the first suggestion
    const suggestion = findFirstSuggestion();

    if (suggestion) {
        console.log(`[Autofill] Found suggestion for "${skillName}", clicking it`);
        suggestion.click();
        await sleep(200);
    } else {
        // If no suggestion found, press Enter to confirm
        console.log(`[Autofill] No suggestion found for "${skillName}", pressing Enter`);
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', keyCode: 13, bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, bubbles: true }));
        await sleep(200);
    }

    // Clear the input for next skill
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
    ).set;
    nativeInputValueSetter.call(input, '');
    input.dispatchEvent(new Event('input', { bubbles: true }));
}

function findFirstSuggestion() {
    // Common autocomplete dropdown selectors
    const selectors = [
        '[role="listbox"] [role="option"]:first-child',
        '[role="listbox"] li:first-child',
        '.autocomplete-suggestion:first-child',
        '.suggestion:first-child',
        '.dropdown-item:first-child',
        '.option:first-child',
        'ul[class*="suggest"] li:first-child',
        'ul[class*="dropdown"] li:first-child',
        'div[class*="menu"] div[class*="item"]:first-child'
    ];

    for (const selector of selectors) {
        const suggestion = document.querySelector(selector);
        if (suggestion && suggestion.offsetParent !== null) { // Check if visible
            return suggestion;
        }
    }

    return null;
}

// ============================================================================
// FIND "ADD" BUTTONS (Education, Experience, etc.)
// ============================================================================
function findAddButton(type) {
    const buttons = document.querySelectorAll('button, a, div[role="button"], span[role="button"]');

    const keywords = {
        education: ['add education', 'add another education', 'add school', 'add degree', '+ education', 'add +'],
        experience: ['add experience', 'add employment', 'add job', 'add work', 'add another', '+ experience', 'add position']
    };

    const searchKeywords = keywords[type] || [];

    for (const button of buttons) {
        const buttonText = (button.innerText || button.textContent || '').toLowerCase().trim();
        const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
        const title = (button.getAttribute('title') || '').toLowerCase();

        const combinedText = `${buttonText} ${ariaLabel} ${title}`;

        // Check if button matches any keyword
        for (const keyword of searchKeywords) {
            if (combinedText.includes(keyword)) {
                return button;
            }
        }

        // Also check for simple "+" or "Add" buttons near education/experience sections
        if ((buttonText === '+' || buttonText === 'add' || buttonText.includes('add another')) && type) {
            const parent = button.closest('section, div, fieldset');
            if (parent) {
                const parentText = parent.innerText.toLowerCase();
                if (parentText.includes(type)) {
                    return button;
                }
            }
        }
    }

    return null;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function formatDate(dateString) {
    if (!dateString) return '';

    // Try to parse the date
    const date = new Date(dateString);

    if (isNaN(date.getTime())) {
        return dateString; // Return as-is if can't parse
    }

    // Return in MM/YYYY format (common for job applications)
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return `${month}/${year}`;
}

// ============================================================================
// ENHANCED PERFORM FILL (with Education, Work, Skills)
// ============================================================================
const originalPerformFill = performFill;

performFill = async function () {
    // Call original fill logic
    originalPerformFill();

    // Only run advanced autofill once per session
    if (!advancedAutofillCompleted) {
        advancedAutofillCompleted = true;

        // Then run advanced autofill for Education, Work, and Skills
        setTimeout(async () => {
            await autofillEducation();
            await autofillWorkExperience();
            await autofillSkills();
        }, 1000); // Wait 1 second after basic fill
    }
};

