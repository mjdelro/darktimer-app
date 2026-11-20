import { createEffect, createMemo, createSignal, For, onCleanup, Show } from "solid-js";

export default function SearchCombobox(props) {
  const [query, setQuery] = createSignal("");
  const [isOpen, setIsOpen] = createSignal(false);
  const [activeIndex, setActiveIndex] = createSignal(0);

  let containerRef;
  let inputRef;
  let listRef;

  const listboxId = `${props.id}-listbox`;

  // Sync displayed text whenever the external selected value changes
  createEffect(() => {
    const label = props.selectedLabel || "";
    if (!isOpen()) {
      setQuery(label);
    }
  });

  const indexedOptions = createMemo(() =>
    (props.options || []).map((opt) => ({
      ...opt,
      lower: opt.label.toLowerCase()
    }))
  );

  const filteredOptions = createMemo(() => {
    const options = indexedOptions();
    const q = query().trim().toLowerCase();
    if (!q) return options;

    const startsWith = [];
    const includes = [];
    for (const opt of options) {
      if (opt.lower.startsWith(q)) startsWith.push(opt);
      else if (opt.lower.includes(q)) includes.push(opt);
    }
    return [...startsWith, ...includes];
  });

  const exactMatch = createMemo(() => {
    const q = query().trim().toLowerCase();
    if (!q) return null;
    return indexedOptions().find((opt) => opt.lower === q) || null;
  });

  const displayItems = createMemo(() => {
    const list = filteredOptions();
    const trimmed = query().trim();
    if (props.allowCustom && trimmed && !exactMatch()) {
      return [
        ...list,
        {
          key: "__custom_entry__",
          label: trimmed,
          isCustomEntry: true,
          badge: "Custom"
        }
      ];
    }
    return list;
  });

  createEffect(() => {
    const items = displayItems();
    if (activeIndex() >= items.length) {
      setActiveIndex(items.length > 0 ? 0 : -1);
    }
  });

  function scrollActiveIntoView(index) {
    if (!listRef || index < 0) return;
    const el = listRef.querySelector(`[data-option-index="${index}"]`);
    el?.scrollIntoView?.({ block: "nearest" });
  }

  function selectItem(item) {
    if (!item) return;
    if (item.isCustomEntry) {
      props.onSelectCustom?.(item.label);
      setQuery(item.label);
    } else {
      props.onSelect?.(item.key);
      setQuery(item.label);
    }
    setIsOpen(false);
    setActiveIndex(0);
  }

  function clearSelection() {
    setQuery("");
    props.onClear?.();
    setIsOpen(true);
    setActiveIndex(0);
    inputRef?.focus();
  }

  function handleInput(event) {
    const val = event.currentTarget.value;
    setQuery(val);
    setIsOpen(true);
    setActiveIndex(0);
    if (!val.trim()) {
      props.onClear?.();
    }
  }

  function handleKeyDown(event) {
    if (props.disabled) return;
    const items = displayItems();

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!isOpen()) {
        setIsOpen(true);
        setActiveIndex(0);
      } else if (items.length > 0) {
        const next = (activeIndex() + 1) % items.length;
        setActiveIndex(next);
        scrollActiveIntoView(next);
      }
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!isOpen()) {
        setIsOpen(true);
        setActiveIndex(Math.max(0, items.length - 1));
      } else if (items.length > 0) {
        const prev = (activeIndex() - 1 + items.length) % items.length;
        setActiveIndex(prev);
        scrollActiveIntoView(prev);
      }
      return;
    }

    if (event.key === "Home" && isOpen() && items.length > 0) {
      event.preventDefault();
      setActiveIndex(0);
      scrollActiveIntoView(0);
      return;
    }

    if (event.key === "End" && isOpen() && items.length > 0) {
      event.preventDefault();
      const last = items.length - 1;
      setActiveIndex(last);
      scrollActiveIntoView(last);
      return;
    }

    if (event.key === "Enter") {
      if (isOpen() && items.length > 0 && activeIndex() >= 0) {
        event.preventDefault();
        selectItem(items[activeIndex()]);
      }
      return;
    }

    if (event.key === "Escape") {
      if (isOpen()) {
        event.preventDefault();
        setIsOpen(false);
        setQuery(props.selectedLabel || "");
      }
    }
  }

  function commitAndClose() {
    if (!isOpen()) return;
    setIsOpen(false);
    const trimmed = query().trim();
    if (!trimmed) {
      props.onClear?.();
      setQuery("");
      return;
    }
    const exact = exactMatch();
    if (exact) {
      props.onSelect?.(exact.key);
      setQuery(exact.label);
    } else if (props.allowCustom) {
      props.onSelectCustom?.(trimmed);
      setQuery(trimmed);
    } else {
      setQuery(props.selectedLabel || "");
    }
  }

  function handleFocusOut(event) {
    if (containerRef && containerRef.contains(event.relatedTarget)) return;
    commitAndClose();
  }

  // Close when clicking outside
  createEffect(() => {
    if (!isOpen()) return;
    const handleOutside = (event) => {
      if (containerRef && !containerRef.contains(event.target)) {
        commitAndClose();
      }
    };
    document.addEventListener("pointerdown", handleOutside);
    onCleanup(() => document.removeEventListener("pointerdown", handleOutside));
  });

  const activeOptionId = createMemo(() => {
    if (!isOpen() || activeIndex() < 0 || displayItems().length === 0) return undefined;
    return `${props.id}-opt-${activeIndex()}`;
  });

  return (
    <div
      class="combobox"
      classList={{ "is-open": isOpen(), "is-disabled": Boolean(props.disabled) }}
      ref={containerRef}
      onFocusOut={handleFocusOut}
    >
      <div class="combobox-input-wrap">
        <input
          ref={inputRef}
          id={props.id}
          type="text"
          role="combobox"
          autocomplete="off"
          spellcheck={false}
          aria-autocomplete="list"
          aria-expanded={isOpen()}
          aria-controls={listboxId}
          aria-activedescendant={activeOptionId()}
          disabled={props.disabled}
          placeholder={props.placeholder}
          value={query()}
          onInput={handleInput}
          onFocus={() => {
            if (!props.disabled) {
              setIsOpen(true);
              setActiveIndex(0);
            }
          }}
          onKeyDown={handleKeyDown}
        />
        <Show when={!props.disabled && query()}>
          <button
            type="button"
            class="combobox-clear"
            tabIndex="-1"
            aria-label={props.clearLabel || "Clear"}
            onMouseDown={(e) => e.preventDefault()}
            onClick={clearSelection}
          >
            ×
          </button>
        </Show>
        <button
          type="button"
          class="combobox-toggle"
          tabIndex="-1"
          disabled={props.disabled}
          aria-label={isOpen() ? "Close options" : "Show options"}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (props.disabled) return;
            const next = !isOpen();
            setIsOpen(next);
            if (next) {
              setActiveIndex(0);
              inputRef?.focus();
            }
          }}
        >
          ▾
        </button>
      </div>

      <span class="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {isOpen() ? `${displayItems().length} ${displayItems().length === 1 ? "option" : "options"} available.` : ""}
      </span>

      <Show when={isOpen() && !props.disabled}>
        <ul
          ref={listRef}
          id={listboxId}
          class="combobox-listbox"
          role="listbox"
          aria-label={props.listboxLabel || props.placeholder}
        >
          <Show
            when={displayItems().length > 0}
            fallback={<li class="combobox-empty" role="option" aria-disabled="true">No matches found</li>}
          >
            <For each={displayItems()}>
              {(item, idx) => (
                <li
                  id={`${props.id}-opt-${idx()}`}
                  data-option-index={idx()}
                  role="option"
                  aria-selected={props.selectedKey === item.key}
                  class="combobox-option"
                  classList={{
                    "is-active": idx() === activeIndex(),
                    "is-selected": props.selectedKey === item.key,
                    "is-custom": Boolean(item.isCustomEntry)
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectItem(item);
                  }}
                  onMouseEnter={() => setActiveIndex(idx())}
                >
                  <span class="combobox-option-label">
                    {item.isCustomEntry ? `Use custom: "${item.label}"` : item.label}
                  </span>
                  <span class="combobox-option-meta">
                    <Show when={item.meta}>
                      <span class="combobox-meta-text">{item.meta}</span>
                    </Show>
                    <Show when={item.badge}>
                      <span class="combobox-badge" classList={{ "is-verified": item.badge === "Verified" }}>
                        {item.badge}
                      </span>
                    </Show>
                  </span>
                </li>
              )}
            </For>
          </Show>
        </ul>
      </Show>
    </div>
  );
}
