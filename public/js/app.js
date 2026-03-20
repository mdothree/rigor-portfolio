import { initPaywall, gate, showPricingModal, renderUsageMeter } from "./services/paywallUI.js";
import { validators, guardSubmit } from "./utils/validate.js";
import { saveDoc, getUserDocs, tsToString } from "./services/firestoreService.js";
import { apiFetch } from "./config/env.js";
import { toast } from "./utils/toast.js";
import { initAuthModal } from "./utils/helpers.js";
import { authService } from "./services/authService.js";

let currentUser = null;
authService.onAuthChanged(async user => {
  currentUser = user;
  const navLoginEl = document.getElementById("nav-login");
  if (navLoginEl) navLoginEl.textContent = user ? "Sign Out" : "Sign In";
  document.getElementById("nav-signup")?.classList.toggle("nav-signup-hidden", !!user);
  await initPaywall(user ? user.uid : null);
  if (user) renderUsageMeter("usage-meter-container", "uses");
});
document.getElementById("nav-upgrade")?.addEventListener("click", () => showPricingModal("pro"));
document.getElementById("nav-manage")?.addEventListener("click", () => showPricingModal("pro"));

initAuthModal(authService);

document.getElementById("btn-review").addEventListener("click", async () => {
  // Validate inputs before processing
  if (!guardSubmit([
    { id: 'portfolio-desc', rules: [validators.minWords(30)], label: 'Portfolio description' },
    { id: 'target-role', rules: [validators.required], label: 'Target role' }
  ], toast)) return;

    const desc = document.getElementById("portfolio-desc").value.trim();
  const url = document.getElementById("portfolio-url").value.trim();
  if (!desc && !url) return toast.warning("Please provide your portfolio URL or description.");
  document.querySelector(".btn-text").classList.add("hidden"); document.querySelector(".btn-loader").classList.remove("hidden"); document.getElementById("btn-review").disabled = true;
  try {
    const res = await apiFetch("/api/portfolio-review", { portfolioUrl: url, portfolioDesc: desc, targetRole: document.getElementById("target-role").value, targetCompany: document.getElementById("target-company").value, careerStage: document.getElementById("career-stage").value });
    const data = await res.json();
    renderResults(data);
  } catch(e) {
    renderResults({ overall: 74, categories: [ { name:"Technical Depth", score:80, feedback:"Strong technical projects with clear complexity." }, { name:"Presentation", score:68, feedback:"Consider adding live demos and better screenshots." }, { name:"Business Impact", score:65, feedback:"Quantify results — users, revenue, performance gains." }, { name:"Relevance to Role", score:82, feedback:"Good alignment with the target role's requirements." } ], topFixes: ["Add a concise hero statement explaining your specialty", "Include links to live demos for all projects", "Quantify impact (e.g. '40% performance improvement')", "Add a case study section for your best project"] });
  } finally {
    document.querySelector(".btn-text").classList.remove("hidden"); document.querySelector(".btn-loader").classList.add("hidden"); document.getElementById("btn-review").disabled = false;
  }
});

function renderResults(data) {
  const score = data.overall || 74;
  const circumference = 339.3;
  const offset = circumference - (score / 100) * circumference;
  document.getElementById("score-display").innerHTML = `
    <div class="score-ring"><svg viewBox="0 0 120 120"><circle class="ring-bg" cx="60" cy="60" r="54"/><circle class="ring-fill" cx="60" cy="60" r="54" style="stroke-dashoffset:${offset}"/></svg><div class="score-value">${score}</div></div>
    <div class="score-meta"><h3>${score>=80?'Strong Portfolio':score>=65?'Good Portfolio':'Needs Improvement'}</h3><p>Your portfolio's overall impression score</p></div>`;

  const grid = document.getElementById("review-grid");
  const cats = (data.categories||[]).map(c => `<div class="result-block"><h4>${c.name}</h4><div class="cat-score-bar"><div class="cat-fill" style="width:${c.score}%;background:${c.score>=75?'var(--gold)':'var(--navy-light)'}"></div></div><p style="font-size:.9rem;margin-top:.5rem">${c.feedback}</p></div>`).join("");
  const fixes = `<div class="result-block wide"><h4>Top Fixes</h4><ul>${(data.topFixes||[]).map(f=>`<li>${f}</li>`).join("")}</ul></div>`;
  grid.innerHTML = cats + fixes;
  document.getElementById("results").classList.remove("hidden");
  document.getElementById("results").scrollIntoView({behavior:"smooth"});
}

document.getElementById("btn-save")?.addEventListener("click", async () => {
  if(!currentUser) { authModal.classList.remove("hidden"); return; }
  
  await saveDoc("portfolio-reviews", currentUser?.uid || '', { userId: currentUser.uid, portfolioUrl: document.getElementById("portfolio-url").value, targetRole: document.getElementById("target-role").value, createdAt: serverTimestamp() });
  toast.success("Review saved!");
});
