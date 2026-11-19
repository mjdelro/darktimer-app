const REPO_ISSUES_URL = "https://github.com/mjdelro/darktimer-app/issues/new";

export const CONFIDENCE_OPTIONS = [
  "Manufacturer datasheet",
  "Personally verified darkroom test",
  "Community verified (with written license)"
];

export const LICENSE_BASIS_OPTIONS = [
  "Minimum factual values from manufacturer technical publication",
  "Original darkroom test data contributed under Apache-2.0",
  "Third-party source with written license allowing Apache-2.0 redistribution"
];

export const AGITATION_SUBMISSION_OPTIONS = [
  "60s + 10s / min (Standard)",
  "Ilford (10s / min)",
  "Kodak (30s + 5s / 30s)",
  "Rodinal (60s + 10s / 30s)",
  "Stand (60s initial only)",
  "Other (noted in limits)"
];

export function parseTimeToSeconds(raw) {
  const value = String(raw || "").trim();
  const match = value.match(/^(\d{1,3}):([0-5]\d)$/);
  if (!match) return null;
  const total = Number(match[1]) * 60 + Number(match[2]);
  return total > 0 ? total : null;
}

export function parseTempToC(rawValue, unit) {
  const num = Number(rawValue);
  if (!Number.isFinite(num)) return null;
  const c = unit === "fahrenheit" ? ((num - 32) * 5) / 9 : num;
  return Math.round(c * 10) / 10;
}

export function buildRecipeIssueUrl(data) {
  const seconds = parseTimeToSeconds(data.time);
  const temperatureC = parseTempToC(data.temperature, data.temperatureUnit);
  const ei = Number(data.ei);

  const catalogEntry = {
    film: data.film.trim(),
    developer: data.developer.trim(),
    dilution: data.dilution.trim(),
    seconds: seconds || 0,
    temperatureC: temperatureC ?? 20,
    ei: Number.isFinite(ei) && ei > 0 ? ei : null,
    format: data.format,
    agitation: data.agitation,
    confidence: data.confidence,
    source: `${data.publisher.trim()} — ${data.title.trim()}`.replace(/ — $/, ""),
    ...(data.sourceUrl?.trim() ? { sourceUrl: data.sourceUrl.trim() } : {})
  };

  const title = `Recipe: ${catalogEntry.film} in ${catalogEntry.developer} ${catalogEntry.dilution} (${data.time.trim()})`;
  const tempDisplay = `${data.temperature}${data.temperatureUnit === "fahrenheit" ? "°F" : "°C"}${temperatureC !== null ? ` (${temperatureC}°C)` : ""}`;

  const body = [
    "### Recipe Details (Minimum Factual Fields)",
    `| Field | Value |`,
    `| :--- | :--- |`,
    `| **Film** | ${catalogEntry.film} |`,
    `| **Developer** | ${catalogEntry.developer} |`,
    `| **Dilution** | ${catalogEntry.dilution} |`,
    `| **EI (ISO)** | ${catalogEntry.ei ?? "Listed"} |`,
    `| **Format** | ${catalogEntry.format} |`,
    `| **Time** | ${data.time.trim()} (${catalogEntry.seconds}s) |`,
    `| **Temperature** | ${tempDisplay} |`,
    `| **Agitation** | ${catalogEntry.agitation} |`,
    `| **Format / EI Limits** | ${data.limits?.trim() || "None"} |`,
    "",
    "### Source Provenance",
    `| Field | Value |`,
    `| :--- | :--- |`,
    `| **Confidence** | ${catalogEntry.confidence} |`,
    `| **Publisher** | ${data.publisher.trim()} |`,
    `| **Title** | ${data.title.trim()} |`,
    `| **Stable URL** | ${data.sourceUrl?.trim() || "N/A"} |`,
    `| **Retrieval / Test Date** | ${data.retrievedDate} |`,
    `| **License Basis** | ${data.licenseBasis} |`,
    "",
    "### Catalog JSON Snippet",
    "```json",
    JSON.stringify(catalogEntry, null, 2),
    "```",
    "",
    "### Apache-2.0 & Non-Scraping Certification",
    "- [x] I certify this submission contains only minimum factual fields, does not scrape or copy any third-party database, prose, table, layout, or user notes without a written redistribution license, and I have the right to contribute it under Apache-2.0.",
    "",
    `Signed-off-by: ${data.signoff.trim()}`
  ].join("\n");

  const params = new URLSearchParams({
    title,
    labels: "recipe-submission",
    body
  });
  return `${REPO_ISSUES_URL}?${params.toString()}`;
}
