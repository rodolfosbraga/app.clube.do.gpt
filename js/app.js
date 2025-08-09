// ===============================
// Helpers DOM
// ===============================
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

// ===============================
// DOM Elements (existentes no seu HTML)
// ===============================
const sidebar       = $("#sidebar");
const collapseBtn   = $("#collapseBtn");

const searchTabs    = $("#searchTabs");
const tabsContainer = $("#categoryTabs");
const contentEl     = $("#content");
const searchInput   = $("#searchInput");
const searchBtn     = $("#searchBtn");
const favoritesBtn  = $("#favoritesBtn");
const sectionTitle  = $("#sectionTitle");

// Seções adicionais (render dinâmico)
const suggestionsSection = $("#suggestionsSection");
const configSection      = $("#configSection");
const profileSection     = $("#profileSection");
const supportSection     = $("#supportSection");
const clubSection        = $("#clubSection");

// Import Modal
const importModal   = $("#importModal");
const importForm    = $("#importForm");

// Toast
const toastEl       = $("#toast");

// ===============================
// Estado global
// ===============================
let categories = [];
let gpts = [];            // catálogo estático (arquivo)
let userGpts = [];        // importados do usuário (Supabase)

// user-state (favoritos/ratings)
let favSet = new Set();   // títulos favoritos
let ratingsMap = new Map();// title -> {stars, comment}

// sessão
let USER_ID = document.documentElement.dataset.userId || "";

// acesso Supabase
const sb = window.supabaseClient || null;

// ===============================
// CSS Vars helper (para posicionamento se precisar)
// ===============================
const getCssVar = (name) =>
  parseInt(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;

// ===============================
// Toast
// ===============================
function showToast(msg, timeout = 5000) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.hidden = false;
  toastEl.classList.add("show");
  setTimeout(() => {
    toastEl.classList.remove("show");
    toastEl.hidden = true;
    toastEl.textContent = "";
  }, timeout);
}

// ===============================
// Local Fallbacks (quando Supabase indisponível)
// ===============================
const LS_KEYS = {
  favorites: "favorites",
  ratings:   "ratings",   // {title:{stars,comment}}
  user_gpts: "user_gpts"  // array de objetos
};

function loadLocalState() {
  try {
    const favs = JSON.parse(localStorage.getItem(LS_KEYS.favorites) || "[]");
    favSet = new Set(favs);
  } catch {}
  try {
    const r = JSON.parse(localStorage.getItem(LS_KEYS.ratings) || "{}");
    ratingsMap = new Map(Object.entries(r));
  } catch {}
  try {
    userGpts = JSON.parse(localStorage.getItem(LS_KEYS.user_gpts) || "[]");
  } catch {}
}

function saveLocalFavorites() {
  localStorage.setItem(LS_KEYS.favorites, JSON.stringify([...favSet]));
}
function saveLocalRatings() {
  const obj = {};
  ratingsMap.forEach((v, k) => (obj[k] = v));
  localStorage.setItem(LS_KEYS.ratings, JSON.stringify(obj));
}
function saveLocalUserGpts() {
  localStorage.setItem(LS_KEYS.user_gpts, JSON.stringify(userGpts));
}

// ===============================
// Supabase sync (opcional/robusto)
// ===============================
async function sbGetSession() {
  if (!sb) return null;
  try {
    const { data: { session }, error } = await sb.auth.getSession();
    if (error) throw error;
    return session || null;
  } catch (e) {
    console.warn("Supabase session error:", e);
    return null;
  }
}

