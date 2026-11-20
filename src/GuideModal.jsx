import { createEffect, onCleanup, Show } from "solid-js";
import { trapDialogFocus } from "./dialog.js";

const GUIDE_TITLES = {
  presoak: "Presoak (pre-wet)",
  dilution: "How to read dilutions",
  tank: "Tank types & capacities",
  agitation: "Agitation methods",
  stop: "Stop bath",
  fixer: "Fixer & clearing time",
  hypo: "Hypo-clear / wash aid"
};

export default function GuideModal(props) {
  let hintDialog;
  let hintCloseButton;

  createEffect(() => {
    if (!props.activeHint) return;
    const previouslyFocused = document.activeElement;
    const handleModalKeys = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        props.onClose();
        return;
      }
      trapDialogFocus(event, hintDialog);
    };
    document.addEventListener("keydown", handleModalKeys);
    window.queueMicrotask(() => hintCloseButton?.focus());
    onCleanup(() => {
      document.removeEventListener("keydown", handleModalKeys);
      previouslyFocused?.focus?.();
    });
  });

  return (
    <div
      class="crt-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guide-title"
      onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}
    >
      <div class="crt-dialog" ref={hintDialog}>
        <div class="crt-dialog-header">
          <h2 class="crt-dialog-title" id="guide-title">{GUIDE_TITLES[props.activeHint] || ""}</h2>
          <button class="crt-close" ref={hintCloseButton} type="button" aria-label="Close guide" onClick={props.onClose}>×</button>
        </div>
        <div class="crt-dialog-body">
          <Show when={props.activeHint === "presoak"}>
            <p>A presoak (pre-wet) fills the tank with plain water at development temperature before pouring in developer. It brings the tank and reels to temperature, softens the gelatin emulsion, and rinses out water-soluble anti-halation dyes.</p>
            <ul class="crt-list">
              <li><strong>Agitated (1–2 min)</strong> : Gentle continuous agitation to wet the film evenly and wash away strong anti-halation dyes (common on 120, sheet film, and Foma stocks).</li>
              <li><strong>Stand (5–15 min)</strong> : Swirl gently for 10 seconds to dislodge air bubbles, then let the tank sit still before draining thoroughly.</li>
              <li><strong>When to skip it</strong> : <strong>Ilford</strong> specifically recommends <em>against</em> presoaking their films, as their emulsions include wetting agents and a presoak can cause uneven development. <strong>Kodak</strong> also does not require a presoak for standard small-tank processing.</li>
            </ul>
            <div class="crt-examples">
              <p class="crt-examples-label">Official references</p>
              <p><a href="https://www.ilfordphoto.com/amfile/file/download/file/1919/product/689/" target="_blank" rel="noreferrer">Ilford Film Processing Technical Information</a></p>
              <p><a href="https://www.kodakprofessional.com/sites/default/files/wysiwyg/pro/resources/edbwf_0.pdf" target="_blank" rel="noreferrer">Kodak Processing Black-and-White Films (ED-BWF)</a></p>
            </div>
          </Show>

          <Show when={props.activeHint === "dilution"}>
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

          <Show when={props.activeHint === "tank"}>
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

          <Show when={props.activeHint === "agitation"}>
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

          <Show when={props.activeHint === "stop"}>
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

          <Show when={props.activeHint === "fixer"}>
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

          <Show when={props.activeHint === "hypo"}>
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
  );
}
