// content.js
const FIELD_MAPPING = {
    "firstName": ["first name", "firstname", "first_name", "first", "given name", "given", "forename", "fname"],
    "lastName": ["last name", "lastname", "last_name", "surname", "last", "family name", "family", "lname"],
    "name": ["full name", "fullname", "your name", "name (as on", "name as on"],

    "email": ["email", "e-mail", "mail"],
    "phone": [
        "phone",
        "phone number",
        "mobile",
        "mobile number",
        "contact",
        "contact number",
        "contact no",
        "telephone",
        "tel",
        "cell",
        "cell phone",
        "whatsapp",
        "primary contact",
        "personal phone"
    ],
    "url": ["website", "web site", "url", "portfolio", "link"],
    "location.address": ["address", "street", "address line 1", "address1", "address 1", "line 1"],
    "location.address2": ["address line 2", "address2", "address 2", "line 2", "apt", "apartment", "suite", "unit"],
    "location.city": ["city", "town"],
    "location.postalCode": ["zip", "postal", "code"],
    "location.region": ["state", "province", "region"],
    "location.countryCode": ["country"],
    "profiles.linkedin": ["linkedin"],
    "profiles.github": ["github"],
    "summary": ["summary", "about", "bio", "description"],
    "label": ["title", "position", "role", "job_title", "current_title"],
    "work.company": ["current company", "company", "employer", "organization"],
    "work.position": ["current position", "job title", "designation", "role"],
    "work.experience": ["years of experience", "total experience", "experience"],
    "skills.list": ["skills", "technical skills", "key skills"],
    "education.degree": ["degree", "highest degree", "qualification"],
    "education.institution": ["university", "college", "institution", "school"],
    "education.graduationYear": ["graduation year", "year of graduation", "passing year"]
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "fill_form") {
        fillForm(request.data, request.aiEnabled);
        sendResponse({ status: "done" });
    }
});

function fillForm(resume, aiEnabled) {
    const inputs = document.querySelectorAll('input, textarea, select');

    inputs.forEach(input => {
        if (input.type === 'hidden' || input.disabled || input.readOnly) return;

        if (input.type === "checkbox" || input.type === "radio") {
            const labelText = (input.closest("label")?.innerText || "").toLowerCase();
            const latestWork = resume.work?.[0];
            if (
                latestWork &&
                !latestWork.endDate &&
                (labelText.includes("current") || labelText.includes("present") || labelText.includes("currently"))
            ) {
                input.checked = true;
                input.dispatchEvent(new Event("change", { bubbles: true }));
            }
        }

        if (input.tagName === "SELECT") {
            const selectText = (
                input.name + " " +
                input.id + " " +
                input.previousElementSibling?.innerText
            ).toLowerCase();

            if (selectText.includes("experience")) {
                const latest = resume.work?.[0];
                if (latest?.startDate) {
                    const start = new Date(latest.startDate);
                    const now = new Date();
                    const years = Math.floor((now - start) / (1000 * 60 * 60 * 24 * 365));

                    let bestOption = null;
                    let bestDiff = Infinity;

                    [...input.options].forEach(opt => {
                        const num = parseInt(opt.value || opt.text);
                        if (!isNaN(num)) {
                            const diff = Math.abs(num - years);
                            if (diff < bestDiff) {
                                bestDiff = diff;
                                bestOption = opt;
                            }
                        }
                    });

                    if (bestOption) {
                        input.value = bestOption.value;
                        input.dispatchEvent(new Event("change", { bubbles: true }));
                    }
                }
            }
        }

        const matchedValue = findValueForInput(input, resume);
        if (matchedValue) setInputValue(input, matchedValue);
    });

    alert('AutoFill complete! Please review the form before submitting.');
}