async function loadUserDataFromSupabase() {
  if (!sb || !USER_ID) return;

  try {
    // favorites
    const { data: favs, error: eFav } = await sb.from("favorites")
      .select("title, link, category")
      .order("created_at", { ascending: false });
    if (!eFav && Array.isArray(favs)) {
      favSet = new Set(favs.map(f => f.title));
    }

    // ratings
    const { data: rates, error: eRat } = await sb.from("ratings")
      .select("title, stars, comment");
    if (!eRat && Array.isArray(rates)) {
      ratingsMap = new Map(rates.map(r => [r.title, { stars: r.stars, comment: r.comment || "" }]));
    }

    // user_gpts
    const { data: ug, error: eUG } = await sb.from("user_gpts")
      .select("name, link, tools, prompt, category")
      .order("created_at", { ascending: false });
    if (!eUG && Array.isArray(ug)) {
      userGpts = ug.map(x => ({
        title: x.name,
        category: x.category || "Favoritos",
        desc: x.prompt || "",
        tools: Array.isArray(x.tools) ? x.tools : String(x.tools || "").split(",").map(s => s.trim()).filter(Boolean),
        prompt: x.prompt || "",
        link: x.link || "#",
        _imported: true
      }));
    }

    // salva fallback local também
    saveLocalFavorites();
    saveLocalRatings();
    saveLocalUserGpts();
  } catch (e) {
    console.warn("Supabase load error:", e);
  }
}

// ===============================
// Catálogo estático
// ===============================
async function loadCatalog() {
  try {
    const resp = await fetch("data/catalog.html");
    const text = await resp.text();
    const doc  = new DOMParser().parseFromString(text, "text/html");

    // Captura categorias e GPTs
    const blocks = Array.from(doc.querySelectorAll(".category-block"));
    categories = [];
    gpts = [];

    blocks.forEach(block => {
      const catTitle = block.querySelector(".category-title")?.textContent?.trim();
      if (catTitle && !categories.includes(catTitle)) categories.push(catTitle);

      Array.from(block.querySelectorAll("details")).forEach(detail => {
        const title   = detail.querySelector("summary")?.textContent?.trim() || "";
        const content = detail.querySelector(".content");
        const linkEl  = content?.querySelector("a");
        const link    = linkEl ? linkEl.href : "#";

        let desc = "", tools = "", prompt = "";
        content?.querySelectorAll("p")?.forEach(p => {
          const strong = p.querySelector("strong");
          if (!strong) return;
          const label = strong.textContent.replace(":", "").trim();
          const txt   = p.textContent.replace(strong.textContent, "").trim();
          if (label === "Descrição")        desc    = txt;
          else if (label === "Ferramentas") tools   = txt;
          else if (label === "Prompt Ideal") prompt = txt;
        });

        gpts.push({
          title,
          category: catTitle || "Outros",
          desc,
          tools: tools ? tools.split(/,| e /).map(s => s.trim()).filter(Boolean) : [],
          prompt,
          link
        });
      });
    });

    // Tabs padrão + Favoritos
    if (!categories.includes("Favoritos")) categories.push("Favoritos");

  } catch (e) {
    console.error("Erro ao carregar catálogo:", e);
  }
}

// ===============================
// UI setup
// ===============================
function buildTabs() {
  tabsContainer.innerHTML = "";
  categories.forEach(cat => {
    const btn = document.createElement("button");
    btn.className = "tabs__btn";
    btn.textContent = cat;
    btn.dataset.cat = cat;
    btn.dataset.action = "selectCategory";
    btn.addEventListener("click", () => selectCategory(cat, btn));
    tabsContainer.appendChild(btn);
  });
}

function markActiveTab(cat) {
  $$(".tabs__btn").forEach(b => b.classList.toggle("active", b.dataset.cat === cat));
}

