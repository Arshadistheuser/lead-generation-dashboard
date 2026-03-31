import { chromium, type Browser, type Page } from "playwright";

export interface ZoomInfoFilters {
  industry?: string[];
  revenueMin?: string;
  revenueMax?: string;
  employeeMin?: string;
  employeeMax?: string;
  country?: string[];
  state?: string[];
  techStack?: string[];
  maxResults?: number;
}

export interface ScrapedCompany {
  name: string;
  domain: string;
  industry: string;
  revenue: string;
  employees: string;
  location: string;
  description: string;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms + Math.random() * 1000));

export async function scrapeZoomInfo(
  email: string,
  password: string,
  filters: ZoomInfoFilters,
  onProgress?: (msg: string) => void
): Promise<ScrapedCompany[]> {
  const log = onProgress || console.log;
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      viewport: { width: 1920, height: 1080 },
    });

    const page = await context.newPage();

    // Step 1: Login
    log("Logging into ZoomInfo...");
    await page.goto("https://app.zoominfo.com/#/login", {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    await delay(2000);

    // Try to find and fill login fields
    const emailInput = page.locator(
      'input[type="email"], input[name="email"], input[placeholder*="email" i], #email'
    );
    const passwordInput = page.locator(
      'input[type="password"], input[name="password"], #password'
    );

    await emailInput.first().fill(email);
    await delay(800);
    await passwordInput.first().fill(password);
    await delay(500);

    // Click login button
    const loginBtn = page.locator(
      'button[type="submit"], button:has-text("Sign In"), button:has-text("Log In")'
    );
    await loginBtn.first().click();
    await delay(5000);

    // Wait for dashboard to load
    await page.waitForURL("**/app/**", { timeout: 30000 }).catch(() => {
      log("Waiting for login to complete...");
    });
    log("Login successful.");

    // Step 2: Navigate to Company Search
    log("Navigating to company search...");
    await page.goto("https://app.zoominfo.com/#/apps/search/v2/results/company", {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    await delay(3000);

    // Step 3: Apply Filters
    log("Applying filters...");
    await applyFilters(page, filters, log);
    await delay(3000);

    // Step 4: Scrape results
    log("Extracting company data...");
    const companies = await extractCompanies(page, filters.maxResults || 100, log);

    log(`Extracted ${companies.length} companies.`);
    return companies;
  } catch (error) {
    log(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    throw error;
  } finally {
    if (browser) await browser.close();
  }
}

async function applyFilters(
  page: Page,
  filters: ZoomInfoFilters,
  log: (msg: string) => void
) {
  // Industry filter
  if (filters.industry?.length) {
    try {
      log(`Setting industry filter: ${filters.industry.join(", ")}`);
      const industryFilter = page.locator(
        '[data-testid="industry-filter"], button:has-text("Industry"), [class*="industry" i]'
      );
      if ((await industryFilter.count()) > 0) {
        await industryFilter.first().click();
        await delay(1000);
        for (const ind of filters.industry) {
          const input = page.locator(
            'input[placeholder*="Search" i], input[placeholder*="industry" i]'
          );
          if ((await input.count()) > 0) {
            await input.first().fill(ind);
            await delay(500);
            const option = page.locator(`text="${ind}"`);
            if ((await option.count()) > 0) {
              await option.first().click();
              await delay(300);
            }
          }
        }
        // Close filter dropdown
        await page.keyboard.press("Escape");
        await delay(500);
      }
    } catch {
      log("Could not apply industry filter - continuing...");
    }
  }

  // Revenue filter
  if (filters.revenueMin || filters.revenueMax) {
    try {
      log(`Setting revenue filter: ${filters.revenueMin || "0"} - ${filters.revenueMax || "max"}`);
      const revenueFilter = page.locator(
        '[data-testid="revenue-filter"], button:has-text("Revenue"), [class*="revenue" i]'
      );
      if ((await revenueFilter.count()) > 0) {
        await revenueFilter.first().click();
        await delay(1000);
        if (filters.revenueMin) {
          const minInput = page.locator('input[placeholder*="Min" i]');
          if ((await minInput.count()) > 0) await minInput.first().fill(filters.revenueMin);
        }
        if (filters.revenueMax) {
          const maxInput = page.locator('input[placeholder*="Max" i]');
          if ((await maxInput.count()) > 0) await maxInput.first().fill(filters.revenueMax);
        }
        await page.keyboard.press("Escape");
        await delay(500);
      }
    } catch {
      log("Could not apply revenue filter - continuing...");
    }
  }

  // Country filter
  if (filters.country?.length) {
    try {
      log(`Setting location filter: ${filters.country.join(", ")}`);
      const locationFilter = page.locator(
        '[data-testid="location-filter"], button:has-text("Location"), button:has-text("Country"), [class*="location" i]'
      );
      if ((await locationFilter.count()) > 0) {
        await locationFilter.first().click();
        await delay(1000);
        for (const c of filters.country) {
          const input = page.locator('input[placeholder*="Search" i]');
          if ((await input.count()) > 0) {
            await input.first().fill(c);
            await delay(500);
            const option = page.locator(`text="${c}"`);
            if ((await option.count()) > 0) {
              await option.first().click();
              await delay(300);
            }
          }
        }
        await page.keyboard.press("Escape");
        await delay(500);
      }
    } catch {
      log("Could not apply location filter - continuing...");
    }
  }

  // Tech stack filter
  if (filters.techStack?.length) {
    try {
      log(`Setting tech stack filter: ${filters.techStack.join(", ")}`);
      const techFilter = page.locator(
        '[data-testid="technology-filter"], button:has-text("Technology"), button:has-text("Tech"), [class*="tech" i]'
      );
      if ((await techFilter.count()) > 0) {
        await techFilter.first().click();
        await delay(1000);
        for (const tech of filters.techStack) {
          const input = page.locator('input[placeholder*="Search" i]');
          if ((await input.count()) > 0) {
            await input.first().fill(tech);
            await delay(500);
            const option = page.locator(`text="${tech}"`);
            if ((await option.count()) > 0) {
              await option.first().click();
              await delay(300);
            }
          }
        }
        await page.keyboard.press("Escape");
        await delay(500);
      }
    } catch {
      log("Could not apply tech filter - continuing...");
    }
  }

  // Wait for results to load
  await delay(3000);
}

async function extractCompanies(
  page: Page,
  maxResults: number,
  log: (msg: string) => void
): Promise<ScrapedCompany[]> {
  const companies: ScrapedCompany[] = [];
  let pageNum = 1;

  while (companies.length < maxResults) {
    log(`Scraping page ${pageNum}...`);

    // Try to extract from table rows or cards
    const rows = await page.evaluate(() => {
      const results: Array<{
        name: string;
        domain: string;
        industry: string;
        revenue: string;
        employees: string;
        location: string;
        description: string;
      }> = [];

      // Try table rows
      const tableRows = document.querySelectorAll(
        'table tbody tr, [class*="result-row"], [class*="company-row"], [class*="search-result"]'
      );

      for (const row of tableRows) {
        const cells = row.querySelectorAll("td, [class*='cell'], [class*='column']");
        const links = row.querySelectorAll("a");
        const allText = row.textContent || "";

        // Try to extract company name from first link or first cell
        let name = "";
        let domain = "";

        for (const link of links) {
          const href = link.getAttribute("href") || "";
          const text = link.textContent?.trim() || "";
          if (href.includes("/company/") || href.includes("/co/")) {
            name = text;
          }
          if (text.includes(".") && !text.includes(" ")) {
            domain = text;
          }
        }

        if (!name && cells.length > 0) {
          name = cells[0]?.textContent?.trim() || "";
        }

        if (name && name.length > 1) {
          results.push({
            name,
            domain: domain || "",
            industry: "",
            revenue: "",
            employees: "",
            location: "",
            description: allText.substring(0, 200).trim(),
          });
        }
      }

      // If no table rows, try card-based layout
      if (results.length === 0) {
        const cards = document.querySelectorAll(
          '[class*="company-card"], [class*="result-card"], [class*="list-item"]'
        );
        for (const card of cards) {
          const name = card.querySelector(
            'h3, h4, [class*="company-name"], [class*="name"]'
          )?.textContent?.trim() || "";
          const domain = card.querySelector(
            '[class*="domain"], [class*="website"], a[href*="."]'
          )?.textContent?.trim() || "";

          if (name) {
            results.push({
              name,
              domain,
              industry: card.querySelector('[class*="industry"]')?.textContent?.trim() || "",
              revenue: card.querySelector('[class*="revenue"]')?.textContent?.trim() || "",
              employees: card.querySelector('[class*="employee"]')?.textContent?.trim() || "",
              location: card.querySelector('[class*="location"], [class*="address"]')?.textContent?.trim() || "",
              description: "",
            });
          }
        }
      }

      return results;
    });

    if (rows.length === 0) {
      log("No more results found on this page.");
      break;
    }

    companies.push(...rows);
    log(`Found ${rows.length} companies on page ${pageNum} (total: ${companies.length})`);

    if (companies.length >= maxResults) break;

    // Try to go to next page
    const nextBtn = page.locator(
      'button:has-text("Next"), [aria-label="Next page"], [class*="next-page"], [class*="pagination"] button:last-child'
    );

    if ((await nextBtn.count()) > 0 && (await nextBtn.first().isEnabled())) {
      await nextBtn.first().click();
      await delay(3000);
      pageNum++;
    } else {
      break;
    }
  }

  return companies.slice(0, maxResults);
}