function findValueForInput(input, resume) {
    const normalize = (s) =>
        (s || "")
            .toLowerCase()
            .replace(/[\u2019']/g, "'")
            .replace(/[^a-z0-9]+/g, " ")
            .replace(/\s+/g, " ")
            .trim();

    const rawIdentifiers = [
        input.name,
        input.id,
        input.getAttribute("aria-label"),
        input.getAttribute("autocomplete"),
        input.placeholder,
        getLabelText(input),
    ].filter(Boolean);

    const identifiers = normalize(rawIdentifiers.join(" "));
    const tokens = new Set(identifiers.split(" ").filter(Boolean));
    // 🔒 UNIVERSAL DIRECT MATCHING (strongest signal)
    const fieldText = (input.name + " " + input.id + " " + input.placeholder + " " + getLabelText(input)).toLowerCase();

    // FIRST NAME — force match
    if (
        /first.*name|given.*name|fname/.test(fieldText) &&
        !/last.*name|surname/.test(fieldText)
    ) {
        return resume.basics?.name?.split(" ")[0] || null;
    }

    // LAST NAME — force match
    if (
        /last.*name|surname|lname|family.*name/.test(fieldText)
    ) {
        return resume.basics?.name?.split(" ").slice(1).join(" ") || null;
    }

    // FULL NAME — force match
    if (
        /full.*name|your.*name|applicant.*name/.test(fieldText) &&
        !/first|last/.test(fieldText)
    ) {
        return resume.basics?.name || null;
    }

    // EMAIL — force match
    if (/email/.test(fieldText)) return resume.basics?.email || null;

    // PHONE — force match
    if (/phone|mobile|tel|contact/.test(fieldText)) return resume.basics?.phone || null;

    // CITY
    if (/city|town/.test(fieldText)) return resume.basics?.location?.city || null;

    // STATE
    if (/state|province|region/.test(fieldText)) return resume.basics?.location?.region || null;

    // POSTAL
    if (/zip|postal/.test(fieldText)) return resume.basics?.location?.postalCode || null;

    // COUNTRY
    if (/country/.test(fieldText)) return resume.basics?.location?.countryCode || null;

    // LINKEDIN
    if (/linkedin/.test(fieldText)) {
        return resume.basics?.profiles?.find(p => p.network.toLowerCase() === "linkedin")?.url || null;
    }

    // GITHUB
    if (/github/.test(fieldText)) {
        return resume.basics?.profiles?.find(p => p.network.toLowerCase() === "github")?.url || null;
    }

    // PORTFOLIO / WEBSITE
    if (/portfolio|website/.test(fieldText)) return resume.basics?.url || null;

    // COMPANY
    if (/current.*company|employer|organization/.test(fieldText)) {
        return resume.work?.[0]?.name || null;
    }

    // JOB TITLE
    if (/job.*title|current.*title|designation|position/.test(fieldText)) {
        return resume.work?.[0]?.position || null;
    }

    // SKILLS
    if (/skills|technical.*skills/.test(fieldText)) {
        return resume.skills?.flatMap(s => s.keywords).join(", ") || null;
    }


    // 🔒 HARD FIELD LOCKS (added)
    if (tokens.has("city")) return resume.basics?.location?.city || null;
    if (tokens.has("state") || tokens.has("region")) return resume.basics?.location?.region || null;
    if (tokens.has("postal") || tokens.has("zip")) return resume.basics?.location?.postalCode || null;
    if (tokens.has("skills")) return resume.skills?.flatMap(s => s.keywords).join(", ") || null;
    if (tokens.has("linkedin")) return resume.basics?.profiles?.find(p => p.network.toLowerCase() === "linkedin")?.url || null;
    if (tokens.has("github")) return resume.basics?.profiles?.find(p => p.network.toLowerCase() === "github")?.url || null;
    if (tokens.has("portfolio") || tokens.has("website")) return resume.basics?.url || null;

    if (
        input.tagName === "TEXTAREA" &&
        (
            identifiers.includes("why do you") ||
            identifiers.includes("why should") ||
            identifiers.includes("describe") ||
            identifiers.includes("what makes") ||
            identifiers.includes("cover letter")
        )
    ) {
        return null;
    }

    const basics = resume.basics || {};
    const location = basics.location || {};
    const profiles = basics.profiles || [];

    let firstName = "";
    let lastName = "";

    if (basics.name) {
        const parts = basics.name.trim().split(/\s+/);
        firstName = parts[0];
        lastName = parts.slice(1).join(" ");
    }

    const getProfileUrl = (network) => {
        if (!Array.isArray(profiles)) return "";
        const p = profiles.find(pf => pf.network && pf.network.toLowerCase() === network.toLowerCase());
        return p && p.url ? p.url : "";
    };

    const getValueForKey = (key) => {
        const latestWork = Array.isArray(resume.work) ? resume.work[0] : null;
        const latestEducation = Array.isArray(resume.education) ? resume.education[0] : null;

        if (key === 'firstName') return firstName;
        if (key === 'lastName') return lastName;
        if (key === 'name') return basics.name;
        if (key === 'email') return basics.email;
        if (key === 'phone') return basics.phone;

        if (tokens.has("country") && tokens.has("code")) {
            if (location.countryCode === "US") return "+1";
            return location.countryCode;
        }

        if (key === 'url') return basics.url;
        if (key === 'summary') return basics.summary;
        if (key === 'label') return basics.label;

        if (key === 'location.address') return location.address;
        if (key === 'location.address2') return location.address2 || null;
        if (key === 'location.city') return location.city;
        if (key === 'location.postalCode') return (location.postalCode || "").replace(/[^\d]/g, "");
        if (key === 'location.region') return location.region;
        if (key === 'location.countryCode') return location.countryCode;

        if (key === 'profiles.linkedin') return getProfileUrl('linkedin');
        if (key === 'profiles.github') return getProfileUrl('github');

        if (key === "work.company") return latestWork?.name;
        if (key === "work.position") return latestWork?.position;

        if (key === "work.experience") {
            if (!latestWork?.startDate) return null;
            const start = new Date(latestWork.startDate);
            const now = new Date();
            return Math.floor((now - start) / 31536000000).toString();
        }

        if (key === "education.degree") return latestEducation?.studyType;
        if (key === "education.institution") return latestEducation?.institution;
        if (key === "education.graduationYear") return latestEducation?.endDate?.slice(0, 4);

        if (key === "skills.list") return resume.skills?.flatMap(s => s.keywords).join(", ");

        return null;
    };

    let bestKey = null;
    let bestScore = 0;

    for (const [key, keywords] of Object.entries(FIELD_MAPPING)) {
        let score = 0;
        keywords.forEach(k => {
            if (identifiers.includes(normalize(k))) score += 50;
        });
        if (score > bestScore) {
            bestScore = score;
            bestKey = key;
        }
    }

    if (bestKey && bestScore >= 50) return getValueForKey(bestKey);

    return null;
}

function getLabelText(input) {
    if (input.parentElement && input.parentElement.tagName === 'LABEL') {
        return input.parentElement.innerText;
    }
    if (input.id) {
        const label = document.querySelector(`label[for="${input.id}"]`);
        if (label) return label.innerText;
    }
    return '';
}

function setInputValue(input, value) {
    if (!value) return;

    const setter = Object.getOwnPropertyDescriptor(input.__proto__, "value")?.set;
    setter ? setter.call(input, value) : (input.value = value);

    ['input', 'change', 'blur'].forEach(eventType => {
        input.dispatchEvent(new Event(eventType, { bubbles: true }));
    });

    input.style.backgroundColor = "#e6fffa";
    input.style.border = "1px solid #059669";
}

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (req.action === "get_question_text") {
        const el = document.activeElement;
        const label = el?.closest("div")?.innerText || el?.placeholder || "";

        chrome.storage.local.get(["resumeData"], (res) => {
            const prompt = `
You are a job applicant assistant.
Using this resume:
${JSON.stringify(res.resumeData)}

Answer this question:
${label}
`;

            chrome.runtime.sendMessage(
                { action: "generate_ai_answer", prompt },
                (aiRes) => {
                    el.value = aiRes.text;
                }
            );
        });
    }
});
