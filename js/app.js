// — 1️⃣ CATEGORIAS (17 + Favoritos)
const categories = [
  "Produtividade",
  "Saúde e Bem-estar",
  "Finanças Pessoais",
  "Viagens e Estilo de Vida",
  "Marketing Digital",
  "Autoestima e Mentalidade",
  "Carreira e Empregabilidade",
  "Comunicação",
  "Criatividade",
  "Educação",
  "Bem-estar Mental",
  "Linguagens",
  "Desenvolvimento Pessoal",
  "Negócios",
  "Saúde Física",
  "Arte & Design",
  "Tecnologia",
  "Favoritos"
];

// — 2️⃣ CATÁLOGO DE GPTs (exemplo – depois fetch/parsing)
const gpts = [
  {
    title: "Planejador Diário 5x5",
    category: "Produtividade",
    desc: "Organize suas tarefas em blocos de foco de 5 minutos.",
    tools: ["Timer", "Checklist"],
    prompt: "Você é meu assistente de organização diário...",
    link: "#"
  },
  {
    title: "Coach de Hábitos Saudáveis",
    category: "Saúde e Bem-estar",
    desc: "Crie um plano de hábitos que se encaixe na sua rotina.",
    tools: ["Calendário", "Relatórios"],
    prompt: "Eu quero desenvolver um hábito de...",
    link: "#"
  },
  // … outros GPTs …
];

// — 3️⃣ FUNÇÕES DE FAVORITOS
function getFavorites() {
  return JSON.parse(localStorage.getItem("favorites") || "[]");
}
function saveFavorites(list) {
  localStorage.setItem("favorites", JSON.stringify(list));
}
function toggleFavorite(title) {
  let favs = getFavorites();
  favs = favs.includes(title)
    ? favs.filter(t => t !== title)
    : [...favs, title];
  saveFavorites(favs);
  // Re-renderiza a aba ativa
  const active = document.querySelector(".tabs button.active");
  if (active) active.click();
}

// — 4️⃣ CACHE ELEMENTOS
const sidebar       = document.getElementById("sidebar");
const collapseBtn   = document.getElementById("collapseBtn");
const tabsContainer = document.getElementById("categoryTabs");
const contentEl     = document.getElementById("content");
const searchInput   = document.getElementById("searchInput");
const searchBtn     = document.getElementById("searchBtn");
const favBtn        = document.getElementById("favoritesBtn");

// — 5️⃣ SIDEBAR RETRÁTIL
collapseBtn.addEventListener("click", () => {
  sidebar.classList.toggle("collapsed");
  collapseBtn.textContent = sidebar.classList.contains("collapsed") ? "›" : "‹";
});

// — 6️⃣ MONTA ABAS
categories.forEach(cat => {
  const btn = document.createElement("button");
  btn.textContent = cat;
  btn.dataset.cat = cat;
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tabs button").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    if (cat === "Favoritos") {
      const favTitles = getFavorites();
      const favGPTs = gpts.filter(g => favTitles.includes(g.title));
      renderCards(favGPTs);
    } else {
      renderCards(gpts.filter(g => g.category === cat));
    }
  });
  tabsContainer.appendChild(btn);
});

// — 7️⃣ RENDERIZA CARDS
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
        <a href="${gpt.link}" target="_blank">Abrir GPT →</a>
        <button class="fav-card-btn">
          ${getFavorites().includes(gpt.title) ? "★" : "☆"}
        </button>
      </div>
    `;
    // toggle favorito
    card.querySelector(".fav-card-btn")
        .addEventListener("click", ()=> toggleFavorite(gpt.title));
    contentEl.appendChild(card);
  });
}

// — 8️⃣ BUSCA (input ou click na lupa)
function doSearch() {
  const term = searchInput.value.toLowerCase();
  // pesquisa em todo o catálogo
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
favBtn.addEventListener("click", () => {
  document.querySelector(".tabs button[data-cat='Favoritos']").click();
});

// — 9️⃣ INICIA COM A PRIMEIRA ABA (GPTs)
document.querySelector(".tabs button[data-cat='Produtividade']").click();
