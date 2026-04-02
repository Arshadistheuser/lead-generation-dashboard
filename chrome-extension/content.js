// =============================================================
// LeadGen HubSpot Matcher — Content Script
// SAFETY: Only reads DOM. Never modifies, injects, or writes.
// Runs in isolated world — invisible to page JavaScript.
// =============================================================

(() => {
  if (!window.location.href.includes("zoominfo.com")) return;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === "CAPTURE_COMPANIES" || message.action === "CAPTURE_CURRENT_PAGE") {
      try {
        const companies = extractCompanies();
        sendResponse({
          success: true,
          companies,
          pageInfo: { url: window.location.href },
        });
      } catch (e) {
        sendResponse({ success: false, companies: [], error: String(e) });
      }
    }

    if (message.action === "CHECK_PAGE") {
      try {
        const companies = extractCompanies();
        sendResponse({
          isZoomInfo: true,
          isSearchResults: true,
          visibleCount: companies.length,
          url: window.location.href,
        });
      } catch {
        sendResponse({ isZoomInfo: true, isSearchResults: false, visibleCount: 0 });
      }
    }

    if (message.action === "TOGGLE_WIDGET") {
      // Handled by widget.js
    }

    return true;
  });

  function extractCompanies() {
    const companies = [];
    const seen = new Set();

    // ── UNIVERSAL APPROACH: Find ALL links on the page that look like company links ──
    // ZoomInfo company links typically contain /company/ or /co/ in the href
    const allLinks = document.querySelectorAll("a");

    for (const link of allLinks) {
      const href = link.getAttribute("href") || "";
      const text = cleanText(link.textContent);

      // Skip empty, too short, too long, or navigation links
      if (!text || text.length < 2 || text.length > 150) continue;
      // Skip if already seen
      if (seen.has(text.toLowerCase())) continue;
      // Skip common non-company links
      if (isNavigationText(text)) continue;

      // Check if this looks like a company link
      const isCompanyLink =
        href.includes("/company/") ||
        href.includes("/co/") ||
        href.includes("/p/company/");

      if (!isCompanyLink) continue;

      seen.add(text.toLowerCase());

      // Get the row/container for additional data
      const container =
        link.closest("tr") ||
        link.closest('[role="row"]') ||
        link.closest('[class*="row"]') ||
        link.closest('[class*="result"]') ||
        link.closest('[class*="card"]') ||
        link.closest('[class*="item"]') ||
        findAncestorWithSiblings(link, 3);

      companies.push(extractFromContainer(container, text));
    }

    // ── FALLBACK: If no company links found, try table rows ──
    if (companies.length === 0) {
      const rows = document.querySelectorAll("table tbody tr");
      for (const row of rows) {
        const cells = row.querySelectorAll("td");
        if (cells.length < 2) continue;

        const name = cleanText(cells[0]?.textContent || "");
        if (!name || name.length < 2 || seen.has(name.toLowerCase())) continue;
        if (isNavigationText(name)) continue;

        seen.add(name.toLowerCase());
        companies.push(extractFromContainer(row, name));
      }
    }

    return companies;
  }

  function extractFromContainer(container, name) {
    if (!container) {
      return { name, domain: "", website: "", industry: "", revenue: "", employees: "", location: "" };
    }

    const allText = container.textContent || "";
    let domain = "";
    let website = "";

    // Find domain from links
    for (const a of container.querySelectorAll("a[href]")) {
      const href = a.getAttribute("href") || "";
      const linkText = cleanText(a.textContent);

      // Skip ZoomInfo internal and social links
      if (isInternalLink(href)) continue;

      if (href.match(/https?:\/\/[a-zA-Z0-9]/)) {
        website = href;
        domain = cleanDomain(href);
        break;
      }
      if (linkText && isDomainLike(linkText)) {
        website = linkText;
        domain = cleanDomain(linkText);
        break;
      }
    }

    // Regex scan for domains in text
    if (!domain) {
      const m = allText.match(
        /\b([a-zA-Z0-9][-a-zA-Z0-9]{0,62}\.(?:com|io|net|org|co|ai|tech|dev|biz|info|us|uk|de|fr|in|ca|au|co\.uk|co\.in))\b/gi
      );
      if (m) {
        for (const match of m) {
          const d = cleanDomain(match);
          if (!isSkipDomain(d)) { domain = d; website = match.trim(); break; }
        }
      }
    }

    // Find other fields
    return {
      name,
      domain,
      website: website || domain,
      industry: findInText(container, ["industry", "sector"]),
      revenue: findInText(container, ["revenue", "annual"]),
      employees: findInText(container, ["employee", "headcount", "people", "size"]),
      location: findInText(container, ["location", "headquarters", "hq", "country", "city"]),
    };
  }

  function findInText(container, keywords) {
    if (!container) return "";
    for (const kw of keywords) {
      for (const sel of [`[class*="${kw}" i]`, `[data-testid*="${kw}" i]`]) {
        try {
          const el = container.querySelector(sel);
          if (el) {
            const t = cleanText(el.textContent);
            if (t && t.length < 150) return t;
          }
        } catch { /* skip bad selector */ }
      }
    }
    return "";
  }

  function findAncestorWithSiblings(el, maxLevels) {
    let current = el;
    for (let i = 0; i < maxLevels; i++) {
      if (!current.parentElement) return current;
      current = current.parentElement;
      if (current.children.length > 2) return current;
    }
    return current;
  }

  function isNavigationText(text) {
    const skip = [
      "home", "about", "contact", "login", "sign in", "sign up", "search",
      "help", "pricing", "blog", "careers", "privacy", "terms", "cookie",
      "next", "previous", "page", "show", "filter", "sort", "export",
      "upgrade", "try", "learn more", "view all", "see more", "load more",
    ];
    const lower = text.toLowerCase().trim();
    return skip.some((s) => lower === s) || lower.length > 100;
  }

  function isInternalLink(href) {
    const skip = ["zoominfo.com", "linkedin.com", "facebook.com", "twitter.com", "javascript:", "mailto:", "#", "chrome://"];
    return !href || skip.some((s) => href.includes(s));
  }

  function isDomainLike(text) {
    return /^[a-z0-9][-a-z0-9]*\.[a-z]{2,}/i.test(text.trim());
  }

  function isSkipDomain(d) {
    const skip = ["zoominfo", "linkedin", "facebook", "twitter", "google", "youtube", "javascript"];
    return skip.some((s) => d.includes(s));
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
