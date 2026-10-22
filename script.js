/* ===== Monkeyphones voorraad- & reparatiebeheer ===== */
const INV_KEY = "monkeyphones_inventory_v1";
const REP_KEY = "monkeyphones_repairs_v1";
const CATS = ["Scherm", "Batterij", "Camera", "Achterkant", "Frame", "Oplaadpoort"];
const ICONS = { Scherm: "📱", Batterij: "🔋", Camera: "📷", Achterkant: "🔲", Frame: "🖼️", Oplaadpoort: "🔌" };
const CAT_PAGES = { batterij: "Batterij", achterkant: "Achterkant" };
const LOW = 2; // "bijna op" bij 2 of minder
const TITLES = { dashboard: "Dashboard", inventory: "Voorraad", iphone: "iPhone", samsung: "Samsung", batterij: "Batterij", achterkant: "Achterkant", reparaties: "Reparaties" };

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const money = n => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(Number(n) || 0);
const esc = s => String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
const load = k => { try { const v = JSON.parse(localStorage.getItem(k) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } };
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const fmtDate = s => { const [y, m, d] = String(s).split("-"); return y && m && d ? `${d}-${m}-${y}` : esc(s); };

let inventory = load(INV_KEY).map(x => ({ ...x, quantity: Number(x.quantity) || 0, sell: Number(x.sell) || 0 }));
let repairs = load(REP_KEY).map(x => ({ ...x, price: Number(x.price) || 0 }));
let currentPage = "dashboard";

function persist() {
  try {
    localStorage.setItem(INV_KEY, JSON.stringify(inventory));
    localStorage.setItem(REP_KEY, JSON.stringify(repairs));
  } catch { toast("Opslaan mislukt — is de browseropslag vol of geblokkeerd?"); }
}

let toastTimer;
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}

/* ---------- Berekeningen ---------- */
const totalQty = (a = inventory) => a.reduce((s, x) => s + x.quantity, 0);
const totalValue = (a = inventory) => a.reduce((s, x) => s + x.quantity * x.sell, 0);
const stockClass = q => q === 0 ? "out" : q <= LOW ? "low" : "";

/* ---------- Dashboard ---------- */
function renderDashboard() {
  const apple = inventory.filter(x => x.brand === "Apple");
  const samsung = inventory.filter(x => x.brand === "Samsung");
  const total = totalQty();
  $("#statItems").textContent = total;
  $("#statValue").textContent = money(totalValue());
  $("#statApple").textContent = totalQty(apple);
  $("#statSamsung").textContent = totalQty(samsung);

  // Bij lege voorraad: 0% / 0% (niet 0% / 100%)
  const ap = total ? Math.round(totalQty(apple) / total * 100) : 0;
  const sp = total ? 100 - ap : 0;
  $("#applePercent").textContent = ap + "%"; $("#samsungPercent").textContent = sp + "%";
  $("#appleBar").style.width = ap + "%"; $("#samsungBar").style.width = sp + "%";

  const recent = [...inventory].sort((a, b) => (b.created || 0) - (a.created || 0)).slice(0, 6);
  $("#recentList").innerHTML = recent.length
    ? recent.map(x => `<div class="recent"><div class="recent-left"><span class="part-icon">${ICONS[x.category] || "•"}</span><div><div class="recent-name">${esc(x.model)}</div><div class="recent-meta">${esc(x.brand)} · ${esc(x.category)}</div></div></div><span class="qty ${stockClass(x.quantity)}">${x.quantity}×</span></div>`).join("")
    : `<div class="empty show">Nog geen onderdelen toegevoegd.</div>`;

  const low = inventory.filter(x => x.quantity <= LOW).sort((a, b) => a.quantity - b.quantity).slice(0, 5);
  $("#lowList").innerHTML = low.length
    ? low.map(x => `<div class="recent"><div class="recent-left"><span class="part-icon">${ICONS[x.category] || "•"}</span><div><div class="recent-name">${esc(x.model)}</div><div class="recent-meta">${esc(x.brand)} · ${esc(x.category)}</div></div></div><span class="stock-pill ${stockClass(x.quantity)}">${x.quantity}</span></div>`).join("")
    : `<div class="empty show" style="padding:26px 10px">Alles ruim op voorraad 👍</div>`;

  const cats = {};
  inventory.forEach(x => cats[x.category] = (cats[x.category] || 0) + x.quantity);
  $("#categoryMini").innerHTML = CATS.filter(c => cats[c]).map(c => `<div>${esc(c)}<b>${cats[c]}</b></div>`).join("") || "<div>Voeg voorraad toe</div>";
}

