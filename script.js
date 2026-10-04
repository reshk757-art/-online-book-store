"use strict";

// ========================================
// SMART LOST & FOUND - MAIN APPLICATION
// ========================================

const STORAGE_KEYS = {
  lost: "lostItems",
  found: "foundItems"
};

const $ = (id) => document.getElementById(id);

function readItems(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Could not read saved reports:", error);
    return [];
  }
}

function saveItems(key, items) {
  try {
    localStorage.setItem(key, JSON.stringify(items));
    return true;
  } catch (error) {
    console.error("Could not save reports:", error);
    showMessage(
      "Storage is full or unavailable. Try a smaller image.",
      true
    );
    return false;
  }
}

function getAllReports() {
  return [
    ...readItems(STORAGE_KEYS.lost).map(item => ({
      ...item,
      type: "Lost"
    })),
    ...readItems(STORAGE_KEYS.found).map(item => ({
      ...item,
      type: "Found"
    }))
  ];
}

function showMessage(message, isError = false) {
  const box = $("appMessage");
  if (!box) return;

  box.textContent = message;
  box.classList.toggle("error", isError);
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

// ========================================
// NAVIGATION BETWEEN FORMS
// ========================================

function showForm(type) {
  const sections = {
    lost: "lostForm",
    found: "foundForm",
    search: "searchForm",
    match: "matchForm"
  };

  Object.values(sections).forEach(id => {
    const section = $(id);
    if (section) section.hidden = true;
  });

  if (sections[type]) {
    const section = $(sections[type]);
    section.hidden = false;
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  showMessage("");

  if (type === "search") searchItems();
}

// ========================================
// IMAGE HANDLING
// Compress images to help browser storage.
// ========================================

function readImage(fileInput) {
  return new Promise((resolve, reject) => {
    const file = fileInput?.files?.[0];

    if (!file) {
      resolve("");
      return;
    }

    if (!file.type.startsWith("image/")) {
      reject(new Error("Please select a valid image."));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      reject(new Error("Please choose an image smaller than 5 MB."));
      return;
    }

    const reader = new FileReader();

    reader.onerror = () => reject(new Error("Could not read the image."));

    reader.onload = () => {
      const image = new Image();

      image.onerror = () => reject(new Error("This image could not be opened."));

      image.onload = () => {
        const maxDimension = 700;
        const scale = Math.min(
          1,
          maxDimension / Math.max(image.width, image.height)
        );

        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));

        const context = canvas.getContext("2d");

        if (!context) {
          reject(new Error("Image processing is unavailable."));
          return;
        }

        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };

      image.src = reader.result;
    };

    reader.readAsDataURL(file);
  });
}

// ========================================
// SUBMIT LOST / FOUND REPORTS
// ========================================

async function submitReport(type) {
  const isLost = type === "Lost";

  const ids = isLost
    ? {
        name: "lostName",
        item: "lostItem",
        location: "lostLocation",
        date: "lostDate",
        description: "lostDescription",
        image: "lostImage"
      }
    : {
        name: "foundName",
        item: "foundItem",
        location: "foundLocation",
        date: "foundDate",
        description: "foundDescription",
        image: "foundImage"
      };

  const values = {};

  for (const field of ["name", "item", "location", "date", "description"]) {
    values[field] = $(ids[field]).value.trim();

    if (!values[field]) {
      showMessage("Please complete all required fields.", true);
      $(ids[field]).focus();
      return;
    }
  }

  const selectedDate = new Date(values.date + "T00:00:00");
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  if (Number.isNaN(selectedDate.getTime()) || selectedDate > today) {
    showMessage("Please enter a valid date that is not in the future.", true);
    return;
  }

  let image = "";

  try {
    image = await readImage($(ids.image));
  } catch (error) {
    showMessage(error.message, true);
    return;
  }

  const key = isLost ? STORAGE_KEYS.lost : STORAGE_KEYS.found;
  const items = readItems(key);

  const report = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    name: values.name,
    item: values.item,
    location: values.location,
    date: values.date,
    description: values.description,
    image,
    createdAt: new Date().toISOString()
  };

  items.push(report);

  if (!saveItems(key, items)) return;

  $(isLost ? "lostReportForm" : "foundReportForm").reset();

  displayRecentReports();
  updateStatistics();
  showMessage(type + " item report submitted successfully!");

  alert(
    type + " item reported successfully!\n\n" +
    "Item: " + report.item + "\n" +
    "Location: " + report.location
  );

  showForm("none");
}

function submitLostItem() {
  return submitReport("Lost");
}

function submitFoundItem() {
  return submitReport("Found");
}

// ========================================
// CREATE REPORT CARDS SAFELY
// ========================================

function createReportCard(report, score) {
  const type = report.type === "Lost" ? "Lost" : "Found";
  const card = document.createElement("article");

  card.className = "result-card";
  card.dataset.type = type;

  const badge = document.createElement("span");
  badge.className = "type-badge " + type.toLowerCase();
  badge.textContent = type + " Item";
  card.appendChild(badge);

  if (report.image && report.image.startsWith("data:image/")) {
    const img = document.createElement("img");
    img.src = report.image;
    img.alt = "Photo of " + (report.item || "reported item");
    img.loading = "lazy";
    card.appendChild(img);
  }

  const title = document.createElement("h3");
  title.textContent = report.item || "Unnamed item";
  card.appendChild(title);

  const details = [
    ["Location", report.location],
    ["Description", report.description],
    ["Date", report.date],
    ["Reported by", report.name]
  ];

  details.forEach(([label, value]) => {
    if (!value) return;

    const p = document.createElement("p");
    const strong = document.createElement("strong");
    strong.textContent = label + ": ";
    p.append(strong, document.createTextNode(String(value)));
    card.appendChild(p);
  });

  if (typeof score === "number") {
    const scoreLabel = document.createElement("span");
    scoreLabel.className = "match-score";
    scoreLabel.textContent = "Estimated similarity: " + score + "%";
    card.appendChild(scoreLabel);
  }

  return card;
}

