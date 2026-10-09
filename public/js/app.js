import { initPaywall, gate, showPricingModal, renderUsageMeter } from "./services/paywallUI.js";
import { validators, guardSubmit } from "./utils/validate.js";
import { saveDoc, getUserDocs, tsToString } from "./services/firestoreService.js";
import { apiFetch } from "./config/env.js";
import { toast } from "./utils/toast.js";
import { initAuthModal, wireAuthNav, openAuthModal, escapeHtml, listItems, showToolError, clearToolError } from "./utils/helpers.js";
import { authService } from "./services/authService.js";

let lastResult = null;

let currentUser = null;
authService.onAuthChanged(async user => {
  currentUser = user;
  const navLoginEl = document.getElementById("nav-login");
  if (navLoginEl) navLoginEl.textContent = user ? "Sign Out" : "Sign In";
  document.getElementById("nav-signup")?.classList.toggle("nav-signup-hidden", !!user);
  await initPaywall(user ? user.uid : null);
  if (user) renderUsageMeter("usage-meter-container", "analyses");
});
document.getElementById("nav-upgrade")?.addEventListener("click", (e) => { e.preventDefault(); showPricingModal("pro"); });
document.getElementById("nav-manage")?.addEventListener("click", () => showPricingModal("pro"));

initAuthModal(authService);
wireAuthNav(authService, () => currentUser);

function setBusy(busy) {
  const btn = document.getElementById("btn-review");
  btn.querySelector(".btn-text").classList.toggle("hidden", busy);
  btn.querySelector(".btn-loader").classList.toggle("hidden", !busy);
  btn.disabled = busy;
}

async function review() {
  // The API sends the description text to the model; the URL is NOT fetched.
  // So the description is required and the URL is optional reference only.
  if (!guardSubmit([
    { id: 'portfolio-desc', rules: [validators.minWords(30)], label: 'Project description' },
    { id: 'target-role', rules: [validators.required], label: 'Target role' }
  ], toast)) return;

  const desc = document.getElementById("portfolio-desc").value.trim();
  const url = document.getElementById("portfolio-url").value.trim();
  clearToolError();
  document.getElementById("results").classList.add("hidden");
  setBusy(true);
  try {
    const data = await apiFetch("/api/portfolio-review", { portfolioUrl: url, portfolioDesc: desc, targetRole: document.getElementById("target-role").value.trim(), targetCompany: document.getElementById("target-company").value.trim(), careerStage: document.getElementById("career-stage").value });
    const score = Number(data?.overall);
    if (!data || !Number.isFinite(score)) throw new Error("The server returned an incomplete review.");
    lastResult = data;
    renderResults(data);
  } catch (e) {
    lastResult = null;
    showToolError(e, review);
  } finally {
    setBusy(false);
  }
}

document.getElementById("btn-review").addEventListener("click", review);

function renderResults(data) {
  // 0 is a valid score: clamp, never default
  const score = Math.max(0, Math.min(100, Math.round(Number(data.overall))));
  const circumference = 339.3;
  const offset = circumference - (score / 100) * circumference;
  const label = score >= 80 ? 'Strong Portfolio' : score >= 65 ? 'Good Portfolio' : 'Needs Improvement';
  document.getElementById("score-display").innerHTML = `
    <div class="score-ring"><svg viewBox="0 0 120 120"><circle class="ring-bg" cx="60" cy="60" r="54"/><circle class="ring-fill" cx="60" cy="60" r="54" style="stroke-dashoffset:${offset}"/></svg><div class="score-value">${score}</div></div>
    <div class="score-meta"><h3>${label}</h3><p>${data.verdict ? escapeHtml(data.verdict) : "Overall impression score (out of 100)"}</p></div>`;

  const grid = document.getElementById("review-grid");
  const catList = Array.isArray(data.categories) ? data.categories : [];
  const cats = catList.map((c, i) => {
    const cs = Math.max(0, Math.min(100, Number(c.score) || 0));
    // Odd category count: stretch the last one so the 2-col grid has no orphan cell
    const wide = catList.length % 2 === 1 && i === catList.length - 1 ? " wide" : "";
    return `<div class="result-block${wide}"><h4>${escapeHtml(c.name || "")} · ${cs}/100</h4><div class="cat-score-bar"><div class="cat-fill" style="width:${cs}%;background:${cs >= 75 ? 'var(--gold)' : 'var(--navy-light)'}"></div></div><p class="cat-feedback">${escapeHtml(c.feedback || "")}</p></div>`;
  }).join("");
  const strengths = data.strengths?.length ? `<div class="result-block wide"><h4>Strengths</h4><ul>${listItems(data.strengths)}</ul></div>` : "";
  const fixes = data.topFixes?.length ? `<div class="result-block wide"><h4>Top Fixes</h4><ul>${listItems(data.topFixes)}</ul></div>` : "";
  grid.innerHTML = strengths + cats + fixes;
  document.getElementById("results").classList.remove("hidden");
  document.getElementById("results").scrollIntoView({ behavior: "smooth" });
}

document.getElementById("btn-save")?.addEventListener("click", async () => {
  if (!currentUser) { openAuthModal("login"); return; }
  try {
    await saveDoc("portfolio-reviews", currentUser.uid, { portfolioUrl: document.getElementById("portfolio-url").value.trim(), targetRole: document.getElementById("target-role").value.trim(), review: lastResult });
    toast.success("Review saved!");
  } catch (e) {
    toast.error(`Couldn't save: ${e?.message || "unknown error"}`);
  }
});
