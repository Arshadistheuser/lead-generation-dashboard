// =============================================================
// LeadGen HubSpot Matcher — Content Script
// SAFETY: Only reads DOM. Never modifies, injects, or writes.
// Runs in isolated world — invisible to page JavaScript.
// =============================================================

(() => {
  // Only activate on ZoomInfo search/results pages
  if (!window.location.href.includes("zoominfo.com")) return;

  // Listen for capture requests from popup/background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "CAPTURE_COMPANIES") {
      const companies = extractCompanies();
      sendResponse({ success: true, companies, url: window.location.href });
    }

    if (message.action === "CAPTURE_CURRENT_PAGE") {
      const companies = extractCompanies();
      sendResponse({
        success: true,
        companies,
        pageInfo: getPageInfo(),
        url: window.location.href,
      });
    }

    if (message.action === "CHECK_PAGE") {
      sendResponse({
        isZoomInfo: true,
        isSearchResults: isSearchResultsPage(),
        url: window.location.href,
      });
    }

    // Must return true to keep the message channel open for async sendResponse
    return true;
  });

  function isSearchResultsPage() {
    const url = window.location.href.toLowerCase();
    return (
      url.includes("search") ||
      url.includes("results") ||
      url.includes("company") ||
      url.includes("list")
    );
  }

  function getPageInfo() {
    // Try to detect pagination info from the page
    const paginationText =
      document.querySelector('[class*="pagination"]')?.textContent?.trim() ||
      document.querySelector('[class*="page-info"]')?.textContent?.trim() ||
      "";

    const totalResults =
      document.querySelector('[class*="total-count"]')?.textContent?.trim() ||
      document.querySelector('[class*="result-count"]')?.textContent?.trim() ||
      "";

    return { paginationText, totalResults };
  }

  function extractCompanies() {
    const companies = [];

    // Strategy 1: Table-based results (most common ZoomInfo layout)
    const tableRows = document.querySelectorAll(
      'table tbody tr, [class*="tableRow"], [data-testid*="row"], [role="row"]'
    );

    if (tableRows.length > 0) {
      for (const row of tableRows) {
        const company = extractFromRow(row);
        if (company && company.name) {
          companies.push(company);
        }
      }
    }

    // Strategy 2: Card/list-based results
    if (companies.length === 0) {
      const cards = document.querySelectorAll(
        '[class*="company-card"], [class*="result-card"], [class*="list-item"], [class*="search-result"], [class*="CompanyResult"]'
      );

      for (const card of cards) {
        const company = extractFromCard(card);
        if (company && company.name) {
          companies.push(company);
        }
      }
    }

    // Strategy 3: Generic link-based extraction (fallback)
    if (companies.length === 0) {
      const links = document.querySelectorAll(
        'a[href*="/company/"], a[href*="/co/"], a[href*="/p/company/"]'
      );

      for (const link of links) {
        const name = link.textContent?.trim();
        if (name && name.length > 1 && name.length < 200) {
          // Walk up to find the containing row/card
          const container =
            link.closest("tr") ||
            link.closest('[class*="row"]') ||
            link.closest('[class*="card"]') ||
            link.closest('[class*="result"]') ||
            link.parentElement?.parentElement;

          const company = container
            ? extractFromContainer(container, name)
            : { name, domain: "", industry: "", revenue: "", employees: "", location: "" };

          if (!companies.find((c) => c.name === company.name)) {
            companies.push(company);
          }
        }
      }
    }

    return companies;
  }

  function extractFromRow(row) {
    const cells = row.querySelectorAll("td, [role='cell'], [class*='cell']");
    const links = row.querySelectorAll("a");

    let name = "";
    let domain = "";

    // Find company name from links (usually the first link in a row)
    for (const link of links) {
      const href = link.getAttribute("href") || "";
      const text = link.textContent?.trim() || "";

      if (
        (href.includes("/company/") || href.includes("/co/") || href.includes("/p/company/")) &&
        text.length > 1
      ) {
        name = text;
        break;
      }
    }

    // Fallback: first cell text
    if (!name && cells.length > 0) {
      const firstCellText = cells[0]?.textContent?.trim() || "";
      if (firstCellText.length > 1 && firstCellText.length < 200) {
        name = firstCellText;
      }
    }

    if (!name) return null;

    // Extract domain from visible text
    const allText = row.textContent || "";
    const domainMatch = allText.match(
      /([a-zA-Z0-9][-a-zA-Z0-9]*\.(com|io|net|org|co|ai|tech|dev|biz|info|us|uk|de|fr|in|ca|au))/i
    );
    if (domainMatch) domain = domainMatch[1].toLowerCase();

    return {
      name: cleanText(name),
      domain,
      industry: findFieldValue(row, ["industry", "sector"]),
      revenue: findFieldValue(row, ["revenue", "annual"]),
      employees: findFieldValue(row, ["employee", "headcount", "people", "staff"]),
      location: findFieldValue(row, ["location", "headquarters", "hq", "country", "city"]),
    };
  }

  function extractFromCard(card) {
    const nameEl =
      card.querySelector('h3, h4, [class*="company-name"], [class*="name"], [class*="title"]');
    const name = nameEl?.textContent?.trim() || "";

    if (!name) return null;

    const domainEl = card.querySelector(
      '[class*="domain"], [class*="website"], [class*="url"]'
    );
    const domain = domainEl?.textContent?.trim() || "";

    return {
      name: cleanText(name),
      domain: cleanDomain(domain),
      industry: findFieldValue(card, ["industry", "sector"]),
      revenue: findFieldValue(card, ["revenue", "annual"]),
      employees: findFieldValue(card, ["employee", "headcount", "people"]),
      location: findFieldValue(card, ["location", "headquarters", "hq", "country"]),
    };
  }

  function extractFromContainer(container, fallbackName) {
    const allText = container.textContent || "";
    const domainMatch = allText.match(
      /([a-zA-Z0-9][-a-zA-Z0-9]*\.(com|io|net|org|co|ai|tech|dev|biz|info|us|uk|de|fr|in|ca|au))/i
    );

    return {
      name: cleanText(fallbackName),
      domain: domainMatch ? domainMatch[1].toLowerCase() : "",
      industry: findFieldValue(container, ["industry", "sector"]),
      revenue: findFieldValue(container, ["revenue", "annual"]),
      employees: findFieldValue(container, ["employee", "headcount", "people"]),
      location: findFieldValue(container, ["location", "headquarters", "hq", "country"]),
    };
  }

  function findFieldValue(container, keywords) {
    // Look for elements whose class or aria-label contains any of the keywords
    for (const keyword of keywords) {
      const el = container.querySelector(
        `[class*="${keyword}" i], [data-testid*="${keyword}" i], [aria-label*="${keyword}" i]`
      );
      if (el) {
        const text = el.textContent?.trim();
        if (text && text.length < 200) return text;
      }
    }

    // Look in cells by position heuristic (common table layouts)
    const cells = container.querySelectorAll("td, [role='cell']");
    // Skip — too unreliable without knowing column headers
    return "";
  }

  function cleanText(text) {
    return (text || "")
      .replace(/\s+/g, " ")
      .replace(/[\n\r\t]/g, "")
      .trim()
      .substring(0, 200);
  }

  function cleanDomain(raw) {
    if (!raw) return "";
    let domain = raw.toLowerCase().trim();
    domain = domain.replace(/^https?:\/\//, "");
    domain = domain.replace(/^www\./, "");
    domain = domain.replace(/\/.*$/, "");
    return domain;
  }
})();
