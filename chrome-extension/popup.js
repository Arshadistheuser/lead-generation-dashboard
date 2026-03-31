// =============================================================
// LeadGen HubSpot Matcher — Popup Script
// =============================================================

const $ = (id) => document.getElementById(id);

let state = { capturedCompanies: [], dashboardUrl: "http://localhost:3000" };

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
  // Load state from background
  chrome.runtime.sendMessage({ action: "GET_STATE" }, (response) => {
    if (response) {
      state = response;
      $("dashboardUrl").value = state.dashboardUrl;
      $("totalCaptured").textContent = state.totalCaptured;
      $("countBadge").textContent = state.totalCaptured;
      updateCompanyList();
      updateButtons();
    }
  });

  // Check current tab
  checkCurrentPage();

  // Event listeners
  $("dashboardUrl").addEventListener("change", saveDashboardUrl);
  $("captureBtn").addEventListener("click", captureCompanies);
  $("matchBtn").addEventListener("click", sendToMatch);
  $("exportCsvBtn").addEventListener("click", exportCSV);
  $("clearBtn").addEventListener("click", clearAll);
  $("viewInDashboardBtn")?.addEventListener("click", openDashboard);
});

function saveDashboardUrl() {
  const url = $("dashboardUrl").value.trim().replace(/\/$/, "");
  chrome.runtime.sendMessage({ action: "SET_DASHBOARD_URL", url });
  state.dashboardUrl = url;
}

async function checkCurrentPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.url?.includes("zoominfo.com")) {
      $("pageStatus").textContent = "Not on ZoomInfo";
      $("pageStatus").style.color = "#ef4444";
      $("visibleCount").textContent = "—";
      $("captureBtn").disabled = true;
      return;
    }

    // Ask content script for page status
    chrome.tabs.sendMessage(tab.id, { action: "CHECK_PAGE" }, (response) => {
      if (chrome.runtime.lastError || !response) {
        $("pageStatus").textContent = "Connecting...";
        $("pageStatus").style.color = "#eab308";
        // Try capturing anyway — content script might not have loaded yet
        $("captureBtn").disabled = false;
        return;
      }

      $("pageStatus").textContent = response.isSearchResults
        ? "Search Results"
        : "ZoomInfo Page";
      $("pageStatus").style.color = "#22c55e";

      // Do a quick preview capture to show count
      chrome.tabs.sendMessage(tab.id, { action: "CAPTURE_COMPANIES" }, (captureResp) => {
        if (captureResp?.companies) {
          $("visibleCount").textContent = captureResp.companies.length;
          $("captureBtn").disabled = captureResp.companies.length === 0;
        }
      });
    });
  } catch (err) {
    $("pageStatus").textContent = "Error";
    $("pageStatus").style.color = "#ef4444";
  }
}

async function captureCompanies() {
  const btn = $("captureBtn");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Capturing...';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    chrome.tabs.sendMessage(tab.id, { action: "CAPTURE_CURRENT_PAGE" }, (response) => {
      if (chrome.runtime.lastError || !response?.success) {
        showAlert("captureAlert", "error", "Could not read page. Make sure you're on ZoomInfo search results.");
        btn.disabled = false;
        btn.textContent = "Capture Companies from This Page";
        return;
      }

      const companies = response.companies;

      if (companies.length === 0) {
        showAlert("captureAlert", "info", "No companies found on this page. Try scrolling down or changing filters.");
        btn.disabled = false;
        btn.textContent = "Capture Companies from This Page";
        return;
      }

      // Send to background to store (deduplicates)
      chrome.runtime.sendMessage(
        { action: "ADD_COMPANIES", companies },
        (addResp) => {
          state.totalCaptured = addResp.totalCaptured;
          $("totalCaptured").textContent = addResp.totalCaptured;
          $("countBadge").textContent = addResp.totalCaptured;

          showAlert(
            "captureAlert",
            "success",
            `Captured ${companies.length} companies! (${addResp.totalCaptured} total, duplicates removed)`
          );

          // Refresh company list
          chrome.runtime.sendMessage({ action: "GET_STATE" }, (stateResp) => {
            state = stateResp;
            updateCompanyList();
            updateButtons();
          });

          btn.disabled = false;
          btn.textContent = "Capture Companies from This Page";
        }
      );
    });
  } catch (err) {
    showAlert("captureAlert", "error", err.message);
    btn.disabled = false;
    btn.textContent = "Capture Companies from This Page";
  }
}

async function sendToMatch() {
  const btn = $("matchBtn");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Matching with HubSpot...';

  chrome.runtime.sendMessage({ action: "SEND_TO_DASHBOARD" }, (response) => {
    btn.disabled = false;
    btn.textContent = "Send to Dashboard & Match";

    if (!response?.success) {
      showAlert("matchAlert", "error", response?.error || "Failed to connect to dashboard");
      return;
    }

    // Show results
    const summary = response.summary;
    if (summary) {
      $("resultsSection").classList.remove("hidden");
      $("foundCount").textContent = summary.found;
      $("notFoundCount").textContent = summary.notFound;
      $("possibleCount").textContent = summary.possibleMatch;
    }

    if (response.matchUrl) {
      $("viewInDashboardBtn").onclick = () => {
        chrome.tabs.create({ url: response.matchUrl });
      };
    }

    showAlert("matchAlert", "success", `Matched! ${summary?.found || 0} in HubSpot, ${summary?.notFound || 0} new.`);
  });
}

function exportCSV() {
  chrome.runtime.sendMessage({ action: "EXPORT_CSV" }, (response) => {
    if (!response?.csv) return;

    const blob = new Blob([response.csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zoominfo-companies-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

function clearAll() {
  if (!confirm("Clear all captured companies?")) return;

  chrome.runtime.sendMessage({ action: "CLEAR_COMPANIES" }, () => {
    state.capturedCompanies = [];
    state.totalCaptured = 0;
    $("totalCaptured").textContent = "0";
    $("countBadge").textContent = "0";
    $("companyList").innerHTML = "";
    $("resultsSection").classList.add("hidden");
    updateButtons();
    showAlert("captureAlert", "info", "All companies cleared.");
  });
}

function openDashboard() {
  chrome.tabs.create({ url: `${state.dashboardUrl}/company-matcher` });
}

function updateCompanyList() {
  const list = $("companyList");
  const companies = state.capturedCompanies || [];

  if (companies.length === 0) {
    list.innerHTML = '<div style="color:#555;text-align:center;padding:8px">No companies captured yet</div>';
    return;
  }

  // Show last 20
  const recent = companies.slice(-20).reverse();
  list.innerHTML = recent
    .map(
      (c) => `
    <div class="company-item">
      <span class="company-name">${escapeHtml(c.name)}</span>
      <span class="company-domain">${escapeHtml(c.domain || "—")}</span>
    </div>
  `
    )
    .join("");

  if (companies.length > 20) {
    list.innerHTML += `<div style="color:#555;text-align:center;padding:4px;font-size:11px">...and ${companies.length - 20} more</div>`;
  }
}

function updateButtons() {
  const hasCompanies = (state.totalCaptured || 0) > 0;
  $("matchBtn").disabled = !hasCompanies;
  $("exportCsvBtn").disabled = !hasCompanies;
}

function showAlert(elementId, type, message) {
  const el = $(elementId);
  el.className = `alert alert-${type}`;
  el.textContent = message;
  el.classList.remove("hidden");

  // Auto-hide after 5 seconds
  setTimeout(() => el.classList.add("hidden"), 5000);
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
