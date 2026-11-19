const REPO_ISSUES_URL = "https://github.com/mjdelro/darktimer-app/issues/new";

export const SUBMISSION_TYPES = [
  {
    value: "community-test",
    label: "Personal darkroom test",
    confidence: "community-reported",
    sourceKind: "community-contribution",
    licenseBasis: "Original empirical test result intentionally contributed under Apache-2.0"
  },
  {
    value: "manufacturer-publication",
    label: "Manufacturer publication",
    confidence: "manufacturer-published",
    sourceKind: "manufacturer-publication",
    licenseBasis: "Facts manually transcribed from a manufacturer technical publication"
  }
];

export const AGITATION_SUBMISSION_OPTIONS = [
  { value: "standard", label: "60s initial + 10s / min (Standard)" },
  { value: "ilford", label: "Ilford (10s / min)" },
  { value: "kodak", label: "Kodak (30s + 5s / 30s)" },
  { value: "rodinal", label: "Rodinal (60s + 10s / 30s)" },
  { value: "stand", label: "Stand (60s initial only)" }
];

function submissionTypeFor(value) {
  return SUBMISSION_TYPES.find((option) => option.value === value) || SUBMISSION_TYPES[0];
}

function markdownCell(value) {
  return String(value ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/\|/g, "\\|")
    .trim();
}

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isDiscordUrl(value) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === "discord.com" || hostname.endsWith(".discord.com") || hostname === "discordapp.com" || hostname.endsWith(".discordapp.com");
  } catch {
    return false;
  }
}

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

export function validateRecipeSubmission(data) {
  const requiredText = [
    [data.film, "Enter the film stock."],
    [data.developer, "Enter the developer."],
    [data.dilution, "Enter the dilution."],
    [data.attribution, "Enter a contributor credit or publisher."],
    [data.sourceTitle, "Enter a test-log or publication title."],
    [data.retrievedDate, "Enter the test or retrieval date."]
  ];
  const missing = requiredText.find(([value]) => !String(value || "").trim());
  if (missing) return missing[1];
  if (!parseTimeToSeconds(data.time)) return "Enter development time in mm:ss format, for example 07:30.";

  const temperatureC = parseTempToC(data.temperature, data.temperatureUnit);
  if (temperatureC === null || temperatureC <= 0 || temperatureC > 50) {
    return "Enter a development temperature between 0 and 50 degrees Celsius.";
  }

  const ei = Number(data.ei);
  if (!Number.isInteger(ei) || ei <= 0) return "Enter a positive whole-number exposure index.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data.retrievedDate || ""))) return "Enter a valid test or retrieval date.";

  if (!SUBMISSION_TYPES.some((option) => option.value === data.submissionType)) return "Choose a valid source type.";
  if (!["135", "120", "sheet", "any"].includes(data.format)) return "Choose a valid film format.";
  if (!AGITATION_SUBMISSION_OPTIONS.some((option) => option.value === data.agitation)) return "Choose a supported agitation method.";

  const sourceUrl = String(data.sourceUrl || "").trim();
  if (sourceUrl && !isHttpsUrl(sourceUrl)) return "Source links must use HTTPS.";
  if (sourceUrl && isDiscordUrl(sourceUrl)) return "Do not use a private Discord message or attachment as the public source URL.";

  const type = submissionTypeFor(data.submissionType);
  if (type.value === "manufacturer-publication" && !isHttpsUrl(sourceUrl)) {
    return "Add the manufacturer's public HTTPS source URL.";
  }
  if (type.value === "community-test") {
    const successfulTests = Number(data.successfulTests);
    if (!Number.isInteger(successfulTests) || successfulTests <= 0) return "Enter at least one successful darkroom test.";
  }
  if (!data.certified) return "Confirm the source, permission, and Apache-2.0 certification.";
  return "";
}

