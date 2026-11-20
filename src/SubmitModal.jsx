import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import { trapDialogFocus } from "./dialog.js";
import {
  AGITATION_SUBMISSION_OPTIONS,
  buildRecipeIssueUrl,
  validateRecipeSubmission
} from "./submission.js";

const FORMAT_NAMES = { any: "Any format", "135": "35mm", "120": "120", sheet: "Sheet" };

function localDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function SubmitModal(props) {
  const [submitError, setSubmitError] = createSignal("");
  const [attribution, setAttribution] = createSignal("");
  const [sourceUrl, setSourceUrl] = createSignal("");
  const [notes, setNotes] = createSignal("");
  const [certified, setCertified] = createSignal(false);
  const retrievedDate = localDateValue();
  let submitDialog;

  createEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    queueMicrotask(() => submitDialog?.querySelector("#subAttribution")?.focus());
    onCleanup(() => { document.body.style.overflow = previousOverflow; });
  });

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      props.onClose();
      return;
    }
    trapDialogFocus(event, submitDialog);
  }

  function handleSubmit(e) {
    e.preventDefault();
    const submission = {
      film: props.recipe.film,
      developer: props.recipe.developer,
      dilution: props.recipe.dilution,
      ei: String(props.recipe.ei || 400),
      format: props.recipe.format || "135",
      time: props.timeDisplay,
      temperature: props.tempDisplay,
      temperatureUnit: props.tempUnit,
      agitation: props.recipe.agitation || "standard",
      notes: notes(),
      submissionType: "community-test",
      attribution: attribution(),
      sourceTitle: "Personal darkroom test log",
      sourceUrl: sourceUrl(),
      retrievedDate,
      certified: certified()
    };
    const error = validateRecipeSubmission(submission);
    if (error) {
      setSubmitError(error);
      return;
    }
    setSubmitError("");
    const issueUrl = buildRecipeIssueUrl(submission);
    window.open(issueUrl, "_blank", "noopener,noreferrer");
    props.onClose();
  }

  return (
    <div
      class="crt-backdrop"
      onClick={(event) => { if (event.target === event.currentTarget) props.onClose(); }}
    >
      <div
        ref={submitDialog}
        class="crt-dialog crt-dialog-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="submit-recipe-title"
        aria-describedby="submit-recipe-description"
        tabIndex="-1"
        onKeyDown={handleKeyDown}
      >
        <div class="crt-dialog-header">
          <h2 class="crt-dialog-title" id="submit-recipe-title">Submit this custom recipe</h2>
          <button class="crt-close" type="button" aria-label="Close submission form" onClick={props.onClose}>×</button>
        </div>
        <form class="crt-dialog-body submit-form" onSubmit={handleSubmit}>
          <p class="submit-privacy" id="submit-recipe-description"><strong>Public record:</strong> Do not paste private Discord messages, screenshots, email addresses, or private message URLs. Use the contributor's chosen credit, including “Anonymous” if requested.</p>

          <dl class="submit-recipe-review" aria-label="Completed custom recipe">
            <div><dt>Film</dt><dd>{props.recipe.film}</dd></div>
            <div><dt>Developer</dt><dd>{props.recipe.developer}</dd></div>
            <div><dt>Dilution</dt><dd>{props.recipe.dilution}</dd></div>
            <div><dt>Time</dt><dd>{props.timeDisplay}</dd></div>
            <div><dt>Temperature</dt><dd>{props.tempDisplay}{props.tempUnit === "fahrenheit" ? "°F" : "°C"}</dd></div>
            <div><dt>EI / Format</dt><dd>EI {props.recipe.ei || 400} · {FORMAT_NAMES[props.recipe.format] || props.recipe.format || "35mm"}</dd></div>
            <div><dt>Submitted</dt><dd>{retrievedDate}</dd></div>
            <div class="submit-review-full"><dt>Agitation</dt><dd>{AGITATION_SUBMISSION_OPTIONS.find((option) => option.value === props.recipe.agitation)?.label || props.recipe.agitation}</dd></div>
          </dl>

          <div class="submit-grid submit-grid-compact">
            <div class="sub-field">
              <label for="subAttribution">Contributor credit *</label>
              <input id="subAttribution" type="text" required placeholder="Name, handle, or Anonymous" value={attribution()} onInput={(e) => setAttribution(e.currentTarget.value)} />
            </div>
            <div class="sub-field">
              <label for="subUrl">Optional public supporting URL</label>
              <input id="subUrl" type="url" placeholder="https://..." value={sourceUrl()} onInput={(e) => setSourceUrl(e.currentTarget.value)} />
            </div>
            <div class="sub-field sub-field-full">
              <label for="subNotes">Process notes or limits (optional)</label>
              <textarea id="subNotes" rows="3" placeholder="Anything needed to reproduce the result" value={notes()} onInput={(e) => setNotes(e.currentTarget.value)} />
            </div>
          </div>

          <label class="submit-cert">
            <input type="checkbox" checked={certified()} onChange={(e) => setCertified(e.currentTarget.checked)} required />
            <span>
              I confirm this recipe comes from my own testing or I have the tester's written permission. It was not copied from a third-party database or user notes. I intentionally submit these factual values and my original notes for inclusion under{" "}
              <a
                href="https://github.com/mjdelro/darktimer-app/blob/main/LICENSE"
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                Apache-2.0
              </a>.
            </span>
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
  );
}
