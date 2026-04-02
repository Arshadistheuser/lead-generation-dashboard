// =============================================================
// LeadGen HubSpot Matcher — Content Script
// SAFETY: Only reads DOM. Never modifies, injects, or writes.
// Runs in isolated world — invisible to page JavaScript.
// =============================================================

(() => {
  if (!window.location.href.includes("zoominfo.com")) return;

  // Auto-capture: watch for page content changes (user clicks Next)
  let lastPageContent = "";
  let autoCapture = false;

  const observer = new MutationObserver(() => {
    if (!autoCapture) return;
    const currentContent = getPageSignature();
    if (currentContent !== lastPageContent && currentContent.length > 100) {
      lastPageContent = currentContent;
      // Small delay to let page fully render
      setTimeout(() => {
        const companies = extractCompanies();
        if (companies.length > 0) {
          chrome.runtime.sendMessage({
            action: "ADD_COMPANIES",
            companies,
          });
        }
      }, 1500);
    }
  });

  function getPageSignature() {
    const rows = document.querySelectorAll('table tbody tr, [role="row"], a[href*="/company/"]');
    return Array.from(rows).map(r => r.textContent?.substring(0, 50)).join("|");
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "CAPTURE_COMPANIES" || message.action === "CAPTURE_CURRENT_PAGE") {
      const companies = extractCompanies();
      lastPageContent = getPageSignature();
      sendResponse({
        success: true,
        companies,
        pageInfo: getPageInfo(),
        url: window.location.href,
      });
    }

    if (message.action === "CHECK_PAGE") {
      const companies = extractCompanies();
      sendResponse({
        isZoomInfo: true,
        isSearchResults: isSearchResultsPage(),
        visibleCount: companies.length,
        url: window.location.href,
      });
    }

    if (message.action === "ENABLE_AUTO_CAPTURE") {
      autoCapture = true;
      lastPageContent = getPageSignature();
      observer.observe(document.body, { childList: true, subtree: true });
      sendResponse({ success: true });
    }

    if (message.action === "DISABLE_AUTO_CAPTURE") {
      autoCapture = false;
      observer.disconnect();
      sendResponse({ success: true });
    }

    return true;
  });

  function isSearchResultsPage() {
    const url = window.location.href.toLowerCase();
    return url.includes("search") || url.includes("results") || url.includes("company") || url.includes("list");
  }

  function getPageInfo() {
    const paginationText = document.querySelector('[class*="pagination"]')?.textContent?.trim() || "";
    const totalResults = document.querySelector('[class*="total-count"]')?.textContent?.trim() ||
      document.querySelector('[class*="result-count"]')?.textContent?.trim() || "";
    return { paginationText, totalResults };
  }

  function extractCompanies() {
    const companies = [];
    const seen = new Set();

    // STRATEGY 1: Company links (most reliable for ZoomInfo)
    const companyLinks = document.querySelectorAll(
      'a[href*="/company/"], a[href*="/co/"], a[href*="/p/company/"]'
    );

    for (const link of companyLinks) {
      const name = cleanText(link.textContent);
      if (!name || name.length < 2 || name.length > 200) continue;
      if (seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());

      const container =
        link.closest("tr") ||
        link.closest('[class*="row"]') ||
        link.closest('[class*="result"]') ||
        link.closest('[class*="card"]') ||
        link.closest('[class*="item"]') ||
        link.closest('[role="row"]') ||
        link.parentElement?.parentElement?.parentElement;

      companies.push(extractData(container, name));
    }

    // STRATEGY 2: Table rows
    if (companies.length === 0) {
      const rows = document.querySelectorAll('table tbody tr, [role="row"]');
      for (const row of rows) {
        const link = row.querySelector("a");
        const name = cleanText(link?.textContent || row.querySelector("td")?.textContent || "");
        if (!name || name.length < 2 || seen.has(name.toLowerCase())) continue;
        seen.add(name.toLowerCase());
        companies.push(extractData(row, name));
      }
    }

    return companies;
  }

  function extractData(container, name) {
    if (!container) {
      return { name, domain: "", website: "", industry: "", revenue: "", employees: "", location: "" };
    }

    const allText = container.textContent || "";

    // ── WEBSITE / DOMAIN ──
    let website = "";
    let domain = "";

    // 1. Elements with website/domain class
    for (const sel of ['[class*="website" i]', '[class*="domain" i]', '[class*="url" i]', '[class*="companyUrl" i]', '[data-testid*="website" i]', '[data-testid*="domain" i]']) {
      try {
        const el = container.querySelector(sel);
        if (el) {
          const t = cleanText(el.textContent);
          if (t && isDomain(t)) { website = t; domain = cleanDomain(t); break; }
          const href = el.getAttribute("href") || el.querySelector("a")?.getAttribute("href") || "";
          if (href && href.includes(".") && !href.includes("zoominfo")) { website = href; domain = cleanDomain(href); break; }
        }
      } catch { /* skip */ }
    }

    // 2. External links (not zoominfo/social)
    if (!domain) {
      for (const a of container.querySelectorAll("a[href]")) {
        const href = a.getAttribute("href") || "";
        if (isExternalUrl(href)) {
          website = href;
          domain = cleanDomain(href);
          break;
        }
        const t = cleanText(a.textContent);
        if (t && isDomain(t)) { website = t; domain = cleanDomain(t); break; }
      }
    }

    // 3. Regex scan of all text
    if (!domain) {
      const m = allText.match(/(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9][-a-zA-Z0-9]{0,62}\.(?:com|io|net|org|co|ai|tech|biz|info|us|uk|de|fr|in|ca|au|co\.uk|co\.in))\b/gi);
      if (m) {
        for (const match of m) {
          const d = cleanDomain(match);
          if (!isSkipDomain(d)) { domain = d; website = match.trim(); break; }
        }
      }
    }

    // 4. Aria-labels, title attributes
    if (!domain) {
      for (const el of container.querySelectorAll("[aria-label], [title]")) {
        const label = el.getAttribute("aria-label") || el.getAttribute("title") || "";
        if (isDomain(label)) { domain = cleanDomain(label); website = label; break; }
      }
    }

    // 5. Data attributes
    if (!domain) {
      for (const el of container.querySelectorAll("[data-website], [data-domain], [data-url]")) {
        const v = el.getAttribute("data-website") || el.getAttribute("data-domain") || el.getAttribute("data-url") || "";
        if (v) { domain = cleanDomain(v); website = v; break; }
      }
    }

    return {
      name,
      domain,
      website: website || domain,
      industry: findField(container, ["industry", "sector"]),
      revenue: findField(container, ["revenue", "annual"]),
      employees: findField(container, ["employee", "headcount", "people", "staff", "size"]),
      location: findField(container, ["location", "headquarters", "hq", "country", "city"]),
    };
  }

  function findField(container, keywords) {
    if (!container) return "";
    for (const kw of keywords) {
      for (const sel of [`[class*="${kw}" i]`, `[data-testid*="${kw}" i]`]) {
        try {
          const el = container.querySelector(sel);
          if (el) {
            const t = cleanText(el.textContent);
            if (t && t.length < 200) return t;
          }
        } catch { /* skip */ }
      }
    }
    return "";
  }

  function isDomain(text) {
    if (!text) return false;
    return /^(?:https?:\/\/)?(?:www\.)?[a-z0-9][-a-z0-9]*\.[a-z]{2,}/i.test(text.trim());
  }

  function isExternalUrl(href) {
    if (!href || !href.includes(".")) return false;
    const skip = ["zoominfo.com", "linkedin.com", "facebook.com", "twitter.com", "javascript:", "mailto:", "#"];
    return !skip.some(s => href.includes(s)) && /https?:\/\/[a-zA-Z0-9]/.test(href);
  }

  function isSkipDomain(d) {
    const skip = ["zoominfo", "linkedin", "facebook", "twitter", "google", "youtube"];
    return skip.some(s => d.includes(s));
  }

  function cleanText(text) {
    return (text || "").replace(/\s+/g, " ").replace(/[\n\r\t]/g, "").trim().substring(0, 200);
  }

  function cleanDomain(raw) {
    if (!raw) return "";
    let d = raw.toLowerCase().trim();
    d = d.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").replace(/[?#].*$/, "");
    return d;
  }
})();
