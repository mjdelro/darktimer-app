import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { loadCustomCatalog, loadFilmList, loadRecipesForFilm } from "./catalog.js";
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
  WASH_OPTIONS
} from "./process.js";
import { playDing, playStepComplete, playTick } from "./audio.js";
import {
  AGITATION_SUBMISSION_OPTIONS,
  buildRecipeIssueUrl,
  SUBMISSION_TYPES,
  validateRecipeSubmission
} from "./submission.js";

const FORMAT_NAMES = { any: "Any format", "135": "35mm", "120": "120", sheet: "Sheet" };

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
  const [submitError, setSubmitError] = createSignal("");
  const [subFilm, setSubFilm] = createSignal("");
  const [subDeveloper, setSubDeveloper] = createSignal("");
  const [subDilution, setSubDilution] = createSignal("");
  const [subEi, setSubEi] = createSignal("400");
  const [subFormat, setSubFormat] = createSignal("135");
  const [subTime, setSubTime] = createSignal("07:30");
  const [subTemp, setSubTemp] = createSignal("20");
  const [subTempUnit, setSubTempUnit] = createSignal("celsius");
  const [subAgitation, setSubAgitation] = createSignal(AGITATION_SUBMISSION_OPTIONS[0].value);
  const [subNotes, setSubNotes] = createSignal("");
  const [subSubmissionType, setSubSubmissionType] = createSignal(SUBMISSION_TYPES[0].value);
  const [subAttribution, setSubAttribution] = createSignal("");
  const [subSourceTitle, setSubSourceTitle] = createSignal("Personal darkroom test log");
  const [subUrl, setSubUrl] = createSignal("");
  const [subDate, setSubDate] = createSignal(new Date().toISOString().slice(0, 10));
  const [subSuccessfulTests, setSubSuccessfulTests] = createSignal("1");
  const [subCertified, setSubCertified] = createSignal(false);
  const [activeHint, setActiveHint] = createSignal(null); // "dilution" | "tank" | "agitation" | null
  let submitModalTrigger;
  let submitDialog;

  createEffect(() => {
    if (!showSubmitModal()) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    onCleanup(() => { document.body.style.overflow = previousOverflow; });
  });

  // Catalog state
  const [catalogMode, setCatalogMode] = createSignal("loading");
  const [catalogError, setCatalogError] = createSignal("");
  const [films, setFilms] = createSignal([]);
  const [customByFilm, setCustomByFilm] = createSignal(new Map());
  const [filmRecipes, setFilmRecipes] = createSignal([]);
  const [loadingRecipes, setLoadingRecipes] = createSignal(false);

  // 01 Presoak
  const [presoakEnabled, setPresoakEnabled] = createSignal(false);
  const [presoakMode, setPresoakMode] = createSignal("agitated");
  const [presoakMinutes, setPresoakMinutes] = createSignal(1);

  // 02 Film & Developer
  const [selectedFilmKey, setSelectedFilmKey] = createSignal("");
  const [selectedDeveloper, setSelectedDeveloper] = createSignal("");
  const [selectedDilution, setSelectedDilution] = createSignal("");
  const [selectedRecipeId, setSelectedRecipeId] = createSignal("");
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
  let timerId = null;
  let hintDialog;
  let hintCloseButton;

  onMount(async () => {
    try {
      const { byFilm, filmEntries } = await loadCustomCatalog();
      setCustomByFilm(byFilm);
      const { mode, films: list } = await loadFilmList(filmEntries);
      setCatalogMode(mode);
      setFilms(list);
    } catch (error) {
      setCatalogMode("error");
      setCatalogError(error instanceof Error ? error.message : "The recipe catalog could not be loaded.");
    }
  });

  onCleanup(() => {
    if (timerId !== null) window.clearInterval(timerId);
  });

  createEffect(() => {
    if (!activeHint()) return;
    const previouslyFocused = document.activeElement;
    const handleModalKeys = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setActiveHint(null);
        return;
      }
      if (event.key !== "Tab" || !hintDialog) return;
      const focusable = [...hintDialog.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleModalKeys);
    window.queueMicrotask(() => hintCloseButton?.focus());
    onCleanup(() => {
      document.removeEventListener("keydown", handleModalKeys);
      previouslyFocused?.focus?.();
    });
  });

  const selectedFilm = createMemo(() => films().find((f) => f.key === selectedFilmKey()) || null);

  createEffect(async () => {
    const film = selectedFilm();
    setSelectedDeveloper("");
    setSelectedDilution("");
    setSelectedRecipeId("");
    if (!film) {
      setFilmRecipes([]);
      return;
    }
    setLoadingRecipes(true);
    const loaded = await loadRecipesForFilm(film, customByFilm(), catalogMode());
    setFilmRecipes(loaded);
    setLoadingRecipes(false);
  });

  const developers = createMemo(() =>
    [...new Set(filmRecipes().map((r) => r.developer))].sort((a, b) => a.localeCompare(b))
  );

  const dilutions = createMemo(() =>
    [...new Set(filmRecipes().filter((r) => r.developer === selectedDeveloper()).map((r) => r.dilution))]
      .sort((a, b) => a.localeCompare(b))
  );

  const variants = createMemo(() =>
    filmRecipes()
      .filter((r) => r.developer === selectedDeveloper() && r.dilution === selectedDilution())
      .sort((a, b) => ((a.ei || 0) - (b.ei || 0)) || (a.temperatureC - b.temperatureC) || (a.seconds - b.seconds))
  );

  const selectedRecipe = createMemo(() => variants().find((r) => String(r.id) === selectedRecipeId()) || null);

  createEffect(() => {
    const list = variants();
    if (list.length === 1) {
      setSelectedRecipeId(String(list[0].id));
    }
  });

  createEffect(() => {
    const rec = selectedRecipe();
    if (!rec) return;
    setDevMinutes(Math.floor(rec.seconds / 60));
    setDevSeconds(rec.seconds % 60);
    if (AGITATION_PRESETS[rec.agitation]) setDevAgitation(rec.agitation);
  });

  const formatTemp = (c) =>
    tempUnit() === "fahrenheit" ? `${formatVolume((c * 9) / 5 + 32)}°F` : `${formatVolume(c)}°C`;

  const formatRecipeOption = (r) => {
    const fmt = FORMAT_NAMES[r.format] || r.format || "Any format";
    const iso = r.ei ? `ISO ${r.ei}` : "Listed speed";
    return `${fmt} · ${iso} · ${formatTemp(r.temperatureC)} · ${formatTime(r.seconds)}`;
  };

  const recipeReference = createMemo(() => {
    const rec = selectedRecipe();
    if (!rec) return null;
    if (rec.sourceUrl) {
      return { url: rec.sourceUrl, label: rec.sourceTitle ? `Reference: ${rec.sourceTitle}` : "Recipe reference" };
    }
    return DEVELOPER_REFERENCE_LINKS[rec.developer] || null;
  });

  const mixSummary = createMemo(() => {
    const rec = selectedRecipe();
    const cap = Number(tankCapacity());
    const mix = dilutionMixFor(rec);
    if (!rec || !cap || !mix) return null;
    if (mix.stock) {
      return {
        label: `Mix for ${cap} mL`,
        formula: `${cap} mL stock developer (no water)`,
        note: "Use working-strength stock solution.",
        source: rec.sourceTitle ? `Source: ${rec.sourceTitle}` : "",
        metadata: `${confidenceLabel(rec.confidence)} · ${AGITATION_PRESETS[rec.agitation]?.label || "Agitation not specified"}`,
        reference: recipeReference()
      };
    }
    const { developerVolume, waterVolume } = calculateMix(cap, mix.developerParts, mix.waterParts);
    return {
      label: `Mix for ${cap} mL`,
      formula: `${formatVolume(developerVolume)} mL developer + ${formatVolume(waterVolume)} mL water`,
      note: `${mix.displayRatio || rec.dilution} working solution`,
      source: rec.sourceTitle ? `Source: ${rec.sourceTitle}` : "",
      metadata: `${confidenceLabel(rec.confidence)} · ${AGITATION_PRESETS[rec.agitation]?.label || "Agitation not specified"}`,
      reference: recipeReference()
    };
  });

  const totalDevSeconds = createMemo(() => Math.max(1, Number(devMinutes()) * 60 + Number(devSeconds())));

  const plannedSteps = createMemo(() =>
    buildProcessSteps({
      presoakEnabled: presoakEnabled(),
      presoakMode: presoakMode(),
      presoakSeconds: Math.max(1, Number(presoakMinutes())) * 60,
      filmName: selectedFilm()?.fullName || "Select film",
      developerName: selectedDeveloper() || "Developer",
      dilution: selectedDilution(),
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
    selectedRecipe() && Number(tankCapacity()) > 0 && !customTimeError()
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
    setWaitingForPour(false);
    setIsPaused(false);
    setElapsedSeconds(0);
    startedAt = Date.now();
    pausedTotal = 0;
    lastTickBoundary = 0;

    timerId = window.setInterval(() => {
      if (isPaused()) return;
      const step = currentStep();
      if (!step) return;
      const elapsed = Math.max(0, Math.floor((Date.now() - startedAt - pausedTotal) / 1000));
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
    setActiveSteps(plannedSteps());
    setStepIndex(0);
    setScreen("timer");
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

  function openSubmitModal() {
    setSubmitError("");
    if (!subFilm() && selectedFilm()) setSubFilm(selectedFilm().fullName);
    if (!subDeveloper() && selectedDeveloper()) setSubDeveloper(selectedDeveloper());
    if (!subDilution() && selectedDilution()) setSubDilution(selectedDilution());
    setSubTempUnit(tempUnit());
    setSubTemp(tempUnit() === "fahrenheit" ? "68" : "20");
    setShowSubmitModal(true);
    queueMicrotask(() => submitDialog?.querySelector("#subType")?.focus());
  }

  function closeSubmitModal() {
    setShowSubmitModal(false);
    queueMicrotask(() => submitModalTrigger?.focus());
  }

  function handleSubmitDialogKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeSubmitModal();
      return;
    }
    if (event.key !== "Tab" || !submitDialog) return;

    const focusable = [...submitDialog.querySelectorAll(
      "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"
    )].filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true");
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function handleRecipeIssueSubmit(e) {
    e.preventDefault();
    const submission = {
      film: subFilm(),
      developer: subDeveloper(),
      dilution: subDilution(),
      ei: subEi(),
      format: subFormat(),
      time: subTime(),
      temperature: subTemp(),
      temperatureUnit: subTempUnit(),
      agitation: subAgitation(),
      notes: subNotes(),
      submissionType: subSubmissionType(),
      attribution: subAttribution(),
      sourceTitle: subSourceTitle(),
      sourceUrl: subUrl(),
      retrievedDate: subDate(),
      successfulTests: subSuccessfulTests(),
      certified: subCertified()
    };
    const error = validateRecipeSubmission(submission);
    if (error) {
      setSubmitError(error);
      return;
    }
    setSubmitError("");
    const issueUrl = buildRecipeIssueUrl(submission);
    window.open(issueUrl, "_blank", "noopener,noreferrer");
    closeSubmitModal();
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
                <li>Choose presoak, film, developer, dilution, and tank capacity to calculate your developer and water mix.</li>
                <li>Pick your recipe and processing stages. Choose a Custom option when you need a different stage time.</li>
                <li>Press <strong>Start Development Process</strong> and follow the VFD timer, agitation pips, and pour prompts between stages.</li>
              </ol>

              <details class="data-note">
                <summary>About these times</summary>
                <p>The local catalog contains manufacturer-published times and may include clearly labeled community reports. Each selected recipe shows its source, confidence, and agitation method. Always check the linked source and the current chemistry label before processing important negatives.</p>
                <ul>
                  <li><a href="https://www.kodakprofessional.com/sites/default/files/wysiwyg/pro/resources/edbwf_0.pdf" target="_blank" rel="noreferrer">Kodak black-and-white processing data (ED-BWF, March 2023)</a></li>
                  <li><a href="https://business.kodakmoments.com/sites/default/files/wysiwyg/pro/chemistry/j24.pdf" target="_blank" rel="noreferrer">Kodak HC-110 Developer technical data and dilutions (J-24)</a></li>
                  <li><a href="https://business.kodakmoments.com/sites/default/files/wysiwyg/pro/chemistry/j78.pdf" target="_blank" rel="noreferrer">Kodak D-76 Developer technical data and dilutions (J-78)</a></li>
                  <li><a href="https://business.kodakmoments.com/sites/default/files/wysiwyg/pro/chemistry/j109.pdf" target="_blank" rel="noreferrer">Kodak XTOL Developer technical data and dilutions (J-109)</a></li>
                  <li><a href="https://www.adox.de/adox-chemie/adox-filmentwickler/rodinal-adonal/" target="_blank" rel="noreferrer">ADOX Rodinal / Adonal product and dilution guide</a></li>
                  <li><a href="https://www.ilfordphoto.com/amfile/file/download/file/1919/product/689/" target="_blank" rel="noreferrer">Ilford FP4 Plus technical information</a></li>
                </ul>
              </details>
              <button ref={submitModalTrigger} class="contribution-button" type="button" onClick={openSubmitModal}>
                Submit a development time
              </button>
              <p class="safety-callout"><strong>Safety:</strong> The manufacturer label and safety data sheet control. Use appropriate protective equipment and ventilation, and follow local disposal rules.</p>

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
            </div>

            <form class="process-panel" onSubmit={startProcess}>
              {/* 01 Presoak */}
              <div class="stage-card">
                <div class="stage-row">
                  <span class="stage-label"><span class="stage-num">01</span> Presoak</span>
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
                  <select id="filmSelect" value={selectedFilmKey()} onChange={(e) => setSelectedFilmKey(e.currentTarget.value)} disabled={catalogMode() === "loading" || catalogMode() === "error"}>
                    <option value="">{catalogMode() === "loading" ? "Loading films..." : catalogMode() === "error" ? "Catalog unavailable" : films().length === 0 ? "No verified recipes available" : "Select film"}</option>
                    <For each={films()}>{(f) => <option value={f.key}>{f.fullName}</option>}</For>
                  </select>
                </div>
                <Show when={catalogMode() === "error"}>
                  <p class="catalog-error" role="alert">Could not load the recipe catalog. {catalogError()} <button type="button" onClick={() => window.location.reload()}>Reload</button></p>
                </Show>
              </div>

              {/* 03 Developer, Dilution & Recipe */}
              <div class="stage-card">
                <div class="stage-row">
                  <label class="stage-label" for="devSelect"><span class="stage-num">03</span> Developer</label>
                  <select id="devSelect" value={selectedDeveloper()} onChange={(e) => { setSelectedDeveloper(e.currentTarget.value); setSelectedDilution(""); setSelectedRecipeId(""); }} disabled={developers().length === 0 || loadingRecipes()}>
                    <option value="">{loadingRecipes() ? "Loading…" : "Select developer"}</option>
                    <For each={developers()}>{(d) => <option value={d}>{d}</option>}</For>
                  </select>
                </div>

                <div class="sub-fields">
                  <div class="sub-field">
                    <button class="hint-sub-button" type="button" onClick={() => setActiveHint("dilution")} title="How to read dilutions">Dilution</button>
                    <select id="dilSelect" aria-label="Dilution" value={selectedDilution()} onChange={(e) => { setSelectedDilution(e.currentTarget.value); setSelectedRecipeId(""); }} disabled={dilutions().length === 0}>
                      <option value="">Select dilution</option>
                      <For each={dilutions()}>{(d) => <option value={d}>{d}</option>}</For>
                    </select>
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

                  <div class="sub-field sub-field-full">
                    <label for="recipeSelect">Recipe Variant</label>
                    <select id="recipeSelect" value={selectedRecipeId()} onChange={(e) => setSelectedRecipeId(e.currentTarget.value)} disabled={variants().length === 0}>
                      <option value="">Select recipe</option>
                      <For each={variants()}>{(r) => <option value={String(r.id)}>{formatRecipeOption(r)}</option>}</For>
                    </select>
                  </div>

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

                  <Show when={selectedRecipe()}>
                    <div class="sub-field sub-field-full">
                      <label>Developer Time (mm : ss)</label>
                      <div class="inline-time">
                        <input type="number" min="1" max="120" value={devMinutes()} onInput={(e) => setDevMinutes(e.currentTarget.value)} aria-label="Developer minutes" />
                        <span>:</span>
                        <input type="number" min="0" max="59" value={devSeconds()} onInput={(e) => setDevSeconds(e.currentTarget.value)} aria-label="Developer seconds" />
                      </div>
                    </div>
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
                      <Show when={selectedRecipe()?.notes}><span>{selectedRecipe().notes}</span></Show>
                      <Show when={mix().reference}>
                        {(ref) => (
                          <a class="mix-ref-link" href={ref().url} target="_blank" rel="noreferrer">{ref().label}</a>
                        )}
                      </Show>
                    </div>
                  )}
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
                      <path d="M3 9v6h4l5 4V5L7 9H3Zm13.6 3 2.9 2.9-1.4 1.4L15.2 13.4l-2.9 2.9-1.4-1.4 2.9-2.9-2.9-2.9 1.4-1.4 2.9 2.9 2.9-2.9 1.4 1.4-2.9 2.9Z" />
                    </svg>
                  }
                >
                  <svg class="vcr-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 9v6h4l5 4V5L7 9H3Zm13.5 3a4.5 4.5 0 0 0-2.5-4.03v8.05A4.5 4.5 0 0 0 16.5 12ZM14 3.23v2.06a7 7 0 0 1 0 13.42v2.06a9 9 0 0 0 0-17.54Z" />
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
            <button class="primary-button primary-button-inline" type="button" onClick={resetProcess}>
              Develop another roll
            </button>
          </section>
        </Show>
      </main>

      <Show when={activeHint()}>
        <div
          class="crt-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="guide-title"
          onClick={(e) => { if (e.target === e.currentTarget) setActiveHint(null); }}
        >
          <div class="crt-dialog" ref={hintDialog}>
            <div class="crt-dialog-header">
              <h2 class="crt-dialog-title" id="guide-title">
                {activeHint() === "dilution" && "How to read dilutions"}
                {activeHint() === "tank" && "Tank types & capacities"}
                {activeHint() === "agitation" && "Agitation methods"}
                {activeHint() === "stop" && "Stop bath"}
                {activeHint() === "fixer" && "Fixer & clearing time"}
                {activeHint() === "hypo" && "Hypo-clear / wash aid"}
              </h2>
              <button class="crt-close" ref={hintCloseButton} type="button" aria-label="Close guide" onClick={() => setActiveHint(null)}>×</button>
            </div>
            <div class="crt-dialog-body">
              <Show when={activeHint() === "dilution"}>
                <p>Dilutions tell you how much developer concentrate to mix with water for a single tank:</p>
                <ul class="crt-list">
                  <li><strong><code>1+50</code> or <code>1:4</code></strong> : Mix <strong>1 part developer</strong> with <strong>50</strong> (or <strong>4</strong>) <strong>parts water</strong>. Higher second numbers mean more water and a weaker mix.</li>
                  <li><strong><code>Stock</code></strong> : Already at working strength. Use it straight from the bottle with <strong>no water added</strong>.</li>
                  <li><strong><code>B (1+31)</code></strong> : Kodak HC-110’s letter code paired with its exact concentrate-to-water ratio.</li>
                </ul>
                <div class="crt-examples">
                  <p class="crt-examples-label">Examples</p>
                  <p><code>1+50</code> in a 250 mL tank → <strong>4.9 mL</strong> developer + <strong>245.1 mL</strong> water</p>
                  <p><code>1+1</code> in a 500 mL tank → <strong>250 mL</strong> developer + <strong>250 mL</strong> water</p>
                  <p><code>Stock</code> in a 500 mL tank → <strong>500 mL</strong> stock developer (0 mL water)</p>
                </div>
              </Show>

              <Show when={activeHint() === "tank"}>
                <p>Pick a volume that completely covers your film reels. Common tank types and typical capacities:</p>
                <ul class="crt-list">
                  <li><strong>Stainless steel (Nikor, Hewes)</strong> : Compact metal tanks: <strong>250 mL</strong> (1× 35mm reel) or <strong>500 mL</strong> (2× 35mm or 1× 120 reel).</li>
                  <li><strong>Plastic daylight tanks (Paterson, AP)</strong> : Universal 2-reel tanks usually take <strong>300 mL</strong> (1× 35mm), <strong>500 mL</strong> (1× 120), or <strong>600 mL</strong> (2× 35mm). Larger 3-reel / Multi-reel tanks take up to <strong>1000 mL</strong>.</li>
                  <li><strong>Jobo 1500 / 2500 series</strong> : Inversion processing uses the full volume printed on the base (often <strong>485–1000 mL</strong>); rotary processing uses roughly half.</li>
                </ul>
                <div class="crt-examples">
                  <p class="crt-examples-label">Quick tip</p>
                  <p>Check the bottom of plastic tanks : most list the exact mL required per 35mm or 120 roll molded right into the base.</p>
                </div>
              </Show>

              <Show when={activeHint() === "agitation"}>
                <p>Agitation refreshes exhausted developer at the film’s surface. Invert the tank smoothly with a gentle wrist twist, then tap the base once or twice to dislodge air bubbles.</p>
                <ul class="crt-list">
                  <li><strong>60s + 10s / min (Default)</strong> : Continuous gentle agitation for the first minute, then 10 seconds (about 3–4 inversions) at the start of every minute.</li>
                  <li><strong>Ilford (10s / min)</strong> : 4 smooth inversions in the first 10 seconds, then 4 inversions during the first 10 seconds of each following minute.</li>
                  <li><strong>Kodak (30s + 5s / 30s)</strong> : 30 seconds initial agitation, followed by 5 seconds (5–7 inversions) every 30 seconds.</li>
                  <li><strong>Rodinal (10s / min)</strong> : Agitate for 10 seconds, then allow 50 seconds of rest per minute.</li>
                  <li><strong>Stand (60s initial only)</strong> : 60 seconds initial agitation, then let the tank sit undisturbed for high-acutance, compensating development (often 45–60 min).</li>
                </ul>
                <div class="crt-examples">
                  <p class="crt-examples-label">Official documentation</p>
                  <p><a href="https://www.kodakprofessional.com/sites/default/files/wysiwyg/pro/resources/edbwf_0.pdf" target="_blank" rel="noreferrer">Kodak Processing Black-and-White Films (ED-BWF)</a></p>
                  <p><a href="https://www.ilfordphoto.com/amfile/file/download/file/1919/product/689/" target="_blank" rel="noreferrer">Ilford Film Processing Technical Information</a></p>
                  <p><a href="https://www.adox.de/adox-chemie/adox-filmentwickler/rodinal-adonal/" target="_blank" rel="noreferrer">ADOX Rodinal / Adonal Instructions</a></p>
                </div>
              </Show>

              <Show when={activeHint() === "stop"}>
                <p>Stop bath immediately halts development by neutralizing alkaline developer carried over on the film, and extends the life of acid fixers.</p>
                <ul class="crt-list">
                  <li><strong>Acid indicator stop</strong> : Ilfostop is listed at 10 seconds here; Kodak Indicator Stop Bath is listed at 30 seconds. Use the current label for your product.</li>
                  <li><strong>Water rinse</strong> : Two 30-second fills with tempered water. Recommended when using alkaline fixers like <strong>TF-4</strong> or staining developers.</li>
                </ul>
                <div class="crt-examples">
                  <p class="crt-examples-label">Official references</p>
                  <p><a href="https://www.ilfordphoto.com/ilfostop/" target="_blank" rel="noreferrer">Ilford Ilfostop Product &amp; Technical Information</a></p>
                  <p><a href="https://business.kodakmoments.com/sites/default/files/wysiwyg/pro/chemistry/e103cf.pdf" target="_blank" rel="noreferrer">Kodak Chemicals for Black-and-White Films (E-103CF)</a></p>
                  <p><a href="https://www.kodakprofessional.com/sites/default/files/wysiwyg/pro/resources/edbwf_0.pdf" target="_blank" rel="noreferrer">Kodak Processing Black-and-White Films (ED-BWF)</a></p>
                </div>
              </Show>

              <Show when={activeHint() === "fixer"}>
                <p>Fixer dissolves unexposed silver halides so negatives become permanent and light-safe. Under-fixed film looks milky or purple and will fog over time.</p>
                <ul class="crt-list">
                  <li><strong>Rapid fixers</strong> : Times vary by product, film, dilution, and fixer condition. T-grain films may need longer. Follow the current label and use a clearing test where the manufacturer recommends one.</li>
                  <li><strong>Conventional powder fixer</strong> : Sodium thiosulfate takes longer (typically <strong>5–10 min</strong>).</li>
                  <li><strong>Clip test (2× rule)</strong> : Drop a scrap film leader into your working fixer in room light, time how long it takes to turn completely clear, then fix for <strong>twice that time</strong>.</li>
                </ul>
                <div class="crt-examples">
                  <p class="crt-examples-label">Official references</p>
                  <p><a href="https://www.ilfordphoto.com/rapid-fixer/" target="_blank" rel="noreferrer">Ilford Rapid Fixer Product &amp; Technical Information</a></p>
                  <p><a href="https://business.kodakmoments.com/sites/default/files/wysiwyg/pro/chemistry/e103cf.pdf" target="_blank" rel="noreferrer">Kodak Fixer and Rapid Fixer Reference (E-103CF)</a></p>
                  <p><a href="https://www.freestylephoto.com/static/pdf/pages/product_pdfs/formulary/FormularyTF4Fixer03-0141-1.pdf" target="_blank" rel="noreferrer">Photographers' Formulary TF-4 instructions</a></p>
                </div>
              </Show>

              <Show when={activeHint() === "hypo"}>
                <p>Hypo-clearing agents (wash aids) neutralize residual thiosulfate from acid fixers so it rinses out of the film emulsion much faster with less water.</p>
                <ul class="crt-list">
                  <li><strong>When to use it</strong> : After acid fixers (Ilford Rapid, Kodak Rapid, Kodak Powder) to cut archival wash times from 15–30 minutes down to ~5 minutes.</li>
                  <li><strong>When to skip it</strong> : Optional for 35mm/120 film if you use the Ilford 5-10-20 archival wash method, and <strong>not needed</strong> with alkaline fixers like TF-4.</li>
                </ul>
                <div class="crt-examples">
                  <p class="crt-examples-label">Official references</p>
                  <p><a href="https://business.kodakmoments.com/sites/default/files/wysiwyg/pro/chemistry/e103cf.pdf" target="_blank" rel="noreferrer">Kodak Hypo Clearing Agent Reference (E-103CF)</a></p>
                  <p><a href="https://www.ilfordphoto.com/washaid/" target="_blank" rel="noreferrer">Ilford Washaid Product &amp; Technical Information</a></p>
                </div>
              </Show>
            </div>
          </div>
        </div>
      </Show>

      <Show when={showSubmitModal()}>
        <div
          class="crt-backdrop"
          onClick={(event) => { if (event.target === event.currentTarget) closeSubmitModal(); }}
        >
          <div
            ref={submitDialog}
            class="crt-dialog crt-dialog-wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="submit-recipe-title"
            aria-describedby="submit-recipe-description"
            tabIndex="-1"
            onKeyDown={handleSubmitDialogKeyDown}
          >
            <div class="crt-dialog-header">
              <h2 class="crt-dialog-title" id="submit-recipe-title">Submit custom development time</h2>
              <button class="crt-close" type="button" aria-label="Close submission form" onClick={closeSubmitModal}>×</button>
            </div>
            <form class="crt-dialog-body submit-form" onSubmit={handleRecipeIssueSubmit}>
              <p class="submit-intro" id="submit-recipe-description">
                Discord can be used to collect the details and permission. This form creates the public GitHub record required by{" "}
                <a href="https://github.com/mjdelro/darktimer-app/blob/main/CONTRIBUTING.md" target="_blank" rel="noreferrer">CONTRIBUTING.md</a>.
              </p>
              <p class="submit-privacy"><strong>Public record:</strong> Do not paste private Discord messages, screenshots, email addresses, or private message URLs. Use the contributor's chosen credit, including “Anonymous” if requested.</p>

              <div class="submit-grid">
                <div class="sub-field sub-field-full">
                  <label for="subType">Source type *</label>
                  <select
                    id="subType"
                    value={subSubmissionType()}
                    onChange={(event) => {
                      const nextType = event.currentTarget.value;
                      setSubSubmissionType(nextType);
                      setSubSourceTitle(nextType === "community-test" ? "Personal darkroom test log" : "");
                      setSubUrl("");
                    }}
                  >
                    <For each={SUBMISSION_TYPES}>{(option) => <option value={option.value}>{option.label}</option>}</For>
                  </select>
                </div>
                <div class="sub-field">
                  <label for="subFilm">Film stock *</label>
                  <input id="subFilm" type="text" required placeholder="Kodak TRI-X 400" value={subFilm()} onInput={(e) => setSubFilm(e.currentTarget.value)} />
                </div>
                <div class="sub-field">
                  <label for="subDev">Developer *</label>
                  <input id="subDev" type="text" required placeholder="Kodak D-76" value={subDeveloper()} onInput={(e) => setSubDeveloper(e.currentTarget.value)} />
                </div>
                <div class="sub-field">
                  <label for="subDil">Dilution *</label>
                  <input id="subDil" type="text" required placeholder="Stock, 1+1, B (1+31)" value={subDilution()} onInput={(e) => setSubDilution(e.currentTarget.value)} />
                </div>
                <div class="sub-field">
                  <label for="subEi">EI (ISO) *</label>
                  <input id="subEi" type="number" min="1" max="102400" required value={subEi()} onInput={(e) => setSubEi(e.currentTarget.value)} />
                </div>
                <div class="sub-field">
                  <label for="subFormat">Format *</label>
                  <select id="subFormat" value={subFormat()} onChange={(e) => setSubFormat(e.currentTarget.value)}>
                    <option value="135">35mm</option>
                    <option value="120">120</option>
                    <option value="sheet">Sheet</option>
                    <option value="any">Any format</option>
                  </select>
                </div>
                <div class="sub-field">
                  <label for="subTime">Time (mm:ss) *</label>
                  <input id="subTime" type="text" required pattern="\d{1,3}:[0-5]\d" placeholder="07:30" value={subTime()} onInput={(e) => setSubTime(e.currentTarget.value)} />
                </div>
                <div class="sub-field">
                  <label for="subTemp">Temperature *</label>
                  <div class="submit-temp-row">
                    <input id="subTemp" type="number" step="0.1" required value={subTemp()} onInput={(e) => setSubTemp(e.currentTarget.value)} />
                    <select aria-label="Temperature unit" value={subTempUnit()} onChange={(e) => setSubTempUnit(e.currentTarget.value)}>
                      <option value="celsius">°C</option>
                      <option value="fahrenheit">°F</option>
                    </select>
                  </div>
                </div>
                <div class="sub-field">
                  <label for="subAgitation">Agitation method *</label>
                  <select id="subAgitation" value={subAgitation()} onChange={(e) => setSubAgitation(e.currentTarget.value)}>
                    <For each={AGITATION_SUBMISSION_OPTIONS}>{(option) => <option value={option.value}>{option.label}</option>}</For>
                  </select>
                </div>
                <div class="sub-field sub-field-full">
                  <label for="subNotes">Process notes or limits (optional, factual only)</label>
                  <textarea id="subNotes" rows="3" placeholder="Small tank only; not recommended for rotary" value={subNotes()} onInput={(e) => setSubNotes(e.currentTarget.value)} />
                </div>

                <div class="sub-field">
                  <label for="subDate">Retrieval / Test date *</label>
                  <input id="subDate" type="date" required value={subDate()} onInput={(e) => setSubDate(e.currentTarget.value)} />
                </div>
                <Show when={subSubmissionType() === "community-test"}>
                  <div class="sub-field">
                    <label for="subSuccessfulTests">Successful tests *</label>
                    <input id="subSuccessfulTests" type="number" min="1" step="1" required value={subSuccessfulTests()} onInput={(e) => setSubSuccessfulTests(e.currentTarget.value)} />
                  </div>
                </Show>
                <div class="sub-field">
                  <label for="subAttribution">{subSubmissionType() === "community-test" ? "Contributor credit" : "Publisher"} *</label>
                  <input id="subAttribution" type="text" required placeholder={subSubmissionType() === "community-test" ? "Name, Discord handle, or Anonymous" : "Kodak, Ilford Photo, ADOX"} value={subAttribution()} onInput={(e) => setSubAttribution(e.currentTarget.value)} />
                </div>
                <div class="sub-field">
                  <label for="subTitle">Source title *</label>
                  <input id="subTitle" type="text" required placeholder={subSubmissionType() === "community-test" ? "Personal darkroom test log" : "Technical publication title"} value={subSourceTitle()} onInput={(e) => setSubSourceTitle(e.currentTarget.value)} />
                </div>
                <div class="sub-field sub-field-full">
                  <label for="subUrl">{subSubmissionType() === "community-test" ? "Optional public supporting URL" : "Manufacturer publication URL"}{subSubmissionType() === "manufacturer-publication" ? " *" : ""}</label>
                  <input id="subUrl" type="url" required={subSubmissionType() === "manufacturer-publication"} placeholder="https://..." value={subUrl()} onInput={(e) => setSubUrl(e.currentTarget.value)} />
                </div>
              </div>

              <label class="submit-cert">
                <input type="checkbox" checked={subCertified()} onChange={(e) => setSubCertified(e.currentTarget.checked)} required />
                <span>I confirm this comes from my own testing or the named manufacturer publication, not a third-party database or copied user notes. If I am submitting another person's test, I have their written permission. I intentionally submit these factual values and my original notes for inclusion under Apache-2.0.</span>
              </label>

              <Show when={submitError()}>
                <p class="submit-error" id="submit-recipe-error" role="alert">{submitError()}</p>
              </Show>

              <button class="primary-button" type="submit">
                Open draft GitHub issue
              </button>
            </form>
          </div>
        </div>
      </Show>

      <footer>
        <div class="footer-notes">
          <p class="privacy-note">Recipe selections stay in your browser and are not sent to a darkTimer data server. The static hosting provider may still receive normal web requests.</p>
          <p class="disclaimer-note">Times are starting points, not guarantees. The manufacturer label and safety data sheet control. darkTimer is independent and is not affiliated with or endorsed by the named manufacturers.</p>
        </div>
        <div class="footer-links">
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
