// js/app.js

// DOM Elements
const sidebar       = document.getElementById("sidebar");
const collapseBtn   = document.getElementById("collapseBtn");
const tabsContainer = document.getElementById("categoryTabs");
const contentEl     = document.getElementById("content");
const searchInput   = document.getElementById("searchInput");
const searchBtn     = document.getElementById("searchBtn");
const favBtn        = document.getElementById("favoritesBtn");
const searchTabs    = document.getElementById("searchTabs");
const sectionTitle  = document.getElementById("sectionTitle");

// Data
let categories = [];
let gpts       = [];
let suggestionsFormHTML = "";
let manualContentHTML   = "";

// Utility: lê variável CSS (retorna inteiro)
function getCssVar(varName) {
  return parseInt(
    getComputedStyle(document.documentElement).getPropertyValue(varName)
  ) || 0;
}

// Centraliza verticalmente o botão de colapso da sidebar
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

// Carrega e parseia o catálogo (data/catalog.html)
async function loadCatalog() {
  const resp = await fetch("data/catalog.html");
  const text = await resp.text();
  const doc  = new DOMParser().parseFromString(text, "text/html");

  // Sugestões
  const form = doc.querySelector("form");
  suggestionsFormHTML = form
    ? `<div class="inner">${form.outerHTML}</div>`
    : "<p>Formulário não encontrado.</p>";

  // Manual
  const intro       = doc.querySelector(".intro")       ?.outerHTML || "";
  const instruction = doc.querySelector(".instruction") ?.outerHTML || "";
  const end         = doc.querySelector(".end")         ?.outerHTML || "";
  const call2       = doc.querySelector(".Calltosearch")?.outerHTML || "";
  manualContentHTML = `
    <div class="manual-content inner">
      ${intro}${instruction}${end}${call2}
    </div>`;

  // Categorias e GPTs
  const blocks = Array.from(doc.querySelectorAll(".category-block"));
  blocks.forEach(block => {
    const catTitle = block.querySelector(".category-title").textContent.trim();
    if (!categories.includes(catTitle)) categories.push(catTitle);

    Array.from(block.querySelectorAll("details")).forEach(detail => {
      const title   = detail.querySelector("summary").textContent.trim();
      const content = detail.querySelector(".content");
      const linkEl  = content.querySelector("a");
      const link    = linkEl ? linkEl.href : "#";

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

  // Aba de Favoritos
  categories.push("Favoritos");

  // Inicia a interface
  initUI();
}

// Configurações de UI e event handlers
function initUI() {
  // Data-attributes para botões principais
  collapseBtn.dataset.action = "toggleSidebar";
  collapseBtn.dataset.label  = collapseBtn.textContent;

  searchBtn.dataset.action = "search";
  searchBtn.dataset.label  = searchBtn.textContent;

  favBtn.dataset.action = "viewFavorites";
  favBtn.dataset.label  = favBtn.textContent;

  // Toggle da sidebar
  collapseBtn.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
    const isCollapsed = sidebar.classList.contains("collapsed");
    collapseBtn.textContent = isCollapsed ? "›" : "‹";
    collapseBtn.dataset.label = collapseBtn.textContent;
    searchTabs.classList.toggle("sidebar-collapsed", isCollapsed);
    updateCollapseBtnPosition();
  });

  // Fecha sidebar no mobile ao clicar fora
  document.addEventListener("click", e => {
    if (window.innerWidth < 700) {
      if (
        !sidebar.contains(e.target) &&
        !collapseBtn.contains(e.target) &&
        !e.target.classList.contains("menu") &&
        !e.target.classList.contains("icon") &&
        !sidebar.classList.contains("collapsed")
      ) {
        sidebar.classList.add("collapsed");
        collapseBtn.textContent = "›";
        collapseBtn.dataset.label = collapseBtn.textContent;
        searchTabs.classList.add("sidebar-collapsed");
        updateCollapseBtnPosition();
      }
    }
  });

  // Monta abas de categoria e delega clique
  tabsContainer.innerHTML = "";
  categories.forEach(cat => {
    const btn = document.createElement("button");
    btn.className           = "tabs__btn";
    btn.textContent         = cat;
    btn.dataset.cat         = cat;
    btn.dataset.action      = "selectCategory";
    btn.dataset.label       = cat;
    tabsContainer.appendChild(btn);
  });
  tabsContainer.addEventListener("click", e => {
    const btn = e.target.closest("button[data-action='selectCategory']");
    if (!btn) return;
    selectCategory(btn.dataset.cat, btn);
  });

  // Navegação lateral por seção
  sidebar.querySelectorAll(".menu li").forEach(li => {
    li.addEventListener("click", async () => {
      const sec = li.dataset.section;
      sidebar.querySelectorAll("li").forEach(x => x.classList.remove("active"));
      li.classList.add("active");

      document.body.classList.remove("gpts-active", "favoritos-active", "sugestoes-active");

      if (sec === "gpts" || sec === "favoritos") {
        searchTabs.style.display   = "block";
        sectionTitle.style.display = "block";
      } else {
        searchTabs.style.display   = "none";
        sectionTitle.style.display = "none";
      }

      if (sec === "manual") {
        contentEl.innerHTML = manualContentHTML;
      } else if (sec === "gpts") {
        document.body.classList.add("gpts-active");
        const firstBtn = tabsContainer.querySelector("button:not([data-cat='Favoritos'])");
        firstBtn && firstBtn.click();
      } else if (sec === "favoritos") {
        document.body.classList.add("gpts-active", "favoritos-active");
        const favTabBtn = tabsContainer.querySelector("button[data-cat='Favoritos']");
        favTabBtn && favTabBtn.click();
      } else if (sec === "sugestoes") {
        document.body.classList.add("sugestoes-active");
        contentEl.innerHTML = suggestionsFormHTML;
      } else if (sec === "cadastro") {
        contentEl.innerHTML = "<div class='em-breve'>Em breve!</div>";
      } else if (sec === "sair") {
        try {
          if (typeof supabase !== 'undefined' && supabase.auth) {
            await supabase.auth.signOut();
          }
        } catch (err) {
          console.warn("Erro ao fazer logoff:", err);
        }
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = "index.html";
        return;
      }
    });
  });

  // Função de busca
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
  searchInput.dataset.action = "searchInput";
  searchInput.dataset.label  = searchInput.placeholder || "";
  searchInput.addEventListener("input", doSearch);
  searchBtn.addEventListener("click", doSearch);

  // Botão Favoritos
  favBtn.addEventListener("click", () => {
    document.body.classList.add("gpts-active", "favoritos-active");
    searchTabs.style.display = "block";
    sectionTitle.style.display = "block";
    const favTabBtn = tabsContainer.querySelector("button[data-cat='Favoritos']");
    favTabBtn && favTabBtn.click();
  });

  // Seção inicial: GPTs
  sidebar.querySelector("li[data-section='gpts']").click();
}

// Seleciona categoria e renderiza
function selectCategory(cat, btn) {
  document.querySelectorAll(".tabs__btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  contentEl.scrollTop = 0;

  if (cat === "Favoritos") {
    const favs    = JSON.parse(localStorage.getItem("favorites") || "[]");
    const favGPTs = gpts.filter(g => favs.includes(g.title));
    renderCards(favGPTs);
  } else {
    renderCards(gpts.filter(g => g.category === cat));
  }
}

// Alterna favorito e re-renderiza
function toggleFavorite(title) {
  let favs = JSON.parse(localStorage.getItem("favorites") || "[]");
  favs = favs.includes(title) ? favs.filter(t => t !== title) : [...favs, title];
  localStorage.setItem("favorites", JSON.stringify(favs));
  const activeBtn = document.querySelector("button[data-action='selectCategory'].active");
  activeBtn && activeBtn.click();
}

// Renderiza os cards de GPTs
function renderCards(list) {
  contentEl.innerHTML = "";
  if (!list.length) {
    contentEl.innerHTML = "<p style='text-align:center;color:#888;'>Nenhum GPT encontrado.</p>";
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
        <a class="btn-open"
           href="${gpt.link}" target="_blank"
           data-action="openGPT" data-label="Abrir GPT">
          Abrir GPT
        </a>
        <button class="fav-card-btn"
                title="Favoritar"
                data-action="toggleFavorite"
                data-label="Favoritar">
          ${
            JSON.parse(localStorage.getItem("favorites") || "[]").includes(gpt.title)
            ? "★" : "☆"
          }
        </button>
      </div>`;
    const favButton = card.querySelector(".fav-card-btn");
    favButton.addEventListener("click", () => toggleFavorite(gpt.title));
    contentEl.appendChild(card);
  });
}

// Inicia toda a engrenagem
document.addEventListener("DOMContentLoaded", () => {
  loadCatalog();
  updateCollapseBtnPosition();
});
