const $ = (id) => document.getElementById(id);
let state = { capturedCompanies: [], dashboardUrl: "http://localhost:3000" };

document.addEventListener("DOMContentLoaded", async () => {
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

  checkCurrentPage();

  $("dashboardUrl").addEventListener("change", () => {
    const url = $("dashboardUrl").value.trim().replace(/\/$/, "");
    chrome.runtime.sendMessage({ action: "SET_DASHBOARD_URL", url });
    state.dashboardUrl = url;
  });

  $("captureBtn").addEventListener("click", captureCompanies);
  $("matchBtn").addEventListener("click", sendToMatch);
  $("exportCsvBtn").addEventListener("click", exportCSV);
  $("clearBtn").addEventListener("click", clearAll);
  $("viewInDashboardBtn")?.addEventListener("click", () => {
    chrome.tabs.create({ url: `${state.dashboardUrl}/company-matcher` });
  });
});

async function checkCurrentPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url?.includes("zoominfo.com")) {
      $("pageStatus").textContent = "Not ZoomInfo";
      $("pageStatus").style.color = "#ef4444";
      $("captureBtn").disabled = true;
      return;
    }

    chrome.tabs.sendMessage(tab.id, { action: "CHECK_PAGE" }, (response) => {
      if (chrome.runtime.lastError || !response) {
        $("pageStatus").textContent = "Loading...";
        $("pageStatus").style.color = "#eab308";
        $("captureBtn").disabled = false;
        return;
      }
      $("pageStatus").textContent = response.isSearchResults ? "Search Results" : "ZoomInfo";
      $("pageStatus").style.color = "#22c55e";
      $("visibleCount").textContent = response.visibleCount || "—";
      $("captureBtn").disabled = (response.visibleCount || 0) === 0;
    });
  } catch {
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
        showAlert("captureAlert", "error", "Could not read page. Are you on ZoomInfo search results?");
        resetBtn(btn, "Capture This Page");
        return;
      }

      const companies = response.companies;
      if (companies.length === 0) {
        showAlert("captureAlert", "info", "No companies found. Try scrolling or changing filters.");
        resetBtn(btn, "Capture This Page");
        return;
      }

      chrome.runtime.sendMessage({ action: "ADD_COMPANIES", companies }, (addResp) => {
        state.totalCaptured = addResp.totalCaptured;
        $("totalCaptured").textContent = addResp.totalCaptured;
        $("countBadge").textContent = addResp.totalCaptured;
        showAlert("captureAlert", "success", `+${companies.length} captured (${addResp.totalCaptured} total)`);

        chrome.runtime.sendMessage({ action: "GET_STATE" }, (stateResp) => {
          state = stateResp;
          updateCompanyList();
          updateButtons();
        });

        resetBtn(btn, "Capture This Page");
      });
    });
  } catch (err) {
    showAlert("captureAlert", "error", err.message);
    resetBtn(btn, "Capture This Page");
  }
}

async function sendToMatch() {
  const btn = $("matchBtn");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Matching...';

  chrome.runtime.sendMessage({ action: "SEND_TO_DASHBOARD" }, (response) => {
    resetBtn(btn, "Match with HubSpot");

    if (!response?.success) {
      showAlert("matchAlert", "error", response?.error || "Failed to connect");
      return;
    }

    const s = response.summary;
    if (s) {
      $("resultsSection").classList.remove("hidden");
      $("foundCount").textContent = s.found;
      $("notFoundCount").textContent = s.notFound;
      $("possibleCount").textContent = s.possibleMatch;
    }
    showAlert("matchAlert", "success", `Done! ${s?.found || 0} in HubSpot, ${s?.notFound || 0} new`);
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
  if (!confirm("Clear all?")) return;
  chrome.runtime.sendMessage({ action: "CLEAR_COMPANIES" }, () => {
    state.capturedCompanies = [];
    state.totalCaptured = 0;
    $("totalCaptured").textContent = "0";
    $("countBadge").textContent = "0";
    $("companyList").innerHTML = '<div style="color:#555;text-align:center;padding:4px">No companies yet</div>';
    $("resultsSection").classList.add("hidden");
    updateButtons();
  });
}

function updateCompanyList() {
  const list = $("companyList");
  const companies = state.capturedCompanies || [];
  if (companies.length === 0) {
    list.innerHTML = '<div style="color:#555;text-align:center;padding:4px">No companies yet</div>';
    return;
  }
  const recent = companies.slice(-15).reverse();
  list.innerHTML = recent.map((c) =>
    `<div class="company-item"><span class="company-name">${esc(c.name)}</span><span class="company-domain">${esc(c.domain || c.website || "—")}</span></div>`
  ).join("");
  if (companies.length > 15) {
    list.innerHTML += `<div style="color:#555;text-align:center;padding:2px;font-size:10px">+${companies.length - 15} more</div>`;
  }
}

function updateButtons() {
  const has = (state.totalCaptured || 0) > 0;
  $("matchBtn").disabled = !has;
  $("exportCsvBtn").disabled = !has;
}

function resetBtn(btn, text) {
  btn.disabled = false;
  btn.textContent = text;
}

function showAlert(id, type, msg) {
  const el = $(id);
  el.className = `alert alert-${type}`;
  el.textContent = msg;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 4000);
}

function esc(text) {
  const d = document.createElement("div");
  d.textContent = text;
  return d.innerHTML;
}
