// DOM elements
const sidebar     = document.getElementById("sidebar");
const collapseBtn = document.getElementById("collapseBtn");
const tabsContainer = document.getElementById("categoryTabs");
const contentEl     = document.getElementById("content");
const searchInput   = document.getElementById("searchInput");
const searchBtn     = document.getElementById("searchBtn");
const favBtn        = document.getElementById("favoritesBtn");

let categories = [];
let gpts       = [];
let suggestionsFormHTML = "";

// 1️⃣ Carrega e parseia o HTML do seu catálogo
async function loadCatalog() {
  const resp = await fetch("data/catalog.html");
  const text = await resp.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, "text/html");

  // 1.a) Extrai o formulário de Sugestões
  const form = doc.querySelector("form");
  suggestionsFormHTML = form ? form.outerHTML : "<p>Formulário não encontrado.</p>";

  // 1.b) Extrai categorias e GPTs
  const blocks = Array.from(doc.querySelectorAll(".category-block"));
  blocks.forEach(block => {
    const catTitle = block.querySelector(".category-title").textContent.trim();
    // só adiciona uma vez
    if (!categories.includes(catTitle)) {
      categories.push(catTitle);
    }
    // para cada GPT dentro da categoria:
    Array.from(block.querySelectorAll("details")).forEach(detail => {
      const title = detail.querySelector("summary").textContent.trim();
      const content = detail.querySelector(".content");
      const linkEl = content.querySelector("a");
      const link = linkEl ? linkEl.href : "";
      let desc = "", tools = "", prompt = "";
      content.querySelectorAll("p").forEach(p => {
        const labelEl = p.querySelector("strong");
        if (!labelEl) return;
        const label = labelEl.textContent.replace(":", "").trim();
        const text  = p.textContent.replace(labelEl.textContent, "").trim();
        if (label === "Descrição")        desc    = text;
        else if (label === "Ferramentas") tools   = text;
        else if (label === "Prompt Ideal") prompt = text;
      });
      gpts.push({
        title,
        category: catTitle,
        desc,
        tools: tools.split(/,| e /).map(s=>s.trim()).filter(Boolean),
        prompt,
        link
      });
    });
  });
  // adiciona aba de favoritos
  categories.push("Favoritos");

  initUI();
}

// 2️⃣ Inicializa a UI (sidebar, abas, cards, buscas, favoritos)
function initUI() {
  // 2.a) Sidebar retrátil  
  collapseBtn.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
    collapseBtn.textContent = sidebar.classList.contains("collapsed") ? "›" : "‹";
  });

  // 2.b) Abas de categoria
  tabsContainer.innerHTML = "";
  categories.forEach(cat => {
    const btn = document.createElement("button");
    btn.textContent = cat;
    btn.dataset.cat  = cat;
    btn.addEventListener("click", () => selectCategory(cat, btn));
    tabsContainer.appendChild(btn);
  });

  // 2.c) Botões de sidebar  
  sidebar.querySelectorAll(".menu li").forEach(li => {
    li.addEventListener("click", () => {
      const sec = li.dataset.section;
      sidebar.querySelectorAll("li").forEach(x=>x.classList.remove("active"));
      li.classList.add("active");
      if (sec === "sugestoes") {
        contentEl.innerHTML = suggestionsFormHTML;
      } else if (sec === "gpts") {
        // ativa a primeira categoria (exceto Favoritos)
        tabsContainer.querySelector("button:not([data-cat='Favoritos'])").click();
      }
      // você pode expandir para manual, cadastro, etc.
    });
  });

  // 2.d) Busca e Favoritos  
  function doSearch() {
    const term = searchInput.value.toLowerCase();
    renderCards( gpts.filter(g =>
      g.title.toLowerCase().includes(term) ||
      g.desc.toLowerCase().includes(term) ||
      g.tools.join(" ").toLowerCase().includes(term) ||
      g.prompt.toLowerCase().includes(term)
    ));
  }
  searchInput.addEventListener("input", doSearch);
  searchBtn.addEventListener("click", doSearch);
  favBtn.   addEventListener("click", () => {
    tabsContainer.querySelector("button[data-cat='Favoritos']").click();
  });

  // 2.e) Inicia na tela dos GPTs
  sidebar.querySelector("li[data-section='gpts']").click();
}

// 3️⃣ Lida com seleção de categoria (inclui Favoritos)
function selectCategory(cat, btn) {
  document.querySelectorAll(".tabs button").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");

  if (cat === "Favoritos") {
    const favs    = JSON.parse(localStorage.getItem("favorites") || "[]");
    const favGPTs = gpts.filter(g => favs.includes(g.title));
    renderCards(favGPTs);
  } else {
    renderCards(gpts.filter(g => g.category === cat));
  }
}

// 4️⃣ Toggle favorito em cada card
function toggleFavorite(title) {
  let favs = JSON.parse(localStorage.getItem("favorites") || "[]");
  if (favs.includes(title)) favs = favs.filter(t=>t!==title);
  else                       favs.push(title);
  localStorage.setItem("favorites", JSON.stringify(favs));
  // rerender aba ativa
  const active = document.querySelector(".tabs button.active");
  active && active.click();
}

// 5️⃣ Renderiza grid de cards
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
      <p><strong>Prompt:</strong> ${gpt.prompt}</p>
      <div class="card-actions">
        <a class="btn-open" href="${gpt.link}" target="_blank">Abrir GPT</a>
        <button class="fav-card-btn">${ 
          (JSON.parse(localStorage.getItem("favorites")||"[]").includes(gpt.title)
            ? "★" : "☆")
        }</button>
      </div>
    `;
    // estilize .btn-open com bordas suaves via CSS
    card.querySelector(".fav-card-btn")
        .addEventListener("click", ()=> toggleFavorite(gpt.title));
    contentEl.appendChild(card);
  });
}

//  🎯 Boot
document.addEventListener("DOMContentLoaded", loadCatalog);
