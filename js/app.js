// 1️⃣ Categorias (puxe do seu HTML real via fetch/parsing depois)
const categories = [
  "Produtividade",
  "Saúde e Bem-estar",
  "Finanças Pessoais",
  "Viagens e Estilo de Vida",
  "Marketing Digital"
];

// 2️⃣ Sample de GPTs (depois substituímos pelo seu catálogo real)
const gpts = [
  { title: "Planejador Diário 5x5", category: "Produtividade", desc: "Organize suas tarefas em blocos...", link: "#" },
  { title: "Coach de Hábitos Saudáveis", category: "Saúde e Bem-estar", desc: "Crie um plano personalizado...", link: "#" },
  { title: "Simulador de Investimentos", category: "Finanças Pessoais", desc: "Projete sua carteira...", link: "#" },
  { title: "Roteiro de Viagem Express", category: "Viagens e Estilo de Vida", desc: "Monte itinerários em minutos...", link: "#" },
  { title: "Estratégia de Ads no Facebook", category: "Marketing Digital", desc: "Otimize suas campanhas...", link: "#" },
];

// 3️⃣ Elementos DOM
const sidebar      = document.getElementById("sidebar");
const collapseBtn  = document.getElementById("collapseBtn");
const tabsContainer= document.getElementById("categoryTabs");
const contentEl    = document.getElementById("content");
const favBtn       = document.getElementById("favoritesBtn");
const searchInput  = document.getElementById("searchInput");

// 4️⃣ Sidebar retrátil
collapseBtn.addEventListener("click", () => {
  sidebar.classList.toggle("collapsed");
  collapseBtn.textContent = sidebar.classList.contains("collapsed") ? '›' : '‹';
});

// 5️⃣ Render das abas de categoria
categories.forEach(cat => {
  const btn = document.createElement("button");
  btn.textContent = cat;
  btn.dataset.cat = cat;
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tabs button").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    renderCards( gpts.filter(g=>g.category===cat) );
  });
  tabsContainer.appendChild(btn);
});

// 6️⃣ Render de cards
function renderCards(list) {
  contentEl.innerHTML = "";
  if(!list.length) {
    contentEl.innerHTML = "<p>Nenhum GPT encontrado.</p>";
    return;
  }
  list.forEach(gpt => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <h3>${gpt.title}</h3>
      <p>${gpt.desc}</p>
      <a href="${gpt.link}" target="_blank">Abrir GPT →</a>
    `;
    contentEl.appendChild(card);
  });
}

// 7️⃣ Inicia mostrando todos
renderCards(gpts);

// 8️⃣ Busca em tempo real
searchInput.addEventListener("input", () => {
  const term = searchInput.value.toLowerCase();
  renderCards(
    gpts.filter(g => g.title.toLowerCase().includes(term) || g.desc.toLowerCase().includes(term))
  );
});

// 9️⃣ Favoritos (exemplo estático)
// – Com localStorage você pode armazenar um array de títulos/link favoritos
favBtn.addEventListener("click", () => {
  alert("Aqui vamos exibir seus GPTs favoritos (implementação futura)!");
});
