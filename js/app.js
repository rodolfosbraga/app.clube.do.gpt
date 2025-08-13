// ===============================
// Helpers
// ===============================
const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
const setCssVar = (name, value) => document.documentElement.style.setProperty(name, String(value));

let sb = null;                                    // client mutável
const getSB = () => window.supabaseClient || sb;

let USER_ID = "";                                  // setado no init()

// ===============================
// DOM Elements (existentes)
const sidebar       = $("#sidebar");
const collapseBtn   = $("#collapseBtn");

const searchTabs    = $("#searchTabs");
const tabsContainer = $("#categoryTabs");
const contentEl     = $("#content");
const searchInput   = $("#searchInput");
const searchBtn     = $("#searchBtn");
const favoritesBtn  = $("#favoritesBtn");
const sectionTitle  = $("#sectionTitle");

// Seções declaradas no HTML
const suggestionsSection = $("#suggestionsSection");
const configSection      = $("#configSection");
const profileSection     = $("#profileSection");
const supportSection     = $("#supportSection");
const clubSection        = $("#clubSection");

// Toast
const toastEl       = $("#toast");

// (não usamos mais o modal, mas manter não quebra)
const importModal = $("#importModal");
const importForm  = $("#importForm");

// ===============================
// Estado
let categories = [];
let gpts = [];
let userGpts = [];

let favSet = new Set();        // títulos
let ratingsMap = new Map();    // title -> {stars, comment}

// LocalStorage Keys
const LS = {
  favorites: "favorites",
  ratings:   "ratings",
  user_gpts: "user_gpts"
};

// ===============================
// Utilidades
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

function getCssVar(name) {
  // Lê var CSS numérica (ex.: "--header-height: 100px") e devolve Number
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!raw) return 0;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

// Medir alturas reais e sincronizar as variáveis CSS usadas no layout
function syncLayoutVars() {
  const topbarEl = $(".topbar");
  const hh = topbarEl ? topbarEl.offsetHeight : 0;
  if (hh) setCssVar("--header-height", `${hh}px`);

  // mede altura da barra fixa apenas quando visível (GPTs/Favoritos)
  if (searchTabs && searchTabs.style.display !== "none") {
    // garante uma medição confiável mesmo com transições
    const prevVis = searchTabs.style.visibility;
    searchTabs.style.visibility = "hidden";
    const stHeight = searchTabs.offsetHeight || getCssVar("--search-tabs-height") || 80;
    searchTabs.style.visibility = prevVis || "";
    setCssVar("--search-tabs-height", `${stHeight}px`);
  }
}

// ===============================
// Local state fallbacks
function loadLocalState() {
  try { favSet = new Set(JSON.parse(localStorage.getItem(LS.favorites) || "[]")); } catch {}
  try {
    const r = JSON.parse(localStorage.getItem(LS.ratings) || "{}");
    ratingsMap = new Map(Object.entries(r));
  } catch {}
  try { userGpts = JSON.parse(localStorage.getItem(LS.user_gpts) || "[]"); } catch {}
}
function saveLocalFavorites(){ localStorage.setItem(LS.favorites, JSON.stringify([...favSet])); }
function saveLocalRatings(){ const o={}; ratingsMap.forEach((v,k)=>o[k]=v); localStorage.setItem(LS.ratings, JSON.stringify(o)); }
function saveLocalUserGpts(){ localStorage.setItem(LS.user_gpts, JSON.stringify(userGpts)); }

// ===============================
// Supabase helpers
async function sbGetSession() {
  const c = getSB();
  if (!c) return null;
  try {
    const { data: { session } } = await c.auth.getSession();
    return session || null;
  } catch { return null; }
}

