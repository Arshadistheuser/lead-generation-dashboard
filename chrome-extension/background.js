// =============================================================
// LeadGen HubSpot Matcher — Background Service Worker
// ALL network requests happen here (bypasses CORS/mixed content)
// =============================================================

// Default to Render URL (HTTPS) — works from any machine
const DEFAULT_DASHBOARD_URL = "https://lead-gen-dashboard-65lx.onrender.com";

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
      return true; // Keep channel open for async

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
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js", "widget.js"],
      });
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ["widget.css"],
      });
      setTimeout(() => {
        chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_WIDGET" }).catch(() => {});
      }, 500);
    } catch {
      // Can't inject
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

  // Clean the URL
  const url = dashboardUrl.replace(/\/+$/, "");
  const endpoint = `${url}/api/company-matcher/extension`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180000); // 3 min timeout for large batches

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companies: capturedCompanies }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      // Check if we got HTML instead of JSON (wrong URL or 404)
      if (text.includes("<!DOCTYPE") || text.includes("<html")) {
        throw new Error("Dashboard returned HTML instead of JSON. Check the Dashboard URL in the widget.");
      }
      try {
        const errData = JSON.parse(text);
        throw new Error(errData.error || `HTTP ${response.status}`);
      } catch (e) {
        if (e instanceof SyntaxError) {
          throw new Error(`HTTP ${response.status}: ${text.substring(0, 100)}`);
        }
        throw e;
      }
    }

    const data = await response.json();
    return {
      success: true,
      results: data.results,
      summary: data.summary,
      matchUrl: `${url}/company-matcher?source=extension`,
    };
  } catch (err) {
    const msg = err.name === "AbortError"
      ? "Request timed out. The dashboard might be sleeping — try again in 30 seconds."
      : `${err.message}`;

    return { success: false, error: msg };
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