function renderCards(list) {
  contentEl.innerHTML = "";
  if (!list || !list.length) {
    contentEl.innerHTML = `<p style="text-align:center;color:#888;">Nenhum GPT encontrado.</p>`;
    return;
  }

  list.forEach(gpt => {
    const favActive = favSet.has(gpt.title);
    const currentRating = ratingsMap.get(gpt.title)?.stars || 0;

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <h3>${gpt.title}</h3>
      <p>${gpt.desc || ""}</p>
      ${gpt.tools?.length ? `<p><strong>Ferramentas:</strong> ${gpt.tools.join(", ")}</p>` : ""}
      ${gpt.prompt ? `<p><strong>Prompt Ideal:</strong> ${gpt.prompt}</p>` : ""}
      <div class="card-actions">
        <a class="btn-open" href="${gpt.link || "#"}" target="_blank" rel="noopener" data-action="openGPT">Abrir GPT</a>
        <div class="right-actions" style="display:flex;align-items:center;gap:.5rem;">
          <div class="rating" data-title="${gpt.title}">
            ${[1,2,3,4,5].map(n => `
              <button class="star" data-star="${n}" aria-label="${n} estrela${n>1?'s':''}">
                ${n <= currentRating ? "★" : "☆"}
              </button>
            `).join("")}
          </div>
          <button class="fav-card-btn" title="Favoritar" data-title="${gpt.title}" data-link="${gpt.link||'#'}" data-category="${gpt.category||''}">
            ${favActive ? "★" : "☆"}
          </button>
        </div>
      </div>
    `;
    // Handlers do card
    const favBtn = card.querySelector(".fav-card-btn");
    favBtn.addEventListener("click", () => toggleFavorite(
      favBtn.dataset.title, favBtn.dataset.link, favBtn.dataset.category
    ));

    card.querySelectorAll(".rating .star").forEach(starBtn => {
      starBtn.addEventListener("click", () => {
        const stars = parseInt(starBtn.dataset.star, 10);
        setRating(gpt.title, stars).then(() => {
          // Atualiza UI das estrelas
          card.querySelectorAll(".rating .star").forEach(btn => {
            const n = parseInt(btn.dataset.star, 10);
            btn.textContent = n <= stars ? "★" : "☆";
          });
        });
      });
    });

    contentEl.appendChild(card);
  });
}

// ===============================
// Ações: Favoritos / Ratings
// ===============================
async function toggleFavorite(title, link = "#", category = "") {
  if (favSet.has(title)) {
    favSet.delete(title);
    // Supabase
    if (sb && USER_ID) {
      try {
        await sb.from("favorites").delete().match({ title });
      } catch (e) {
        console.warn("SB remove favorite:", e);
      }
    }
  } else {
    favSet.add(title);
    if (sb && USER_ID) {
      try {
        await sb.from("favorites").insert({ title, link, category });
      } catch (e) {
        console.warn("SB add favorite:", e);
      }
    }
  }
  saveLocalFavorites();
  // Re-render categoria atual
  const active = $(".tabs__btn.active");
  if (active) selectCategory(active.dataset.cat, active);
}

async function setRating(title, stars, comment = "") {
  ratingsMap.set(title, { stars, comment });
  saveLocalRatings();

  if (sb && USER_ID) {
    try {
      // upsert por (user_id,title) — como não temos unique por user_id no SQL,
      // fazemos delete+insert simples:
      await sb.from("ratings").delete().match({ title });
      await sb.from("ratings").insert({ title, stars, comment });
    } catch (e) {
      console.warn("SB rating:", e);
    }
  }
}

// ===============================
// Importar GPT (modal)
// ===============================
function openImportModal() {
  if (typeof importModal?.showModal === "function") importModal.showModal();
  else importModal?.setAttribute("open", "");
}
function closeImportModal() {
  if (typeof importModal?.close === "function") importModal.close();
  else importModal?.removeAttribute("open");
}

function wireImportModal() {
  if (!importForm) return;
  // abrir via menu "Adicione o seu GPT"
  // (considera data-section "adicionar" OU label com texto semelhante)
  $$(".menu li").forEach(li => {
    const sec = (li.dataset.section || "").toLowerCase();
    const label = li.textContent.trim().toLowerCase();
    if (sec === "adicionegpt" || sec === "addgpt" || sec === "adicionar" || label.includes("adicione o seu gpt")) {
      li.addEventListener("click", (e) => {
        e.preventDefault();
        openImportModal();
      });
    }
  });

  // Fechar
  $("#importCloseBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    closeImportModal();
  });

  // Salvar
  $("#importSaveBtn")?.addEventListener("click", async (e) => {
    e.preventDefault();
    const formData = new FormData(importForm);
    const payload = {
      user_id: USER_ID || undefined,
      link:   (formData.get("link")  || "").toString().trim(),
      name:   (formData.get("name")  || "").toString().trim(),
      tools:  (formData.get("tools") || "").toString().split(",").map(s => s.trim()).filter(Boolean),
      prompt: (formData.get("prompt")|| "").toString().trim(),
    };

    if (!payload.link || !payload.name) {
      showToast("Preencha link e nome do GPT.", 4000);
      return;
    }

    try {
      if (sb && USER_ID) {
        await sb.from("user_gpts").insert(payload);
      } else {
        // fallback local
        userGpts.unshift({
          title: payload.name,
          category: "Favoritos",
          desc: payload.prompt,
          tools: payload.tools,
          prompt: payload.prompt,
          link: payload.link,
          _imported: true
        });
        saveLocalUserGpts();
      }
      // Atualiza memória (mesmo com SB, adiciona para render imediato)
      userGpts.unshift({
        title: payload.name,
        category: "Favoritos",
        desc: payload.prompt,
        tools: payload.tools,
        prompt: payload.prompt,
        link: payload.link,
        _imported: true
      });
      showToast("GPT importado com sucesso! ✅", 4000);
      closeImportModal();

      // se estiver em Favoritos, re-render
      const active = $(".tabs__btn.active");
      if (active?.dataset.cat === "Favoritos") {
        selectCategory("Favoritos", active);
      }
    } catch (err) {
      console.error("Erro ao importar GPT:", err);
      showToast("Erro ao importar GPT.", 4000);
    }
  });
}

// ===============================
// Sugestões (form)
// ===============================
function wireSuggestionForm() {
  const form = $("#suggestionForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(form);

    // monta payload a partir de data-col
    const payload = {};
    form.querySelectorAll("[data-col]").forEach(el => {
      const col = el.dataset.col;
      let val = formData.get(el.name);
      if (el.type === "file") {
        // TODO: implement storage depois; por ora, ignoramos arquivo
        val = null;
      }
      payload[col] = val;
    });
    if (USER_ID) payload.user_id = USER_ID;

    try {
      if (sb && USER_ID) {
        await sb.from("suggestions").insert(payload);
      }
      // toast
      const msg = form.dataset.successToast || "Obrigado pela sugestão!";
      const t   = parseInt(form.dataset.successTimeout || "5000", 10);
      showToast(msg, t);
      form.reset();
    } catch (err) {
      console.error("Erro ao enviar sugestão:", err);
      showToast("Erro ao enviar sugestão.", 4000);
    }
  });
}

// ===============================
// Perfil + Config (darkmode, prefs)
// ===============================
function wireProfileForm() {
  const form = $("#profileForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const payload = {};
    form.querySelectorAll("[data-col]").forEach(el => {
      const col = el.dataset.col;
      let val = fd.get(el.name);
      if (col === "preferences") {
        // pode ser CSV; guarda como texto mesmo (ou JSON se quiser evoluir)
        payload[col] = (val || "").toString();
      } else {
        payload[col] = val;
      }
    });
    if (USER_ID) payload.user_id = USER_ID;

    try {
      if (sb && USER_ID) {
        // verifica se já existe profile
        const { data: existing } = await sb.from("profiles").select("id").limit(1);
        if (existing && existing.length) {
          await sb.from("profiles").update(payload).eq("user_id", USER_ID);
        } else {
          await sb.from("profiles").insert(payload);
        }
        showToast("Perfil salvo com sucesso! ✅", 3000);
      } else {
        showToast("Sem sessão: perfil não foi salvo no servidor.", 4000);
      }
    } catch (err) {
      console.error("Salvar perfil:", err);
      showToast("Erro ao salvar perfil.", 4000);
    }
  });
}

function wireConfig() {
  const darkToggle = $("#darkModeToggle");
  const prefCats   = $("#prefCategories");

  // estado inicial (localStorage primeiro; depois tenta carregar do server)
  const LS_THEME = "pref_darkmode";
  const LS_PREFS = "pref_categories";
  const savedDark = localStorage.getItem(LS_THEME);
  const savedCats = localStorage.getItem(LS_PREFS);
  if (savedDark !== null) {
    const v = savedDark === "true";
    darkToggle && (darkToggle.checked = v);
    document.documentElement.classList.toggle("dark", v);
  }
  if (savedCats !== null && prefCats) prefCats.value = savedCats;

  darkToggle?.addEventListener("change", async () => {
    const enabled = !!darkToggle.checked;
    document.documentElement.classList.toggle("dark", enabled);
    localStorage.setItem(LS_THEME, String(enabled));
    // salva no profiles.darkmode
    try {
      if (sb && USER_ID) {
        const { data: existing } = await sb.from("profiles").select("id").limit(1);
        if (existing && existing.length) {
          await sb.from("profiles").update({ darkmode: enabled }).eq("user_id", USER_ID);
        } else {
          await sb.from("profiles").insert({ user_id: USER_ID, darkmode: enabled });
        }
      }
    } catch (e) {
      console.warn("darkmode save:", e);
    }
  });

  prefCats?.addEventListener("change", async () => {
    const val = prefCats.value.trim();
    localStorage.setItem(LS_PREFS, val);
    try {
      if (sb && USER_ID) {
        const { data: existing } = await sb.from("profiles").select("id").limit(1);
        if (existing && existing.length) {
          await sb.from("profiles").update({ preferences: { categories: val } }).eq("user_id", USER_ID);
        } else {
          await sb.from("profiles").insert({ user_id: USER_ID, preferences: { categories: val } });
        }
      }
    } catch (e) {
      console.warn("prefs save:", e);
    }
  });
}

// ===============================
// Busca
// ===============================
function doSearch() {
  const term = (searchInput.value || "").trim().toLowerCase();
  const activeTab = $(".tabs__btn.active")?.dataset.cat;
  const pool = activeTab === "Favoritos"
    ? getFavoritesList()
    : gpts;
  const list = pool.filter(g =>
    g.title.toLowerCase().includes(term) ||
    (g.desc || "").toLowerCase().includes(term) ||
    (g.tools || []).join(" ").toLowerCase().includes(term) ||
    (g.prompt || "").toLowerCase().includes(term)
  );
  renderCards(list);
}

// ===============================
// Listas por categoria
// ===============================
function getFavoritesList() {
  // Favoritos são: itens do catálogo cujo title está no favSet
  const favFromCatalog = gpts.filter(g => favSet.has(g.title));
  // + importados do usuário
  const imports = userGpts.slice(); // já em "Favoritos"
  // Unir evitando duplicatas pelo título
  const titles = new Set();
  const merged = [];
  [...imports, ...favFromCatalog].forEach(item => {
    if (!titles.has(item.title)) {
      titles.add(item.title);
      merged.push(item);
    }
  });
  return merged;
}

function selectCategory(cat, btn) {
  markActiveTab(cat);
  sectionTitle.textContent = cat;

  // exibe/oculta a barra superior
  searchTabs.style.display   = (cat === "Favoritos" || categories.includes(cat)) ? "block" : "none";
  sectionTitle.style.display = (cat === "Favoritos" || categories.includes(cat)) ? "block" : "none";

  // decide lista
  const list = (cat === "Favoritos")
    ? getFavoritesList()
    : gpts.filter(g => g.category === cat);

  renderCards(list);
}

// ===============================
// Navegação lateral
// ===============================
function wireSidebarNav() {
  $$("#sidebar .menu li").forEach(li => {
    li.addEventListener("click", (e) => {
      const sec = (li.dataset.section || "").toLowerCase();

      // reset estados de página
      document.body.classList.remove("gpts-active","favoritos-active","sugestoes-active");

      // rotas principais
      if (sec === "gpts") {
        searchTabs.style.display = "block";
        sectionTitle.style.display = "block";
        document.body.classList.add("gpts-active");
        // selecionar primeira categoria (não favorit.)
        const firstCatBtn = $$(".tabs__btn").find(b => b.dataset.cat !== "Favoritos");
        (firstCatBtn || $(".tabs__btn"))?.click();
      }
      else if (sec === "favoritos") {
        searchTabs.style.display = "block";
        sectionTitle.style.display = "block";
        document.body.classList.add("gpts-active", "favoritos-active");
        const favBtn = $$(".tabs__btn").find(b => b.dataset.cat === "Favoritos");
        favBtn?.click();
      }
      else if (sec === "sugestoes") {
        searchTabs.style.display = "none";
        sectionTitle.style.display = "none";
        // mostra a seção de sugestões
        showOnlySection(suggestionsSection);
      }
      else if (sec === "config") {
        searchTabs.style.display = "none";
        sectionTitle.style.display = "none";
        showOnlySection(configSection);
      }
      else if (sec === "perfil") {
        searchTabs.style.display = "none";
        sectionTitle.style.display = "none";
        showOnlySection(profileSection);
      }
      else if (sec === "suporte") {
        searchTabs.style.display = "none";
        sectionTitle.style.display = "none";
        showOnlySection(supportSection);
      }
      else if (sec === "clube") {
        searchTabs.style.display = "none";
        sectionTitle.style.display = "none";
        showOnlySection(clubSection);
      }
      else if (sec === "cadastro") {
        // mantém "em breve"
        searchTabs.style.display = "none";
        sectionTitle.style.display = "none";
        contentEl.innerHTML = `<div class="em-breve">Em breve!</div>`;
        hideAllSections();
      }
      else if (sec === "sair") {
        doLogout();
      }
    });
  });
}

function hideAllSections() {
  [suggestionsSection, configSection, profileSection, supportSection, clubSection]
    .forEach(sec => sec && (sec.hidden = true));
}
function showOnlySection(sectionEl) {
  hideAllSections();
  if (sectionEl) {
    sectionEl.hidden = false;
    contentEl.innerHTML = ""; // esvazia cards
  }
}

// ===============================
// Sidebar collapse
// ===============================
function updateCollapseBtnPosition() {
  const headerHeight  = getCssVar('--header-height');
  const sidebarHeight = sidebar.offsetHeight;
  const btnHeight     = collapseBtn.offsetHeight;
  let newTop = headerHeight + (sidebarHeight / 2) - (btnHeight / 2);

  if (window.innerWidth < 700) {
    newTop = headerHeight + ((window.innerHeight - headerHeight) / 2) - (btnHeight / 2);
  }
  collapseBtn.style.top = `${newTop}px`;
}

function wireSidebarCollapse() {
  collapseBtn?.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
    const isCollapsed = sidebar.classList.contains("collapsed");
    collapseBtn.textContent = isCollapsed ? "›" : "‹";
    updateCollapseBtnPosition();
  });

  // fecha no mobile ao clicar fora
  document.addEventListener("click", (e) => {
    if (window.innerWidth < 700) {
      if (!sidebar.contains(e.target) && !collapseBtn.contains(e.target) && !sidebar.classList.contains("collapsed")) {
        sidebar.classList.add("collapsed");
        collapseBtn.textContent = "›";
        updateCollapseBtnPosition();
      }
    }
  });
}

// ===============================
// Logout
// ===============================
async function doLogout() {
  try {
    if (sb?.auth) await sb.auth.signOut();
  } catch(e) {
    console.warn("Erro ao sair:", e);
  }
  localStorage.clear();
  sessionStorage.clear();
  window.location.href = "index.html";
}

// ===============================
// Init
// ===============================
async function init() {
  // Carrega fallback local
  loadLocalState();

  // Sessão Supabase
  const session = await sbGetSession();
  USER_ID = session?.user?.id || USER_ID || "";

  // Carrega dados do usuário do Supabase (favoritos, ratings, imports)
  await loadUserDataFromSupabase();

  // Carrega catálogo estático
  await loadCatalog();

  // Monta UI inicial
  buildTabs();
  wireSidebarNav();
  wireSidebarCollapse();
  wireImportModal();
  wireSuggestionForm();
  wireProfileForm();
  wireConfig();

  // Busca
  searchBtn?.addEventListener("click", doSearch);
  searchInput?.addEventListener("input", doSearch);
  favoritesBtn?.addEventListener("click", () => {
    const favTab = $$(".tabs__btn").find(b => b.dataset.cat === "Favoritos");
    favTab?.click();
  });

  // Abre GPTs por padrão
  const firstCatBtn = $$(".tabs__btn").find(b => b.dataset.cat !== "Favoritos");
  (firstCatBtn || $(".tabs__btn"))?.click();

  // Posiciona collapse-btn
  updateCollapseBtnPosition();
  window.addEventListener("resize", updateCollapseBtnPosition);
}

document.addEventListener("DOMContentLoaded", init);