async function loadUserDataFromSupabase() {
  const c = getSB();
  if (!c || !USER_ID) return;
  try {
    // favorites
    const { data: favs } = await c.from("favorites").select("title, link, category");
    if (Array.isArray(favs)) favSet = new Set(favs.map(f => f.title));

    // ratings
    const { data: rates } = await c.from("ratings").select("title, stars, comment");
    if (Array.isArray(rates)) ratingsMap = new Map(rates.map(r => [r.title, {stars:r.stars, comment:r.comment||""}]));

    // user_gpts
    const { data: ug } = await c.from("user_gpts").select("name, link, tools, prompt, category").order("created_at", {ascending:false});
    if (Array.isArray(ug)) {
      userGpts = ug.map(x => ({
        title: x.name,
        category: x.category || "Favoritos",
        desc: x.prompt || "",
        tools: Array.isArray(x.tools) ? x.tools : String(x.tools||"").split(",").map(s=>s.trim()).filter(Boolean),
        prompt: x.prompt || "",
        link: x.link || "#",
        _imported: true
      }));
    }

    // salva fallback local também
    saveLocalFavorites(); saveLocalRatings(); saveLocalUserGpts();
  } catch (e) {
    console.warn("Supabase load error:", e);
  }
}

// ===============================
// Catálogo estático
async function loadCatalog() {
  try {
    const resp = await fetch("data/catalog.html");
    const text = await resp.text();
    const doc  = new DOMParser().parseFromString(text, "text/html");

    const blocks = Array.from(doc.querySelectorAll(".category-block"));
    categories = []; gpts = [];

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
          tools: tools ? tools.split(/,| e /).map(s=>s.trim()).filter(Boolean) : [],
          prompt,
          link
        });
      });
    });

    if (!categories.includes("Favoritos")) categories.push("Favoritos");
  } catch (e) { console.error("Erro catálogo:", e); }
}

