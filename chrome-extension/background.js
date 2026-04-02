// =============================================================
// LeadGen HubSpot Matcher — Background Service Worker
// Handles data relay between content script and dashboard API.
// All network requests happen here — invisible to ZoomInfo page.
// =============================================================

// Default dashboard URL — user configures this in popup
const DEFAULT_DASHBOARD_URL = "http://localhost:3000";

// Store captured companies across pages
let capturedCompanies = [];
let dashboardUrl = DEFAULT_DASHBOARD_URL;

// Load saved settings
chrome.storage.local.get(["dashboardUrl", "capturedCompanies"], (result) => {
  if (result.dashboardUrl) dashboardUrl = result.dashboardUrl;
  if (result.capturedCompanies) capturedCompanies = result.capturedCompanies;
});

// Listen for messages from popup and content script
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
      sendResponse({
        success: true,
        totalCaptured: capturedCompanies.length,
      });
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
      return true; // Keep channel open for async response

    case "EXPORT_CSV":
      const csv = generateCSV();
      sendResponse({ success: true, csv });
      break;
  }

  return true;
});

function addCompanies(newCompanies) {
  // Deduplicate by name + domain
  const existing = new Set(
    capturedCompanies.map((c) => `${c.name.toLowerCase()}|${c.domain.toLowerCase()}`)
  );

  let added = 0;
  for (const company of newCompanies) {
    const key = `${company.name.toLowerCase()}|${(company.domain || "").toLowerCase()}`;
    if (!existing.has(key) && company.name) {
      capturedCompanies.push({
        ...company,
        capturedAt: new Date().toISOString(),
      });
      existing.add(key);
      added++;
    }
  }

  // Persist to storage
  chrome.storage.local.set({ capturedCompanies });

  return added;
}

async function sendToDashboard() {
  if (capturedCompanies.length === 0) {
    return { success: false, error: "No companies captured yet" };
  }

  try {
    const response = await fetch(
      `${dashboardUrl}/api/company-matcher/extension`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companies: capturedCompanies }),
      }
    );

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
    return {
      success: false,
      error: `Failed to connect to dashboard: ${err.message}`,
    };
  }
}

function generateCSV() {
  const headers = [
    "Company Name",
    "Domain",
    "Industry",
    "Revenue",
    "Employees",
    "Location",
    "Captured At",
  ];

  const rows = capturedCompanies.map((c) =>
    [
      `"${(c.name || "").replace(/"/g, '""')}"`,
      c.domain || "",
      `"${(c.industry || "").replace(/"/g, '""')}"`,
      `"${(c.revenue || "").replace(/"/g, '""')}"`,
      c.employees || "",
      `"${(c.location || "").replace(/"/g, '""')}"`,
      c.capturedAt || "",
    ].join(",")
  );

  return [headers.join(","), ...rows].join("\n");
}

// Toggle widget when toolbar icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.url && tab.url.includes("zoominfo.com")) {
    chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_WIDGET" });
  }
});
