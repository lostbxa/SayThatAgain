const phrases = window.PHRASES || [];
const storageKey = "say-that-again-score";
const revealDelayMs = 3000;
const difficultyPoints = {
  Easy: 1,
  Smooth: 2,
  Medium: 3,
  Odd: 4,
  Hard: 5,
};

const state = {
  currentIndex: 0,
  promptNumber: 1,
  isAnimating: false,
  isRevealed: false,
  revealTimer: null,
  history: [],
  drag: {
    active: false,
    startX: 0,
    startY: 0,
    x: 0,
    y: 0,
  },
};

const card = document.querySelector("#phrase-card");
const phraseText = document.querySelector("#phrase-text");
const phraseNumber = document.querySelector("#phrase-number");
const difficultyLabel = document.querySelector("#difficulty-label");
const categoryLabel = document.querySelector("#category-label");
const revealHint = document.querySelector("#reveal-hint");
const statusPill = document.querySelector("#status-pill");
const weightedScore = document.querySelector("#weighted-score");
const successCount = document.querySelector("#success-count");
const failCount = document.querySelector("#fail-count");
const streakCount = document.querySelector("#streak-count");
const failButton = document.querySelector("#fail-button");
const successButton = document.querySelector("#success-button");
const resetButton = document.querySelector("#reset-button");
const historyButton = document.querySelector("#history-button");
const successTile = document.querySelector("#success-tile");
const failTile = document.querySelector("#fail-tile");
const streakTile = document.querySelector("#streak-tile");
const historyPanel = document.querySelector("#history-panel");
const historyBackdrop = document.querySelector("#history-backdrop");
const historyClose = document.querySelector("#history-close");
const historyTitle = document.querySelector("#history-title");
const historyKicker = document.querySelector("#history-kicker");
const historyScoreValue = document.querySelector("#history-score-value");
const historyGrid = document.querySelector("#history-grid");

function isTouchLayout() {
  return window.matchMedia("(pointer: coarse)").matches;
}

function revealActionLabel() {
  return isTouchLayout() ? "Tap to reveal" : "Click to reveal";
}

function pointsForDifficulty(difficulty) {
  return difficultyPoints[difficulty] || 1;
}

function loadHistory() {
  const savedState = window.localStorage.getItem(storageKey);

  if (!savedState) {
    return;
  }

  try {
    const parsed = JSON.parse(savedState);
    state.history = Array.isArray(parsed.history) ? parsed.history : [];
  } catch {
    window.localStorage.removeItem(storageKey);
  }
}

function saveHistory() {
  window.localStorage.setItem(storageKey, JSON.stringify({ history: state.history }));
}

function getCurrentStreakEntries(history = state.history) {
  const streak = [];

  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (history[index].result !== "success") {
      break;
    }

    streak.unshift(history[index]);
  }

  return streak;
}

function getStats(history = state.history) {
  const successes = history.filter((entry) => entry.result === "success");
  const fails = history.filter((entry) => entry.result === "fail");
  const score = successes.reduce((total, entry) => total + pointsForDifficulty(entry.difficulty), 0);

  return {
    successes,
    fails,
    score,
    streak: getCurrentStreakEntries(history).length,
  };
}

function getLongestStreakIds(history = state.history) {
  let bestRun = [];
  let currentRun = [];

  history.forEach((entry) => {
    if (entry.result === "success") {
      currentRun.push(entry);

      if (currentRun.length > bestRun.length) {
        bestRun = [...currentRun];
      }

      return;
    }

    currentRun = [];
  });

  return new Set(bestRun.map((entry) => entry.id));
}

function updateScoreboard() {
  const stats = getStats();
  weightedScore.textContent = stats.score;
  successCount.textContent = stats.successes.length;
  failCount.textContent = stats.fails.length;
  streakCount.textContent = stats.streak;
}

function getNextIndex() {
  if (phrases.length === 1) {
    return 0;
  }

  let nextIndex = Math.floor(Math.random() * phrases.length);

  while (nextIndex === state.currentIndex) {
    nextIndex = Math.floor(Math.random() * phrases.length);
  }

  return nextIndex;
}

function resetCardPosition() {
  state.drag.x = 0;
  state.drag.y = 0;
  card.style.transform = "";
  card.dataset.swipe = "";
}

