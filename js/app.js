// js/app.js

// ===== Elementos do DOM =====
const sidebar       = document.getElementById("sidebar");
const collapseBtn   = document.getElementById("collapseBtn");
const tabsContainer = document.getElementById("categoryTabs");
const contentEl     = document.getElementById("content");
const searchInput   = document.getElementById("searchInput");
const searchBtn     = document.getElementById("searchBtn");
const favBtn        = document.getElementById("favoritesBtn");

let categories = [];
let gpts       = [];
let suggestionsFormHTML = "";
let manualContentHTML   = "";

// ===== 1️⃣ Carrega e parseia o HTML do catálogo =====
async function loadCatalog() {
  const resp = await fetch("data/catalog.html");
  const text = await resp.text();
  const doc  = new DOMParser().parseFromString(text, "text/html");

  // 1.a) Formulário de Sugestões
  const form = doc.querySelector("form");
  suggestionsFormHTML = form
    ? `<div class="inner">${form.outerHTML}</div>`
    : "<p>Formulário não encontrado.</p>";

  // 1.b) Conteúdo Manual (blocos .intro, .instruction, .end, .Calltosearch)
  const intro       = doc.querySelector(".intro")       ?.outerHTML || "";
  const instruction = doc.querySelector(".instruction") ?.outerHTML || "";
  const end         = doc.querySelector(".end")         ?.outerHTML || "";
  const call2       = doc.querySelector(".Calltosearch")?.outerHTML || "";
  manualContentHTML = `
    <div class="manual-content inner">
      ${intro}${instruction}${end}${call2}
    </div>`;

  // 1.c) Extrai categorias e GPTs de cada .category-block
  const blocks = Array.from(doc.querySelectorAll(".category-block"));
  blocks.forEach(block => {
    const catTitle = block.querySelector(".category-title").textContent.trim();
    if (!categories.includes(catTitle)) categories.push(catTitle);

    Array.from(block.querySelectorAll("details")).forEach(detail => {
      const title = detail.querySelector("summary").textContent.trim();
      const content = detail.querySelector(".content");
      const linkEl = content.querySelector("a");
      const link   = linkEl ? linkEl.href : "#";

      let desc = "", tools = "", prompt = "";
      content.querySelectorAll("p").forEach(p => {
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
        category: catTitle,
        desc,
        tools: tools.split(/,| e /).map(s => s.trim()).filter(Boolean),
        prompt,
        link
      });
    });
  });

  // 1.d) Adiciona aba de Favoritos
  categories.push("Favoritos");

  // Inicializa a interface
  initUI();
}

// ===== 2️⃣ Inicializa Interface =====
function initUI() {
  // 2.a) Sidebar retrátil
  collapseBtn.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
    collapseBtn.textContent = sidebar.classList.contains("collapsed") ? "›" : "‹";
  });

  // 2.b) Gera abas de categoria
  tabsContainer.innerHTML = "";
  categories.forEach(cat => {
    const btn = document.createElement("button");
    btn.textContent = cat;
    btn.dataset.cat   = cat;
    btn.addEventListener("click", () => selectCategory(cat, btn));
    tabsContainer.appendChild(btn);
  });

  // 2.c) Evento de clique no menu lateral
  sidebar.querySelectorAll(".menu li").forEach(li => {
    li.addEventListener("click", () => {
      const sec = li.dataset.section;
      sidebar.querySelectorAll("li").forEach(x => x.classList.remove("active"));
      li.classList.add("active");

      // controle de classe no body para visualização condicional de componentes
      document.body.classList.remove("gpts-active", "favoritos-active", "sugestoes-active");

      if (sec === "manual") {
        contentEl.innerHTML = manualContentHTML;
      } else if (sec === "gpts") {
        document.body.classList.add("gpts-active");
        tabsContainer.querySelector("button:not([data-cat='Favoritos'])").click();
      } else if (sec === "favoritos") {
        document.body.classList.add("gpts-active", "favoritos-active");
        tabsContainer.querySelector("button[data-cat='Favoritos']").click();
      } else if (sec === "sugestoes") {
        document.body.classList.add("sugestoes-active");
        contentEl.innerHTML = suggestionsFormHTML;
      }
      // (poderá estender cadastro, opcoes, sair etc.)
    });
  });

  // 2.d) Função de busca
  function doSearch() {
    const term = searchInput.value.trim().toLowerCase();
    renderCards(
      gpts.filter(g =>
        g.title.toLowerCase().includes(term) ||
        g.desc.toLowerCase().includes(term) ||
        g.tools.join(" ").toLowerCase().includes(term) ||
        g.prompt.toLowerCase().includes(term)
      )
    );
  }
  searchInput.addEventListener("input", doSearch);
  searchBtn.addEventListener("click", doSearch);

  // 2.e) Botão Favoritos geral
  favBtn.addEventListener("click", () => {
    document.body.classList.add("gpts-active", "favoritos-active");
    tabsContainer.querySelector("button[data-cat='Favoritos']").click();
  });

  // 2.f) Inicia na seção GPTs
  sidebar.querySelector("li[data-section='gpts']").click();
}

// ===== 3️⃣ Seleção de Categoria =====
function selectCategory(cat, btn) {
  document.querySelectorAll(".tabs button").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");

  // rola o container pro topo sempre que muda categoria
  if (contentEl) contentEl.scrollTop = 0;

  if (cat === "Favoritos") {
    const favs    = JSON.parse(localStorage.getItem("favorites") || "[]");
    const favGPTs = gpts.filter(g => favs.includes(g.title));
    renderCards(favGPTs);
  } else {
    renderCards(gpts.filter(g => g.category === cat));
  }
}

// ===== 4️⃣ Toggle Favorito =====
function toggleFavorite(title) {
  let favs = JSON.parse(localStorage.getItem("favorites") || "[]");
  if (favs.includes(title)) {
    favs = favs.filter(t => t !== title);
  } else {
    favs.push(title);
  }
  localStorage.setItem("favorites", JSON.stringify(favs));
  // Re-renderiza aba ativa
  const active = document.querySelector(".tabs button.active");
  active && active.click();
}

// ===== 5️⃣ Renderização dos Cards =====
function renderCards(list) {
  contentEl.innerHTML = "";
  if (!list.length) {
    contentEl.innerHTML = "<p>Nenhum GPT encontrado.</p>";
    return;
  }
  list.forEach(gpt => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <h3>${gpt.title}</h3>
      <p>${gpt.desc}</p>
      <p><strong>Ferramentas:</strong> ${gpt.tools.join(", ")}</p>
      <p><strong>Prompt Ideal:</strong> ${gpt.prompt}</p>
      <div class="card-actions">
        <a class="btn-open" href="${gpt.link}" target="_blank">Abrir GPT</a>
        <button class="fav-card-btn">${
          JSON.parse(localStorage.getItem("favorites") || "[]").includes(gpt.title) ? "★" : "☆"
        }</button>
      </div>
    `;
    card.querySelector(".fav-card-btn")
        .addEventListener("click", () => toggleFavorite(gpt.title));
    contentEl.appendChild(card);
  });
}

// ===== Inicialização =====
document.addEventListener("DOMContentLoaded", loadCatalog);
