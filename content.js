(() => {
  if (document.getElementById("litcode-premium-root")) return;

  const WINDOW_LABELS = {
    all: "All time",
    "30d": "30 days",
    "3m": "3 months",
    "6m": "6 months",
    older: "Older",
  };
  const WINDOW_FILES = {
    all: "5. All.csv",
    "30d": "1. Thirty Days.csv",
    "3m": "2. Three Months.csv",
    "6m": "3. Six Months.csv",
    older: "4. More Than Six Months.csv",
  };
  const WINDOW_ORDER = ["all", "30d", "3m", "6m", "older"];
  const ICON = {
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 10 4 4 4-4"/></svg>',
    external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 5h6v6M19 5l-9 9"/><path d="M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>',
  };
  const state = { slug: null, question: null, meta: null, open: false, window: "all", search: "", error: null, loading: false };
  const host = document.createElement("div");
  host.id = "litcode-premium-root";
  document.documentElement.append(host);
  const shadow = host.attachShadow({ mode: "open" });
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = chrome.runtime.getURL("content.css");
  shadow.append(stylesheet);
  const shell = document.createElement("div");
  shell.className = "litcode-shell";
  shell.innerHTML = `
    <button class="litcode-launcher" type="button" aria-expanded="false" aria-controls="litcode-panel">
      <span class="litcode-mark" aria-hidden="true">L</span>
      <span class="litcode-launcher-text">Companies</span>
      <span class="litcode-launcher-count">…</span>
    </button>
    <section id="litcode-panel" class="litcode-panel" aria-label="Litcode company data" hidden>
      <header class="litcode-header">
        <div class="litcode-brand"><span class="litcode-mark" aria-hidden="true">L</span><span>Litcode Premium</span></div>
        <button class="litcode-icon-button litcode-close" type="button" aria-label="Close panel">${ICON.close}</button>
      </header>
      <div class="litcode-content">
        <div class="litcode-question"></div>
        <div class="litcode-controls" hidden>
          <div class="litcode-window-tabs" role="group" aria-label="Question time window"></div>
          <label class="litcode-search-label" for="litcode-company-search">Find a company</label>
          <input id="litcode-company-search" class="litcode-search" type="search" placeholder="Search companies" autocomplete="off" />
          <div class="litcode-result-count" aria-live="polite"></div>
        </div>
        <div class="litcode-company-list"></div>
      </div>
      <footer class="litcode-footer"><a class="litcode-source" target="_blank" rel="noopener noreferrer">Source repository ${ICON.external}</a><span class="litcode-snapshot"></span></footer>
    </section>`;
  shadow.append(shell);

  const launcher = shadow.querySelector(".litcode-launcher");
  const panel = shadow.querySelector(".litcode-panel");
  const close = shadow.querySelector(".litcode-close");
  const questionView = shadow.querySelector(".litcode-question");
  const controls = shadow.querySelector(".litcode-controls");
  const tabs = shadow.querySelector(".litcode-window-tabs");
  const search = shadow.querySelector(".litcode-search");
  const countView = shadow.querySelector(".litcode-result-count");
  const list = shadow.querySelector(".litcode-company-list");
  const source = shadow.querySelector(".litcode-source");
  const snapshot = shadow.querySelector(".litcode-snapshot");

  function textElement(tag, className, value) {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = value;
    return element;
  }

  function slugFromUrl() {
    const match = location.pathname.match(/^\/problems\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:\/|$)/);
    return match?.[1] || null;
  }

  function setOpen(open) {
    state.open = open;
    panel.hidden = !open;
    launcher.hidden = open;
    launcher.setAttribute("aria-expanded", String(open));
    if (open) search.focus({ preventScroll: true });
    else launcher.focus({ preventScroll: true });
  }

  function formatFrequency(value) {
    return typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(1)}%` : "—";
  }

  function sourceFile(company, window) {
    const base = state.meta?.source || "https://github.com/liquidslr/leetcode-company-wise-problems";
    const revision = state.meta?.revision || "main";
    return `${base}/blob/${encodeURIComponent(revision)}/${encodeURIComponent(company)}/${encodeURIComponent(WINDOW_FILES[window])}`;
  }

  function renderQuestion() {
    questionView.replaceChildren();
    controls.hidden = !state.question;
    if (state.loading) {
      questionView.append(textElement("p", "litcode-status", "Loading company data…"));
      return;
    }
    if (state.error) {
      questionView.append(textElement("p", "litcode-status litcode-error", state.error));
      const retry = textElement("button", "litcode-retry", "Retry lookup");
      retry.type = "button";
      retry.addEventListener("click", () => lookup(state.slug));
      questionView.append(retry);
      return;
    }
    if (!state.question) {
      questionView.append(textElement("h2", "litcode-title", "No company data found"));
      questionView.append(textElement("p", "litcode-status", "This problem is not in the current repository snapshot."));
      return;
    }
    const question = state.question;
    questionView.append(textElement("h2", "litcode-title", question.title));
    const facts = textElement("div", "litcode-facts", "");
    facts.append(textElement("span", `litcode-difficulty litcode-${question.difficulty.toLowerCase()}`, question.difficulty));
    if (typeof question.acceptanceRate === "number") facts.append(textElement("span", "", `${question.acceptanceRate.toFixed(1)}% acceptance`));
    questionView.append(facts);
    if (question.topics.length) {
      const topics = textElement("div", "litcode-topics", "");
      question.topics.forEach(topic => topics.append(textElement("span", "litcode-topic", topic)));
      questionView.append(topics);
    }
  }

  function renderTabs() {
    tabs.replaceChildren();
    for (const window of WINDOW_ORDER) {
      const button = textElement("button", `litcode-tab${state.window === window ? " is-active" : ""}`, window === "all" ? "All companies" : WINDOW_LABELS[window]);
      button.type = "button";
      button.setAttribute("aria-pressed", String(state.window === window));
      button.addEventListener("click", () => {
        state.window = window;
        renderTabs();
        renderCompanies();
      });
      tabs.append(button);
    }
  }

  function renderCompanies() {
    list.replaceChildren();
    if (!state.question) {
      countView.textContent = "";
      return;
    }
    const query = state.search.trim().toLocaleLowerCase();
    const matches = state.question.companies
      .filter(company => (state.window === "all" || company.windows[state.window] !== undefined) && company.name.toLocaleLowerCase().includes(query))
      .sort((a, b) => (b.windows[state.window] ?? -1) - (a.windows[state.window] ?? -1) || a.name.localeCompare(b.name));
    countView.textContent = `${matches.length} ${matches.length === 1 ? "company" : "companies"} · ${state.window === "all" ? "all-time" : WINDOW_LABELS[state.window]} frequency score`;
    if (!matches.length) {
      list.append(textElement("p", "litcode-empty", query ? "No companies match your search in this time window." : "No companies listed in this time window."));
      return;
    }
    const fragment = document.createDocumentFragment();
    for (const company of matches) {
      const details = document.createElement("details");
      details.className = "litcode-company";
      const summary = document.createElement("summary");
      summary.append(textElement("span", "litcode-company-name", company.name));
      summary.append(textElement("span", "litcode-company-frequency", formatFrequency(company.windows[state.window])));
      const chevron = textElement("span", "litcode-chevron", "");
      chevron.innerHTML = ICON.chevron;
      summary.append(chevron);
      details.append(summary);
      const breakdown = textElement("div", "litcode-breakdown", "");
      for (const window of WINDOW_ORDER) {
        if (company.windows[window] === undefined) continue;
        const row = textElement("div", "litcode-breakdown-row", "");
        row.append(textElement("span", "", WINDOW_LABELS[window]));
        row.append(textElement("strong", "", formatFrequency(company.windows[window])));
        const link = document.createElement("a");
        link.href = sourceFile(company.name, window);
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.setAttribute("aria-label", `${company.name}, ${WINDOW_LABELS[window]} source CSV`);
        link.innerHTML = ICON.external;
        row.append(link);
        breakdown.append(row);
      }
      const browse = document.createElement("a");
      browse.className = "litcode-browse-link";
      browse.href = `https://leetcode.com/problemset/?litcodeCompany=${encodeURIComponent(company.name)}`;
      browse.target = "_blank";
      browse.rel = "noopener noreferrer";
      browse.textContent = `Browse ${company.name} questions`;
      breakdown.append(browse);
      details.append(breakdown);
      fragment.append(details);
    }
    list.append(fragment);
  }

  function render() {
    if (!state.slug) {
      host.hidden = true;
      return;
    }
    host.hidden = false;
    const total = state.question?.companies.length;
    shadow.querySelector(".litcode-launcher-count").textContent = state.loading ? "…" : total === undefined ? "—" : total;
    renderQuestion();
    renderTabs();
    renderCompanies();
    source.href = state.meta?.source || "https://github.com/liquidslr/leetcode-company-wise-problems";
    snapshot.textContent = state.meta?.revision ? `Snapshot ${state.meta.revision.slice(0, 7)}` : "";
  }

  function lookup(slug) {
    state.slug = slug;
    state.question = null;
    state.error = null;
    state.loading = true;
    state.window = "all";
    state.search = "";
    search.value = "";
    render();
    chrome.runtime.sendMessage({ type: "LITCODE_LOOKUP", slug }, response => {
      if (state.slug !== slug) return;
      state.loading = false;
      if (chrome.runtime.lastError) state.error = "The extension could not load its data. Reload this page and try again.";
      else if (response?.error) state.error = response.error;
      else {
        state.question = response?.question || null;
        state.meta = response?.meta || null;
      }
      render();
    });
  }

  function checkRoute() {
    const slug = slugFromUrl();
    if (slug === state.slug) return;
    if (slug) lookup(slug);
    else {
      state.slug = null;
      state.question = null;
      render();
    }
  }

  launcher.addEventListener("click", () => setOpen(true));
  close.addEventListener("click", () => setOpen(false));
  search.addEventListener("input", () => {
    state.search = search.value;
    renderCompanies();
  });
  shadow.addEventListener("keydown", event => {
    if (event.key === "Escape" && state.open) setOpen(false);
  });
  checkRoute();
  setInterval(checkRoute, 800);
})();
