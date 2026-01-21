// Background service worker
// Currently minimal as most logic is in popup and content script due to user interaction requirement

chrome.runtime.onInstalled.addListener(() => {
  console.log('AutoFill Job Applications Extension installed.');
});