function renderCards(container, reports, emptyMessage) {
  if (!container) return;

  container.replaceChildren();

  if (!reports.length) {
    const p = document.createElement("p");
    p.className = "empty-state";
    p.textContent = emptyMessage;
    container.appendChild(p);
    return;
  }

  reports.forEach(report => {
    container.appendChild(
      createReportCard(report, report.score)
    );
  });
}

// ========================================
// SEARCH LOST AND FOUND REPORTS
// ========================================

function searchItems() {
  const query = normalize($("searchText")?.value || "");
  const type = $("searchType")?.value || "all";

  const results = getAllReports().filter(report => {
    if (type !== "all" && report.type !== type) return false;

    if (!query) return true;

    const searchableText = normalize([
      report.item,
      report.location,
      report.description,
      report.date,
      report.type
    ].join(" "));

    return searchableText.includes(query);
  });

  renderCards(
    $("searchResults"),
    results.reverse(),
    "No matching reports found. Try another keyword or filter."
  );
}

// ========================================
// RECENT REPORTS AND LIVE STATISTICS
// ========================================

function displayRecentReports() {
  const reports = getAllReports();

  reports.sort((a, b) => {
    const dateA = new Date(a.createdAt || 0).getTime();
    const dateB = new Date(b.createdAt || 0).getTime();
    return dateB - dateA;
  });

  renderCards(
    $("recentReports"),
    reports.slice(0, 6),
    "No reports yet. Be the first to submit one!"
  );
}

function updateStatistics() {
  const lostCount = readItems(STORAGE_KEYS.lost).length;
  const foundCount = readItems(STORAGE_KEYS.found).length;

  if ($("lostCount")) $("lostCount").textContent = lostCount;
  if ($("foundCount")) $("foundCount").textContent = foundCount;
  if ($("totalCount")) $("totalCount").textContent = lostCount + foundCount;
}

// ========================================
// SMART MATCH SCORING
// Rule-based text similarity, not AI.
// ========================================

function wordSet(text) {
  return new Set(
    normalize(text)
      .split(/[^a-z0-9]+/)
      .filter(word => word.length > 1)
  );
}

function similarity(first, second) {
  const a = normalize(first);
  const b = normalize(second);

  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.85;

  const wordsA = wordSet(a);
  const wordsB = wordSet(b);

  if (!wordsA.size || !wordsB.size) return 0;

  const common = [...wordsA].filter(word => wordsB.has(word)).length;
  const total = new Set([...wordsA, ...wordsB]).size;

  return total ? common / total : 0;
}

function calculateMatch(query, found) {
  const itemScore = similarity(query.item, found.item);
  const locationScore = similarity(query.location, found.location);
  const descriptionScore = similarity(query.description, found.description);

  // Item name is weighted most heavily.
  const total = (
    itemScore * 0.50 +
    locationScore * 0.25 +
    descriptionScore * 0.25
  );

  return Math.round(total * 100);
}

function findSmartMatch() {
  const query = {
    item: normalize($("matchItem")?.value),
    location: normalize($("matchLocation")?.value),
    description: normalize($("matchDescription")?.value)
  };

  if (!query.item || !query.location || !query.description) {
    showMessage("Please enter the item name, location and description.", true);
    return;
  }

  const matches = readItems(STORAGE_KEYS.found)
    .map(item => ({
      ...item,
      type: "Found",
      score: calculateMatch(query, item)
    }))
    .filter(item => item.score >= 25)
    .sort((a, b) => b.score - a.score);

  const resultBox = $("matchResults");
  if (!resultBox) return;

  resultBox.replaceChildren();

  const heading = document.createElement("h3");
  heading.textContent = matches.length
    ? "🤖 Possible Matches"
    : "No Possible Match Found";

  resultBox.appendChild(heading);

  if (!matches.length) {
    const message = document.createElement("p");
    message.className = "empty-state";
    message.textContent =
      "No sufficiently similar found reports were detected. Try different details.";
    resultBox.appendChild(message);
    return;
  }

  const note = document.createElement("p");
  note.className = "helper-text";
  note.textContent =
    "Scores indicate text similarity only. Verify an item's details before claiming it.";
  resultBox.appendChild(note);

  matches.forEach(match => {
    resultBox.appendChild(createReportCard(match, match.score));
  });
}

// ========================================
// INITIALIZE APP
// ========================================

function initializeApp() {
  const lostForm = $("lostReportForm");
  const foundForm = $("foundReportForm");
  const matchForm = $("matchReportForm");

  if (lostForm) {
    lostForm.addEventListener("submit", event => {
      event.preventDefault();
      submitLostItem();
    });
  }

  if (foundForm) {
    foundForm.addEventListener("submit", event => {
      event.preventDefault();
      submitFoundItem();
    });
  }

  if (matchForm) {
    matchForm.addEventListener("submit", event => {
      event.preventDefault();
      findSmartMatch();
    });
  }

  const searchInput = $("searchText");

  if (searchInput) {
    searchInput.addEventListener("keydown", event => {
      if (event.key === "Enter") searchItems();
    });

    searchInput.addEventListener("input", searchItems);
  }

  const searchType = $("searchType");

  if (searchType) {
    searchType.addEventListener("change", searchItems);
  }

  // Compatible with the previous HTML version.
  // The old inline onclick functions can still call these functions.
  displayRecentReports();
  updateStatistics();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp);
} else {
  initializeApp();
}