/* ====== EDIT THIS ======
   Your WhatsApp number in international format, digits only. */
const PHONE = "917529870673";
/* ======================== */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const phoneSet = /^\d{11,15}$/.test(PHONE);
const waLink = (text = "") => `https://wa.me/${PHONE}${text ? "?text=" + encodeURIComponent(text) : ""}`;

// contact links
const pl = $("#phoneLink");
pl.textContent = phoneSet ? "+" + PHONE.slice(0, 2) + " " + PHONE.slice(2) : "Add number in script.js";
pl.href = phoneSet ? "tel:+" + PHONE : "#contact";
$("#waFloat").href = waLink("Hi Anmol, I run a boutique in the Tricity and I'd like to discuss embellishment work.");
$("#yr").textContent = new Date().getFullYear();

// nav + scroll progress
const nav = $("#nav"), burger = $("#burger"), links = $("#navLinks"), bar = $("#progress");
function onScroll() {
  nav.classList.toggle("scrolled", scrollY > 40);
  const h = document.documentElement.scrollHeight - innerHeight;
  bar.style.transform = `scaleX(${h > 0 ? scrollY / h : 0})`;
}
onScroll(); addEventListener("scroll", onScroll, { passive: true });
const closeMenu = () => { links.classList.remove("open"); burger.setAttribute("aria-expanded", "false"); };
burger.addEventListener("click", () => {
  burger.setAttribute("aria-expanded", links.classList.toggle("open"));
});
$$("a", links).forEach(a => a.addEventListener("click", closeMenu));

// scroll reveal
$$(".gallery button").forEach(b => b.classList.add("rv"));
let pending = $$(".rv");
pending.forEach(el => {
  const sibs = $$(".rv", el.parentElement);
  el.style.transitionDelay = Math.min(sibs.indexOf(el), 5) * 90 + "ms";
});
// Plain scroll check (instead of IntersectionObserver) so reveals also fire
// after a refresh / restored scroll position, without needing any interaction.
function revealCheck() {
  pending = pending.filter(el => {
    const r = el.getBoundingClientRect();
    if (r.top < innerHeight * .92 && r.bottom > 0) { el.classList.add("in"); return false; }
    return true;
  });
  checkCalc();
}

// animated number
function tween(el, to) {
  const from = parseInt(el.textContent) || 0;
  if (reduce || from === to) { el.textContent = to; return; }
  const t0 = performance.now(), d = 600;
  (function step(t) {
    const p = Math.min((t - t0) / d, 1);
    el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(step);
  })(t0);
}

// calculator
const num = id => Math.max(0, parseFloat($(id).value) || 0);
function calc() {
  const hrs = num("#cPieces") * num("#cHours");
  const skilled = num("#cSkilled");
  tween($("#rHours"), Math.round(hrs));
  tween($("#rDays"), Math.round(hrs / 8));
  tween($("#rOrders"), skilled ? Math.floor(hrs / skilled) : 0);
}
$$("#calcForm input").forEach(i => i.addEventListener("input", calc));
let calcDone = false;
function checkCalc() {
  if (calcDone) return;
  const r = $("#calcForm").getBoundingClientRect();
  if (r.top < innerHeight * .75 && r.bottom > 0) {
    calcDone = true;
    ["#rHours", "#rDays", "#rOrders"].forEach(s => $(s).textContent = 0);
    calc();
  }
}

addEventListener("scroll", revealCheck, { passive: true });
addEventListener("resize", revealCheck);
addEventListener("load", revealCheck);
revealCheck();
// safety net for the first seconds (slow image loads, restored scroll position)
let ticks = 0;
const tk = setInterval(() => { revealCheck(); if (++ticks > 20 || !pending.length) clearInterval(tk); }, 300);

// gallery filter
const all = $$("#gallery button");
const chips = $$(".chip");
const countEl = $("#count");
function applyFilter(f) {
  let n = 0;
  all.forEach(b => {
    const ok = f === "all" || b.dataset.cat.split(" ").includes(f);
    b.hidden = !ok;
    b.classList.remove("pop");
    if (ok) {
      b.classList.add("in");
      void b.offsetWidth;
      b.style.animationDelay = Math.min(n, 12) * 45 + "ms";
      b.classList.add("pop");
      n++;
    }
  });
  countEl.textContent = `Showing ${n} piece${n === 1 ? "" : "s"}`;
}
chips.forEach(c => c.addEventListener("click", () => {
  chips.forEach(x => x.classList.toggle("on", x === c));
  applyFilter(c.dataset.f);
}));
countEl.textContent = `${all.length} pieces`;

// lightbox (works on whatever is currently visible)
const lb = $("#lightbox"), lbImg = $("#lbImg"), lbCap = $("#lbCap");
let vis = [], cur = 0;
function show(i) {
  cur = (i + vis.length) % vis.length;
  const img = $("img", vis[cur]);
  lbImg.src = img.src; lbImg.alt = img.alt;
  lbCap.textContent = $("span", vis[cur]).textContent;
}
all.forEach(b => b.addEventListener("click", () => {
  vis = all.filter(x => !x.hidden);
  show(vis.indexOf(b));
  lb.hidden = false; document.body.style.overflow = "hidden";
}));
const closeLb = () => { lb.hidden = true; document.body.style.overflow = ""; };
$("#lbClose").addEventListener("click", closeLb);
$("#lbPrev").addEventListener("click", () => show(cur - 1));
$("#lbNext").addEventListener("click", () => show(cur + 1));
lb.addEventListener("click", e => { if (e.target === lb) closeLb(); });
addEventListener("keydown", e => {
  if (lb.hidden) return;
  if (e.key === "Escape") closeLb();
  if (e.key === "ArrowLeft") show(cur - 1);
  if (e.key === "ArrowRight") show(cur + 1);
});
let tx = 0;
lb.addEventListener("touchstart", e => tx = e.touches[0].clientX, { passive: true });
lb.addEventListener("touchend", e => {
  const dx = e.changedTouches[0].clientX - tx;
  if (Math.abs(dx) > 50) show(cur + (dx < 0 ? 1 : -1));
});

// lead form -> WhatsApp
$("#leadForm").addEventListener("submit", e => {
  e.preventDefault();
  if (!phoneSet) { alert("Set your WhatsApp number in script.js (PHONE) first."); return; }
  const f = Object.fromEntries(new FormData(e.target));
  const msg =
`Hi Anmol, I'd like to discuss embellishment work.

Boutique: ${f.boutique}
Name: ${f.name}
Area: ${f.area}
Work needed: ${f.work}
Pieces this season: ${f.qty || "not sure yet"}
Preferred pricing: ${f.mode}`;
  window.open(waLink(msg), "_blank", "noopener");
});