export function buildRecipeIssueUrl(data) {
  const seconds = parseTimeToSeconds(data.time);
  const temperatureC = parseTempToC(data.temperature, data.temperatureUnit);
  const ei = Number(data.ei);
  const attribution = String(data.attribution || "").trim();
  const sourceTitle = String(data.sourceTitle || "").trim();
  const type = submissionTypeFor(data.submissionType);
  const issueSourceId = type.value === "community-test"
    ? "community-issue-ISSUE_NUMBER"
    : `${slug(attribution)}-${slug(sourceTitle)}` || "manufacturer-source";
  const issueSourceUrl = type.value === "community-test"
    ? "https://github.com/mjdelro/darktimer-app/issues/ISSUE_NUMBER"
    : String(data.sourceUrl || "").trim();

  const sourceEntry = {
    id: issueSourceId,
    kind: type.sourceKind,
    title: sourceTitle,
    publisher: attribution,
    url: issueSourceUrl,
    retrievedAt: data.retrievedDate,
    licenseBasis: type.licenseBasis
  };

  const catalogEntry = {
    film: String(data.film || "").trim(),
    developer: String(data.developer || "").trim(),
    dilution: String(data.dilution || "").trim(),
    seconds: seconds || 0,
    temperatureC: temperatureC ?? 20,
    ei: Number.isFinite(ei) && ei > 0 ? ei : null,
    format: data.format,
    sourceId: issueSourceId,
    confidence: type.confidence,
    agitation: data.agitation,
    ...(type.value === "community-test" ? { successfulTests: Number(data.successfulTests) || 1 } : {}),
    ...(String(data.notes || "").trim() ? { notes: String(data.notes).trim() } : {})
  };

  const title = `Recipe: ${catalogEntry.film} in ${catalogEntry.developer} ${catalogEntry.dilution} (${String(data.time || "").trim()})`;
  const tempDisplay = `${data.temperature}${data.temperatureUnit === "fahrenheit" ? "°F" : "°C"}${temperatureC !== null ? ` (${temperatureC}°C)` : ""}`;
  const agitationLabel = AGITATION_SUBMISSION_OPTIONS.find((option) => option.value === data.agitation)?.label || data.agitation;

  const body = [
    "### Recipe details",
    "| Field | Value |",
    "| :--- | :--- |",
    `| **Film** | ${markdownCell(catalogEntry.film)} |`,
    `| **Developer** | ${markdownCell(catalogEntry.developer)} |`,
    `| **Dilution** | ${markdownCell(catalogEntry.dilution)} |`,
    `| **EI** | ${catalogEntry.ei ?? "Not specified"} |`,
    `| **Format** | ${markdownCell(catalogEntry.format)} |`,
    `| **Time** | ${markdownCell(data.time)} (${catalogEntry.seconds}s) |`,
    `| **Temperature** | ${markdownCell(tempDisplay)} |`,
    `| **Agitation** | ${markdownCell(agitationLabel)} |`,
    `| **Process notes or limits** | ${markdownCell(data.notes) || "None"} |`,
    ...(type.value === "community-test" ? [`| **Successful tests** | ${catalogEntry.successfulTests} |`] : []),
    "",
    "### Source and permission",
    "| Field | Value |",
    "| :--- | :--- |",
    `| **Source type** | ${markdownCell(type.label)} |`,
    `| **Contributor credit / publisher** | ${markdownCell(attribution)} |`,
    `| **Title** | ${markdownCell(sourceTitle)} |`,
    `| **Public source URL** | ${markdownCell(data.sourceUrl) || "This GitHub issue"} |`,
    `| **Test / retrieval date** | ${markdownCell(data.retrievedDate)} |`,
    `| **License basis** | ${markdownCell(type.licenseBasis)} |`,
    "",
    "### Source JSON",
    ...(type.value === "community-test" ? ["Replace `ISSUE_NUMBER` with this issue's number before merging."] : []),
    "```json",
    JSON.stringify(sourceEntry, null, 2),
    "```",
    "",
    "### Recipe JSON",
    "```json",
    JSON.stringify(catalogEntry, null, 2),
    "```",
    "",
    "### Contribution certification",
    "- [x] I confirm this recipe comes from my own testing or the named manufacturer publication, not from a third-party database, table, or copied user notes.",
    "- [x] If I am submitting another person's test, I have their written permission to publish it and to use the attribution shown above.",
    "- [x] I intentionally submit these factual values and any original notes for inclusion in darkTimer under Apache-2.0.",
    "",
    `Submitted by: ${markdownCell(attribution)}`
  ].join("\n");

  const params = new URLSearchParams({
    title,
    labels: "recipe-submission",
    body
  });
  return `${REPO_ISSUES_URL}?${params.toString()}`;
}
