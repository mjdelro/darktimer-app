import { createEffect, createMemo, createSignal, For, lazy, onCleanup, onMount, Show, Suspense } from "solid-js";
import {
  buildDeveloperList,
  buildFilmList,
  getRecipesForFilm,
  loadCustomCatalog
} from "./catalog.js";
import {
  AGITATION_PRESETS,
  agitationMarkersFor,
  buildProcessSteps,
  calculateMix,
  dilutionMixFor,
  FIXER_OPTIONS,
  formatTime,
  formatVolume,
  HYPO_CLEAR_OPTIONS,
  instructionFor,
  STOP_BATH_OPTIONS,
  temperatureFromCelsius,
  temperatureToCelsius,
  WASH_OPTIONS
} from "./process.js";
import { playDing, playStepComplete, playTick, unlockAudio } from "./audio.js";
import SearchCombobox from "./SearchCombobox.jsx";

const GuideModal = lazy(() => import("./GuideModal.jsx"));
const SubmitModal = lazy(() => import("./SubmitModal.jsx"));

const FORMAT_NAMES = { any: "Any format", "135": "35mm", "120": "120", sheet: "Sheet" };
const CUSTOM_FILM_KEY = "__custom_film__";
const CUSTOM_DEVELOPER_KEY = "__custom_developer__";
const CUSTOM_RECIPE_ID = "custom-recipe";

const DEVELOPER_REFERENCE_LINKS = {
  "Kodak HC-110": { url: "https://business.kodakmoments.com/sites/default/files/wysiwyg/pro/chemistry/j24.pdf", label: "Reference: Kodak HC-110 datasheet (J-24)" },
  "HC-110": { url: "https://business.kodakmoments.com/sites/default/files/wysiwyg/pro/chemistry/j24.pdf", label: "Reference: Kodak HC-110 datasheet (J-24)" },
  "Kodak D-76": { url: "https://business.kodakmoments.com/sites/default/files/wysiwyg/pro/chemistry/j78.pdf", label: "Reference: Kodak D-76 datasheet (J-78)" },
  "Kodak XTOL": { url: "https://business.kodakmoments.com/sites/default/files/wysiwyg/pro/chemistry/j109.pdf", label: "Reference: Kodak XTOL datasheet (J-109)" },
  "Rodinal": { url: "https://www.adox.de/adox-chemie/adox-filmentwickler/rodinal-adonal/", label: "Reference: ADOX Rodinal / Adonal guide" }
};

const CONFIDENCE_LABELS = {
  "manufacturer-published": "Manufacturer-published time",
  "community-reported": "Community-reported time"
};

const confidenceLabel = (confidence) => CONFIDENCE_LABELS[confidence] || "Source status unknown";

