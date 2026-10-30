(() => {
  if (document.getElementById("litcode-explorer-root")) return;

  const WINDOWS = [
    ["all", "All questions"],
    ["30d", "30 days"],
    ["3m", "3 months"],
    ["6m", "6 months"],
    ["older", "Older"],
  ];
  const SOURCE_FILES = {
    all: "5. All.csv",
    "30d": "1. Thirty Days.csv",
    "3m": "2. Three Months.csv",
    "6m": "3. Six Months.csv",
    older: "4. More Than Six Months.csv",
  };
  const ICON_CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg>';
  const ICON_ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>';
  const state = {
    active: false,
    open: false,
    loadingList: false,
    loadingCompany: false,
    error: null,
    companies: [],
    meta: null,
    selected: null,
    requestedCompany: null,
    questions: [],
    window: "all",
    difficulty: "all",
    sort: "frequency",
    query: "",
    visible: 50,
    suggestionIndex: -1,
  };

  const host = document.createElement("div");
  host.id = "litcode-explorer-root";
  host.hidden = true;
  document.documentElement.append(host);
  const shadow = host.attachShadow({ mode: "open" });
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = chrome.runtime.getURL("problemset.css");
  shadow.append(stylesheet);
  const shell = document.createElement("div");
  shell.className = "lx-shell";
  shell.innerHTML = `
    <button class="lx-launcher" type="button" aria-expanded="false" aria-controls="lx-panel">
      <span class="lx-mark" aria-hidden="true">L</span><span class="lx-launcher-label">Company practice</span><span class="lx-launcher-count">…</span>
    </button>
    <section id="lx-panel" class="lx-panel" aria-label="Company question explorer" hidden>
      <header class="lx-header">
        <div class="lx-brand"><span class="lx-mark" aria-hidden="true">L</span><span>Company practice</span></div>
        <button class="lx-close" type="button" aria-label="Close company practice">${ICON_CLOSE}</button>
      </header>
      <div class="lx-body">
        <div class="lx-intro"><h2>Practice by company</h2><p>Choose a company to see its questions from the repository, ranked by frequency.</p></div>
        <div class="lx-picker">
          <label for="lx-company-input">Company</label>
          <input id="lx-company-input" type="search" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="lx-suggestions" placeholder="Search 470 companies" autocomplete="off" />
          <div id="lx-suggestions" class="lx-suggestions" role="listbox" hidden></div>
        </div>
        <div class="lx-quick" aria-label="Popular companies"></div>
        <div class="lx-filters" hidden>
          <div class="lx-tabs" role="group" aria-label="Question time window"></div>
          <div class="lx-filter-grid">
            <label class="lx-query-field">Find a question<input class="lx-query" type="search" placeholder="Title or topic" autocomplete="off" /></label>
            <label>Difficulty<select class="lx-difficulty"><option value="all">Any</option><option value="Easy">Easy</option><option value="Medium">Medium</option><option value="Hard">Hard</option></select></label>
            <label>Sort by<select class="lx-sort"><option value="frequency">Frequency</option><option value="title">Title A–Z</option><option value="difficulty">Difficulty</option><option value="acceptance">Acceptance</option></select></label>
          </div>
        </div>
        <div class="lx-results-heading" aria-live="polite"></div>
        <div class="lx-results"></div>
        <button class="lx-more" type="button" hidden>Show 50 more questions</button>
      </div>
      <footer class="lx-footer"><a class="lx-source" target="_blank" rel="noopener noreferrer">Source repository</a><span class="lx-revision"></span></footer>
    </section>`;
  shadow.append(shell);

  const launcher = shadow.querySelector(".lx-launcher");
  const launcherLabel = shadow.querySelector(".lx-launcher-label");
  const launcherCount = shadow.querySelector(".lx-launcher-count");
  const panel = shadow.querySelector(".lx-panel");
  const close = shadow.querySelector(".lx-close");
  const companyInput = shadow.querySelector("#lx-company-input");
  const suggestions = shadow.querySelector(".lx-suggestions");
  const quick = shadow.querySelector(".lx-quick");
  const filters = shadow.querySelector(".lx-filters");
  const tabs = shadow.querySelector(".lx-tabs");
  const queryInput = shadow.querySelector(".lx-query");
  const difficultyInput = shadow.querySelector(".lx-difficulty");
  const sortInput = shadow.querySelector(".lx-sort");
  const resultsHeading = shadow.querySelector(".lx-results-heading");
  const results = shadow.querySelector(".lx-results");
  const more = shadow.querySelector(".lx-more");
  const source = shadow.querySelector(".lx-source");
  const revision = shadow.querySelector(".lx-revision");

  function element(tag, className, value) {
    const node = document.createElement(tag);
    node.className = className;
    node.textContent = value;
    return node;
  }

  function isProblemset() {
    return /^\/problemset(?:\/|$)/.test(location.pathname);
  }

  function setOpen(value) {
    state.open = value;
    panel.hidden = !value;
    launcher.hidden = value;
    launcher.setAttribute("aria-expanded", String(value));
    if (value) companyInput.focus({ preventScroll: true });
    else launcher.focus({ preventScroll: true });
  }

  function formatScore(score) {
    return typeof score === "number" && Number.isFinite(score) ? `${score.toFixed(1)}%` : "—";
  }

  function scoreFor(question) {
    return question.windows[state.window];
  }

  function sourceUrl() {
    const base = state.meta?.source || "https://github.com/liquidslr/leetcode-company-wise-problems";
    if (!state.selected) return base;
    const filename = SOURCE_FILES[state.window];
    return `${base}/blob/${encodeURIComponent(state.meta?.revision || "main")}/${encodeURIComponent(state.selected)}/${encodeURIComponent(filename)}`;
  }

  function matchingCompanies() {
    const search = companyInput.value.trim().toLocaleLowerCase();
    if (!search) return state.companies.slice(0, 12);
    return state.companies
      .filter(company => company.name.toLocaleLowerCase().includes(search))
      .sort((a, b) => {
        const aStart = a.name.toLocaleLowerCase().startsWith(search);
        const bStart = b.name.toLocaleLowerCase().startsWith(search);
        return Number(bStart) - Number(aStart) || b.count - a.count || a.name.localeCompare(b.name);
      })
      .slice(0, 12);
  }

  function renderSuggestions(show = true) {
    suggestions.replaceChildren();
    const matches = matchingCompanies();
    const visible = show && state.companies.length > 0 && (document.activeElement === host || shadow.activeElement === companyInput);
    suggestions.hidden = !visible;
    companyInput.setAttribute("aria-expanded", String(visible));
    if (!visible) return;
    state.suggestionIndex = Math.min(state.suggestionIndex, matches.length - 1);
    if (!matches.length) {
      suggestions.append(element("p", "lx-no-company", "No company matches this search."));
      return;
    }
    matches.forEach((company, index) => {
      const option = document.createElement("button");
      option.type = "button";
      option.className = `lx-option${index === state.suggestionIndex ? " is-focused" : ""}`;
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", String(company.name === state.selected));
      option.append(element("span", "", company.name), element("span", "lx-option-count", String(company.count)));
      option.addEventListener("mousedown", event => event.preventDefault());
      option.addEventListener("click", () => selectCompany(company.name));
      suggestions.append(option);
    });
  }

  function renderQuick() {
    quick.replaceChildren();
    if (state.selected || !state.companies.length) {
      quick.hidden = true;
      return;
    }
    quick.hidden = false;
    quick.append(element("span", "lx-quick-label", "Start with"));
    for (const name of ["Google", "Amazon", "Meta", "Microsoft", "Apple"]) {
      if (!state.companies.some(company => company.name === name)) continue;
      const button = element("button", "lx-quick-button", name);
      button.type = "button";
      button.addEventListener("click", () => selectCompany(name));
      quick.append(button);
    }
  }

  function renderTabs() {
    tabs.replaceChildren();
    for (const [window, label] of WINDOWS) {
      const button = element("button", `lx-tab${state.window === window ? " is-active" : ""}`, label);
      button.type = "button";
      button.setAttribute("aria-pressed", String(state.window === window));
      button.addEventListener("click", () => {
        state.window = window;
        state.visible = 50;
        renderTabs();
        renderResults();
      });
      tabs.append(button);
    }
  }

  function filteredQuestions() {
    const search = state.query.trim().toLocaleLowerCase();
    const difficultyRank = { Easy: 0, Medium: 1, Hard: 2 };
    return state.questions
      .filter(question => (state.window === "all" || question.windows[state.window] !== undefined)
        && (state.difficulty === "all" || question.difficulty === state.difficulty)
        && (!search || question.title.toLocaleLowerCase().includes(search)
          || question.topics.some(topic => topic.toLocaleLowerCase().includes(search))))
      .sort((a, b) => {
        if (state.sort === "title") return a.title.localeCompare(b.title);
        if (state.sort === "difficulty") return (difficultyRank[a.difficulty] ?? 3) - (difficultyRank[b.difficulty] ?? 3) || a.title.localeCompare(b.title);
        if (state.sort === "acceptance") return (b.acceptanceRate ?? -1) - (a.acceptanceRate ?? -1) || a.title.localeCompare(b.title);
        return (scoreFor(b) ?? -1) - (scoreFor(a) ?? -1) || a.title.localeCompare(b.title);
      });
  }

  function renderResults() {
    results.replaceChildren();
    more.hidden = true;
    filters.hidden = !state.selected;
    source.href = sourceUrl();
    source.textContent = state.selected ? (state.window === "all" ? "View all-time CSV" : "View source CSV") : "Source repository";
    if (state.error) {
      resultsHeading.textContent = "Could not load company data";
      results.append(element("p", "lx-status lx-error", state.error));
      const retry = element("button", "lx-retry", "Retry");
      retry.type = "button";
      retry.addEventListener("click", () => state.companies.length ? selectCompany(state.selected) : loadCompanyList());
      results.append(retry);
      return;
    }
    if (state.loadingList || state.loadingCompany) {
      resultsHeading.textContent = "Loading…";
      return;
    }
    if (!state.selected) {
      resultsHeading.textContent = "Choose a company to begin";
      results.append(element("p", "lx-status", "Questions will appear here, sorted by the selected company's frequency score."));
      return;
    }
    const matches = filteredQuestions();
    const windowLabel = WINDOWS.find(([key]) => key === state.window)?.[1] || "All questions";
    resultsHeading.textContent = `${state.selected} · ${matches.length.toLocaleString()} ${matches.length === 1 ? "question" : "questions"} · ${windowLabel}`;
    if (!matches.length) {
      results.append(element("p", "lx-status", "No questions match these filters. Try another time window or difficulty."));
      return;
    }
    const fragment = document.createDocumentFragment();
    matches.slice(0, state.visible).forEach((question, index) => {
      const link = document.createElement("a");
      link.className = "lx-question";
      link.href = `https://leetcode.com/problems/${question.slug}/`;
      link.append(element("span", "lx-rank", String(index + 1).padStart(2, "0")));
      const content = element("span", "lx-question-main", "");
      content.append(element("span", "lx-question-title", question.title));
      const facts = element("span", "lx-question-facts", "");
      facts.append(element("span", `lx-difficulty lx-${question.difficulty.toLowerCase()}`, question.difficulty));
      if (typeof question.acceptanceRate === "number") facts.append(element("span", "", `${question.acceptanceRate.toFixed(1)}% acceptance`));
      content.append(facts);
      link.append(content);
      const score = element("span", "lx-score", formatScore(scoreFor(question)));
      score.title = "Repository frequency score";
      link.append(score);
      const arrow = element("span", "lx-arrow", "");
      arrow.innerHTML = ICON_ARROW;
      link.append(arrow);
      fragment.append(link);
    });
    results.append(fragment);
    more.hidden = matches.length <= state.visible;
    if (!more.hidden) more.textContent = `Show 50 more · ${Math.min(state.visible, matches.length).toLocaleString()} of ${matches.length.toLocaleString()}`;
  }

  function render() {
    host.hidden = !state.active;
    if (!state.active) return;
    launcherLabel.textContent = state.selected ? `${state.selected} questions` : "Company practice";
    launcherCount.textContent = state.selected ? state.questions.length.toLocaleString() : state.companies.length ? String(state.companies.length) : "…";
    source.href = sourceUrl();
    revision.textContent = state.meta?.revision ? `Snapshot ${state.meta.revision.slice(0, 7)}` : "";
    renderQuick();
    renderTabs();
    renderResults();
  }

  function selectCompany(name, { persist = true, open = true } = {}) {
    if (!state.companies.some(company => company.name === name)) return;
    state.selected = name;
    state.questions = [];
    state.loadingCompany = true;
    state.error = null;
    state.window = "all";
    state.difficulty = "all";
    state.sort = "frequency";
    state.query = "";
    state.visible = 50;
    companyInput.value = name;
    queryInput.value = "";
    difficultyInput.value = "all";
    sortInput.value = "frequency";
    if (persist) chrome.storage.local.set({ litcodeCompany: name });
    if (open && !state.open) setOpen(true);
    renderSuggestions(false);
    render();
    chrome.runtime.sendMessage({ type: "LITCODE_COMPANY_LOOKUP", company: name }, response => {
      if (state.selected !== name) return;
      state.loadingCompany = false;
      if (chrome.runtime.lastError) state.error = "The extension could not load this company. Reload the page and try again.";
      else if (response?.error) state.error = response.error;
      else state.questions = response?.questions || [];
      render();
    });
  }

  function loadCompanyList() {
    if (state.loadingList) return;
    state.loadingList = true;
    state.error = null;
    render();
    chrome.runtime.sendMessage({ type: "LITCODE_COMPANY_LIST" }, response => {
      state.loadingList = false;
      if (chrome.runtime.lastError) state.error = "The extension could not load its company list. Reload the page and try again.";
      else if (response?.error) state.error = response.error;
      else {
        state.companies = response?.companies || [];
        state.meta = response?.meta || null;
        companyInput.placeholder = `Search ${state.companies.length} companies`;
      }
      render();
      if (state.error) return;
      const requested = state.requestedCompany;
      chrome.storage.local.get(["litcodeCompany"], saved => {
        const name = state.companies.some(company => company.name === requested) ? requested : saved?.litcodeCompany;
        if (name && state.companies.some(company => company.name === name)) selectCompany(name, { persist: false, open: Boolean(requested) });
      });
    });
  }

  function checkRoute() {
    const active = isProblemset();
    if (active === state.active) return;
    state.active = active;
    host.hidden = !active;
    if (active) state.requestedCompany = new URLSearchParams(location.search).get("litcodeCompany");
    if (active && !state.companies.length) loadCompanyList();
    else render();
  }

  launcher.addEventListener("click", () => setOpen(true));
  close.addEventListener("click", () => setOpen(false));
  companyInput.addEventListener("focus", () => renderSuggestions(true));
  companyInput.addEventListener("input", () => {
    state.suggestionIndex = -1;
    renderSuggestions(true);
  });
  companyInput.addEventListener("keydown", event => {
    const matches = matchingCompanies();
    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && matches.length) {
      event.preventDefault();
      state.suggestionIndex = (state.suggestionIndex + (event.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length;
      renderSuggestions(true);
    } else if (event.key === "Enter" && matches.length) {
      event.preventDefault();
      selectCompany(matches[Math.max(0, state.suggestionIndex)].name);
    } else if (event.key === "Escape") {
      if (suggestions.hidden) setOpen(false);
      else renderSuggestions(false);
    }
  });
  companyInput.addEventListener("blur", () => {
    setTimeout(() => {
      renderSuggestions(false);
      if (state.selected) companyInput.value = state.selected;
    }, 120);
  });
  shadow.addEventListener("keydown", event => {
    if (event.key === "Escape" && state.open && shadow.activeElement !== companyInput) setOpen(false);
  });
  queryInput.addEventListener("input", () => {
    state.query = queryInput.value;
    state.visible = 50;
    renderResults();
  });
  difficultyInput.addEventListener("change", () => {
    state.difficulty = difficultyInput.value;
    state.visible = 50;
    renderResults();
  });
  sortInput.addEventListener("change", () => {
    state.sort = sortInput.value;
    state.visible = 50;
    renderResults();
  });
  more.addEventListener("click", () => {
    state.visible += 50;
    renderResults();
  });
  checkRoute();
  setInterval(checkRoute, 800);
})();