// ===============================
// UI: Tabs/Cards
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
  if (!list?.length) {
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
        <a class="btn-open" href="${gpt.link||'#'}" target="_blank" rel="noopener">Abrir GPT</a>
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
    // handlers
    const favBtn = card.querySelector(".fav-card-btn");
    favBtn.addEventListener("click", () => toggleFavorite(
      favBtn.dataset.title, favBtn.dataset.link, favBtn.dataset.category
    ));
    card.querySelectorAll(".rating .star").forEach(starBtn => {
      starBtn.addEventListener("click", () => {
        const stars = parseInt(starBtn.dataset.star, 10);
        setRating(gpt.title, stars).then(() => {
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
// Ações: favoritos/ratings
async function toggleFavorite(title, link = "#", category = "") {
  const c = getSB();
  if (favSet.has(title)) {
    favSet.delete(title);
    if (c && USER_ID) {
      try { await c.from("favorites").delete().match({ title }); } catch(e){ console.warn(e); }
    }
  } else {
    favSet.add(title);
    if (c && USER_ID) {
      try { await c.from("favorites").insert({ title, link, category }); } catch(e){ console.warn(e); }
    }
  }
  saveLocalFavorites();
  const active = $(".tabs__btn.active");
  if (active) selectCategory(active.dataset.cat, active);
}
async function setRating(title, stars, comment = "") {
  const c = getSB();
  ratingsMap.set(title, { stars, comment });
  saveLocalRatings();
  if (c && USER_ID) {
    try {
      await c.from("ratings").delete().match({ title });
      await c.from("ratings").insert({ title, stars, comment });
    } catch(e){ console.warn(e); }
  }
}

// ===============================
// Importar GPT (inline no main)
function renderImportInline() {
  // esconde barra de busca/tabs e mostra apenas o formulário no main
  searchTabs.style.display = "none";
  sectionTitle.style.display = "none";
  hideAllSections();
  contentEl.innerHTML = `
    <section id="importSection">
      <div class="inner">
        <h3 class="use-cinzel">Importar GPT</h3>
        <form id="importInlineForm" data-table="user_gpts" class="import-form">
          <input type="hidden" name="user_id" value="${USER_ID}">
          <div class="form-group">
            <label>Link do GPT
              <input type="url" name="link" placeholder="https://chatgpt.com/g/..." required>
            </label>
          </div>
          <div class="form-group">
            <label>Nome do GPT
              <input type="text" name="name" placeholder="Meu GPT" required>
            </label>
          </div>
          <div class="form-group">
            <label>Ferramentas (separe por vírgula)
              <input type="text" name="tools" placeholder="Browser, DALL·E">
            </label>
          </div>
          <div class="form-group">
            <label>Prompt curto ideal
              <input type="text" name="prompt" placeholder="Descreva em 1 frase">
            </label>
          </div>
          <div style="display:flex; gap:.5rem; justify-content:flex-end; margin-top:.5rem;">
            <button type="button" id="importCancelBtn">Cancelar</button>
            <button type="submit" id="importSubmitBtn">Salvar</button>
          </div>
        </form>
      </div>
    </section>
  `;
  // handlers
  $("#importCancelBtn")?.addEventListener("click", () => {
    // volta para GPTs
    const firstCatBtn = $$(".tabs__btn").find(b => b.dataset.cat !== "Favoritos");
    searchTabs.style.display = "block"; sectionTitle.style.display = "block";
    (firstCatBtn || $(".tabs__btn"))?.click();
  });

  $("#importInlineForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const c = getSB();
    const fd = new FormData(e.currentTarget);
    const payload = {
      user_id: USER_ID || undefined,
      link:   (fd.get("link")  || "").toString().trim(),
      name:   (fd.get("name")  || "").toString().trim(),
      tools:  (fd.get("tools") || "").toString().split(",").map(s=>s.trim()).filter(Boolean),
      prompt: (fd.get("prompt")|| "").toString().trim()
    };
    if (!payload.link || !payload.name) { showToast("Preencha link e nome do GPT.", 4000); return; }

    try {
      if (c && USER_ID) await c.from("user_gpts").insert(payload);
      // atualiza lista local para render imediato
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
      showToast("GPT importado com sucesso! ✅", 4000);

      // vai para Favoritos
      searchTabs.style.display = "block"; sectionTitle.style.display = "block";
      const favTab = $$(".tabs__btn").find(b => b.dataset.cat === "Favoritos");
      favTab?.click();
    } catch (err) {
      console.error("Erro ao importar GPT:", err);
      showToast("Erro ao importar GPT.", 4000);
    }
  });
}

// ===============================
// Sugestões (com Cinzel)
function wireSuggestionForm() {
  const form = $("#suggestionForm");
  if (!form) return;
  suggestionsSection?.classList.add("use-cinzel");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const c = getSB();
    const fd = new FormData(form);
    const payload = {};
    form.querySelectorAll("[data-col]").forEach(el => {
      const col = el.dataset.col;
      let val = fd.get(el.name);
      if (el.type === "file") val = null; // storage depois
      payload[col] = val;
    });
    if (USER_ID) payload.user_id = USER_ID;

    try {
      if (c && USER_ID) await c.from("suggestions").insert(payload);
      showToast(form.dataset.successToast || "Obrigado pela sugestão! 🙌", parseInt(form.dataset.successTimeout||"5000",10));
      form.reset();
    } catch (err) {
      console.error("Sugestão:", err);
      showToast("Erro ao enviar sugestão.", 4000);
    }
  });
}

// ===============================
// Perfil (com Cinzel) + Config (cancelamento)
function wireProfileForm() {
  const form = $("#profileForm");
  if (!form) return;
  profileSection?.classList.add("use-cinzel");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const c = getSB();
    const fd = new FormData(form);
    const payload = {};
    form.querySelectorAll("[data-col]").forEach(el => {
      const col = el.dataset.col;
      let val = fd.get(el.name);
      payload[col] = val;
    });
    if (USER_ID) payload.user_id = USER_ID;

    try {
      if (c && USER_ID) {
        const { data: existing } = await c.from("profiles").select("id").eq("user_id", USER_ID).limit(1);
        if (existing && existing.length) {
          await c.from("profiles").update(payload).eq("user_id", USER_ID);
        } else {
          await c.from("profiles").insert({ user_id: USER_ID, ...payload });
        }
        showToast("Perfil salvo com sucesso! ✅", 3000);
      } else {
        showToast("Sem sessão: perfil não salvo no servidor.", 4000);
      }
    } catch (err) {
      console.error("Perfil:", err);
      showToast("Erro ao salvar perfil.", 4000);
    }
  });
}

function wireConfig() {
  if (!configSection) return;
  // render sob demanda em renderConfigScreen()
}

async function renderConfigScreen() {
  const c = getSB();
  if (!configSection) return;

  configSection.innerHTML = `
    <div class="inner use-cinzel">
      <h3>Configurações</h3>

      <div class="form-group">
        <label for="darkModeToggle">Tema escuro</label>
        <input type="checkbox" id="darkModeToggle" name="darkmode">
      </div>

      <div class="form-group">
        <label for="prefCategories">Preferências de categorias</label>
        <input id="prefCategories" name="pref_categories" type="text" placeholder="Ex.: IA, Marketing, Vendas" />
      </div>

      <div class="form-group">
        <label>Seu plano</label>
        <div id="planInfo">Plano: Starter • Renova em: —</div>
      </div>

      <hr style="margin: 16px 0; opacity:.35;">

      <div class="form-group">
        <label for="cancelReason"><strong>Solicitar cancelamento do plano</strong></label>
        <textarea id="cancelReason" rows="3" placeholder="Conte o motivo do cancelamento (opcional)"></textarea>
        <div style="display:flex;gap:.5rem;justify-content:flex-end;margin-top:.5rem;">
          <button id="cancelPlanBtn">Enviar pedido de cancelamento</button>
        </div>
      </div>
    </div>
  `;

  // Wire dark mode + prefs
  const darkToggle = $("#darkModeToggle");
  const prefCats   = $("#prefCategories");
  const LS_THEME = "pref_darkmode";
  const LS_PREFS = "pref_categories";
  const savedDark = localStorage.getItem(LS_THEME);
  const savedCats = localStorage.getItem(LS_PREFS);

  if (savedDark !== null) {
    const v = savedDark === "true";
    darkToggle.checked = v;
    document.documentElement.classList.toggle("dark", v);
  }
  if (savedCats !== null && prefCats) prefCats.value = savedCats;

  darkToggle.addEventListener("change", async () => {
    const enabled = !!darkToggle.checked;
    document.documentElement.classList.toggle("dark", enabled);
    localStorage.setItem(LS_THEME, String(enabled));
    try {
      if (c && USER_ID) {
        const { data: existing } = await c.from("profiles").select("id").eq("user_id", USER_ID).limit(1);
        if (existing && existing.length) await c.from("profiles").update({ darkmode: enabled }).eq("user_id", USER_ID);
        else await c.from("profiles").insert({ user_id: USER_ID, darkmode: enabled });
      }
    } catch (e) { console.warn("darkmode save:", e); }
  });

  prefCats.addEventListener("change", async () => {
    const val = prefCats.value.trim();
    localStorage.setItem(LS_PREFS, val);
    try {
      if (c && USER_ID) {
        const { data: existing } = await c.from("profiles").select("id").eq("user_id", USER_ID).limit(1);
        if (existing && existing.length) await c.from("profiles").update({ preferences: { categories: val } }).eq("user_id", USER_ID);
        else await c.from("profiles").insert({ user_id: USER_ID, preferences: { categories: val } });
      }
    } catch (e) { console.warn("prefs save:", e); }
  });

  // Cancelamento (usa tabela suggestions com type="cancelamento")
  $("#cancelPlanBtn")?.addEventListener("click", async () => {
    const reason = ($("#cancelReason")?.value || "").trim();
    try {
      if (c && USER_ID) {
        await c.from("suggestions").insert({
          user_id: USER_ID,
          type: "cancelamento",
          title: "Pedido de cancelamento",
          description: reason || "(sem motivo informado)"
        });
        showToast("Pedido de cancelamento enviado. ✅", 4000);
      } else {
        showToast("Sem sessão: não foi possível enviar.", 4000);
      }
    } catch (e) {
      console.error("cancelamento:", e);
      showToast("Erro ao enviar pedido de cancelamento.", 4000);
    }
  });
}

// ===============================
// Busca
function doSearch() {
  const term = (searchInput.value || "").trim().toLowerCase();
  const activeTab = $(".tabs__btn.active")?.dataset.cat;
  const pool = activeTab === "Favoritos" ? getFavoritesList() : gpts;
  const list = pool.filter(g =>
    g.title.toLowerCase().includes(term) ||
    (g.desc||"").toLowerCase().includes(term) ||
    (g.tools||[]).join(" ").toLowerCase().includes(term) ||
    (g.prompt||"").toLowerCase().includes(term)
  );
  renderCards(list);
  // re-sincroniza altura da barra (pode mudar wrap das tabs/inputs)
  syncLayoutVars();
}

// ===============================
// Listas por categoria
function getFavoritesList() {
  const favFromCatalog = gpts.filter(g => favSet.has(g.title));
  const imports = userGpts.slice();
  const titles = new Set(); const merged = [];
  [...imports, ...favFromCatalog].forEach(item => {
    if (!titles.has(item.title)) { titles.add(item.title); merged.push(item); }
  });
  return merged;
}
function selectCategory(cat, btn) {
  markActiveTab(cat);
  sectionTitle.textContent = cat;
  searchTabs.style.display = "block";
  sectionTitle.style.display = "block";
  hideAllSections();

  const list = (cat === "Favoritos")
    ? getFavoritesList()
    : gpts.filter(g => g.category === cat);

  renderCards(list);

  // mede e aplica altura real da barra fixa após render
  requestAnimationFrame(syncLayoutVars);
}

// ===============================
// Navegação lateral
function hideAllSections() {
  [suggestionsSection, configSection, profileSection, supportSection, clubSection]
    .forEach(sec => sec && (sec.hidden = true));
}
function showOnlySection(el) {
  hideAllSections();
  if (el) { el.hidden = false; contentEl.innerHTML = ""; }
}

function wireSidebarNav() {
  const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  $$("#sidebar .menu li").forEach(li => {
    li.addEventListener("click", async (e) => {
      const sec   = norm(li.dataset.section || "");
      const label = norm(li.textContent || "");

      // 🔐 SAIR — prioridade
      if (sec === "sair" || label.includes("sair")) {
        e.preventDefault();
        e.stopPropagation();
        await doLogout();
        return;
      }

      document.body.classList.remove("gpts-active","favoritos-active","sugestoes-active");

      if (sec === "gpts") {
        searchTabs.style.display = "block"; sectionTitle.style.display = "block";
        document.body.classList.add("gpts-active");
        const firstCatBtn = $$(".tabs__btn").find(b => b.dataset.cat !== "Favoritos");
        (firstCatBtn || $(".tabs__btn"))?.click();
        return;
      }
      if (sec === "favoritos") {
        searchTabs.style.display = "block"; sectionTitle.style.display = "block";
        document.body.classList.add("gpts-active","favoritos-active");
        const favTabBtn = $$(".tabs__btn").find(b => b.dataset.cat === "Favoritos");
        favTabBtn?.click();
        return;
      }
      if (sec === "sugestoes") {
        searchTabs.style.display = "none"; sectionTitle.style.display = "none";
        showOnlySection(suggestionsSection);
        // após esconder a barra, atualiza var para o main subir corretamente
        requestAnimationFrame(syncLayoutVars);
        return;
      }
      if (sec === "config") {
        searchTabs.style.display = "none"; sectionTitle.style.display = "none";
        showOnlySection(configSection);
        await renderConfigScreen();
        requestAnimationFrame(syncLayoutVars);
        return;
      }
      if (sec === "perfil") {
        searchTabs.style.display = "none"; sectionTitle.style.display = "none";
        showOnlySection(profileSection);
        requestAnimationFrame(syncLayoutVars);
        return;
      }
      if (sec === "suporte") {
        searchTabs.style.display = "none"; sectionTitle.style.display = "none";
        supportSection.innerHTML = `
          <div class="inner use-cinzel">
            <h3>Suporte</h3>
            <p>Escolha uma das opções abaixo:</p>
            <div style="display:flex; gap:.75rem; flex-wrap:wrap; margin-top:.5rem;">
              <a href="mailto:lead.aizy.solutions@gmail.com" class="btn btn--email">Email</a>
              <a href="https://wa.me/5511969206719" target="_blank" rel="noopener" class="btn btn--whatsapp">WhatsApp</a>
            </div>
          </div>`;
        showOnlySection(supportSection);
        requestAnimationFrame(syncLayoutVars);
        return;
      }
      if (sec === "clube") {
        searchTabs.style.display = "none"; sectionTitle.style.display = "none";
        clubSection.innerHTML = `<div class="inner use-cinzel"><h3>CLUBE</h3><p>Conecte-se com a comunidade e troque experiências. (em breve)</p></div>`;
        showOnlySection(clubSection);
        requestAnimationFrame(syncLayoutVars);
        return;
      }

      // "Adicione o seu GPT"
      if (sec === "adicionegpt" || sec === "addgpt" || sec === "adicionar" || label.includes("adicione o seu gpt")) {
        renderImportInline();
        requestAnimationFrame(syncLayoutVars);
        return;
      }

      if (sec === "cadastro") {
        searchTabs.style.display = "none"; sectionTitle.style.display = "none";
        contentEl.innerHTML = `<div class="em-breve">Em breve!</div>`;
        hideAllSections();
        requestAnimationFrame(syncLayoutVars);
        return;
      }
    });
  });
}

// ===============================
// Logout (global)
async function doLogout() {
  // Se o HTML declarou window.appLogout, delega para ela
  if (typeof window.appLogout === 'function') {
    return window.appLogout();
  }

  // Fallback local
  try {
    const client = window.supabaseClient;
    if (client && client.auth && typeof client.auth.signOut === 'function') {
      await client.auth.signOut();
    }
  } catch (_) { /* silencia erros de rede */ }

  localStorage.clear();
  sessionStorage.clear();
  window.location.replace('index.html');
}

// ===============================
// Sidebar collapse
function updateCollapseBtnPosition() {
  const headerHeight  = getCssVar('--header-height');
  const sidebarHeight = sidebar?.offsetHeight || 0;
  const btnHeight     = collapseBtn?.offsetHeight || 0;
  let newTop = headerHeight + (sidebarHeight / 2) - (btnHeight / 2);
  if (window.innerWidth < 700) newTop = headerHeight + ((window.innerHeight - headerHeight) / 2) - (btnHeight / 2);
  if (collapseBtn) collapseBtn.style.top = `${newTop}px`;
}

function wireSidebarCollapse() {
  collapseBtn?.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
    const isCollapsed = sidebar.classList.contains("collapsed");
    collapseBtn.textContent = isCollapsed ? "›" : "‹";

    // NOVO: flag global no <body> para CSS robusto (independe da ordem no DOM)
    document.body.classList.toggle("sidebar-collapsed", isCollapsed);

    // re-sincroniza alturas e posição do botão
    syncLayoutVars();
    updateCollapseBtnPosition();
  });

  // click fora fecha a sidebar no mobile
  document.addEventListener("click", (e) => {
    if (window.innerWidth < 700) {
      if (!sidebar.contains(e.target) && !collapseBtn.contains(e.target) && !sidebar.classList.contains("collapsed")) {
        sidebar.classList.add("collapsed");
        document.body.classList.add("sidebar-collapsed");
        collapseBtn.textContent = "›";
        syncLayoutVars();
        updateCollapseBtnPosition();
      }
    }
  });
}

