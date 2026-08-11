/* ============================================================
   MC INFORMÁTICA — Loja
   ------------------------------------------------------------
   O site não realiza venda direta: todo anúncio leva o cliente
   para o WhatsApp da loja, onde a negociação é fechada.

   Os produtos ficam no arquivo produtos.json e são cadastrados
   pelo painel administrativo (admin.html) — não é preciso
   editar código para incluir, alterar ou remover produtos.
   ============================================================ */

const NUMERO_WHATSAPP = "5516996198688"; // WhatsApp da MC Informática

const CATEGORIAS = {
    notebooks: "Notebooks",
    computadores: "Computadores",
    perifericos: "Periféricos",
    hardware: "Hardware",
    acessorios: "Acessórios",
    outros: "Outros"
};

const ICONES = {
    notebooks: "fa-solid fa-laptop",
    computadores: "fa-solid fa-desktop",
    perifericos: "fa-solid fa-keyboard",
    hardware: "fa-solid fa-microchip",
    acessorios: "fa-solid fa-plug",
    outros: "fa-solid fa-box"
};

let PRODUTOS = [];
let categoriaAtual = "todos";

const gradeProdutos = document.getElementById("grade-produtos");
const barraFiltros = document.getElementById("filtros");

// ---------- Utilidades ----------
const formatarPreco = (valor) =>
    Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function precoTexto(valor) {
    const numero = Number(valor);
    return numero > 0 ? formatarPreco(numero) : "Sob consulta";
}

// Escapa o texto cadastrado no painel antes de ir para a página
function esc(texto) {
    return String(texto ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function abrirWhatsApp(mensagem) {
    const url = `https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(mensagem)}`;
    window.open(url, "_blank");
}

// ---------- Carregamento dos produtos ----------
async function carregarProdutos() {
    try {
        const resposta = await fetch("produtos.json", { cache: "no-cache" });
        if (!resposta.ok) throw new Error("HTTP " + resposta.status);
        const dados = await resposta.json();
        PRODUTOS = Array.isArray(dados) ? dados : [];
    } catch (erro) {
        PRODUTOS = [];
    }
    renderizarFiltros();
    renderizarProdutos();
}

// ---------- Filtros (montados a partir dos produtos cadastrados) ----------
function renderizarFiltros() {
    if (PRODUTOS.length === 0) {
        barraFiltros.innerHTML = "";
        return;
    }

    const presentes = Object.keys(CATEGORIAS).filter((slug) =>
        PRODUTOS.some((p) => p.categoria === slug)
    );
    const temUsados = PRODUTOS.some((p) => p.condicao === "usado");

    const botoes = [{ slug: "todos", nome: "Todos" }]
        .concat(presentes.map((slug) => ({ slug, nome: CATEGORIAS[slug] })));
    if (temUsados) botoes.push({ slug: "usados", nome: "Usados" });

    // Com uma categoria só, o filtro não ajuda em nada
    if (botoes.length <= 2) {
        barraFiltros.innerHTML = "";
        return;
    }

    barraFiltros.innerHTML = botoes
        .map(
            (b) =>
                `<button class="filtro${b.slug === categoriaAtual ? " ativo" : ""}" data-categoria="${b.slug}">${b.nome}</button>`
        )
        .join("");
}

barraFiltros.addEventListener("click", (e) => {
    const botao = e.target.closest(".filtro");
    if (!botao) return;
    categoriaAtual = botao.dataset.categoria;
    barraFiltros.querySelectorAll(".filtro").forEach((b) => b.classList.remove("ativo"));
    botao.classList.add("ativo");
    renderizarProdutos();
});

// ---------- Vitrine ----------
function renderizarProdutos() {
    if (PRODUTOS.length === 0) {
        gradeProdutos.innerHTML = `
            <div class="catalogo-vazio">
                <i class="fa-solid fa-boxes-packing"></i>
                <h3>Estamos preparando nosso catálogo</h3>
                <p>Chame a gente no WhatsApp e diga o que você procura — trabalhamos com equipamentos novos e usados, e conseguimos o que você precisa.</p>
                <button class="btn btn-whatsapp" data-whats="Olá! Vim pelo site da MC Informática e gostaria de saber o que vocês têm disponível.">
                    <i class="fa-brands fa-whatsapp"></i> Falar com a loja
                </button>
            </div>`;
        ativarLinksWhats();
        return;
    }

    const visiveis = PRODUTOS.filter((p) => {
        if (categoriaAtual === "todos") return true;
        if (categoriaAtual === "usados") return p.condicao === "usado";
        return p.categoria === categoriaAtual;
    });

    if (visiveis.length === 0) {
        gradeProdutos.innerHTML =
            '<p class="sem-produtos">Nenhum produto nesta categoria no momento. Fale com a gente no WhatsApp!</p>';
        return;
    }

    gradeProdutos.innerHTML = visiveis
        .map((p) => {
            const icone = ICONES[p.categoria] || ICONES.outros;
            const imagem = p.imagem
                ? `<img src="${esc(p.imagem)}" alt="${esc(p.nome)}" loading="lazy">`
                : `<i class="${icone} icone-placeholder" aria-hidden="true"></i>`;
            const selo =
                p.condicao === "usado"
                    ? '<span class="selo selo-usado">Usado</span>'
                    : '<span class="selo selo-novo">Novo</span>';
            const categoria = CATEGORIAS[p.categoria] || "Produtos";

            return `
            <article class="produto">
                <div class="produto-imagem">${imagem}${selo}</div>
                <div class="produto-corpo">
                    <p class="produto-categoria">${esc(categoria)}</p>
                    <h3 class="produto-nome">${esc(p.nome)}</h3>
                    <p class="produto-descricao">${esc(p.descricao)}</p>
                    <p class="produto-preco">${precoTexto(p.preco)}</p>
                    <div class="produto-acoes">
                        <button class="btn-comprar-whats" data-id="${esc(p.id)}">
                            <i class="fa-brands fa-whatsapp"></i> Comprar pelo WhatsApp
                        </button>
                    </div>
                </div>
            </article>`;
        })
        .join("");
}

gradeProdutos.addEventListener("click", (e) => {
    const botao = e.target.closest(".btn-comprar-whats");
    if (!botao) return;
    const produto = PRODUTOS.find((p) => p.id === botao.dataset.id);
    if (produto) {
        abrirWhatsApp(
            `Olá! Vi este anúncio no site da MC Informática:\n\n• ${produto.nome} — ${precoTexto(produto.preco)}\n\nAinda está disponível?`
        );
    }
});

// ---------- Links de WhatsApp (cabeçalho, rodapé, botão flutuante, serviços) ----------
function ativarLinksWhats() {
    document.querySelectorAll("[data-whats]").forEach((el) => {
        if (el.dataset.ligado) return;
        el.dataset.ligado = "1";
        el.addEventListener("click", (e) => {
            e.preventDefault();
            abrirWhatsApp(el.dataset.whats);
        });
    });
}

ativarLinksWhats();

// ---------- Menu mobile ----------
const nav = document.getElementById("nav");
document.getElementById("menu-toggle").addEventListener("click", () => {
    nav.classList.toggle("aberto");
});
nav.addEventListener("click", (e) => {
    if (e.target.tagName === "A") nav.classList.remove("aberto");
});

// ---------- Inicialização ----------
carregarProdutos();
