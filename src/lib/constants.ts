export const TEAM_MEMBERS = [
  "Harika",
  "Vivek",
  "Tejaswini",
  "Rishiga",
  "Sowmiya Shankar",
  "Varsha",
  "Kaviya",
  "Sathish",
  "Revathy",
  "Shanmugapriya",
  "Sharmila",
  "Sowmya Hariharan",
  "Keerthana",
  "Sandhiya",
  "Rajalakshmi",
  "Reena Devi",
  "Pachaiyappan",
  "Santhosh Kumar",
] as const;

export const INDUSTRIES = [
  "Manufacturing",
  "CPG",
  "Distribution",
  "Fashion",
  "Food & Beverages",
  "Hi-Tech",
  "Life Science",
  "Retail",
  "BFSI",
  "Healthcare",
  "Logistics",
] as const;

export const DATA_SOURCES = [
  "ZoomInfo",
  "HG Insights",
  "Scraper",
] as const;

export const TECH_STACKS = [
  "SAP",
  "MS",
  "BHL",
  "Oracle",
  "Other",
] as const;

export const TOOLS = [
  { id: "ZOOMINFO", label: "ZoomInfo" },
  { id: "HG_INSIGHTS", label: "HG Insights" },
  { id: "SCRAPER", label: "Scraper" },
] as const;

export const HUBSPOT_INDUSTRY_MAP: Record<string, string> = {
  // Manufacturing
  Manufacturing: "Manufacturing",
  Manufactuing: "Manufacturing",
  MECHANICAL_OR_INDUSTRIAL_ENGINEERING: "Manufacturing",
  INDUSTRIAL_AUTOMATION: "Manufacturing",
  MACHINERY: "Manufacturing",
  // CPG
  CPG: "CPG",
  CONSUMER_GOODS: "CPG",
  CONSUMER_ELECTRONICS: "CPG",
  COSMETICS: "CPG",
  // Distribution
  Distribution: "Distribution",
  WHOLESALE: "Distribution",
  "Wholesale & Distribution": "Distribution",
  // Fashion
  Fashion: "Fashion",
  Fashon: "Fashion",
  APPAREL_FASHION: "Fashion",
  TEXTILES: "Fashion",
  LUXURY_GOODS_JEWELRY: "Fashion",
  // Food & Beverages
  FOOD_BEVERAGES: "Food & Beverages",
  FOOD_PRODUCTION: "Food & Beverages",
  "Food & Beverage": "Food & Beverages",
  "Food and Beverage": "Food & Beverages",
  DAIRY: "Food & Beverages",
  // Hi-Tech
  INFORMATION_TECHNOLOGY_AND_SERVICES: "Hi-Tech",
  "Information Technology & Services": "Hi-Tech",
  COMPUTER_SOFTWARE: "Hi-Tech",
  INTERNET: "Hi-Tech",
  Technology: "Hi-Tech",
  SEMICONDUCTORS: "Hi-Tech",
  // Life Science
  "Life Science": "Life Science",
  BIOTECHNOLOGY: "Life Science",
  PHARMACEUTICALS: "Life Science",
  "Pharmaceutical Manufacturing": "Life Science",
  MEDICAL_DEVICES: "Life Science",
  // Retail
  RETAIL: "Retail",
  Retail: "Retail",
  Retal: "Retail",
  SUPERMARKETS: "Retail",
  // BFSI
  BFSI: "BFSI",
  BANKING: "BFSI",
  FINANCIAL_SERVICES: "BFSI",
  INSURANCE: "BFSI",
  CAPITAL_MARKETS: "BFSI",
  Finance: "BFSI",
  // Healthcare
  Healthcare: "Healthcare",
  HOSPITAL_HEALTH_CARE: "Healthcare",
  MEDICAL_PRACTICE: "Healthcare",
  HEALTH_WELLNESS_AND_FITNESS: "Healthcare",
  // Logistics
  Logistics: "Logistics",
  LOGISTICS_AND_SUPPLY_CHAIN: "Logistics",
  "Logistics & Supply Chain": "Logistics",
  PACKAGE_FREIGHT_DELIVERY: "Logistics",
  WAREHOUSING: "Logistics",
  "Transportation, Logistics, Supply Chain & Storage": "Logistics",
};

export type Industry = (typeof INDUSTRIES)[number];
export type DataSource = (typeof DATA_SOURCES)[number];
export type TeamMemberName = (typeof TEAM_MEMBERS)[number];