// ===============================
// Init
async function init() {
  sb = getSB();                                   // pega o client vivo criado no HTML
  if (!sb) { console.warn('Supabase ainda não carregado'); }

  loadLocalState();

  try {
    const { data: { session } = {} } = await sb.auth.getSession();
    USER_ID = session?.user?.id || document.documentElement.dataset.userId || USER_ID || "";
  } catch (_) {}

  await loadUserDataFromSupabase();
  await loadCatalog();

  buildTabs();
  wireSidebarNav();
  wireSidebarCollapse();

  // forms extras
  wireSuggestionForm();
  wireProfileForm();
  wireConfig(); // tela é renderizada on-demand

  // busca
  searchBtn?.addEventListener("click", doSearch);
  searchInput?.addEventListener("input", doSearch);
  favoritesBtn?.addEventListener("click", () => {
    const favTab = $$(".tabs__btn").find(b => b.dataset.cat === "Favoritos");
    favTab?.click();
  });

  // padrão: GPTs
  const firstCatBtn = $$(".tabs__btn").find(b => b.dataset.cat !== "Favoritos");
  (firstCatBtn || $(".tabs__btn"))?.click();

  // primeira sincronização de alturas + posição do botão
  syncLayoutVars();
  updateCollapseBtnPosition();

  // recalcula em resize (orientação, teclado mobile, etc.)
  window.addEventListener("resize", () => {
    syncLayoutVars();
    updateCollapseBtnPosition();
  });
}

document.addEventListener("DOMContentLoaded", init);
