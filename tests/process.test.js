import assert from "node:assert/strict";
import {
  AGITATION_PRESETS,
  agitationMarkersFor,
  buildProcessSteps,
  calculateMix,
  dilutionMixFor,
  FIXER_OPTIONS,
  formatTime,
  HYPO_CLEAR_OPTIONS,
  STOP_BATH_OPTIONS,
  temperatureFromCelsius,
  temperatureToCelsius,
  WASH_OPTIONS
} from "../src/process.js";
import { buildRecipeIssueUrl, parseTempToC, parseTimeToSeconds, validateRecipeSubmission } from "../src/submission.js";

assert.equal(formatTime(90), "01:30");
assert.equal(formatTime(0), "00:00");
assert.equal(temperatureFromCelsius(20, "fahrenheit"), 68);
assert.equal(temperatureFromCelsius(20, "celsius"), 20);
assert.equal(temperatureToCelsius(68, "fahrenheit"), 20);
assert.equal(temperatureToCelsius(20, "celsius"), 20);
assert.equal(temperatureFromCelsius("not-a-temperature", "fahrenheit"), null);

const mix = calculateMix(500, 1, 50);
assert.ok(Math.abs(mix.developerVolume - 9.8039) < 0.01);
assert.deepEqual(dilutionMixFor({ developer: "Rodinal", dilution: "1+50" }), {
  developerParts: 1,
  waterParts: 50,
  displayRatio: "1+50"
});
assert.deepEqual(dilutionMixFor({ developer: "Kodak HC-110", dilution: "B (1+31)" }), {
  developerParts: 1,
  waterParts: 31,
  displayRatio: "1+31"
});
assert.equal(dilutionMixFor({ developer: "Example", dilution: "1+1+250" }), null);

assert.equal(AGITATION_PRESETS.rodinal.initialSeconds, 10);
assert.equal(AGITATION_PRESETS.rodinal.intervalSeconds, 60);
assert.equal(STOP_BATH_OPTIONS.find((option) => option.id === "ilfostop").seconds, 10);
assert.equal(HYPO_CLEAR_OPTIONS.find((option) => option.id === "ilford-washaid").seconds, 150);
assert.ok(WASH_OPTIONS.every((option) => option.photoFloSeconds === 30));
assert.equal(STOP_BATH_OPTIONS.filter((option) => option.id === "custom").length, 1);
assert.equal(FIXER_OPTIONS.filter((option) => option.id === "custom").length, 1);
assert.equal(WASH_OPTIONS.filter((option) => option.id === "custom").length, 1);
assert.equal(HYPO_CLEAR_OPTIONS.some((option) => option.id === "custom"), false);

const fullChain = buildProcessSteps({
  presoakEnabled: true,
  presoakSeconds: 60,
  filmName: "Ilford HP5 Plus",
  developerName: "Rodinal",
  dilution: "1+50",
  devSeconds: 660,
  devAgitation: "ilford",
  stopBathId: "ilfostop",
  stopBathSeconds: 15,
  fixerId: "ilford-rapid",
  fixerSeconds: 210,
  hypoClearId: "kodak-hca",
  hypoClearSeconds: 150,
  washId: "running-5",
  washSeconds: 360,
  photoFloSeconds: 25
});

assert.deepEqual(fullChain.map((step) => step.id), ["presoak", "develop", "stop", "fixer", "hypo-clear", "wash", "photo-flo"]);
assert.deepEqual(fullChain.map((step) => step.seconds), [60, 660, 10, 180, 120, 300, 30]);

const customChain = buildProcessSteps({
  presoakEnabled: false,
  filmName: "Ilford FP4 Plus",
  developerName: "Rodinal",
  dilution: "1+50",
  devSeconds: 900,
  stopBathId: "custom",
  stopBathSeconds: 45,
  fixerId: "custom",
  fixerSeconds: 330,
  hypoClearId: "ilford-washaid",
  washId: "custom",
  washSeconds: 720,
  photoFloSeconds: 20
});

assert.deepEqual(customChain.map((step) => step.id), ["develop", "stop", "fixer", "hypo-clear", "wash", "photo-flo"]);
assert.deepEqual(customChain.map((step) => step.seconds), [900, 45, 330, 150, 720, 20]);
assert.match(customChain.find((step) => step.id === "stop").subtitle, /Custom Stop Bath/);
assert.match(customChain.find((step) => step.id === "fixer").subtitle, /Custom Fixer/);
assert.match(customChain.find((step) => step.id === "wash").subtitle, /Custom Wash/);