/* ---------- Voorraad ---------- */
function filtered() {
  const q = $("#search").value.toLowerCase().trim(), b = $("#brandFilter").value, c = $("#categoryFilter").value;
  return inventory
    .filter(x => (!q || `${x.brand} ${x.model} ${x.category}`.toLowerCase().includes(q)) && (!b || x.brand === b) && (!c || x.category === c))
    .sort((a, b) => a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model, "nl", { numeric: true }) || a.category.localeCompare(b.category));
}
function renderInventory() {
  const arr = filtered();
  $("#inventoryCount").textContent = `${arr.length} ${arr.length === 1 ? "onderdeel" : "onderdelen"} · totaal ${totalQty(arr)} stuks`;
  $("#inventoryBody").innerHTML = arr.map(x => `<tr>
    <td><span class="brand-tag ${x.brand === "Apple" ? "apple" : "samsung"}">${esc(x.brand)}</span></td>
    <td><span class="cat-tag">${esc(x.category)}</span></td>
    <td><strong>${esc(x.model)}</strong></td>
    <td><span class="stock-pill ${stockClass(x.quantity)}">${x.quantity}</span></td>
    <td class="price">${money(x.sell)}</td>
    <td class="price">${money(x.quantity * x.sell)}</td>
    <td><div class="actions"><button class="icon-btn" data-edit="${esc(x.id)}">Bewerken</button><button class="icon-btn danger" data-del="${esc(x.id)}">Verwijderen</button></div></td></tr>`).join("");
  $("#emptyState").classList.toggle("show", !arr.length);
  $("#emptyState").firstChild.textContent = inventory.length ? "Geen onderdelen gevonden met deze filters." : "Nog geen voorraad toegevoegd.";
}

function renderBrand(brand) {
  const arr = inventory.filter(x => x.brand === brand);
  const target = brand === "Apple" ? "iphone" : "samsung";
  $(`#${target}Categories`).innerHTML = CATS.map(c => {
    const n = arr.filter(x => x.category === c);
    return `<button class="category-card" data-brand="${brand}" data-cat="${c}"><div class="cc-icon">${ICONS[c]}</div><h4>${c}</h4><p>${n.length} ${n.length === 1 ? "model" : "modellen"}</p><strong>${totalQty(n)} stuks</strong></button>`;
  }).join("");
  const sorted = [...arr].sort((a, b) => a.category.localeCompare(b.category) || a.model.localeCompare(b.model, "nl", { numeric: true }));
  $(`#${target}List`).innerHTML = sorted.length
    ? sorted.map(x => `<div class="brand-item"><div><strong>${esc(x.model)}</strong><div class="recent-meta">${esc(x.category)}</div></div><div class="right"><span class="price">${money(x.sell)}</span><span class="stock-pill ${stockClass(x.quantity)}">${x.quantity}×</span></div></div>`).join("")
    : `<div class="empty show">Nog geen ${brand} onderdelen.</div>`;
}

function renderCategoryPages() {
  Object.entries(CAT_PAGES).forEach(([id, cat]) => {
    const arr = inventory.filter(x => x.category === cat)
      .sort((a, b) => a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model, "nl", { numeric: true }));
    $(`#${id}Qty`).textContent = totalQty(arr);
    $(`#${id}Apple`).textContent = totalQty(arr.filter(x => x.brand === "Apple"));
    $(`#${id}Samsung`).textContent = totalQty(arr.filter(x => x.brand === "Samsung"));
    $(`#${id}Count`).textContent = `${arr.length} ${arr.length === 1 ? "model" : "modellen"} · waarde ${money(totalValue(arr))}`;
    $(`#${id}Body`).innerHTML = arr.map(x => `<tr>
      <td><span class="brand-tag ${x.brand === "Apple" ? "apple" : "samsung"}">${esc(x.brand)}</span></td>
      <td><strong>${esc(x.model)}</strong></td>
      <td><span class="stock-pill ${stockClass(x.quantity)}">${x.quantity}</span></td>
      <td class="price">${money(x.sell)}</td><td class="price">${money(x.quantity * x.sell)}</td>
      <td><div class="actions"><button class="icon-btn" data-edit="${esc(x.id)}">Bewerken</button><button class="icon-btn danger" data-del="${esc(x.id)}">Verwijderen</button></div></td></tr>`).join("");
    $(`#${id}Empty`).classList.toggle("show", !arr.length);
  });
}

