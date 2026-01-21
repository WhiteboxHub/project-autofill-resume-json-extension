// content.js

// Field Mapping Dictionary
// Maps JSON fields to potential input name/id/label keywords
const FIELD_MAPPING = {
    "name": ["name", "fullname", "first_name", "last_name", "full_name"],
    "email": ["email", "e-mail", "mail"],
    "phone": ["phone", "tel", "mobile", "cell", "contact"],
    "url": ["website", "url", "portfolio", "link"],
    "location.address": ["address", "street"],
    "location.city": ["city", "town"],
    "location.postalCode": ["zip", "postal", "code"],
    "location.region": ["state", "province", "region"],
    "location.countryCode": ["country"],
    "profiles.linkedin": ["linkedin"],
    "profiles.github": ["github"],
    "summary": ["summary", "about", "bio", "description"]
};

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "fill_form") {
        console.log("AutoFill: Received resume data", request.data);
        console.log("AutoFill: AI Enabled?", request.aiEnabled);
        fillForm(request.data, request.aiEnabled);
        sendResponse({ status: "done" });
    }
});

function fillForm(resume) {
    const inputs = document.querySelectorAll('input, textarea, select');

    inputs.forEach(input => {
        // Skip hidden or disabled inputs
        if (input.type === 'hidden' || input.disabled || input.readOnly) return;

        // Attempt to match input to resume data
        const matchedValue = findValueForInput(input, resume);

        if (matchedValue) {
            setInputValue(input, matchedValue);
        }
    });

    alert('AutoFill complete! Please review the form before submitting.');
}

function findValueForInput(input, resume) {
    const identifiers = [
        input.name,
        input.id,
        input.getAttribute('aria-label'),
        input.placeholder,
        getLabelText(input)
    ].map(s => s ? s.toLowerCase() : '');

    // Flattened Resume Data Helper
    const basics = resume.basics || {};
    const location = basics.location || {};
    const profiles = basics.profiles || [];

    // Specific Lookup Helpers
    const getProfileUrl = (network) => {
        const p = profiles.find(pf => pf.network.toLowerCase().includes(network));
        return p ? p.url : '';
    };

    // Check mappings
    for (const [key, keywords] of Object.entries(FIELD_MAPPING)) {
        // If any keyword matches any identifier of the input
        const isMatch = keywords.some(keyword =>
            identifiers.some(id => id.includes(keyword))
        );

        if (isMatch) {
            // Return corresponding value
            if (key === 'name') return basics.name;
            if (key === 'email') return basics.email;
            if (key === 'phone') return basics.phone;
            if (key === 'url') return basics.url;
            if (key === 'summary') return basics.summary;

            if (key === 'location.address') return location.address;
            if (key === 'location.city') return location.city;
            if (key === 'location.postalCode') return location.postalCode;
            if (key === 'location.region') return location.region;
            if (key === 'location.countryCode') return location.countryCode;

            if (key === 'profiles.linkedin') return getProfileUrl('linkedin');
            if (key === 'profiles.github') return getProfileUrl('github');
        }
    }

    return null;
}

function getLabelText(input) {
    // Label wrapping input
    if (input.parentElement && input.parentElement.tagName === 'LABEL') {
        return input.parentElement.innerText;
    }
    // Label via for attribute
    if (input.id) {
        const label = document.querySelector(`label[for="${input.id}"]`);
        if (label) return label.innerText;
    }
    return '';
}

function setInputValue(input, value) {
    if (!value) return;

    // Handle standard inputs and textareas
    input.value = value;

    // Handle Select elements (basic matching)
    if (input.tagName === 'SELECT') {
        for (let i = 0; i < input.options.length; i++) {
            if (input.options[i].text.toLowerCase().includes(value.toLowerCase()) ||
                input.options[i].value.toLowerCase().includes(value.toLowerCase())) {
                input.selectedIndex = i;
                break;
            }
        }
    }

    // Dispatch events for React/Angular/Vue
    ['input', 'change', 'blur'].forEach(eventType => {
        const event = new Event(eventType, { bubbles: true });
        input.dispatchEvent(event);
    });

    // Visual feedback
    input.style.backgroundColor = "#e6fffa";
    input.style.border = "1px solid #059669";
}
