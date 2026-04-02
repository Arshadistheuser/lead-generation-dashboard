// =============================================================
// LeadGen — Persistent In-Page Widget (injected into ZoomInfo)
// Stays visible until user clicks X. Draggable.
// =============================================================

(() => {
  if (document.getElementById("leadgen-widget")) return;

  let state = { capturedCompanies: [], dashboardUrl: "http://localhost:3000", totalCaptured: 0 };

  // ── Build Widget HTML ──
  const widget = document.createElement("div");
  widget.id = "leadgen-widget";
  widget.innerHTML = `
    <div id="leadgen-header">
      <div style="display:flex;align-items:center">
        <h1>LeadGen Matcher</h1>
        <span class="lg-badge" id="lg-countBadge">0</span>
      </div>
      <button id="leadgen-close">&times;</button>
    </div>
    <div id="leadgen-body">
      <div class="lg-section">
        <div class="lg-section-title">Dashboard URL</div>
        <input type="text" id="lg-dashUrl" value="http://localhost:3000" />
      </div>
      <div class="lg-section">
        <div class="lg-status-row">
          <span class="lg-label">Visible on page</span>
          <span class="lg-value lg-blue" id="lg-visible">—</span>
        </div>
        <div class="lg-status-row">
          <span class="lg-label">Captured total</span>
          <span class="lg-value lg-green" id="lg-total">0</span>
        </div>
      </div>
      <div class="lg-section">
        <button class="lg-btn lg-btn-primary" id="lg-captureBtn">Capture This Page</button>
        <div class="lg-alert" id="lg-captureAlert"></div>
      </div>
      <div class="lg-section">
        <div class="lg-section-title">Captured Companies</div>
        <div class="lg-company-list" id="lg-companyList">
          <div style="color:#555;text-align:center;padding:4px">No companies yet</div>
        </div>
      </div>
      <div class="lg-section">
        <button class="lg-btn lg-btn-success lg-btn-sm" id="lg-matchBtn" disabled>Match with HubSpot</button>
        <div class="lg-btn-row">
          <button class="lg-btn lg-btn-outline lg-btn-sm" id="lg-csvBtn" disabled>CSV</button>
          <button class="lg-btn lg-btn-outline lg-btn-sm" id="lg-clearBtn">Clear</button>
        </div>
        <div class="lg-alert" id="lg-matchAlert"></div>
      </div>
      <div class="lg-section lg-hidden" id="lg-resultsSection">
        <div class="lg-results-row">
          <div class="lg-result-box"><div class="lg-num lg-green" id="lg-found">0</div><div class="lg-rlabel">In HubSpot</div></div>
          <div class="lg-result-box"><div class="lg-num lg-red" id="lg-notFound">0</div><div class="lg-rlabel">New</div></div>
          <div class="lg-result-box"><div class="lg-num lg-yellow" id="lg-possible">0</div><div class="lg-rlabel">Maybe</div></div>
        </div>
        <button class="lg-btn lg-btn-outline lg-btn-sm" id="lg-openDash" style="margin-top:4px">Open in Dashboard</button>
      </div>
    </div>
    <div id="leadgen-footer">Reads visible data only. No credits used.</div>
  `;

  document.body.appendChild(widget);

  // ── Load State ──
  chrome.runtime.sendMessage({ action: "GET_STATE" }, (r) => {
    if (r) {
      state = r;
      q("#lg-dashUrl").value = state.dashboardUrl;
      q("#lg-total").textContent = state.totalCaptured;
      q("#lg-countBadge").textContent = state.totalCaptured;
      updateList();
      updateBtns();
    }
  });

  // Show visible count
  setTimeout(() => {
    chrome.runtime.sendMessage({ action: "CAPTURE_COMPANIES" }, () => {});
    const companies = window.__leadgenExtract ? window.__leadgenExtract() : [];
    q("#lg-visible").textContent = companies.length || "—";
  }, 1000);

  // ── Make Draggable ──
  let isDragging = false, offsetX = 0, offsetY = 0;
  const header = q("#leadgen-header");

  header.addEventListener("mousedown", (e) => {
    if (e.target.id === "leadgen-close") return;
    isDragging = true;
    offsetX = e.clientX - widget.getBoundingClientRect().left;
    offsetY = e.clientY - widget.getBoundingClientRect().top;
    widget.style.transition = "none";
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    widget.style.left = (e.clientX - offsetX) + "px";
    widget.style.top = (e.clientY - offsetY) + "px";
    widget.style.right = "auto";
  });

  document.addEventListener("mouseup", () => { isDragging = false; });

  // ── Toggle via toolbar icon ──
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "TOGGLE_WIDGET") {
      widget.classList.toggle("visible");
      if (widget.classList.contains("visible")) refreshVisible();
    }
  });

  // Start visible
  widget.classList.add("visible");
  setTimeout(refreshVisible, 1500);

  // ── Close Button ──
  q("#leadgen-close").addEventListener("click", () => {
    widget.classList.remove("visible");
  });

  // ── Dashboard URL ──
  q("#lg-dashUrl").addEventListener("change", () => {
    const url = q("#lg-dashUrl").value.trim().replace(/\/$/, "");
    chrome.runtime.sendMessage({ action: "SET_DASHBOARD_URL", url });
    state.dashboardUrl = url;
  });

  // ── Capture Button ──
  q("#lg-captureBtn").addEventListener("click", () => {
    const btn = q("#lg-captureBtn");
    btn.disabled = true;
    btn.innerHTML = '<span class="lg-spinner"></span>Capturing...';

    chrome.runtime.sendMessage({ action: "CAPTURE_COMPANIES" }, () => {});

    // Use content script's extract function
    setTimeout(() => {
      chrome.runtime.sendMessage({ action: "CAPTURE_CURRENT_PAGE" }, (response) => {
        if (!response?.success || !response.companies.length) {
          showAlert("#lg-captureAlert", "info", "No companies found on this page.");
          resetBtn(btn, "Capture This Page");
          return;
        }

        chrome.runtime.sendMessage({ action: "ADD_COMPANIES", companies: response.companies }, (addResp) => {
          state.totalCaptured = addResp.totalCaptured;
          q("#lg-total").textContent = addResp.totalCaptured;
          q("#lg-countBadge").textContent = addResp.totalCaptured;
          showAlert("#lg-captureAlert", "success", `+${response.companies.length} captured (${addResp.totalCaptured} total)`);

          chrome.runtime.sendMessage({ action: "GET_STATE" }, (s) => {
            state = s;
            updateList();
            updateBtns();
          });

          resetBtn(btn, "Capture This Page");
        });
      });
    }, 300);
  });

  // ── Match Button ──
  q("#lg-matchBtn").addEventListener("click", () => {
    const btn = q("#lg-matchBtn");
    btn.disabled = true;
    btn.innerHTML = '<span class="lg-spinner"></span>Matching...';

    chrome.runtime.sendMessage({ action: "SEND_TO_DASHBOARD" }, (response) => {
      resetBtn(btn, "Match with HubSpot");

      if (!response?.success) {
        showAlert("#lg-matchAlert", "error", response?.error || "Failed to connect to dashboard");
        return;
      }

      const s = response.summary;
      if (s) {
        q("#lg-resultsSection").classList.remove("lg-hidden");
        q("#lg-found").textContent = s.found;
        q("#lg-notFound").textContent = s.notFound;
        q("#lg-possible").textContent = s.possibleMatch;
      }
      showAlert("#lg-matchAlert", "success", `Done! ${s?.found || 0} in HubSpot, ${s?.notFound || 0} new`);
    });
  });

  // ── CSV Export ──
  q("#lg-csvBtn").addEventListener("click", () => {
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
  });

  // ── Clear ──
  q("#lg-clearBtn").addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "CLEAR_COMPANIES" }, () => {
      state.capturedCompanies = [];
      state.totalCaptured = 0;
      q("#lg-total").textContent = "0";
      q("#lg-countBadge").textContent = "0";
      q("#lg-companyList").innerHTML = '<div style="color:#555;text-align:center;padding:4px">No companies yet</div>';
      q("#lg-resultsSection").classList.add("lg-hidden");
      updateBtns();
    });
  });

  // ── Open Dashboard ──
  q("#lg-openDash").addEventListener("click", () => {
    window.open(`${state.dashboardUrl}/company-matcher?source=extension`, "_blank");
  });

  // ── Helpers ──
  function q(sel) { return document.querySelector(sel); }

  function refreshVisible() {
    chrome.runtime.sendMessage({ action: "CHECK_PAGE" }, () => {});
    setTimeout(() => {
      chrome.runtime.sendMessage({ action: "CAPTURE_COMPANIES" }, (resp) => {
        if (resp?.companies) q("#lg-visible").textContent = resp.companies.length;
      });
    }, 200);
  }

  function updateList() {
    const list = q("#lg-companyList");
    const companies = state.capturedCompanies || [];
    if (companies.length === 0) {
      list.innerHTML = '<div style="color:#555;text-align:center;padding:4px">No companies yet</div>';
      return;
    }
    const recent = companies.slice(-12).reverse();
    list.innerHTML = recent.map((c) =>
      `<div class="lg-company-item"><span class="lg-company-name">${esc(c.name)}</span><span class="lg-company-domain">${esc(c.domain || c.website || "—")}</span></div>`
    ).join("");
    if (companies.length > 12) {
      list.innerHTML += `<div style="color:#555;text-align:center;padding:2px;font-size:10px">+${companies.length - 12} more</div>`;
    }
  }

  function updateBtns() {
    const has = (state.totalCaptured || 0) > 0;
    q("#lg-matchBtn").disabled = !has;
    q("#lg-csvBtn").disabled = !has;
  }

  function resetBtn(btn, text) { btn.disabled = false; btn.textContent = text; }

  function showAlert(sel, type, msg) {
    const el = q(sel);
    el.className = `lg-alert lg-alert-${type} lg-show`;
    el.textContent = msg;
    setTimeout(() => el.classList.remove("lg-show"), 4000);
  }

  function esc(t) { const d = document.createElement("div"); d.textContent = t; return d.innerHTML; }
})();