/* ---------- Reparaties ---------- */
function renderRepairs() {
  const q = $("#repairSearch").value.toLowerCase().trim();
  let items = [...repairs].sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id)));
  if (q) items = items.filter(r => [r.date, fmtDate(r.date), r.customer, r.phone, r.device, r.type].join(" ").toLowerCase().includes(q));
  $("#repairTableBody").innerHTML = items.map(r => `<tr>
    <td>${fmtDate(r.date)}</td><td><strong>${esc(r.customer)}</strong></td><td>${esc(r.phone)}</td>
    <td>${esc(r.device)}</td><td>${esc(r.type)}</td><td class="price">${money(r.price)}</td>
    <td><div class="actions"><button class="icon-btn" data-edit-repair="${esc(r.id)}">Bewerken</button><button class="icon-btn danger" data-del-repair="${esc(r.id)}">Verwijderen</button></div></td></tr>`).join("");
  $("#repairEmpty").classList.toggle("show", !items.length);
  $("#repairEmpty").firstChild.textContent = repairs.length ? "Geen reparaties gevonden." : "Nog geen reparaties toegevoegd.";
  $("#repairToday").textContent = money(repairs.filter(r => r.date === todayStr()).reduce((s, r) => s + r.price, 0));
  $("#repairCount").textContent = repairs.length;
  $("#repairRevenue").textContent = money(repairs.reduce((s, r) => s + r.price, 0));
}

function renderAll() {
  renderDashboard(); renderInventory(); renderBrand("Apple"); renderBrand("Samsung"); renderCategoryPages(); renderRepairs();
}

/* ---------- Modals ---------- */
function showModal(el) { el.classList.add("show"); el.setAttribute("aria-hidden", "false"); }
function hideModal(el) { el.classList.remove("show"); el.setAttribute("aria-hidden", "true"); }

function openModal(item = null, presetBrand = null, presetCat = null) {
  $("#modalTitle").textContent = item ? "Onderdeel bewerken" : "Onderdeel toevoegen";
  $("#editId").value = item?.id || "";
  $("#brand").value = item?.brand || presetBrand || "Apple";
  $("#category").value = item?.category || presetCat || "Scherm";
  $("#model").value = item?.model || "";
  $("#quantity").value = item?.quantity ?? 1;
  $("#sell").value = item?.sell ?? "";
  showModal($("#modal")); setTimeout(() => $("#model").focus(), 30);
}
const closeModal = () => hideModal($("#modal"));

function openRepair(item = null) {
  $("#repairModalTitle").textContent = item ? "Reparatie bewerken" : "Reparatie toevoegen";
  $("#repairId").value = item?.id || "";
  $("#repairDate").value = item?.date || todayStr();
  $("#repairCustomer").value = item?.customer || "";
  $("#repairPhone").value = item?.phone || "";
  $("#repairDevice").value = item?.device || "";
  $("#repairType").value = item?.type || "";
  $("#repairPrice").value = item?.price ?? "";
  showModal($("#repairModal")); setTimeout(() => $("#repairCustomer").focus(), 30);
}
const closeRepair = () => hideModal($("#repairModal"));

/* ---------- Navigatie ---------- */
function go(page) {
  if (!TITLES[page]) page = "dashboard";
  currentPage = page;
  $$(".page").forEach(p => p.classList.toggle("active", p.id === page));
  $$(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.page === page));
  $("#pageTitle").textContent = TITLES[page];
  $("#quickAdd").textContent = page === "reparaties" ? "＋ Nieuwe reparatie" : "＋ Nieuw onderdeel";
  if (location.hash.slice(1) !== page) history.replaceState(null, "", "#" + page);
  closeSidebar(); window.scrollTo(0, 0);
}
function closeSidebar() { $("#sidebar").classList.remove("open"); $("#scrim").classList.remove("show"); }

/* ---------- Events ---------- */
$$(".nav-btn").forEach(b => b.addEventListener("click", () => go(b.dataset.page)));
$$("[data-go]").forEach(b => b.addEventListener("click", () => go(b.dataset.go)));
$("#mobileMenu").addEventListener("click", () => { $("#sidebar").classList.toggle("open"); $("#scrim").classList.toggle("show"); });
$("#scrim").addEventListener("click", closeSidebar);

// Eén knop rechtsboven; gedrag hangt af van de pagina (werkt ook direct na laden)
$("#quickAdd").addEventListener("click", () => {
  if (currentPage === "reparaties") openRepair();
  else openModal(null, currentPage === "iphone" ? "Apple" : currentPage === "samsung" ? "Samsung" : null, CAT_PAGES[currentPage] || null);
});
$("#addInventory").addEventListener("click", () => openModal());
$("#emptyAdd").addEventListener("click", () => openModal());
$("#repairEmptyAdd").addEventListener("click", () => openRepair());

// Filters / zoeken
$("#categoryFilter").innerHTML = `<option value="">Alle onderdelen</option>` + CATS.map(c => `<option>${c}</option>`).join("");
$("#category").innerHTML = CATS.map(c => `<option>${c}</option>`).join("");
["#search", "#brandFilter", "#categoryFilter"].forEach(s => $(s).addEventListener("input", renderInventory));
$("#repairSearch").addEventListener("input", renderRepairs);

// Categoriekaart op merkpagina → naar voorraad met dat filter
document.addEventListener("click", e => {
  const card = e.target.closest(".category-card");
  if (card) {
    $("#brandFilter").value = card.dataset.brand; $("#categoryFilter").value = card.dataset.cat; $("#search").value = "";
    renderInventory(); go("inventory");
  }
});

