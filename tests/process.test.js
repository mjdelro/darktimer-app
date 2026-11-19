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
  WASH_OPTIONS
} from "../src/process.js";

assert.equal(formatTime(90), "01:30");
assert.equal(formatTime(0), "00:00");

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

console.log("Development process tests passed.");
