// =============================================================
// LeadGen — Persistent In-Page Widget
// Reads ZoomInfo's actual table columns including all visible data
// =============================================================

(() => {
  if (document.getElementById("leadgen-widget")) return;

  let state = { capturedCompanies: [], dashboardUrl: "https://lead-gen-dashboard-65lx.onrender.com", totalCaptured: 0 };

  // ══════════════════════════════════════════════════════
  // EXTRACT: Read ZoomInfo's table with ALL visible columns
  // ══════════════════════════════════════════════════════
  function extractCompaniesDirectly() {
    const companies = [];
    const seen = new Set();

    // Step 1: Find table headers to know column positions
    const headerRow = document.querySelector("table thead tr, [role='row']:first-child");
    const headers = [];
    if (headerRow) {
      headerRow.querySelectorAll("th, [role='columnheader'], td").forEach((th, i) => {
        const text = (th.textContent || "").trim().toLowerCase();
        headers[i] = text;
      });
    }

    // Map header names to column indices
    const colMap = {};
    headers.forEach((h, i) => {
      if (h.includes("company name") || h.includes("company")) colMap.name = i;
      if (h.includes("city") || h.includes("state") || h.includes("location") || h.includes("headquarters")) colMap.location = i;
      if (h.includes("industry") || h.includes("primary industry")) colMap.industry = i;
      if (h.includes("employee") || h.includes("headcount")) colMap.employees = i;
      if (h.includes("revenue") || h.includes("annual")) colMap.revenue = i;
      if (h.includes("website") || h.includes("url") || h.includes("domain")) colMap.website = i;
    });

    // Step 2: Read all data rows
    const rows = document.querySelectorAll("table tbody tr, [role='row']");

    for (const row of rows) {
      // Skip header row
      if (row.querySelector("th, [role='columnheader']")) continue;

      const cells = row.querySelectorAll("td, [role='cell'], [role='gridcell']");
      if (cells.length < 2) continue;

      // Extract company name — try mapped column first, then find link
      let name = "";
      if (colMap.name !== undefined && cells[colMap.name]) {
        name = clean(cells[colMap.name].textContent);
      }
      if (!name) {
        // Find company link
        const link = row.querySelector('a[href*="/company/"], a[href*="/co/"]');
        if (link) name = clean(link.textContent);
      }
      if (!name) {
        // First cell as fallback
        name = clean(cells[0]?.textContent || "");
      }

      if (!name || name.length < 2 || name.length > 200 || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());

      // Extract all other fields from mapped columns
      const location = colMap.location !== undefined ? clean(cells[colMap.location]?.textContent || "") : "";
      const industry = colMap.industry !== undefined ? clean(cells[colMap.industry]?.textContent || "") : "";
      const employees = colMap.employees !== undefined ? clean(cells[colMap.employees]?.textContent || "") : "";
      const revenue = colMap.revenue !== undefined ? clean(cells[colMap.revenue]?.textContent || "") : "";

      // Website/domain — try mapped column, then scan for domains
      let website = "";
      let domain = "";
      if (colMap.website !== undefined && cells[colMap.website]) {
        website = clean(cells[colMap.website].textContent);
        domain = cleanDomain(website);
      }

      // Also check for external links in the row
      if (!domain) {
        for (const a of row.querySelectorAll("a[href]")) {
          const href = a.getAttribute("href") || "";
          if (isExternalUrl(href)) {
            website = href;
            domain = cleanDomain(href);
            break;
          }
          const lt = clean(a.textContent);
          if (lt && /^[a-z0-9][-a-z0-9]*\.[a-z]{2,}/i.test(lt)) {
            website = lt;
            domain = cleanDomain(lt);
            break;
          }
        }
      }

      // Fallback: regex scan entire row text for domains
      if (!domain) {
        const allText = row.textContent || "";
        const m = allText.match(/(?:www\.)?([a-zA-Z0-9][-a-zA-Z0-9]{0,62}\.(?:com|io|net|org|co|ai|tech|biz|info|us|uk|de|fr|in|ca|au))\b/gi);
        if (m) {
          for (const match of m) {
            const d = cleanDomain(match);
            if (!isSkipDomain(d)) { domain = d; website = match.trim(); break; }
          }
        }
      }

      companies.push({ name, domain, website: website || domain, industry, revenue, employees, location });
    }

    // ── Fallback: company links if table parsing found nothing ──
    if (companies.length === 0) {
      const links = document.querySelectorAll('a[href*="/company/"], a[href*="/co/"]');
      for (const link of links) {
        const name = clean(link.textContent);
        if (!name || name.length < 2 || seen.has(name.toLowerCase())) continue;
        seen.add(name.toLowerCase());

        const container = link.closest("tr") || link.closest('[class*="row"]') || link.parentElement?.parentElement?.parentElement;
        const allText = container?.textContent || "";
        let domain = "";
        const m = allText.match(/(?:www\.)?([a-zA-Z0-9][-a-zA-Z0-9]{0,62}\.(?:com|io|net|org|co))\b/gi);
        if (m) {
          for (const match of m) {
            const d = cleanDomain(match);
            if (!isSkipDomain(d)) { domain = d; break; }
          }
        }
        companies.push({ name, domain, website: domain, industry: "", revenue: "", employees: "", location: "" });
      }
    }

    return companies;
  }

  function clean(t) { return (t || "").replace(/\s+/g, " ").replace(/[\n\r\t]/g, "").trim().substring(0, 200); }
  function cleanDomain(r) { if (!r) return ""; let d = r.toLowerCase().trim(); d = d.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").replace(/[?#].*$/, ""); return d; }
  function isExternalUrl(h) { if (!h || !h.includes(".")) return false; const skip = ["zoominfo.com","linkedin.com","facebook.com","twitter.com","javascript:","mailto:","#"]; return !skip.some(s => h.includes(s)) && /https?:\/\/[a-zA-Z0-9]/.test(h); }
  function isSkipDomain(d) { return ["zoominfo","linkedin","facebook","twitter","google","youtube"].some(s => d.includes(s)); }

  // ══════════════════════════════════════════════════════
  // BUILD WIDGET UI
  // ══════════════════════════════════════════════════════
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
        <input type="text" id="lg-dashUrl" value="https://lead-gen-dashboard-65lx.onrender.com" />
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

  // ── PERSIST WIDGET: Re-attach if ZoomInfo's SPA removes it ──
  const persistObserver = new MutationObserver(() => {
    if (!document.getElementById("leadgen-widget")) {
      document.body.appendChild(widget);
      widget.classList.add("visible");
    }
  });
  persistObserver.observe(document.body, { childList: true, subtree: false });

  // Also re-check on URL changes (SPA navigation)
  let lastUrl = window.location.href;
  setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      if (!document.getElementById("leadgen-widget")) {
        document.body.appendChild(widget);
        widget.classList.add("visible");
      }
      // Update visible count for new page
      setTimeout(() => {
        const c = extractCompaniesDirectly();
        q("#lg-visible").textContent = c.length;
      }, 2000);
    }
  }, 1000);

  // Load state
  chrome.runtime.sendMessage({ action: "GET_STATE" }, (r) => {
    if (chrome.runtime.lastError || !r) return;
    state = r;
    q("#lg-dashUrl").value = state.dashboardUrl;
    q("#lg-total").textContent = state.totalCaptured;
    q("#lg-countBadge").textContent = state.totalCaptured;
    updateList();
    updateBtns();
  });

  // Count visible companies
  setTimeout(() => {
    const c = extractCompaniesDirectly();
    q("#lg-visible").textContent = c.length;
  }, 2000);

  // Draggable
  let isDragging = false, offsetX = 0, offsetY = 0;
  q("#leadgen-header").addEventListener("mousedown", (e) => {
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

  // Toggle via toolbar
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "TOGGLE_WIDGET") widget.classList.toggle("visible");
  });

  widget.classList.add("visible");

  // Close
  q("#leadgen-close").addEventListener("click", () => widget.classList.remove("visible"));

  // Dashboard URL
  q("#lg-dashUrl").addEventListener("change", () => {
    const url = q("#lg-dashUrl").value.trim().replace(/\/$/, "");
    chrome.runtime.sendMessage({ action: "SET_DASHBOARD_URL", url });
    state.dashboardUrl = url;
  });

  // ── CAPTURE ──
  q("#lg-captureBtn").addEventListener("click", () => {
    const btn = q("#lg-captureBtn");
    btn.disabled = true;
    btn.innerHTML = '<span class="lg-spinner"></span>Capturing...';

    setTimeout(() => {
      const companies = extractCompaniesDirectly();

      if (companies.length === 0) {
        showAlert("#lg-captureAlert", "info", "No companies found. Make sure you're on a search results page.");
        resetBtn(btn, "Capture This Page");
        return;
      }

      chrome.runtime.sendMessage({ action: "ADD_COMPANIES", companies }, (addResp) => {
        if (chrome.runtime.lastError || !addResp) {
          showAlert("#lg-captureAlert", "error", "Extension error. Try refreshing the page.");
          resetBtn(btn, "Capture This Page");
          return;
        }
        state.totalCaptured = addResp.totalCaptured;
        q("#lg-total").textContent = addResp.totalCaptured;
        q("#lg-countBadge").textContent = addResp.totalCaptured;
        showAlert("#lg-captureAlert", "success", `+${companies.length} captured (${addResp.totalCaptured} total)`);

        chrome.runtime.sendMessage({ action: "GET_STATE" }, (s) => {
          if (s) { state = s; updateList(); updateBtns(); }
        });
        resetBtn(btn, "Capture This Page");
      });
    }, 500);
  });

  // ── MATCH (with wake-up ping + progress) ──
  q("#lg-matchBtn").addEventListener("click", async () => {
    const btn = q("#lg-matchBtn");
    btn.disabled = true;
    btn.innerHTML = '<span class="lg-spinner"></span>Waking up server...';
    showAlert("#lg-matchAlert", "info", "Waking up dashboard server... this may take 30s on first use.");

    // Step 1: Wake up Render (free tier sleeps after 15 min)
    try {
      const dashUrl = state.dashboardUrl.replace(/\/+$/, "");
      await fetch(`${dashUrl}/api/team-members`, { signal: AbortSignal.timeout(45000) }).catch(() => {});
    } catch { /* ignore wake-up errors */ }

    btn.innerHTML = '<span class="lg-spinner"></span>Matching ' + state.totalCaptured + ' companies...';
    showAlert("#lg-matchAlert", "info", "Matching " + state.totalCaptured + " companies against HubSpot...");

    // Step 2: Send for matching
    chrome.runtime.sendMessage({ action: "SEND_TO_DASHBOARD" }, (response) => {
      resetBtn(btn, "Match with HubSpot");
      if (chrome.runtime.lastError || !response?.success) {
        showAlert("#lg-matchAlert", "error", response?.error || "Failed to connect. Try again in 30s.");
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

  // CSV
  q("#lg-csvBtn").addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "EXPORT_CSV" }, (r) => {
      if (!r?.csv) return;
      const blob = new Blob([r.csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url;
      a.download = `zoominfo-companies-${new Date().toISOString().split("T")[0]}.csv`;
      a.click(); URL.revokeObjectURL(url);
    });
  });

  // Clear
  q("#lg-clearBtn").addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "CLEAR_COMPANIES" }, () => {
      state.capturedCompanies = []; state.totalCaptured = 0;
      q("#lg-total").textContent = "0"; q("#lg-countBadge").textContent = "0";
      q("#lg-companyList").innerHTML = '<div style="color:#555;text-align:center;padding:4px">No companies yet</div>';
      q("#lg-resultsSection").classList.add("lg-hidden");
      updateBtns();
    });
  });

  // Open Dashboard
  q("#lg-openDash").addEventListener("click", () => {
    window.open(`${state.dashboardUrl}/company-matcher?source=extension`, "_blank");
  });

  // ── Helpers ──
  function q(sel) { return document.querySelector(sel); }

  function updateList() {
    const list = q("#lg-companyList");
    const c = state.capturedCompanies || [];
    if (c.length === 0) { list.innerHTML = '<div style="color:#555;text-align:center;padding:4px">No companies yet</div>'; return; }
    const recent = c.slice(-12).reverse();
    list.innerHTML = recent.map(x =>
      `<div class="lg-company-item"><span class="lg-company-name">${esc(x.name)}</span><span class="lg-company-domain">${esc(x.domain || x.website || "—")}</span></div>`
    ).join("");
    if (c.length > 12) list.innerHTML += `<div style="color:#555;text-align:center;padding:2px;font-size:10px">+${c.length - 12} more</div>`;
  }

  function updateBtns() {
    const has = (state.totalCaptured || 0) > 0;
    q("#lg-matchBtn").disabled = !has;
    q("#lg-csvBtn").disabled = !has;
  }

  function resetBtn(b, t) { b.disabled = false; b.textContent = t; }

  function showAlert(sel, type, msg) {
    const el = q(sel);
    el.className = `lg-alert lg-alert-${type} lg-show`;
    el.textContent = msg;
    setTimeout(() => el.classList.remove("lg-show"), 4000);
  }

  function esc(t) { const d = document.createElement("div"); d.textContent = t; return d.innerHTML; }
})();
