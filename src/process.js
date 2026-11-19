export const AGITATION_PRESETS = {
  standard: {
    label: "60s + 10s / min (Default)",
    initialSeconds: 60,
    intervalSeconds: 60,
    agitateSeconds: 10,
    initialTitle: "Invert or agitate continuously",
    initialDetail: "Keep a steady rhythm for the full minute."
  },
  ilford: {
    label: "Ilford (10s / min)",
    initialSeconds: 10,
    intervalSeconds: 60,
    agitateSeconds: 10,
    initialTitle: "Invert 4 times (first 10s)",
    initialDetail: "Invert smoothly 4 times, then let the tank rest."
  },
  kodak: {
    label: "Kodak (30s + 5s / 30s)",
    initialSeconds: 30,
    intervalSeconds: 30,
    agitateSeconds: 5,
    initialTitle: "Agitate first 30 seconds",
    initialDetail: "Keep a steady inversion rhythm for 30 seconds."
  },
  rodinal: {
    label: "Rodinal (10s / min)",
    initialSeconds: 10,
    intervalSeconds: 60,
    agitateSeconds: 10,
    initialTitle: "Agitate for the first 10 seconds",
    initialDetail: "Agitate for 10 seconds, then let the tank rest for 50 seconds."
  },
  stand: {
    label: "Stand (60s initial only)",
    initialSeconds: 60,
    intervalSeconds: 0,
    agitateSeconds: 0,
    initialTitle: "Invert or agitate continuously",
    initialDetail: "Agitate for the first minute, then let stand undisturbed."
  },
  continuous: {
    label: "Continuous gentle agitation",
    initialSeconds: 99999,
    intervalSeconds: 0,
    agitateSeconds: 0,
    initialTitle: "Agitate gently and continuously",
    initialDetail: "Keep the solution moving smoothly until the step finishes."
  },
  soak: {
    label: "Gentle soak (no vigorous agitation)",
    initialSeconds: 10,
    intervalSeconds: 0,
    agitateSeconds: 0,
    initialTitle: "Swirl gently for 10 seconds",
    initialDetail: "Avoid vigorous agitation so wetting agent does not foam."
  }
};

export const STOP_BATH_OPTIONS = [
  { id: "ilfostop", label: "Ilford Ilfostop (1+19 · 0:10)", seconds: 10, agitation: "continuous", note: "Pour in stop bath and agitate continuously for 10 seconds." },
  { id: "kodak-indicator", label: "Kodak Indicator Stop Bath (1+63 · 0:30)", seconds: 30, agitation: "continuous", note: "Agitate continuously for 30 seconds, then drain." },
  { id: "water", label: "Water Rinse (2 changes · 1:00)", seconds: 60, agitation: "continuous", note: "Fill with tempered water, invert continuously, drain and repeat." },
  { id: "citric", label: "Citric Acid Stop (1:00)", seconds: 60, agitation: "continuous", note: "Agitate gently for 1 minute, then pour out." },
  { id: "none", label: "None (skip stop bath)", seconds: 0, agitation: "continuous", note: "" }
];

export const FIXER_OPTIONS = [
  { id: "ilford-rapid", label: "Ilford Rapid Fixer (1+4 · 3:00)", seconds: 180, agitation: "ilford", note: "Rapid ammonium thiosulfate fixer. Invert 4 times per minute." },
  { id: "kodak-rapid", label: "Kodak Rapid Fixer (1+3 · 4:00)", seconds: 240, agitation: "kodak", note: "Agitate 30s initially, then 5s every 30 seconds." },
  { id: "tf4", label: "TF-4 Alkaline Archival Fixer (1+3 · 4:00)", seconds: 240, agitation: "standard", note: "Use a water rinse instead of acid stop. Some films require a longer fixing time; check the current TF-4 label and run a clearing test." },
  { id: "kodak-powder", label: "Kodak Fixer Powder (Stock · 8:00)", seconds: 480, agitation: "kodak", note: "Conventional sodium thiosulfate fixer. Agitate 5s every 30 seconds." }
];

export const HYPO_CLEAR_OPTIONS = [
  { id: "none", label: "No (skip hypo-clear)", seconds: 0, agitation: "standard", note: "" },
  { id: "kodak-hca", label: "Yes · Kodak Hypo Clearing Agent (2:00)", seconds: 120, agitation: "standard", note: "Rinse 30s after fixer, then agitate gently in HCA for 2 minutes." },
  { id: "ilford-washaid", label: "Yes · Ilford Washaid (1+4 · 2:30)", seconds: 150, agitation: "ilford", note: "Use for 2 to 3 minutes with intermittent agitation, following the current product instructions." },
  { id: "heico-perma-wash", label: "Yes · Heico Perma Wash (1:00)", seconds: 60, agitation: "continuous", note: "Agitate continuously for 1 minute before final wash." }
];