const customWithoutPhotoFlo = buildProcessSteps({
  presoakEnabled: false,
  devSeconds: 60,
  stopBathId: "none",
  fixerId: "custom",
  fixerSeconds: 60,
  washId: "custom",
  washSeconds: 60,
  photoFloSeconds: 0
});
assert.equal(customWithoutPhotoFlo.some((step) => step.id === "photo-flo"), false);

const minimalChain = buildProcessSteps({
  presoakEnabled: false,
  filmName: "Kodak TRI-X 400",
  developerName: "Kodak D-76",
  dilution: "Stock",
  devSeconds: 405,
  stopBathId: "none",
  fixerId: "tf4",
  hypoClearId: "none",
  washId: "ilford-archival"
});

assert.deepEqual(minimalChain.map((step) => step.id), ["develop", "fixer", "wash", "photo-flo"]);
assert.deepEqual(minimalChain.map((step) => step.stage), ["01", "02", "03", "04"]);
assert.equal(minimalChain.at(-1).seconds, 30);

assert.deepEqual(agitationMarkersFor(300, "standard").map((marker) => marker.atSeconds), [0, 60, 120, 180, 240]);
assert.deepEqual(agitationMarkersFor(1800, "stand").map((marker) => marker.atSeconds), [0]);
assert.deepEqual(agitationMarkersFor(300, "rodinal").map((marker) => marker.atSeconds), [0, 60, 120, 180, 240]);

assert.equal(parseTimeToSeconds("07:30"), 450);
assert.equal(parseTimeToSeconds("bad"), null);
assert.equal(parseTempToC("68", "fahrenheit"), 20);
const manufacturerSubmission = {
  film: "Kodak TRI-X 400",
  developer: "Kodak D-76",
  dilution: "1+1",
  ei: "400",
  format: "135",
  time: "09:45",
  temperature: "68",
  temperatureUnit: "fahrenheit",
  agitation: "kodak",
  notes: "Small tank only",
  submissionType: "manufacturer-publication",
  attribution: "Kodak",
  sourceTitle: "Kodak ED-BWF",
  sourceUrl: "https://www.kodakprofessional.com/sites/default/files/wysiwyg/pro/resources/edbwf_0.pdf",
  retrievedDate: "2026-11-19",
  certified: true
};
assert.equal(validateRecipeSubmission(manufacturerSubmission), "");
assert.match(validateRecipeSubmission({ ...manufacturerSubmission, sourceUrl: "" }), /public HTTPS source URL/);

const issueUrl = buildRecipeIssueUrl(manufacturerSubmission);
assert.ok(issueUrl.startsWith("https://github.com/mjdelro/darktimer-app/issues/new?"));
const parsedIssue = new URL(issueUrl);
assert.equal(parsedIssue.searchParams.get("labels"), "recipe-submission");
assert.match(parsedIssue.searchParams.get("body"), /"confidence": "manufacturer-published"/);
assert.match(parsedIssue.searchParams.get("body"), /"format": "135"/);
assert.match(parsedIssue.searchParams.get("body"), /"agitation": "kodak"/);

const communitySubmission = {
  ...manufacturerSubmission,
  film: "Ilford HP5 Plus",
  developer: "Rodinal",
  dilution: "1+50",
  time: "13:00",
  temperature: "20",
  temperatureUnit: "celsius",
  agitation: "rodinal",
  submissionType: "community-test",
  attribution: "Anonymous",
  sourceTitle: "Personal darkroom test log",
  sourceUrl: ""
};
assert.equal(validateRecipeSubmission(communitySubmission), "");
assert.match(validateRecipeSubmission({ ...communitySubmission, sourceUrl: "https://discord.com/channels/1/2/3" }), /private Discord/);
const communityIssueBody = new URL(buildRecipeIssueUrl(communitySubmission)).searchParams.get("body");
assert.match(communityIssueBody, /"confidence": "community-reported"/);
assert.match(communityIssueBody, /\*\*Submission date\*\* \| 2026-11-19/);
assert.match(communityIssueBody, /community-issue-ISSUE_NUMBER/);
assert.match(communityIssueBody, /written permission to publish/);

const fahrenheitCommunityIssueBody = new URL(buildRecipeIssueUrl({
  ...communitySubmission,
  temperature: "70",
  temperatureUnit: "fahrenheit"
})).searchParams.get("body");
assert.match(fahrenheitCommunityIssueBody, /70°F \(21\.1°C\)/);
assert.match(fahrenheitCommunityIssueBody, /"temperatureC": 21\.1/);

console.log("Development process tests passed.");