function setButtonsEnabled(isEnabled) {
  failButton.disabled = !isEnabled;
  successButton.disabled = !isEnabled;
}

function setCardTransform(x, y) {
  const rotation = Math.max(-16, Math.min(16, x / 18));
  card.style.transform = `translate(${x}px, ${y}px) rotate(${rotation}deg)`;
  card.dataset.swipe = x < -42 ? "left" : x > 42 ? "right" : "";
}

function renderConcealedPrompt() {
  phraseNumber.textContent = `Prompt ${state.promptNumber}`;
  phraseText.textContent = "";
  difficultyLabel.textContent = "";
  categoryLabel.textContent = "";
  revealHint.textContent = "";
  card.classList.remove("is-revealed", "show-reveal-hint");
  card.classList.add("is-concealed");
  setButtonsEnabled(false);
  statusPill.textContent = "New card ready";

  window.clearTimeout(state.revealTimer);
  state.revealTimer = window.setTimeout(() => {
    if (!state.isRevealed && !state.isAnimating) {
      revealHint.textContent = revealActionLabel();
      card.classList.add("show-reveal-hint");
    }
  }, revealDelayMs);
}

function revealPrompt() {
  if (state.isRevealed || state.isAnimating) {
    return;
  }

  const phrase = phrases[state.currentIndex];
  state.isRevealed = true;
  window.clearTimeout(state.revealTimer);
  revealHint.textContent = "";
  phraseText.textContent = `"${phrase.text}"`;
  difficultyLabel.textContent = phrase.difficulty;
  categoryLabel.textContent = phrase.category;
  card.classList.remove("is-concealed", "show-reveal-hint");
  card.classList.add("is-revealed");
  setButtonsEnabled(true);
  statusPill.textContent = "Mark the card when conversation has spoken";
}

function showNextPhrase() {
  state.currentIndex = getNextIndex();
  state.promptNumber += 1;
  state.isRevealed = false;
  resetCardPosition();
  renderConcealedPrompt();
  card.classList.add("entering");
  window.setTimeout(() => card.classList.remove("entering"), 280);
  state.isAnimating = false;
}

function recordAttempt(result) {
  const phrase = phrases[state.currentIndex];
  const entry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    promptNumber: state.promptNumber,
    text: phrase.text,
    difficulty: phrase.difficulty,
    category: phrase.category,
    result,
    points: result === "success" ? pointsForDifficulty(phrase.difficulty) : 0,
    createdAt: new Date().toISOString(),
  };

  state.history.push(entry);
  saveHistory();
}

function markAttempt(result) {
  if (state.isAnimating || !state.isRevealed) {
    return;
  }

  state.isAnimating = true;
  const succeeded = result === "success";

  recordAttempt(result);
  updateScoreboard();

  const stats = getStats();
  statusPill.textContent = succeeded && stats.streak > 1 ? `Streak x${stats.streak}` : succeeded ? "Nailed it" : "Missed. New prompt incoming.";
  card.classList.add(succeeded ? "leaving-right" : "leaving-left");

  window.setTimeout(() => {
    card.classList.remove("leaving-right", "leaving-left");
    showNextPhrase();
  }, 285);
}

function onPointerDown(event) {
  if (state.isAnimating || !state.isRevealed) {
    return;
  }

  state.drag.active = true;
  state.drag.startX = event.clientX;
  state.drag.startY = event.clientY;
  card.setPointerCapture(event.pointerId);
}

function onPointerMove(event) {
  if (!state.drag.active || state.isAnimating || !state.isRevealed) {
    return;
  }

  state.drag.x = event.clientX - state.drag.startX;
  state.drag.y = event.clientY - state.drag.startY;
  setCardTransform(state.drag.x, state.drag.y);
}

function onPointerUp(event) {
  if (!state.drag.active) {
    return;
  }

  state.drag.active = false;
  card.releasePointerCapture(event.pointerId);

  if (state.drag.x > 110) {
    markAttempt("success");
    return;
  }

  if (state.drag.x < -110) {
    markAttempt("fail");
    return;
  }

  resetCardPosition();
}

