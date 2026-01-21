document.addEventListener('DOMContentLoaded', () => {
    const resumeInput = document.getElementById('resumeInput');
    const fillFormBtn = document.getElementById('fillFormBtn');
    const viewResumeBtn = document.getElementById('viewResumeBtn');
    const statusDiv = document.getElementById('status');
    const resumePreview = document.getElementById('resumePreview');
    const resumeContent = document.getElementById('resumeContent');

    // Load existing resume and settings
    chrome.storage.local.get(['resumeData', 'aiEnabled'], (result) => {
        if (result.resumeData) {
            showStatus('Resume loaded', 'success');
            enableButtons();
            updatePreview(result.resumeData);
        }
        if (result.aiEnabled) {
            document.getElementById('aiToggle').checked = true;
        }
    });

    // Handle AI Toggle
    document.getElementById('aiToggle').addEventListener('change', (e) => {
        chrome.storage.local.set({ aiEnabled: e.target.checked });
    });

    // Handle File Upload
    resumeInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const json = JSON.parse(e.target.result);
                    chrome.storage.local.set({ resumeData: json }, () => {
                        showStatus('Resume saved successfully!', 'success');
                        enableButtons();
                        updatePreview(json);
                    });
                } catch (error) {
                    showStatus('Error parsing JSON file.', 'error');
                    console.error(error);
                }
            };
            reader.readAsText(file);
        }
    });

    // Handle Fill Form
    fillFormBtn.addEventListener('click', () => {
        chrome.storage.local.get(['resumeData'], (result) => {
            if (result.resumeData) {
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    // Execute content script if not already injected
                    chrome.scripting.executeScript({
                        target: { tabId: tabs[0].id },
                        files: ['content.js']
                    }, () => {
                        // Send message after ensuring script is there
                        chrome.storage.local.get(['aiEnabled'], (settings) => {
                            chrome.tabs.sendMessage(tabs[0].id, {
                                action: "fill_form",
                                data: result.resumeData,
                                aiEnabled: settings.aiEnabled || false
                            }, (response) => {
                                if (chrome.runtime.lastError) {
                                    // Often happens if content script hasn't fully loaded listeners yet or page is restricted
                                    showStatus('Could not fill form on this page.', 'error');
                                } else {
                                    showStatus('Form filling initiated!', 'success');
                                }
                            });
                        });
                    });
                });
            } else {
                showStatus('No resume data found.', 'error');
            }
        });
    });

    // Toggle Preview
    viewResumeBtn.addEventListener('click', () => {
        resumePreview.classList.toggle('hidden');
        viewResumeBtn.textContent = resumePreview.classList.contains('hidden')
            ? 'View Data'
            : 'Hide Data';
    });

    function showStatus(msg, type) {
        statusDiv.textContent = msg;
        statusDiv.className = `status-message status-${type}`;
        statusDiv.classList.remove('hidden');
        setTimeout(() => {
            statusDiv.classList.add('hidden');
        }, 3000);
    }

    function enableButtons() {
        fillFormBtn.disabled = false;
        viewResumeBtn.disabled = false;
    }

    function updatePreview(data) {
        resumeContent.textContent = JSON.stringify(data, null, 2);
    }
});