export const WASH_OPTIONS = [
  { id: "ilford-archival", label: "Ilford Archival Wash (5 + 10 + 20 inversions · 3:00) + Photo-Flo", washSeconds: 180, photoFloSeconds: 30, note: "Fill with tempered water: 5 inversions, drain, 10 inversions, drain, then 20 inversions." },
  { id: "running-5", label: "Running Water Wash (5:00 · with Hypo-Clear) + Photo-Flo", washSeconds: 300, photoFloSeconds: 30, note: "Gentle continuous water exchange at processing temperature." },
  { id: "running-10", label: "Running Water Wash (10:00) + Photo-Flo", washSeconds: 600, photoFloSeconds: 30, note: "Continuous water wash at about 20°C / 68°F." },
  { id: "running-15", label: "Archival Running Wash (15:00) + Photo-Flo", washSeconds: 900, photoFloSeconds: 30, note: "Full archival wash without hypo-clearing agent." },
  { id: "quick-3", label: "Quick Multi-Change Wash (3:00) + Photo-Flo", washSeconds: 180, photoFloSeconds: 30, note: "Use 3 to 4 complete tank refills with gentle inversions." }
];

export const NAMED_DILUTION_MIXES = {
  "HC-110|A": { developerParts: 1, waterParts: 15, displayRatio: "1+15" },
  "HC-110|B": { developerParts: 1, waterParts: 31, displayRatio: "1+31" },
  "HC-110|E": { developerParts: 1, waterParts: 47, displayRatio: "1+47" },
  "HC-110|H": { developerParts: 1, waterParts: 63, displayRatio: "1+63" },
  "Kodak HC-110|A": { developerParts: 1, waterParts: 15, displayRatio: "1+15" },
  "Kodak HC-110|B": { developerParts: 1, waterParts: 31, displayRatio: "1+31" }
};

