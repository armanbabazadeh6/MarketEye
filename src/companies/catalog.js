// Curated records, deliberately separate from model output and live feeds.
import nvda from "../../data/companies/nvda.json";
import aapl from "../../data/companies/aapl.json";
import tsla from "../../data/companies/tsla.json";
export const companies = [nvda, aapl, tsla];
export function searchCompanies(query = "") {
  const q = query.trim().toLowerCase();
  return companies.filter((c) =>
    `${c.ticker} ${c.name} ${c.sector}`.toLowerCase().includes(q),
  );
}
