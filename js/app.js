// js/app.js

// DOM ELEMENTS
const sidebar       = document.getElementById("sidebar");
const collapseBtn   = document.getElementById("collapseBtn");
const tabsContainer = document.getElementById("categoryTabs");
const contentEl     = document.getElementById("content");
const searchInput   = document.getElementById("searchInput");
const searchBtn     = document.getElementById("searchBtn");
const favBtn        = document.getElementById("favoritesBtn");
const searchTabs    = document.getElementById("searchTabs");
const sectionTitle  = document.getElementById("sectionTitle");

// Dados
let categories = [];
let gpts       = [];
let suggestionsFormHTML = "";
let manualContentHTML   = "";

// CENTRALIZA BOTÃO DA SIDEBAR VERTICALMENTE
function updateCollapseBtnPosition() {
  const headerHeight  = 60;
  const sidebarHeight = sidebar.offsetHeight;
  const btnHeight     = 38;
  let newTop = headerHeight + (sidebarHeight / 2) - (btnHeight / 2);

  // Mobile: centralizar melhor
  if (window.innerWidth < 700) {
    // Altura da janela - header, centralizado (ajustável)
    newTop = headerHeight + ((window.innerHeight - headerHeight) / 2) - (btnHeight / 2);
  }
  collapseBtn.style.top = `${newTop}px`;
}
window.addEventListener('resize', updateCollapseBtnPosition);
window.addEventListener('DOMContentLoaded', updateCollapseBtnPosition);
sidebar.addEventListener('transitionend', updateCollapseBtnPosition);

// CARREGAR/EXTRAIR CATALOG (substitua o caminho se necessário)
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

  // Adiciona aba de Favoritos
  categories.push("Favoritos");

  // Inicializa interface
  initUI();
}

// INICIALIZA A INTERFACE
function initUI() {
  // Sidebar retrátil
  collapseBtn.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
    collapseBtn.textContent = sidebar.classList.contains("collapsed") ? "›" : "‹";
    searchTabs.classList.toggle('sidebar-collapsed', sidebar.classList.contains('collapsed'));
    updateCollapseBtnPosition();
  });

  // Fecha sidebar em mobile ao clicar fora
  document.addEventListener('click', function(e) {
    if (window.innerWidth < 700) {
      if (
        !sidebar.contains(e.target) &&
        !collapseBtn.contains(e.target) &&
        !e.target.classList.contains('menu') &&
        !e.target.classList.contains('icon') &&
        sidebar.classList.contains('collapsed') === false
      ) {
        sidebar.classList.add('collapsed');
        collapseBtn.textContent = "›";
        searchTabs.classList.add('sidebar-collapsed');
        updateCollapseBtnPosition();
      }
    }
  });

  // Abas de categoria
  tabsContainer.innerHTML = "";
  categories.forEach(cat => {
    const btn = document.createElement("button");
    btn.textContent = cat;
    btn.dataset.cat = cat;
    btn.addEventListener("click", () => selectCategory(cat, btn));
    tabsContainer.appendChild(btn);
  });

  // Menu lateral - navegação das seções
  sidebar.querySelectorAll(".menu li").forEach(li => {
    li.addEventListener("click", () => {
      const sec = li.dataset.section;
      sidebar.querySelectorAll("li").forEach(x => x.classList.remove("active"));
      li.classList.add("active");

      // Limpa classes de seção no body
      document.body.classList.remove("gpts-active", "favoritos-active", "sugestoes-active");

      // Oculta barra fixa em todas seções exceto GPTs e Favoritos
      if (sec === "gpts" || sec === "favoritos") {
        searchTabs.style.display = "block";
        sectionTitle.style.display = "block";
      } else {
        searchTabs.style.display = "none";
        sectionTitle.style.display = "none";
      }

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
      } else if (sec === "cadastro") {
        contentEl.innerHTML = "<div class='em-breve'>Em breve!</div>";
      }
      if (sec === "Sair") {
      // 1. Supabase logoff (se usar Supabase Auth)
      if (typeof supabase !== 'undefined' && supabase.auth) {
        await supabase.auth.signOut();
      }
      // 2. Limpar localStorage/sessionStorage
      localStorage.clear();
      sessionStorage.clear();
      // 3. Redirecionar para a tela de login
      window.location.href = "index.html"; // ou "/" se seu login for na home
    }
      
    });
  });

  // Busca
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

  // Botão Favoritos
  favBtn.addEventListener("click", () => {
    document.body.classList.add("gpts-active", "favoritos-active");
    searchTabs.style.display = "block";
    sectionTitle.style.display = "block";
    tabsContainer.querySelector("button[data-cat='Favoritos']").click();
  });

  // Seção inicial: GPTs
  sidebar.querySelector("li[data-section='gpts']").click();
}

// SELECIONA CATEGORIA
function selectCategory(cat, btn) {
  document.querySelectorAll(".tabs button").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  // Rolagem para o topo ao trocar de categoria
  if (contentEl) contentEl.scrollTop = 0;

  if (cat === "Favoritos") {
    const favs    = JSON.parse(localStorage.getItem("favorites") || "[]");
    const favGPTs = gpts.filter(g => favs.includes(g.title));
    renderCards(favGPTs);
  } else {
    renderCards(gpts.filter(g => g.category === cat));
  }
}

// ADICIONAR/REMOVER FAVORITO
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

// RENDERIZA CARDS DE GPTs
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
        <a class="btn-open" href="${gpt.link}" target="_blank">Abrir GPT</a>
        <button class="fav-card-btn" title="Favoritar">${
          JSON.parse(localStorage.getItem("favorites") || "[]").includes(gpt.title) ? "★" : "☆"
        }</button>
      </div>
    `;
    card.querySelector(".fav-card-btn")
        .addEventListener("click", () => toggleFavorite(gpt.title));
    contentEl.appendChild(card);
  });
}

// INICIALIZAÇÃO
document.addEventListener("DOMContentLoaded", () => {
  loadCatalog();
  updateCollapseBtnPosition();
});
