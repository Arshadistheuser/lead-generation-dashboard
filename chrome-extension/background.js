// =============================================================
// LeadGen HubSpot Matcher — Background Service Worker
// Handles data relay between content script and dashboard API.
// =============================================================

const DEFAULT_DASHBOARD_URL = "http://localhost:3000";

let capturedCompanies = [];
let dashboardUrl = DEFAULT_DASHBOARD_URL;

chrome.storage.local.get(["dashboardUrl", "capturedCompanies"], (result) => {
  if (result.dashboardUrl) dashboardUrl = result.dashboardUrl;
  if (result.capturedCompanies) capturedCompanies = result.capturedCompanies;
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case "GET_STATE":
      sendResponse({
        capturedCompanies,
        dashboardUrl,
        totalCaptured: capturedCompanies.length,
      });
      break;

    case "SET_DASHBOARD_URL":
      dashboardUrl = message.url;
      chrome.storage.local.set({ dashboardUrl });
      sendResponse({ success: true });
      break;

    case "ADD_COMPANIES":
      addCompanies(message.companies);
      sendResponse({ success: true, totalCaptured: capturedCompanies.length });
      break;

    case "CLEAR_COMPANIES":
      capturedCompanies = [];
      chrome.storage.local.set({ capturedCompanies: [] });
      sendResponse({ success: true });
      break;

    case "SEND_TO_DASHBOARD":
      sendToDashboard()
        .then((result) => sendResponse(result))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;

    case "EXPORT_CSV":
      sendResponse({ success: true, csv: generateCSV() });
      break;
  }
  return true;
});

// Toggle widget when toolbar icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_WIDGET" });
  } catch {
    // Content script not loaded yet — inject it first
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js", "widget.js"],
      });
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ["widget.css"],
      });
      // Small delay then toggle
      setTimeout(() => {
        chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_WIDGET" }).catch(() => {});
      }, 500);
    } catch {
      // Can't inject — not a valid page
    }
  }
});

function addCompanies(newCompanies) {
  const existing = new Set(
    capturedCompanies.map((c) => `${c.name.toLowerCase()}|${(c.domain || "").toLowerCase()}`)
  );

  for (const company of newCompanies) {
    const key = `${company.name.toLowerCase()}|${(company.domain || "").toLowerCase()}`;
    if (!existing.has(key) && company.name) {
      capturedCompanies.push({ ...company, capturedAt: new Date().toISOString() });
      existing.add(key);
    }
  }

  chrome.storage.local.set({ capturedCompanies });
}

async function sendToDashboard() {
  if (capturedCompanies.length === 0) {
    return { success: false, error: "No companies captured yet" };
  }

  try {
    const response = await fetch(`${dashboardUrl}/api/company-matcher/extension`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companies: capturedCompanies }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      results: data.results,
      summary: data.summary,
      matchUrl: `${dashboardUrl}/company-matcher?source=extension`,
    };
  } catch (err) {
    return { success: false, error: `Failed to connect to dashboard: ${err.message}` };
  }
}

function generateCSV() {
  const headers = ["Company Name", "Domain", "Industry", "Revenue", "Employees", "Location", "Captured At"];
  const rows = capturedCompanies.map((c) =>
    [
      `"${(c.name || "").replace(/"/g, '""')}"`,
      c.domain || "",
      `"${(c.industry || "").replace(/"/g, '""')}"`,
      `"${(c.revenue || "").replace(/"/g, '""')}"`,
      `"${(c.employees || "").replace(/"/g, '""')}"`,
      `"${(c.location || "").replace(/"/g, '""')}"`,
      c.capturedAt || "",
    ].join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}
