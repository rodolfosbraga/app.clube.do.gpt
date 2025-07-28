// Mock de categorias (extraído da sua página) :contentReference[oaicite:1]{index=1}
const categories = [
  "Autoestima e Mentalidade",
  "Carreira e Empregabilidade",
  "Comunicação",
  "Criatividade"
];

// Eventos de interação
const tabsContainer = document.getElementById("categoryTabs");
const contentEl   = document.getElementById("content");
const favBtn      = document.getElementById("favoritesBtn");
const searchInput = document.getElementById("searchInput");

// Gera abas
categories.forEach(cat => {
  const btn = document.createElement("button");
  btn.textContent = cat;
  btn.dataset.cat = cat;
  btn.addEventListener("click", () => filterByCategory(cat, btn));
  tabsContainer.appendChild(btn);
});

// Exemplo de cards estáticos (depois podemos injetar via fetch/parsing real)
const sampleGPTs = [
  { title: "Desenvolvedor de Mindset de Crescimento", category: "Autoestima e Mentalidade", link: "#" },
  { title: "Criador de Currículo Express", category: "Carreira e Empregabilidade", link: "#" },
  { title: "Melhorador de E-mails Profissionais", category: "Comunicação", link: "#" },
  { title: "Gerador de Ideias para Posts", category: "Criatividade", link: "#" }
];

// Renderiza cards no content
function renderCards(list) {
  contentEl.innerHTML = "";
  list.forEach(gpt => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <h3>${gpt.title}</h3>
      <a href="${gpt.link}" target="_blank">Abrir GPT</a>
    `;
    contentEl.appendChild(card);
  });
}

// Filtra por categoria
function filterByCategory(cat, btn) {
  // ativa/desativa botão
  document.querySelectorAll(".tabs button").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  // filtra e renderiza
  const filtered = sampleGPTs.filter(g => g.category === cat);
  renderCards(filtered);
}

// Inicia com todos
renderCards(sampleGPTs);

// TODO: implementar busca, favoritos e navegação de sidebar