export function formatTime(totalSeconds) {
  const safeSeconds = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatVolume(volume) {
  return Math.abs(volume - Math.round(volume)) < 0.05 ? String(Math.round(volume)) : volume.toFixed(1);
}

export function calculateMix(capacity, developerParts, waterParts) {
  const totalParts = developerParts + waterParts;
  const developerVolume = capacity * developerParts / totalParts;
  return {
    developerVolume,
    waterVolume: capacity - developerVolume
  };
}

export function dilutionMixFor(recipe) {
  if (!recipe || !recipe.dilution) return null;
  if (recipe.dilution.toLowerCase() === "stock") return { stock: true };
  const named = NAMED_DILUTION_MIXES[`${recipe.developer}|${recipe.dilution}`];
  if (named) return named;
  const exactRatio = /^\s*(\d+(?:\.\d+)?)\s*[+:]\s*(\d+(?:\.\d+)?)\s*$/;
  const parentheticalRatio = /\(\s*(\d+(?:\.\d+)?)\s*[+:]\s*(\d+(?:\.\d+)?)\s*\)\s*$/;
  const ratio = recipe.dilution.match(exactRatio) || recipe.dilution.match(parentheticalRatio);
  if (!ratio) return null;
  return {
    developerParts: Number(ratio[1]),
    waterParts: Number(ratio[2]),
    displayRatio: `${ratio[1]}+${ratio[2]}`
  };
}

export function instructionFor(elapsedSeconds, presetKey = "standard") {
  const preset = AGITATION_PRESETS[presetKey] || AGITATION_PRESETS.standard;
  const elapsed = Math.max(0, Math.floor(elapsedSeconds));
  if (elapsed < preset.initialSeconds) {
    const initialLabel = preset.initialSeconds >= 99999
      ? "Active step"
      : preset.initialSeconds === 60
        ? "First minute"
        : "Initial agitation";
    const kicker = preset.initialSeconds >= 99999
      ? initialLabel
      : `${initialLabel} · ${preset.initialSeconds - elapsed}s remaining`;
    return {
      phase: "first-minute",
      kicker,
      title: preset.initialTitle,
      detail: preset.initialDetail
    };
  }

  if (preset.intervalSeconds <= 0) {
    return {
      phase: "rest",
      kicker: presetKey === "soak" ? "Wetting soak" : "Stand development",
      title: presetKey === "soak" ? "Let film soak calmly" : "Let the developer work",
      detail: presetKey === "soak"
        ? "Keep the tank still to prevent bubbles before hanging to dry."
        : "Keep the tank still until this step completes."
    };
  }

  const secondInCycle = elapsed % preset.intervalSeconds;
  if (secondInCycle < preset.agitateSeconds) {
    const intervalLabel = preset.intervalSeconds === 60 ? "Top of minute" : "Agitation cycle";
    return {
      phase: "agitate",
      kicker: `${intervalLabel} · ${preset.agitateSeconds - secondInCycle}s`,
      title: "Invert or agitate now",
      detail: `Continue for ${preset.agitateSeconds} seconds, then let the tank rest.`
    };
  }

  const secondsUntilAgitation = preset.intervalSeconds - secondInCycle;
  return {
    phase: "rest",
    kicker: "Rest period",
    title: "Let the chemistry work",
    detail: `Next agitation in ${secondsUntilAgitation} ${secondsUntilAgitation === 1 ? "second" : "seconds"}.`
  };
}

export function agitationMarkersFor(durationSeconds, presetKey = "standard") {
  if (!durationSeconds || durationSeconds <= 0) return [];
  const preset = AGITATION_PRESETS[presetKey] || AGITATION_PRESETS.standard;
  const markers = [];
  if (preset.initialSeconds > 0) {
    markers.push({ atSeconds: 0, pct: 0 });
  }
  if (preset.intervalSeconds > 0) {
    const startAt = Math.max(preset.intervalSeconds, Math.ceil(preset.initialSeconds / preset.intervalSeconds) * preset.intervalSeconds);
    for (let t = startAt; t < durationSeconds; t += preset.intervalSeconds) {
      markers.push({ atSeconds: t, pct: (t / durationSeconds) * 100 });
    }
  }
  return markers;
}

export function buildProcessSteps({
  presoakEnabled,
  presoakMode = "agitated",
  presoakSeconds = 60,
  filmName,
  developerName,
  dilution,
  devSeconds,
  devAgitation = "standard",
  stopBathId = "ilfostop",
  stopBathSeconds,
  fixerId = "ilford-rapid",
  fixerSeconds,
  hypoClearId = "none",
  hypoClearSeconds,
  washId = "ilford-archival",
  washSeconds,
  photoFloSeconds
}) {
  const steps = [];

  if (presoakEnabled && presoakSeconds > 0) {
    const isStand = presoakMode === "stand";
    steps.push({
      id: "presoak",
      stage: "01",
      name: isStand ? "Stand Presoak" : "Presoak",
      subtitle: isStand ? "Stand tempered water soak" : "Agitated tempered water pre-wet",
      seconds: presoakSeconds,
      agitation: isStand ? "soak" : "continuous",
      pourPrompt: isStand
        ? "Fill tank with tempered water, swirl gently for 10s to release bubbles, then let stand."
        : "Fill tank with tempered water and agitate gently to wet the emulsion and remove anti-halation dye."
    });
  }

  steps.push({
    id: "develop",
    stage: "03",
    name: "Develop",
    subtitle: `${filmName || "Film"} · ${developerName || "Developer"} ${dilution || ""}`.trim(),
    seconds: Math.max(1, devSeconds),
    agitation: devAgitation,
    pourPrompt: "Pour in prepared developer, start the timer, and tap the tank to dislodge air bubbles."
  });

  const stopOption = STOP_BATH_OPTIONS.find((o) => o.id === stopBathId);
  const effectiveStopSeconds = stopBathSeconds ?? stopOption?.seconds ?? 0;
  if (stopOption && stopOption.id !== "none" && effectiveStopSeconds > 0) {
    steps.push({
      id: "stop",
      stage: "04",
      name: "Stop Bath",
      subtitle: stopOption.label.split(" (")[0],
      seconds: effectiveStopSeconds,
      agitation: stopOption.agitation,
      pourPrompt: stopOption.note
    });
  }

  const fixerOption = FIXER_OPTIONS.find((o) => o.id === fixerId) || FIXER_OPTIONS[0];
  const effectiveFixerSeconds = fixerSeconds ?? fixerOption.seconds;
  if (effectiveFixerSeconds > 0) {
    steps.push({
      id: "fixer",
      stage: "05",
      name: "Fixer",
      subtitle: fixerOption.label.split(" (")[0],
      seconds: effectiveFixerSeconds,
      agitation: fixerOption.agitation,
      pourPrompt: fixerOption.note
    });
  }

  const hypoOption = HYPO_CLEAR_OPTIONS.find((o) => o.id === hypoClearId);
  const effectiveHypoSeconds = hypoClearSeconds ?? hypoOption?.seconds ?? 0;
  if (hypoOption && hypoOption.id !== "none" && effectiveHypoSeconds > 0) {
    steps.push({
      id: "hypo-clear",
      stage: "06",
      name: "Hypo-Clear",
      subtitle: hypoOption.label.replace(/^Yes · /, "").split(" (")[0],
      seconds: effectiveHypoSeconds,
      agitation: hypoOption.agitation,
      pourPrompt: hypoOption.note
    });
  }

  const washOption = WASH_OPTIONS.find((o) => o.id === washId) || WASH_OPTIONS[0];
  const effectiveWashSeconds = washSeconds ?? washOption.washSeconds;
  if (effectiveWashSeconds > 0) {
    steps.push({
      id: "wash",
      stage: "07",
      name: "Wash",
      subtitle: washOption.label.split(" (")[0],
      seconds: effectiveWashSeconds,
      agitation: "standard",
      pourPrompt: washOption.note
    });
  }

  const effectivePhotoFloSeconds = photoFloSeconds ?? washOption.photoFloSeconds ?? 30;
  if (effectivePhotoFloSeconds > 0) {
    steps.push({
      id: "photo-flo",
      stage: "07",
      name: "Photo-Flo Rinse",
      subtitle: "Kodak Photo-Flo 200 (1+200)",
      seconds: effectivePhotoFloSeconds,
      agitation: "soak",
      pourPrompt: "Add distilled water and Photo-Flo, swirl gently for 10 seconds, let soak, then hang negatives to dry."
    });
  }

  return steps.map((step, index) => ({
    ...step,
    stage: String(index + 1).padStart(2, "0")
  }));
}