function onKeyDown(event) {
  if (historyPanel.classList.contains("is-open") && event.key === "Escape") {
    closeHistory();
    return;
  }

  if (!state.isRevealed && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    revealPrompt();
    return;
  }

  if (event.key === "ArrowLeft") {
    markAttempt("fail");
  }

  if (event.key === "ArrowRight") {
    markAttempt("success");
  }
}

function resetScore() {
  state.history = [];
  statusPill.textContent = "Score reset";
  saveHistory();
  updateScoreboard();
  closeHistory();
}

function getHistoryEntries(filter) {
  if (filter === "success") {
    return state.history.filter((entry) => entry.result === "success");
  }

  if (filter === "fail") {
    return state.history.filter((entry) => entry.result === "fail");
  }

  if (filter === "streak") {
    return getCurrentStreakEntries();
  }

  return state.history;
}

function historyTitleFor(filter) {
  if (filter === "success") {
    return "Successful Cards";
  }

  if (filter === "fail") {
    return "Missed Cards";
  }

  if (filter === "streak") {
    return "Current Streak";
  }

  return "All Cards";
}

function renderHistoryCard(entry, longestStreakIds) {
  const cardElement = document.createElement("article");
  cardElement.className = `history-card ${entry.result}`;

  if (longestStreakIds.has(entry.id)) {
    cardElement.classList.add("longest-streak");
  }

  const text = document.createElement("p");
  text.className = "history-card-text";
  text.textContent = `"${entry.text}"`;

  const meta = document.createElement("div");
  meta.className = "history-card-meta";

  [entry.result === "success" ? "Success" : "Missed", entry.difficulty, entry.category, `${entry.points} pts`, `#${entry.promptNumber}`].forEach((label) => {
    const pill = document.createElement("span");
    pill.textContent = label;
    meta.appendChild(pill);
  });

  if (longestStreakIds.has(entry.id)) {
    const streakPill = document.createElement("span");
    streakPill.textContent = "Longest streak";
    meta.appendChild(streakPill);
  }

  cardElement.append(text, meta);
  return cardElement;
}

function openHistory(filter = "all") {
  const entries = getHistoryEntries(filter);
  const visibleScore = entries.reduce((total, entry) => total + (entry.result === "success" ? pointsForDifficulty(entry.difficulty) : 0), 0);
  const longestStreakIds = getLongestStreakIds();

  historyKicker.textContent = filter === "all" ? "History" : "Filtered history";
  historyTitle.textContent = historyTitleFor(filter);
  historyScoreValue.textContent = visibleScore;
  historyGrid.replaceChildren();

  if (entries.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-history";
    empty.textContent = "No cards here yet.";
    historyGrid.appendChild(empty);
  } else {
    [...entries].reverse().forEach((entry) => {
      historyGrid.appendChild(renderHistoryCard(entry, longestStreakIds));
    });
  }

  historyPanel.classList.add("is-open");
  historyPanel.setAttribute("aria-hidden", "false");
  historyClose.focus();
}

function closeHistory() {
  historyPanel.classList.remove("is-open");
  historyPanel.setAttribute("aria-hidden", "true");
}

function init() {
  if (phrases.length === 0) {
    statusPill.textContent = "No phrases found";
    return;
  }

  state.currentIndex = Math.floor(Math.random() * phrases.length);
  loadHistory();
  updateScoreboard();
  renderConcealedPrompt();

  card.addEventListener("click", revealPrompt);
  card.addEventListener("pointerdown", onPointerDown);
  card.addEventListener("pointermove", onPointerMove);
  card.addEventListener("pointerup", onPointerUp);
  card.addEventListener("pointercancel", resetCardPosition);
  failButton.addEventListener("click", () => markAttempt("fail"));
  successButton.addEventListener("click", () => markAttempt("success"));
  resetButton.addEventListener("click", resetScore);
  historyButton.addEventListener("click", () => openHistory("all"));
  successTile.addEventListener("click", () => openHistory("success"));
  failTile.addEventListener("click", () => openHistory("fail"));
  streakTile.addEventListener("click", () => openHistory("streak"));
  historyBackdrop.addEventListener("click", closeHistory);
  historyClose.addEventListener("click", closeHistory);
  window.addEventListener("keydown", onKeyDown);
}

init();