// Voorraad: bewerken / verwijderen
document.addEventListener("click", e => {
  const addc = e.target.closest("[data-add-cat]");
  if (addc) return openModal(null, null, addc.dataset.addCat);
  const ed = e.target.closest("[data-edit]"), del = e.target.closest("[data-del]");
  if (ed) openModal(inventory.find(x => x.id === ed.dataset.edit));
  if (del && confirm("Dit onderdeel verwijderen?")) { inventory = inventory.filter(x => x.id !== del.dataset.del); persist(); renderAll(); toast("Onderdeel verwijderd"); }
});

// Voorraad opslaan — zelfde merk/onderdeel/model telt op i.p.v. dubbele regel
$("#stockForm").addEventListener("submit", e => {
  e.preventDefault();
  const id = $("#editId").value;
  const data = {
    brand: $("#brand").value, category: $("#category").value, model: $("#model").value.trim(),
    quantity: Math.max(0, Math.floor(Number($("#quantity").value) || 0)), sell: Math.max(0, Number($("#sell").value) || 0)
  };
  if (!data.model) return;
  if (id) {
    inventory = inventory.map(x => x.id === id ? { ...x, ...data } : x);
    toast("Wijzigingen opgeslagen");
  } else {
    const dup = inventory.find(x => x.brand === data.brand && x.category === data.category && x.model.toLowerCase() === data.model.toLowerCase());
    if (dup) { dup.quantity += data.quantity; dup.sell = data.sell; toast(`Aantal opgehoogd: ${dup.model} → ${dup.quantity}`); }
    else { inventory.push({ id: Date.now().toString(), ...data, created: Date.now() }); toast("Onderdeel toegevoegd"); }
  }
  persist(); renderAll(); closeModal();
});

// Reparaties: bewerken / verwijderen / opslaan
$("#repairTableBody").addEventListener("click", e => {
  const ed = e.target.closest("[data-edit-repair]"), del = e.target.closest("[data-del-repair]");
  if (ed) openRepair(repairs.find(x => x.id === ed.dataset.editRepair));
  if (del && confirm("Deze reparatie verwijderen?")) { repairs = repairs.filter(x => x.id !== del.dataset.delRepair); persist(); renderAll(); toast("Reparatie verwijderd"); }
});
$("#repairForm").addEventListener("submit", e => {
  e.preventDefault();
  const id = $("#repairId").value || Date.now().toString();
  const item = {
    id, date: $("#repairDate").value, customer: $("#repairCustomer").value.trim(), phone: $("#repairPhone").value.trim(),
    device: $("#repairDevice").value.trim(), type: $("#repairType").value.trim(), price: Math.max(0, Number($("#repairPrice").value) || 0)
  };
  const i = repairs.findIndex(x => x.id === id);
  if (i >= 0) repairs[i] = item; else repairs.push(item);
  persist(); renderAll(); closeRepair(); toast("Reparatie opgeslagen");
});

// Modals sluiten
["#closeModal", "#cancelModal"].forEach(s => $(s).addEventListener("click", closeModal));
["#closeRepairModal", "#cancelRepair"].forEach(s => $(s).addEventListener("click", closeRepair));
$("#modal").addEventListener("click", e => { if (e.target.id === "modal") closeModal(); });
$("#repairModal").addEventListener("click", e => { if (e.target.id === "repairModal") closeRepair(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") { closeModal(); closeRepair(); closeSidebar(); } });

// Back-up & herstel (gegevens staan alleen in deze browser)
$("#exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify({ inventory, repairs, exported: new Date().toISOString() }, null, 2)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `monkeyphones-backup-${todayStr()}.json`; a.click();
  URL.revokeObjectURL(a.href); toast("Back-up gedownload");
});
$("#importBtn").addEventListener("click", () => $("#importFile").click());
$("#importFile").addEventListener("change", async e => {
  const file = e.target.files[0]; e.target.value = ""; if (!file) return;
  try {
    const d = JSON.parse(await file.text());
    if (!Array.isArray(d.inventory) || !Array.isArray(d.repairs)) throw 0;
    if (!confirm("Alle huidige gegevens vervangen door deze back-up?")) return;
    inventory = d.inventory.map(x => ({ ...x, quantity: Number(x.quantity) || 0, sell: Number(x.sell) || 0 }));
    repairs = d.repairs.map(x => ({ ...x, price: Number(x.price) || 0 }));
    persist(); renderAll(); toast("Back-up hersteld");
  } catch { toast("Ongeldig back-upbestand"); }
});

window.addEventListener("hashchange", () => go(location.hash.slice(1)));
renderAll();
go(location.hash.slice(1) || "dashboard");