function DurationInput(props) {
  const minutes = () => Math.floor(Number(props.seconds) / 60);
  const seconds = () => Number(props.seconds) % 60;
  return (
    <div class="stage-time-field" role="group" aria-label={`${props.label} duration`}>
      <span class="stage-time-label">{props.displayLabel || "Time"}</span>
      <input
        type="number"
        min="0"
        max="120"
        value={minutes()}
        aria-label={`${props.label} minutes`}
        onInput={(event) => props.onChange(Math.max(0, Number(event.currentTarget.value)) * 60 + seconds())}
      />
      <span aria-hidden="true">:</span>
      <input
        type="number"
        min="0"
        max="59"
        value={seconds()}
        aria-label={`${props.label} seconds`}
        onInput={(event) => props.onChange(minutes() * 60 + Math.min(59, Math.max(0, Number(event.currentTarget.value))))}
      />
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = createSignal("setup"); // setup | timer | complete
  const [tempUnit, setTempUnit] = createSignal("fahrenheit");
  const [soundEnabled, setSoundEnabled] = createSignal(true);
  const [showSubmitModal, setShowSubmitModal] = createSignal(false);
  const [activeHint, setActiveHint] = createSignal(null); // "dilution" | "tank" | "agitation" | "stop" | "fixer" | "hypo" | null
  let submitReturnTarget;

  // Catalog state (pre-populated with curated B&W film and developer pickers)
  const [catalogMode, setCatalogMode] = createSignal("loading");
  const [catalogError, setCatalogError] = createSignal("");
  const [films, setFilms] = createSignal(buildFilmList([]));
  const [customByFilm, setCustomByFilm] = createSignal(new Map());

  // 01 Presoak
  const [presoakEnabled, setPresoakEnabled] = createSignal(false);
  const [presoakMode, setPresoakMode] = createSignal("agitated");
  const [presoakMinutes, setPresoakMinutes] = createSignal(1);

  // 02 Film & Developer
  const [selectedFilmKey, setSelectedFilmKey] = createSignal("");
  const [selectedDeveloperKey, setSelectedDeveloperKey] = createSignal("");
  const [selectedDilution, setSelectedDilution] = createSignal("");
  const [selectedRecipeId, setSelectedRecipeId] = createSignal("");
  const [customFilmName, setCustomFilmName] = createSignal("");
  const [customDeveloperName, setCustomDeveloperName] = createSignal("");
  const [customDilutionMode, setCustomDilutionMode] = createSignal("ratio"); // "ratio" | "stock" | "other"
  const [customDilutionParts, setCustomDilutionParts] = createSignal("");
  const [customDilutionOther, setCustomDilutionOther] = createSignal("");
  const [customEi, setCustomEi] = createSignal("400");
  const [customFormat, setCustomFormat] = createSignal("135");
  const [customTemperatureC, setCustomTemperatureC] = createSignal("20");
  const [tankCapacity, setTankCapacity] = createSignal("500");
  const [devAgitation, setDevAgitation] = createSignal("standard");
  const [devMinutes, setDevMinutes] = createSignal(8);
  const [devSeconds, setDevSeconds] = createSignal(0);

  // 03 Stop Bath
  const [stopBathId, setStopBathId] = createSignal("ilfostop");
  const [customStopBathSeconds, setCustomStopBathSeconds] = createSignal(30);
  // 04 Fixer
  const [fixerId, setFixerId] = createSignal("ilford-rapid");
  const [customFixerSeconds, setCustomFixerSeconds] = createSignal(300);
  // 05 Hypo-Clear
  const [hypoClearId, setHypoClearId] = createSignal("none");
  // 06 Wash & Photo-Flo
  const [washId, setWashId] = createSignal("ilford-archival");
  const [customWashSeconds, setCustomWashSeconds] = createSignal(600);
  const [customPhotoFloSeconds, setCustomPhotoFloSeconds] = createSignal(30);

  // Chained timer state
  const [activeSteps, setActiveSteps] = createSignal([]);
  const [stepIndex, setStepIndex] = createSignal(0);
  const [waitingForPour, setWaitingForPour] = createSignal(false);
  const [isPaused, setIsPaused] = createSignal(false);
  const [elapsedSeconds, setElapsedSeconds] = createSignal(0);

  let startedAt = 0;
  let pausedAt = 0;
  let pausedTotal = 0;
  let lastTickBoundary = 0;
  let lastRenderedElapsed = -1;
  let timerId = null;
  let wakeLockSentinel = null;

  async function releaseWakeLock() {
    if (!wakeLockSentinel) return;
    try {
      await wakeLockSentinel.release();
    } catch {
      // Ignore release errors when already inactive
    }
    wakeLockSentinel = null;
  }

  async function requestWakeLock() {
    if (!navigator.wakeLock || wakeLockSentinel) return;
    try {
      wakeLockSentinel = await navigator.wakeLock.request("screen");
      wakeLockSentinel.addEventListener("release", () => { wakeLockSentinel = null; });
    } catch {
      // Ignore if wake lock is denied or unsupported in the current context
    }
  }

  onMount(async () => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && screen() === "timer" && !isPaused() && !waitingForPour()) {
        requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    onCleanup(() => document.removeEventListener("visibilitychange", handleVisibilityChange));

    try {
      const { byFilm, filmEntries } = await loadCustomCatalog();
      setCustomByFilm(byFilm);
      setFilms(buildFilmList(filmEntries));
      setCatalogMode("local");
    } catch (error) {
      setCatalogMode("error");
      setCatalogError(error instanceof Error ? error.message : "The recipe catalog could not be loaded.");
    }
  });

  createEffect(() => {
    if (screen() === "timer" && !isPaused() && !waitingForPour()) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }
  });

  onCleanup(() => {
    if (timerId !== null) window.clearInterval(timerId);
    releaseWakeLock();
  });

  const filmByKey = createMemo(() => new Map(films().map((f) => [f.key, f])));
  const allDevelopers = createMemo(() => buildDeveloperList(customByFilm()));
  const developerByKey = createMemo(() => new Map(allDevelopers().map((d) => [d.key, d])));

  const isCustomFilm = createMemo(() => selectedFilmKey() === CUSTOM_FILM_KEY);
  const isCustomDeveloper = createMemo(() => selectedDeveloperKey() === CUSTOM_DEVELOPER_KEY);
  const selectedFilm = createMemo(() => filmByKey().get(selectedFilmKey()) || null);
  const selectedDeveloperEntry = createMemo(() => developerByKey().get(selectedDeveloperKey()) || null);

  const filmRecipes = createMemo(() => {
    const film = selectedFilm();
    if (!film) return [];
    return getRecipesForFilm(film, customByFilm());
  });

  const verifiedDeveloperKeysForFilm = createMemo(() =>
    new Set(filmRecipes().map((r) => `dev:${r.normalizedDeveloper}`))
  );

  const verifiedDevelopersForFilm = createMemo(() => {
    const keys = verifiedDeveloperKeysForFilm();
    if (keys.size === 0) return [];
    return allDevelopers().filter((d) => keys.has(d.key));
  });

  const otherDevelopersForFilm = createMemo(() => {
    const keys = verifiedDeveloperKeysForFilm();
    if (keys.size === 0) return allDevelopers();
    return allDevelopers().filter((d) => !keys.has(d.key));
  });

  const variants = createMemo(() => {
    const dev = selectedDeveloperEntry();
    if (!dev) return [];
    return filmRecipes()
      .filter((r) => r.normalizedDeveloper === dev.normalized)
      .sort((a, b) =>
        a.dilution.localeCompare(b.dilution)
        || ((a.ei || 0) - (b.ei || 0))
        || (a.temperatureC - b.temperatureC)
        || (a.seconds - b.seconds)
      );
  });

  const dilutions = createMemo(() =>
    [...new Set(variants().map((r) => r.dilution))].sort((a, b) => a.localeCompare(b))
  );

  const hasFilmAndDeveloper = createMemo(() => Boolean(selectedFilmKey() && selectedDeveloperKey()));
  const hasVerifiedRecipes = createMemo(() => variants().length > 0);
  const isCustomRecipe = createMemo(() => Boolean(
    hasFilmAndDeveloper() && (!hasVerifiedRecipes() || selectedRecipeId() === CUSTOM_RECIPE_ID)
  ));

  const selectedRecipe = createMemo(() =>
    selectedRecipeId() === CUSTOM_RECIPE_ID
      ? null
      : variants().find((r) => String(r.id) === selectedRecipeId()) || null
  );

  const filmComboboxOptions = createMemo(() =>
    [...films()]
      .sort((a, b) => (a.popularRank - b.popularRank) || a.fullName.localeCompare(b.fullName))
      .map((f) => ({
        key: f.key,
        label: f.fullName,
        meta: `ISO ${f.defaultIso}`,
        badge: f.hasVerifiedRecipes ? "Verified" : ""
      }))
  );

  const developerComboboxOptions = createMemo(() => [
    ...[...verifiedDevelopersForFilm()]
      .sort((a, b) => (a.popularRank - b.popularRank) || a.name.localeCompare(b.name))
      .map((d) => ({
        key: d.key,
        label: d.name,
        badge: "Verified"
      })),
    ...[...otherDevelopersForFilm()]
      .sort((a, b) => (a.popularRank - b.popularRank) || a.name.localeCompare(b.name))
      .map((d) => ({
        key: d.key,
        label: d.name
      }))
  ]);

  function resetCustomDilution() {
    setCustomDilutionMode("ratio");
    setCustomDilutionParts("");
    setCustomDilutionOther("");
  }

  function applyDilutionToCustom(raw) {
    const val = String(raw || "").trim();
    if (!val) {
      resetCustomDilution();
      return;
    }
    if (val.toLowerCase() === "stock") {
      setCustomDilutionMode("stock");
      setCustomDilutionParts("");
      setCustomDilutionOther("");
      return;
    }
    const onePlus = val.match(/^1\s*[+:]\s*(\d+(?:\.\d+)?)$/) || val.match(/\(\s*1\s*[+:]\s*(\d+(?:\.\d+)?)\s*\)$/);
    if (onePlus) {
      setCustomDilutionMode("ratio");
      setCustomDilutionParts(onePlus[1]);
      setCustomDilutionOther("");
      return;
    }
    setCustomDilutionMode("other");
    setCustomDilutionParts("");
    setCustomDilutionOther(val);
  }

  const resolvedCustomDilution = createMemo(() => {
    const mode = customDilutionMode();
    if (mode === "stock") return "Stock";
    if (mode === "ratio") {
      const raw = customDilutionParts().trim();
      if (!raw) return "";
      const num = Number(raw);
      if (!Number.isFinite(num) || num < 0) return "";
      return num === 0 ? "Stock" : `1+${raw}`;
    }
    return customDilutionOther().trim();
  });

  function handleFilmChange(nextFilmKey) {
    setSelectedFilmKey(nextFilmKey);
    if (nextFilmKey !== CUSTOM_FILM_KEY) setCustomFilmName("");
    setSelectedDeveloperKey("");
    setCustomDeveloperName("");
    setSelectedDilution("");
    setSelectedRecipeId("");
    resetCustomDilution();
    const nextFilm = filmByKey().get(nextFilmKey);
    setCustomEi(nextFilm?.defaultIso ? String(nextFilm.defaultIso) : "400");
  }

  function handleCustomFilmSelect(name) {
    setCustomFilmName(name);
    setSelectedFilmKey(CUSTOM_FILM_KEY);
    setSelectedDeveloperKey("");
    setCustomDeveloperName("");
    setSelectedDilution("");
    setSelectedRecipeId("");
    resetCustomDilution();
    setCustomEi("400");
  }

  function handleDeveloperChange(nextDevKey) {
    setSelectedDeveloperKey(nextDevKey);
    if (nextDevKey !== CUSTOM_DEVELOPER_KEY) setCustomDeveloperName("");
    setSelectedDilution("");
    setSelectedRecipeId("");
  }

  function handleCustomDeveloperSelect(name) {
    setCustomDeveloperName(name);
    setSelectedDeveloperKey(CUSTOM_DEVELOPER_KEY);
    setSelectedDilution("");
    setSelectedRecipeId("");
  }

  function handleVariantChange(nextVariantId) {
    setSelectedRecipeId(nextVariantId);
    if (nextVariantId === CUSTOM_RECIPE_ID) {
      if (!resolvedCustomDilution() && selectedDilution()) {
        applyDilutionToCustom(selectedDilution());
      }
      return;
    }
    const rec = variants().find((r) => String(r.id) === nextVariantId);
    if (rec) setSelectedDilution(rec.dilution);
  }

  function handleDilutionChange(nextDilution) {
    setSelectedDilution(nextDilution);
    if (!nextDilution) {
      setSelectedRecipeId("");
      return;
    }
    const current = selectedRecipe();
    if (current && current.dilution === nextDilution) return;
    const match = variants().find((r) => r.dilution === nextDilution);
    setSelectedRecipeId(match ? String(match.id) : "");
  }

  createEffect(() => {
    if (!hasFilmAndDeveloper()) return;
    const list = variants();
    if (list.length === 0) {
      if (selectedRecipeId() !== CUSTOM_RECIPE_ID) {
        setSelectedRecipeId(CUSTOM_RECIPE_ID);
      }
      return;
    }
    if (list.length === 1 && !selectedRecipeId()) {
      setSelectedRecipeId(String(list[0].id));
      setSelectedDilution(list[0].dilution);
    }
  });

  createEffect(() => {
    const rec = selectedRecipe();
    if (!rec) return;
    setSelectedDilution(rec.dilution);
    setDevMinutes(Math.floor(rec.seconds / 60));
    setDevSeconds(rec.seconds % 60);
    if (AGITATION_PRESETS[rec.agitation]) setDevAgitation(rec.agitation);
  });

  const resolvedFilmName = createMemo(() =>
    isCustomFilm() ? customFilmName().trim() : (selectedFilm()?.fullName || "")
  );
  const resolvedDeveloperName = createMemo(() =>
    isCustomDeveloper() ? customDeveloperName().trim() : (selectedDeveloperEntry()?.name || "")
  );

  const totalDevSeconds = createMemo(() => Math.max(1, Number(devMinutes()) * 60 + Number(devSeconds())));
  const customTemperatureValue = createMemo(() => {
    if (customTemperatureC() === "") return "";
    const displayValue = temperatureFromCelsius(customTemperatureC(), tempUnit());
    return displayValue === null ? "" : formatVolume(displayValue);
  });
  const customTemperatureLimits = createMemo(() => tempUnit() === "fahrenheit"
    ? { min: "32.1", max: "122", message: "Enter a temperature above 32°F and no more than 122°F." }
    : { min: "0.1", max: "50", message: "Enter a temperature above 0°C and no more than 50°C." });
  const customRecipeError = createMemo(() => {
    if (!isCustomRecipe()) return "";
    if (!resolvedFilmName()) return "Enter a custom film name.";
    if (!resolvedDeveloperName()) return "Enter a custom developer name.";
    if (!resolvedCustomDilution()) {
      return customDilutionMode() === "ratio"
        ? "Enter the parts of water (e.g. 50 for 1+50, or switch to Stock)."
        : "Enter the custom developer dilution.";
    }
    if (!Number.isInteger(Number(customEi())) || Number(customEi()) <= 0) return "Enter a positive whole-number EI.";
    if (!Number.isFinite(Number(customTemperatureC())) || Number(customTemperatureC()) <= 0 || Number(customTemperatureC()) > 50) return customTemperatureLimits().message;
    return "";
  });
  const effectiveRecipe = createMemo(() => isCustomRecipe()
    ? {
        id: CUSTOM_RECIPE_ID,
        film: resolvedFilmName(),
        developer: resolvedDeveloperName(),
        dilution: resolvedCustomDilution(),
        seconds: totalDevSeconds(),
        temperatureC: Math.round(Number(customTemperatureC()) * 10) / 10,
        ei: Number(customEi()),
        format: customFormat(),
        agitation: devAgitation(),
        confidence: "custom",
        isCustom: true
      }
    : selectedRecipe());

  const formatTemp = (c) =>
    `${formatVolume(temperatureFromCelsius(c, tempUnit()))}${tempUnit() === "fahrenheit" ? "°F" : "°C"}`;

  function updateCustomTemperature(displayValue) {
    if (displayValue === "") {
      setCustomTemperatureC("");
      return;
    }
    const celsius = temperatureToCelsius(displayValue, tempUnit());
    setCustomTemperatureC(celsius === null ? "" : String(celsius));
  }

  const formatRecipeOption = (r) => {
    const fmt = FORMAT_NAMES[r.format] || r.format || "Any format";
    const iso = r.ei ? `ISO ${r.ei}` : "Listed speed";
    return `${r.dilution} · ${fmt} · ${iso} · ${formatTemp(r.temperatureC)} · ${formatTime(r.seconds)}`;
  };

  const recipeReference = createMemo(() => {
    const rec = effectiveRecipe();
    if (!rec) return null;
    if (rec.isCustom) return null;
    if (rec.sourceUrl) {
      return { url: rec.sourceUrl, label: rec.sourceTitle ? `Reference: ${rec.sourceTitle}` : "Recipe reference" };
    }
    return DEVELOPER_REFERENCE_LINKS[rec.developer] || null;
  });

  const mixSummary = createMemo(() => {
    const rec = effectiveRecipe();
    const cap = Number(tankCapacity());
    const mix = dilutionMixFor(rec);
    if (!rec || !cap || !mix) return null;
    if (mix.stock) {
      return {
        label: `Mix for ${cap} mL`,
        formula: `${cap} mL stock developer (no water)`,
        note: "Use working-strength stock solution.",
        source: rec.sourceTitle ? `Source: ${rec.sourceTitle}` : "",
        metadata: `${rec.isCustom ? "Custom recipe" : confidenceLabel(rec.confidence)} · ${AGITATION_PRESETS[rec.agitation]?.label || "Agitation not specified"}`,
        reference: recipeReference()
      };
    }
    const { developerVolume, waterVolume } = calculateMix(cap, mix.developerParts, mix.waterParts);
    return {
      label: `Mix for ${cap} mL`,
      formula: `${formatVolume(developerVolume)} mL developer + ${formatVolume(waterVolume)} mL water`,
      note: `${mix.displayRatio || rec.dilution} working solution`,
      source: rec.sourceTitle ? `Source: ${rec.sourceTitle}` : "",
      metadata: `${rec.isCustom ? "Custom recipe" : confidenceLabel(rec.confidence)} · ${AGITATION_PRESETS[rec.agitation]?.label || "Agitation not specified"}`,
      reference: recipeReference()
    };
  });

  const plannedSteps = createMemo(() =>
    buildProcessSteps({
      presoakEnabled: presoakEnabled(),
      presoakMode: presoakMode(),
      presoakSeconds: Math.max(1, Number(presoakMinutes())) * 60,
      filmName: effectiveRecipe()?.film || resolvedFilmName() || "Select film",
      developerName: effectiveRecipe()?.developer || resolvedDeveloperName() || "Developer",
      dilution: effectiveRecipe()?.dilution || selectedDilution(),
      devSeconds: totalDevSeconds(),
      devAgitation: devAgitation(),
      stopBathId: stopBathId(),
      stopBathSeconds: Number(customStopBathSeconds()),
      fixerId: fixerId(),
      fixerSeconds: Number(customFixerSeconds()),
      hypoClearId: hypoClearId(),
      washId: washId(),
      washSeconds: Number(customWashSeconds()),
      photoFloSeconds: Number(customPhotoFloSeconds())
    })
  );

  const totalProcessSeconds = createMemo(() =>
    plannedSteps().reduce((sum, step) => sum + step.seconds, 0)
  );

  const customTimeError = createMemo(() => {
    if (stopBathId() === "custom" && Number(customStopBathSeconds()) <= 0) return "Set a custom stop bath time greater than zero.";
    if (fixerId() === "custom" && Number(customFixerSeconds()) <= 0) return "Set a custom fixer time greater than zero.";
    if (washId() === "custom" && Number(customWashSeconds()) <= 0) return "Set a custom wash time greater than zero.";
    return "";
  });

  const canStart = createMemo(() => Boolean(
    effectiveRecipe() && Number(tankCapacity()) > 0 && !customRecipeError() && !customTimeError()
  ));

  const currentStep = createMemo(() => activeSteps()[stepIndex()] || null);
  const nextStep = createMemo(() => activeSteps()[stepIndex() + 1] || null);
  const remainingSeconds = createMemo(() => {
    const step = currentStep();
    if (!step) return 0;
    return Math.max(0, step.seconds - elapsedSeconds());
  });
  const stepProgressPct = createMemo(() => {
    const step = currentStep();
    if (!step || step.seconds <= 0) return 0;
    return Math.min(100, (elapsedSeconds() / step.seconds) * 100);
  });
  const agitationMarkers = createMemo(() => {
    const step = currentStep();
    if (!step) return [];
    return agitationMarkersFor(step.seconds, step.agitation);
  });
  const currentInstruction = createMemo(() => {
    const step = currentStep();
    if (!step) return { phase: "rest", kicker: "", title: "", detail: "" };
    if (waitingForPour()) {
      return {
        phase: "rest",
        kicker: `Stage ${step.stage} ready · ${formatTime(step.seconds)}`,
        title: `Pour in ${step.name}`,
        detail: step.pourPrompt
      };
    }
    return instructionFor(elapsedSeconds(), step.agitation);
  });

  function stopTicker() {
    if (timerId !== null) {
      window.clearInterval(timerId);
      timerId = null;
    }
  }

  function runCurrentStepClock() {
    stopTicker();
    if (soundEnabled()) unlockAudio();
    setWaitingForPour(false);
    setIsPaused(false);
    setElapsedSeconds(0);
    startedAt = Date.now();
    pausedTotal = 0;
    lastTickBoundary = 0;
    lastRenderedElapsed = 0;

    timerId = window.setInterval(() => {
      if (isPaused()) return;
      const step = currentStep();
      if (!step) return;
      const elapsed = Math.max(0, Math.floor((Date.now() - startedAt - pausedTotal) / 1000));
      if (elapsed === lastRenderedElapsed) return;
      lastRenderedElapsed = elapsed;
      setElapsedSeconds(elapsed);

      const boundary = Math.floor(elapsed / 10) * 10;
      if (boundary >= 10 && boundary > lastTickBoundary && elapsed < step.seconds) {
        lastTickBoundary = boundary;
        if (soundEnabled()) {
          const preset = AGITATION_PRESETS[step.agitation] || AGITATION_PRESETS.standard;
          const isAgitationStart = preset.intervalSeconds > 0 && boundary >= preset.initialSeconds && boundary % preset.intervalSeconds === 0;
          if (isAgitationStart) playDing();
          else playTick();
        }
      }

      if (elapsed >= step.seconds) {
        stopTicker();
        if (soundEnabled()) playStepComplete();
        if (stepIndex() + 1 < activeSteps().length) {
          setStepIndex(stepIndex() + 1);
          setElapsedSeconds(0);
          setWaitingForPour(true);
        } else {
          setScreen("complete");
        }
      }
    }, 250);
  }

  function startProcess(e) {
    e.preventDefault();
    if (!canStart()) return;
    if (soundEnabled()) unlockAudio();
    setActiveSteps(plannedSteps());
    setStepIndex(0);
    setScreen("timer");
    window.scrollTo(0, 0);
    runCurrentStepClock();
  }

  function togglePause() {
    if (waitingForPour()) return;
    if (isPaused()) {
      pausedTotal += Date.now() - pausedAt;
      setIsPaused(false);
    } else {
      pausedAt = Date.now();
      setIsPaused(true);
    }
  }

  function skipToNextStep() {
    stopTicker();
    if (stepIndex() + 1 < activeSteps().length) {
      setStepIndex(stepIndex() + 1);
      setElapsedSeconds(0);
      setWaitingForPour(true);
    } else {
      setScreen("complete");
    }
  }

  function openSubmitModal(event) {
    if (!effectiveRecipe()) return;
    submitReturnTarget = event?.currentTarget;
    setShowSubmitModal(true);
  }

  function closeSubmitModal() {
    setShowSubmitModal(false);
    queueMicrotask(() => submitReturnTarget?.focus());
  }

  function resetProcess() {
    stopTicker();
    setWaitingForPour(false);
    setIsPaused(false);
    setScreen("setup");
  }

  return (
    <div class="app-shell">
      <header class="site-header">
        <a class="wordmark-button" href="https://darktimer.app/" aria-label="darkTimer">
          <img class="brand-icon" src="./assets/images/darktimer-icon.png" alt="" aria-hidden="true" width="512" height="512" />
          <span class="logo-lockup">
            <img class="brand-wordmark" src="./assets/images/darktimer-logo.png" alt="darkTimer" width="1013" height="231" />
          </span>
        </a>
        <div class="header-actions">
          <span class="version-badge" aria-label="Application version">v1.0.0</span>
        </div>
      </header>

      <main>
        <Show when={screen() === "setup"}>
          <section class="setup-screen">
            <div class="setup-copy">
              <h1>
                <span class="logo-lockup logo-lockup-setup">
                  <img class="setup-logo" src="./assets/images/darktimer-logo.png" alt="darkTimer" width="1013" height="231" />
                </span>
              </h1>
              <p>A black-and-white film development timer with dilution mixing math, audio cues, and chained agitation prompts from presoak through Photo-Flo.</p>
              <ol class="setup-howto">
                <li>Choose presoak, film, developer, recipe variant, dilution, and tank capacity to calculate your developer and water mix.</li>
                <li>Pick a verified recipe variant, or use Custom Recipe (enabled automatically when no verified recipe is available) to enter your own dilution and timing.</li>
                <li>Press <strong>Start Development Process</strong> and follow the VFD timer, agitation pips, and pour prompts between stages.</li>
              </ol>

              <details class="data-note">
                <summary>About these times</summary>
                <p>The local catalog contains manufacturer-published times and may include clearly labeled community reports. Custom recipe names are entered by you and are not imported from an external database. Each selected catalog recipe shows its source, confidence, and agitation method. Always check the linked source and the current chemistry label before processing important negatives.</p>
                <ul>
                  <li><a href="https://www.kodakprofessional.com/sites/default/files/wysiwyg/pro/resources/edbwf_0.pdf" target="_blank" rel="noreferrer">Kodak black-and-white processing data (ED-BWF, March 2023)</a></li>
                  <li><a href="https://business.kodakmoments.com/sites/default/files/wysiwyg/pro/chemistry/j24.pdf" target="_blank" rel="noreferrer">Kodak HC-110 Developer technical data and dilutions (J-24)</a></li>
                  <li><a href="https://business.kodakmoments.com/sites/default/files/wysiwyg/pro/chemistry/j78.pdf" target="_blank" rel="noreferrer">Kodak D-76 Developer technical data and dilutions (J-78)</a></li>
                  <li><a href="https://business.kodakmoments.com/sites/default/files/wysiwyg/pro/chemistry/j109.pdf" target="_blank" rel="noreferrer">Kodak XTOL Developer technical data and dilutions (J-109)</a></li>
                  <li><a href="https://www.adox.de/adox-chemie/adox-filmentwickler/rodinal-adonal/" target="_blank" rel="noreferrer">ADOX Rodinal / Adonal product and dilution guide</a></li>
                  <li><a href="https://www.ilfordphoto.com/amfile/file/download/file/1919/product/689/" target="_blank" rel="noreferrer">Ilford FP4 Plus technical information</a></li>
                </ul>
              </details>
              <p class="safety-callout"><strong>Safety:</strong> Follow the product label and Safety Data Sheet (SDS) first. Use appropriate PPE, ventilate your workspace, and follow local disposal rules.</p>
            </div>

            <div class="chain-preview">
              <div class="chain-preview-header">
                <span>Process Chain ({plannedSteps().length} steps)</span>
                <span>Total {formatTime(totalProcessSeconds())}</span>
              </div>
              <ol class="chain-list">
                <For each={plannedSteps()}>
                  {(step) => (
                    <li class="chain-item">
                      <span class="chain-stage">{step.stage}</span>
                      <span class="chain-name">
                        <strong>{step.name}</strong>
                        <span class="chain-sub">{step.subtitle}</span>
                      </span>
                      <span class="chain-time">{formatTime(step.seconds)}</span>
                    </li>
                  )}
                </For>
              </ol>
            </div>

            <form class="process-panel" onSubmit={startProcess}>
              {/* 01 Presoak */}
              <div class="stage-card">
                <div class="stage-row stage-row-presoak">
                  <div class="stage-label-row">
                    <span class="stage-label"><span class="stage-num">01</span></span>
                    <button class="stage-hint-button" type="button" onClick={() => setActiveHint("presoak")} title="Presoak guide & references">Presoak</button>
                  </div>
                  <div class="presoak-controls">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={presoakEnabled()}
                      aria-label="Presoak"
                      class="vcr-switch"
                      classList={{ "is-on": presoakEnabled() }}
                      onClick={() => setPresoakEnabled(!presoakEnabled())}
                    >
                      <span class="vcr-switch-label" aria-hidden="true">
                        {presoakEnabled() ? "YES" : "NO"}
                      </span>
                      <span class="vcr-switch-thumb" aria-hidden="true" />
                    </button>
                    <Show when={presoakEnabled()}>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={presoakMode() === "stand"}
                        aria-label={`Presoak method: ${presoakMode() === "stand" ? "Stand" : "Agitated"}`}
                        class="vcr-switch vcr-switch-mode"
                        classList={{ "is-on": presoakMode() === "stand" }}
                        onClick={() => {
                          const nextMode = presoakMode() === "stand" ? "agitated" : "stand";
                          setPresoakMode(nextMode);
                          setPresoakMinutes(nextMode === "stand" ? 15 : 1);
                        }}
                      >
                        <span class="vcr-switch-label" aria-hidden="true">
                          {presoakMode() === "stand" ? "STAND" : "AGIT"}
                        </span>
                        <span class="vcr-switch-thumb" aria-hidden="true" />
                      </button>
                      <div class="presoak-duration">
                        <input
                          id="presoakMin"
                          type="number"
                          min="1"
                          max="60"
                          value={presoakMinutes()}
                          onInput={(e) => setPresoakMinutes(e.currentTarget.value)}
                          aria-label="Presoak duration in minutes"
                        />
                        <label for="presoakMin">min</label>
                      </div>
                    </Show>
                  </div>
                </div>
              </div>

              {/* 02 Film */}
              <div class="stage-card">
                <div class="stage-row">
                  <label class="stage-label" for="filmSelect"><span class="stage-num">02</span> Film</label>
                  <SearchCombobox
                    id="filmSelect"
                    placeholder="Search 480 B&W films…"
                    listboxLabel="Black and white films"
                    clearLabel="Clear film"
                    options={filmComboboxOptions()}
                    selectedKey={selectedFilmKey()}
                    selectedLabel={resolvedFilmName()}
                    allowCustom={true}
                    onSelect={handleFilmChange}
                    onSelectCustom={handleCustomFilmSelect}
                    onClear={() => handleFilmChange("")}
                  />
                </div>
                <Show when={catalogMode() === "error"}>
                  <p class="catalog-error" role="alert">Could not load the verified recipe catalog. You can still use any film and developer with a Custom Recipe. {catalogError()} <button type="button" onClick={() => window.location.reload()}>Reload</button></p>
                </Show>
              </div>

              {/* 03 Developer, Recipe Variant, Dilution & Tank */}
              <div class="stage-card">
                <div class="stage-row">
                  <label class="stage-label" for="devSelect"><span class="stage-num">03</span> Developer</label>
                  <SearchCombobox
                    id="devSelect"
                    placeholder={selectedFilmKey() ? "Search 342 B&W developers…" : "Select a film first"}
                    listboxLabel="Black and white developers"
                    clearLabel="Clear developer"
                    options={developerComboboxOptions()}
                    selectedKey={selectedDeveloperKey()}
                    selectedLabel={resolvedDeveloperName()}
                    disabled={!selectedFilmKey()}
                    allowCustom={true}
                    onSelect={handleDeveloperChange}
                    onSelectCustom={handleCustomDeveloperSelect}
                    onClear={() => handleDeveloperChange("")}
                  />
                </div>

                <div class="sub-fields">
                  <div class="sub-field sub-field-full">
                    <label for="recipeSelect">Recipe Variant</label>
                    <select
                      id="recipeSelect"
                      value={selectedRecipeId()}
                      onChange={(e) => handleVariantChange(e.currentTarget.value)}
                      disabled={!hasFilmAndDeveloper()}
                    >
                      <Show
                        when={hasFilmAndDeveloper()}
                        fallback={<option value="">Select film and developer</option>}
                      >
                        <Show
                          when={hasVerifiedRecipes()}
                          fallback={<option value={CUSTOM_RECIPE_ID}>Custom Recipe (no verified recipe available)</option>}
                        >
                          <option value="">Select recipe</option>
                          <For each={variants()}>{(r) => <option value={String(r.id)}>{formatRecipeOption(r)}</option>}</For>
                          <option value={CUSTOM_RECIPE_ID}>Custom Recipe</option>
                        </Show>
                      </Show>
                    </select>
                  </div>

                  <div class="sub-field">
                    <button class="hint-sub-button" type="button" onClick={() => setActiveHint("dilution")} title="How to read dilutions">Dilution</button>
                    <Show
                      when={!isCustomRecipe()}
                      fallback={
                        <div class="custom-dilution-group">
                          <select
                            id="customDilutionMode"
                            class="custom-dilution-mode"
                            aria-label="Dilution format"
                            value={customDilutionMode()}
                            onChange={(e) => setCustomDilutionMode(e.currentTarget.value)}
                          >
                            <option value="ratio">1+</option>
                            <option value="stock">Stock</option>
                            <option value="other">Other</option>
                          </select>
                          <Show when={customDilutionMode() === "ratio"}>
                            <input
                              id="customDilution"
                              aria-label="Parts water per 1 part developer"
                              type="number"
                              min="0"
                              step="any"
                              inputMode="decimal"
                              required
                              placeholder="Parts water (e.g. 50)"
                              value={customDilutionParts()}
                              onInput={(e) => setCustomDilutionParts(e.currentTarget.value)}
                            />
                          </Show>
                          <Show when={customDilutionMode() === "other"}>
                            <input
                              id="customDilution"
                              aria-label="Custom developer dilution"
                              type="text"
                              required
                              placeholder="e.g. 1+1+100 or 2+3"
                              value={customDilutionOther()}
                              onInput={(e) => setCustomDilutionOther(e.currentTarget.value)}
                            />
                          </Show>
                        </div>
                      }
                    >
                      <select id="dilSelect" aria-label="Dilution" value={selectedDilution()} onChange={(e) => handleDilutionChange(e.currentTarget.value)} disabled={dilutions().length === 0}>
                        <option value="">Select dilution</option>
                        <For each={dilutions()}>{(d) => <option value={d}>{d}</option>}</For>
                      </select>
                    </Show>
                  </div>

                  <div class="sub-field">
                    <button class="hint-sub-button" type="button" onClick={() => setActiveHint("tank")} title="Tank types and capacities">Tank</button>
                    <select id="tankSelect" aria-label="Tank" value={tankCapacity()} onChange={(e) => setTankCapacity(e.currentTarget.value)}>
                      <option value="250">250 mL</option>
                      <option value="300">300 mL</option>
                      <option value="500">500 mL</option>
                      <option value="600">600 mL</option>
                      <option value="1000">1000 mL</option>
                    </select>
                  </div>

                  <Show when={isCustomRecipe()}>
                    <div class="sub-field">
                      <label for="customEi">Exposure index *</label>
                      <input id="customEi" type="number" min="1" step="1" required value={customEi()} onInput={(e) => setCustomEi(e.currentTarget.value)} />
                    </div>
                    <div class="sub-field">
                      <label for="customFormat">Film format *</label>
                      <select id="customFormat" value={customFormat()} onChange={(e) => setCustomFormat(e.currentTarget.value)}>
                        <option value="135">35mm</option>
                        <option value="120">120</option>
                        <option value="sheet">Sheet</option>
                        <option value="any">Any format</option>
                      </select>
                    </div>
                    <div class="sub-field sub-field-full">
                      <label for="customTemperature">Developer temperature ({tempUnit() === "fahrenheit" ? "°F" : "°C"}) *</label>
                      <input
                        id="customTemperature"
                        type="number"
                        min={customTemperatureLimits().min}
                        max={customTemperatureLimits().max}
                        step="0.1"
                        required
                        value={customTemperatureValue()}
                        onInput={(e) => updateCustomTemperature(e.currentTarget.value)}
                      />
                    </div>
                  </Show>

                  <div class="sub-field sub-field-full">
                    <button class="hint-sub-button" type="button" onClick={() => setActiveHint("agitation")} title="Agitation methods and documentation">Agitation</button>
                    <select id="agitSelect" aria-label="Agitation" value={devAgitation()} onChange={(e) => setDevAgitation(e.currentTarget.value)}>
                      <option value="standard">60s + 10s / min (Default)</option>
                      <option value="ilford">Ilford (10s / min)</option>
                      <option value="kodak">Kodak (30s + 5s / 30s)</option>
                      <option value="rodinal">Rodinal (10s / min)</option>
                      <option value="stand">Stand (60s initial only)</option>
                    </select>
                  </div>

                  <Show when={effectiveRecipe()}>
                    <div class="sub-field sub-field-full">
                      <label>{isCustomRecipe() ? "Custom developer time" : "Developer time"} (mm : ss)</label>
                      <div class="inline-time">
                        <input type="number" min="1" max="120" value={devMinutes()} onInput={(e) => setDevMinutes(e.currentTarget.value)} aria-label="Developer minutes" />
                        <span>:</span>
                        <input type="number" min="0" max="59" value={devSeconds()} onInput={(e) => setDevSeconds(e.currentTarget.value)} aria-label="Developer seconds" />
                      </div>
                    </div>
                  </Show>
                  <Show when={customRecipeError()}>
                    <p class="custom-time-error sub-field-full" role="alert">{customRecipeError()}</p>
                  </Show>
                </div>

                <Show when={mixSummary()}>
                  {(mix) => (
                    <div class="mix-box">
                      <span>{mix().label}</span>
                      <strong>{mix().formula}</strong>
                      <span>{mix().note}</span>
                      <Show when={mix().source}>
                        <span>{mix().source}</span>
                      </Show>
                      <span>{mix().metadata}</span>
                      <Show when={effectiveRecipe()?.notes}><span>{effectiveRecipe().notes}</span></Show>
                      <Show when={mix().reference}>
                        {(ref) => (
                          <a class="mix-ref-link" href={ref().url} target="_blank" rel="noreferrer">{ref().label}</a>
                        )}
                      </Show>
                    </div>
                  )}
                </Show>

                <Show when={isCustomRecipe()}>
                  <div class="submission-prompt submission-prompt-setup">
                    <h3>Submit this custom recipe</h3>
                    <p>Review the film, developer, dilution, time, temperature, and agitation before opening a draft public GitHub issue.</p>
                    <button
                      class="contribution-button"
                      type="button"
                      disabled={Boolean(customRecipeError())}
                      onClick={openSubmitModal}
                    >
                      Submit this recipe
                    </button>
                  </div>
                </Show>
              </div>

              {/* 04 Stop Bath */}
              <div class="stage-card">
                <div class="stage-row">
                  <div class="stage-label-row">
                    <label class="stage-label" for="stopSelect"><span class="stage-num">04</span></label>
                    <button class="stage-hint-button" type="button" onClick={() => setActiveHint("stop")} title="Stop bath guide & references">Stop Bath</button>
                  </div>
                  <select id="stopSelect" aria-label="Stop Bath" value={stopBathId()} onChange={(e) => setStopBathId(e.currentTarget.value)}>
                    <For each={STOP_BATH_OPTIONS}>{(o) => <option value={o.id}>{o.label}</option>}</For>
                  </select>
                </div>
                <Show when={stopBathId() === "custom"}>
                  <DurationInput label="Custom stop bath" seconds={customStopBathSeconds()} onChange={setCustomStopBathSeconds} />
                  <Show when={Number(customStopBathSeconds()) <= 0}><p class="custom-time-error" role="alert">Set a time greater than zero.</p></Show>
                </Show>
              </div>

              {/* 05 Fixer */}
              <div class="stage-card">
                <div class="stage-row">
                  <div class="stage-label-row">
                    <label class="stage-label" for="fixerSelect"><span class="stage-num">05</span></label>
                    <button class="stage-hint-button" type="button" onClick={() => setActiveHint("fixer")} title="Fixer guide & references">Fixer</button>
                  </div>
                  <select id="fixerSelect" aria-label="Fixer" value={fixerId()} onChange={(e) => setFixerId(e.currentTarget.value)}>
                    <For each={FIXER_OPTIONS}>{(o) => <option value={o.id}>{o.label}</option>}</For>
                  </select>
                </div>
                <Show when={fixerId() === "custom"}>
                  <DurationInput label="Custom fixer" seconds={customFixerSeconds()} onChange={setCustomFixerSeconds} />
                  <Show when={Number(customFixerSeconds()) <= 0}><p class="custom-time-error" role="alert">Set a time greater than zero.</p></Show>
                </Show>
              </div>

              {/* 06 Hypo-Clear */}
              <div class="stage-card">
                <div class="stage-row">
                  <div class="stage-label-row">
                    <label class="stage-label" for="hypoSelect"><span class="stage-num">06</span></label>
                    <button class="stage-hint-button" type="button" onClick={() => setActiveHint("hypo")} title="Hypo-clear guide & references">Hypo-Clear</button>
                  </div>
                  <select id="hypoSelect" aria-label="Hypo-Clear" value={hypoClearId()} onChange={(e) => setHypoClearId(e.currentTarget.value)}>
                    <For each={HYPO_CLEAR_OPTIONS}>{(o) => <option value={o.id}>{o.label}</option>}</For>
                  </select>
                </div>
              </div>

              {/* 07 Wash + Photo-Flo */}
              <div class="stage-card">
                <div class="stage-row">
                  <label class="stage-label" for="washSelect"><span class="stage-num">07</span> Wash</label>
                  <select id="washSelect" value={washId()} onChange={(e) => setWashId(e.currentTarget.value)}>
                    <For each={WASH_OPTIONS}>{(o) => <option value={o.id}>{o.label}</option>}</For>
                  </select>
                </div>
                <Show when={washId() === "custom"}>
                  <div class="stage-time-grid">
                    <DurationInput label="Custom wash" displayLabel="Wash" seconds={customWashSeconds()} onChange={setCustomWashSeconds} />
                    <DurationInput label="Custom Photo-Flo" displayLabel="Photo-Flo" seconds={customPhotoFloSeconds()} onChange={setCustomPhotoFloSeconds} />
                  </div>
                  <Show when={Number(customWashSeconds()) <= 0}><p class="custom-time-error" role="alert">Set a wash time greater than zero. Set Photo-Flo to zero to omit that step.</p></Show>
                </Show>
              </div>

              <Show when={customTimeError()}><p class="custom-time-summary" role="alert">{customTimeError()}</p></Show>
              <button class="primary-button" type="submit" disabled={!canStart()}>
                Start Development Process
              </button>
            </form>
          </section>
        </Show>

        <Show when={screen() === "timer" && currentStep()}>
          <section class="timer-screen">
            <div class="step-ribbon">
              <For each={activeSteps()}>
                {(step, i) => (
                  <span
                    class="step-pill"
                    classList={{
                      "is-done": i() < stepIndex(),
                      "is-active": i() === stepIndex()
                    }}
                  >
                    {step.name}
                  </span>
                )}
              </For>
            </div>

            <div class="timer-display" role="timer">
              {formatTime(remainingSeconds())}
            </div>

            <div
              class="tank-stage"
              classList={{
                "is-agitating": !waitingForPour() && !isPaused() && currentInstruction().phase !== "rest",
                "is-pouring": waitingForPour()
              }}
            >
              <img
                src={waitingForPour() ? "./assets/images/canister-vfd-pour.svg" : "./assets/images/canister-vfd.svg"}
                alt={waitingForPour() ? "Pouring developing tank" : "Developing tank"}
                width="720"
                height="720"
              />
            </div>

            <div class="vfd-progress-panel" aria-label="Step progress">
              <div class="vfd-progress-meta">
                <span>{currentStep().name} progress</span>
                <span class="vfd-progress-digits">{formatTime(elapsedSeconds())} / {formatTime(currentStep().seconds)}</span>
              </div>
              <div
                class="vfd-progress-track"
                role="progressbar"
                aria-valuemin="0"
                aria-valuemax={currentStep().seconds}
                aria-valuenow={Math.min(elapsedSeconds(), currentStep().seconds)}
              >
                <div class="vfd-progress-fill" style={{ width: `${stepProgressPct()}%` }} />
                <div class="vfd-progress-pips" aria-hidden="true">
                  <For each={agitationMarkers()}>
                    {(marker) => (
                      <span
                        class="vfd-pip"
                        classList={{
                          "is-passed": !waitingForPour() && elapsedSeconds() >= marker.atSeconds
                        }}
                        style={{ left: `${marker.pct}%` }}
                        title={`Agitate at ${formatTime(marker.atSeconds)}`}
                      />
                    )}
                  </For>
                </div>
              </div>
              <div class="vfd-progress-legend">
                <span><span class="vfd-pip-swatch" aria-hidden="true" /> Agitate point</span>
                <span>{Math.round(stepProgressPct())}%</span>
              </div>
            </div>

            <div class="instruction-panel">
              <p class="instruction-kicker">
                Step {stepIndex() + 1} of {activeSteps().length} · {currentStep().name} : {currentInstruction().kicker}
              </p>
              <h2>{currentInstruction().title}</h2>
              <p>{currentInstruction().detail}</p>
              <Show when={nextStep()}>
                {(next) => <p class="up-next">Up next: <strong>{next().name}</strong> ({formatTime(next().seconds)})</p>}
              </Show>
            </div>

            <div class="vcr-deck" role="group" aria-label="Process transport controls">
              <button
                class="vcr-key vcr-key-play"
                type="button"
                aria-label={waitingForPour() ? `Pour and start ${currentStep().name}` : isPaused() ? "Resume timer" : "Pause timer"}
                title={waitingForPour() ? `Pour & Start ${currentStep().name}` : isPaused() ? "Play / Resume" : "Pause"}
                onClick={() => (waitingForPour() ? runCurrentStepClock() : togglePause())}
              >
                <Show
                  when={waitingForPour() || isPaused()}
                  fallback={
                    <svg class="vcr-icon" viewBox="0 0 24 24" aria-hidden="true">
                      <rect x="6" y="4" width="4" height="16" rx="1" />
                      <rect x="14" y="4" width="4" height="16" rx="1" />
                    </svg>
                  }
                >
                  <svg class="vcr-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6 4.5v15l13-7.5-13-7.5Z" />
                  </svg>
                </Show>
              </button>

              <button
                class="vcr-key"
                type="button"
                aria-label="Skip to next step"
                title="Next step"
                onClick={skipToNextStep}
              >
                <svg class="vcr-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 5v14l9-7-9-7Zm10 0v14l6-4.7V19h2V5h-2v4.7L14 5Z" />
                </svg>
              </button>

              <button
                class="vcr-key vcr-key-mute"
                type="button"
                aria-pressed={!soundEnabled()}
                aria-label={soundEnabled() ? "Mute timer sounds" : "Unmute timer sounds"}
                title={soundEnabled() ? "Mute" : "Muted (click to unmute)"}
                onClick={() => setSoundEnabled(!soundEnabled())}
              >
                <Show
                  when={soundEnabled()}
                  fallback={
                    <svg class="vcr-icon" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M3 9v6h4l5 4V5L7 9H3Zm13.5 3a4.5 4.5 0 0 0-2.5-4.03v8.05A4.5 4.5 0 0 0 16.5 12ZM14 3.23v2.06a7 7 0 0 1 0 13.42v2.06a9 9 0 0 0 0-17.54Z" />
                    </svg>
                  }
                >
                  <svg class="vcr-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 9v6h4l5 4V5L7 9H3Zm13.6 3 2.9 2.9-1.4 1.4L15.2 13.4l-2.9 2.9-1.4-1.4 2.9-2.9-2.9-2.9 1.4-1.4 2.9 2.9 2.9-2.9 1.4 1.4-2.9 2.9Z" />
                  </svg>
                </Show>
              </button>

              <button
                class="vcr-key"
                type="button"
                aria-label="Reset process"
                title="Eject / Reset"
                onClick={resetProcess}
              >
                <svg class="vcr-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 5 4 15h16L12 5Zm-8 12v2h16v-2H4Z" />
                </svg>
              </button>
            </div>
          </section>
        </Show>

        <Show when={screen() === "complete"}>
          <section class="timer-screen">
            <div class="timer-display">00:00</div>
            <div class="tank-stage is-pouring">
              <img src="./assets/images/canister-vfd-pour.svg" alt="Pouring developing tank" width="720" height="720" />
            </div>
            <div class="instruction-panel">
              <p class="instruction-kicker">All {activeSteps().length} steps complete</p>
              <h2>Development process finished.</h2>
              <p>Remove your film from the Photo-Flo bath and hang to dry in a dust-free spot.</p>
            </div>
            <Show when={isCustomRecipe()}>
              <div class="submission-prompt">
                <h3>Do you want to submit this recipe?</h3>
                <p>Review the film, developer, required dilution, time, temperature, and agitation before opening a draft public GitHub issue.</p>
                <button class="contribution-button" type="button" onClick={openSubmitModal}>Review recipe submission</button>
              </div>
            </Show>
            <div class="submission-prompt support-prompt">
              <h3>Support darkTimer</h3>
              <p>darkTimer is free and open-source. If it helped you develop this roll, consider donating on Ko-fi to help maintain this website.</p>
              <a class="contribution-button support-kofi-button" href="https://ko-fi.com/mikey_247" target="_blank" rel="noreferrer">
                <svg class="github-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M18 8h1a3 3 0 0 1 0 6h-1v1a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V8a1 1 0 0 1 1-1h15v1Zm0 4h1a1 1 0 0 0 0-2h-1v2Zm-7.5 3.6c1.66-1.16 2.8-2.2 2.8-3.38a1.72 1.72 0 0 0-1.7-1.72c-.6 0-1.1.3-1.4.76-.3-.46-.8-.76-1.4-.76a1.72 1.72 0 0 0-1.7 1.72c0 1.18 1.14 2.22 2.8 3.38l.3.2.3-.2Z" />
                </svg>
                <span>Donate on Ko-fi</span>
              </a>
            </div>
            <button class="primary-button primary-button-inline" type="button" onClick={resetProcess}>
              {isCustomRecipe() ? "No, develop another roll" : "Develop another roll"}
            </button>
          </section>
        </Show>
      </main>

      <Suspense>
        <Show when={activeHint()}>
          <GuideModal activeHint={activeHint()} onClose={() => setActiveHint(null)} />
        </Show>

        <Show when={showSubmitModal() && effectiveRecipe()}>
          <SubmitModal
            recipe={effectiveRecipe()}
            timeDisplay={formatTime(totalDevSeconds())}
            tempDisplay={customTemperatureValue()}
            tempUnit={tempUnit()}
            onClose={closeSubmitModal}
          />
        </Show>
      </Suspense>

      <footer>
        <div class="footer-notes">
          <p class="privacy-note">
            <button class="footer-policy-button" type="button" onClick={() => setActiveHint("privacy")}>
              Privacy Policy
            </button>
          </p>
          <p class="disclaimer-note">Times are starting points, not guarantees. The manufacturer label and safety data sheet control. darkTimer is independent and is not affiliated with or endorsed by the named manufacturers.</p>
        </div>
        <div class="footer-links">
          <div class="temperature-toggle">
            <span class="temperature-label" aria-hidden="true">TEMP</span>
            <button
              type="button"
              role="switch"
              aria-checked={tempUnit() === "celsius"}
              aria-label={`Temperature unit: ${tempUnit() === "fahrenheit" ? "Fahrenheit" : "Celsius"}`}
              class="vcr-switch vcr-switch-temp"
              classList={{ "is-on": tempUnit() === "celsius" }}
              onClick={() => setTempUnit(tempUnit() === "fahrenheit" ? "celsius" : "fahrenheit")}
            >
              <span class="vcr-switch-label" aria-hidden="true">
                {tempUnit() === "celsius" ? "°C" : "°F"}
              </span>
              <span class="vcr-switch-thumb" aria-hidden="true" />
            </button>
          </div>
          <a class="github-link kofi-link" href="https://ko-fi.com/mikey_247" target="_blank" rel="noreferrer">
            <svg class="github-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18 8h1a3 3 0 0 1 0 6h-1v1a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V8a1 1 0 0 1 1-1h15v1Zm0 4h1a1 1 0 0 0 0-2h-1v2Zm-7.5 3.6c1.66-1.16 2.8-2.2 2.8-3.38a1.72 1.72 0 0 0-1.7-1.72c-.6 0-1.1.3-1.4.76-.3-.46-.8-.76-1.4-.76a1.72 1.72 0 0 0-1.7 1.72c0 1.18 1.14 2.22 2.8 3.38l.3.2.3-.2Z" />
            </svg>
            <span>Ko-fi</span>
          </a>
          <a class="github-link" href="https://github.com/mjdelro/darktimer-app" target="_blank" rel="noreferrer">
            <svg class="github-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.15-1.11-1.46-1.11-1.46-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.35 1.09 2.92.83.09-.65.35-1.09.64-1.34-2.22-.25-4.56-1.11-4.56-4.95 0-1.09.39-1.99 1.03-2.69-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.03a9.56 9.56 0 0 1 5 0c1.91-1.3 2.75-1.03 2.75-1.03.55 1.38.2 2.4.1 2.65.64.7 1.03 1.6 1.03 2.69 0 3.85-2.34 4.7-4.57 4.95.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
            </svg>
            <span>GitHub</span>
          </a>
        </div>
      </footer>
    </div>
  );
}
