const BUCKET_COUNT = 64;
const cache = new Map();
const companyCache = new Map();
let metadataPromise;
let companyListPromise;

function bucketFor(slug) {
  let value = 2166136261;
  for (const char of slug) {
    value = Math.imul(value ^ char.charCodeAt(0), 16777619) >>> 0;
  }
  return (value % BUCKET_COUNT).toString(16).padStart(2, "0");
}

async function loadJson(path) {
  const response = await fetch(chrome.runtime.getURL(path));
  if (!response.ok) throw new Error(`Could not load ${path}`);
  return response.json();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const pageUrl = sender.url || sender.tab?.url || "";
  if (message?.type === "LITCODE_LOOKUP") {
    if (!/^https:\/\/(www\.)?leetcode\.com\/problems\//.test(pageUrl)) {
      sendResponse({ error: "Lookup is available only on LeetCode problem pages." });
      return false;
    }
    const slug = message.slug;
    if (typeof slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      sendResponse({ error: "Invalid problem URL." });
      return false;
    }
    const bucket = bucketFor(slug);
    if (!cache.has(bucket)) {
      cache.set(bucket, loadJson(`data/${bucket}.json`).catch(error => {
        cache.delete(bucket);
        throw error;
      }));
    }
    metadataPromise ||= loadJson("data/meta.json").catch(error => {
      metadataPromise = undefined;
      throw error;
    });
    Promise.all([cache.get(bucket), metadataPromise])
      .then(([questions, meta]) => sendResponse({ question: questions[slug] || null, meta }))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  if (message?.type === "LITCODE_COMPANY_LIST" || message?.type === "LITCODE_COMPANY_LOOKUP") {
    if (!/^https:\/\/(www\.)?leetcode\.com\/problemset(?:\/|[?#]|$)/.test(pageUrl)) {
      sendResponse({ error: "Company browsing is available only on the LeetCode problemset." });
      return false;
    }
    companyListPromise ||= loadJson("data/company-list.json").catch(error => {
      companyListPromise = undefined;
      throw error;
    });
    metadataPromise ||= loadJson("data/meta.json").catch(error => {
      metadataPromise = undefined;
      throw error;
    });
    if (message.type === "LITCODE_COMPANY_LIST") {
      Promise.all([companyListPromise, metadataPromise])
        .then(([companies, meta]) => sendResponse({ companies, meta }))
        .catch(error => sendResponse({ error: error.message }));
      return true;
    }
    const name = message.company;
    companyListPromise.then(companies => {
      if (typeof name !== "string" || !companies.some(company => company.name === name)) {
        throw new Error("Unknown company.");
      }
      const bucket = bucketFor(name);
      if (!companyCache.has(bucket)) {
        companyCache.set(bucket, loadJson(`data/companies/${bucket}.json`).catch(error => {
          companyCache.delete(bucket);
          throw error;
        }));
      }
      return companyCache.get(bucket).then(data => data[name] || []);
    }).then(questions => sendResponse({ questions }))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  return false;
});
