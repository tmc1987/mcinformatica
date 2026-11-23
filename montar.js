/* ============================================================
   MC INFORMÁTICA — Monte seu PC
   ------------------------------------------------------------
   As peças ficam em montador-pecas.json. Cada peça tem:
     id, categoria, nome, descricao, condicao ("novo" | "usado"),
     imagem (opcional) e specs:
       socket (processador e placa-mãe), memoria (tipo na
       placa-mãe e na memória), tdp (W, processador e placa de
       vídeo), potencia (W, fonte), formato (placa-mãe, ex.:
       "ATX", "micro-ATX") e formatos (lista de formatos de
       placa-mãe aceitos pelo gabinete).
   O site não mostra preços nem vende direto: a montagem é
   enviada para o WhatsApp da loja.
   ============================================================ */

const NUMERO_WHATSAPP_MONTADOR = "5516996198688";
const CHAVE_MONTAGEM = "mc-montagem-v1";

const ETAPAS = [
    { slug: "processador", nome: "Processador", obrigatoria: true },
    { slug: "placa_mae", nome: "Placa-mãe", obrigatoria: true },
    { slug: "memoria", nome: "Memória RAM", obrigatoria: true },
    { slug: "armazenamento", nome: "Armazenamento", obrigatoria: true },
    { slug: "placa_video", nome: "Placa de vídeo", obrigatoria: false },
    { slug: "fonte", nome: "Fonte", obrigatoria: true },
    { slug: "gabinete", nome: "Gabinete", obrigatoria: true }
];

const ICONES_ETAPA = {
    processador: "fa-solid fa-microchip",
    placa_mae: "fa-solid fa-memory",
    memoria: "fa-solid fa-memory",
    armazenamento: "fa-solid fa-hard-drive",
    placa_video: "fa-solid fa-display",
    fonte: "fa-solid fa-bolt",
    gabinete: "fa-solid fa-computer"
};

let PECAS = [];
let montagem = {};

const etapasEl = document.getElementById("etapas");
const resumoListaEl = document.getElementById("resumo-lista");
const resumoAvisosEl = document.getElementById("resumo-avisos");

const esc = (texto) =>
    String(texto ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

function pecasDaCategoria(slug) {
    return PECAS.filter((p) => p.categoria === slug);
}

// Regras de compatibilidade entre a peça escolhida e a peça candidata
function ehCompativel(candidata, categoria) {
    const cpu = montagem.processador;
    const mae = montagem.placa_mae;

    if (categoria === "placa_mae" && cpu) return candidata.specs.socket === cpu.specs.socket;
    if (categoria === "processador" && mae) return candidata.specs.socket === mae.specs.socket;
    if (categoria === "memoria" && mae) return candidata.specs.memoria === mae.specs.memoria;
    if (categoria === "gabinete" && mae) {
        return (candidata.specs.formatos || []).includes(mae.specs.formato);
    }
    if (categoria === "fonte") {
        const necessaria = potenciaNecessaria({ ...montagem, fonte: candidata });
        return necessaria === null || Number(candidata.specs.potencia) >= necessaria;
    }
    return true;
}

// Potência mínima com margem de 20%. Retorna null se faltar informação.
function potenciaNecessaria(montagemAtual) {
    const cpu = montagemAtual.processador;
    const video = montagemAtual.placa_video;
    const consumo = (cpu?.specs.tdp || 0) + (video?.specs.tdp || 0) + 100;
    if (!cpu) return null;
    return Math.ceil(consumo * 1.2);
}

function listaVisivel(slug) {
    return pecasDaCategoria(slug).filter((p) => {
        if (slug === "placa_mae" && montagem.processador) return ehCompativel(p, "placa_mae");
        if (slug === "processador" && montagem.placa_mae) return ehCompativel(p, "processador");
        if (slug === "memoria" && montagem.placa_mae) return ehCompativel(p, "memoria");
        if (slug === "gabinete" && montagem.placa_mae) return ehCompativel(p, "gabinete");
        if (slug === "fonte") return ehCompativel(p, "fonte");
        return true;
    });
}

function renderizarEtapas() {
    if (PECAS.length === 0) {
        etapasEl.innerHTML = `
            <div class="catalogo-vazio">
                <i class="fa-solid fa-screwdriver-wrench"></i>
                <h3>Montador em preparação</h3>
                <p>Estamos cadastrando as peças disponíveis. Enquanto isso, fale com a gente no WhatsApp e monte sua configuração com a nossa equipe.</p>
                <button class="btn btn-whatsapp" data-whats="Olá! Quero montar um PC pelo site da MC Informática.">
                    <i class="fa-brands fa-whatsapp"></i> Montar com a loja
                </button>
            </div>`;
        ativarLinksWhatsMontador();
        return;
    }

    etapasEl.innerHTML = ETAPAS.map((etapa, indice) => {
        const escolhida = montagem[etapa.slug];
        const opcoes = listaVisivel(etapa.slug);
        const corpo = opcoes.length === 0
            ? '<p class="montador-aviso">Nenhuma peça compatível com as escolhas anteriores.</p>'
            : `<div class="montador-opcoes">${opcoes.map((p) => cartaoPeca(p, escolhida)).join("")}</div>`;
        return `
            <section class="montador-etapa${escolhida ? " concluida" : ""}">
                <header class="montador-etapa-cabecalho">
                    <span class="montador-numero">${indice + 1}</span>
                    <i class="${ICONES_ETAPA[etapa.slug]}"></i>
                    <h2>${esc(etapa.nome)}</h2>
                    ${etapa.obrigatoria ? "" : '<span class="montador-opcional">Opcional</span>'}
                </header>
                ${corpo}
            </section>`;
    }).join("");
}

function cartaoPeca(peca, escolhida) {
    const ativa = escolhida && escolhida.id === peca.id;
    const imagem = peca.imagem
        ? `<img src="${esc(peca.imagem)}" alt="${esc(peca.nome)}" loading="lazy">`
        : `<i class="${ICONES_ETAPA[peca.categoria] || "fa-solid fa-box"} icone-placeholder" aria-hidden="true"></i>`;
    const selo = peca.condicao === "usado"
        ? '<span class="selo selo-usado">Usado</span>'
        : '<span class="selo selo-novo">Novo</span>';
    return `
        <article class="montador-peca${ativa ? " selecionada" : ""}">
            <div class="montador-peca-imagem">${imagem}${selo}</div>
            <div class="montador-peca-corpo">
                <h3>${esc(peca.nome)}</h3>
                <p>${esc(peca.descricao)}</p>
                <button class="btn ${ativa ? "btn-secundario" : "btn-escolher"}" data-id="${esc(peca.id)}" data-categoria="${esc(peca.categoria)}">
                    ${ativa ? '<i class="fa-solid fa-check"></i> Escolhida (remover)' : "Escolher"}
                </button>
            </div>
        </article>`;
}

function renderizarResumo() {
    resumoListaEl.innerHTML = ETAPAS.map((etapa) => {
        const peca = montagem[etapa.slug];
        return `<li class="${peca ? "ok" : "pendente"}">
            <strong>${esc(etapa.nome)}:</strong>
            ${peca ? esc(peca.nome) : "<em>não escolhido</em>"}
        </li>`;
    }).join("");

    const avisos = validarMontagem();
    resumoAvisosEl.innerHTML = avisos.length
        ? avisos.map((a) => `<p class="aviso-item"><i class="fa-solid fa-triangle-exclamation"></i> ${esc(a)}</p>`).join("")
        : "";
}

function validarMontagem() {
    const avisos = [];
    const faltam = ETAPAS.filter((e) => e.obrigatoria && !montagem[e.slug]).map((e) => e.nome);
    if (faltam.length) avisos.push(`Ainda falta escolher: ${faltam.join(", ")}.`);

    const cpu = montagem.processador;
    const mae = montagem.placa_mae;
    const fonte = montagem.fonte;
    if (cpu && mae && cpu.specs.socket !== mae.specs.socket) {
        avisos.push("O processador e a placa-mãe têm sockets diferentes.");
    }
    if (montagem.memoria && mae && montagem.memoria.specs.memoria !== mae.specs.memoria) {
        avisos.push("A memória não é compatível com a placa-mãe escolhida.");
    }
    const necessaria = potenciaNecessaria(montagem);
    if (fonte && necessaria && Number(fonte.specs.potencia) < necessaria) {
        avisos.push(`A fonte escolhida pode não ser suficiente. Recomendado: pelo menos ${necessaria} W.`);
    }
    return avisos;
}

function escolherPeca(id, categoria) {
    const peca = PECAS.find((p) => p.id === id);
    if (!peca) return;
    const atual = montagem[categoria];
    if (atual && atual.id === id) {
        delete montagem[categoria];
    } else {
        montagem[categoria] = peca;
    }
    limparIncompativeis();
    salvarMontagem();
    renderizarTudo();
}

// Remove peças que deixaram de combinar depois de uma troca
function limparIncompativeis() {
    ETAPAS.forEach((etapa) => {
        const peca = montagem[etapa.slug];
        if (!peca) return;
        delete montagem[etapa.slug];
        const valida = listaVisivel(etapa.slug).some((p) => p.id === peca.id);
        if (valida) montagem[etapa.slug] = peca;
    });
}

function salvarMontagem() {
    const ids = Object.fromEntries(Object.entries(montagem).map(([k, p]) => [k, p.id]));
    localStorage.setItem(CHAVE_MONTAGEM, JSON.stringify(ids));
}

function carregarMontagemSalva() {
    try {
        const ids = JSON.parse(localStorage.getItem(CHAVE_MONTAGEM) || "{}");
        montagem = {};
        Object.entries(ids).forEach(([categoria, id]) => {
            const peca = PECAS.find((p) => p.id === id);
            if (peca) montagem[categoria] = peca;
        });
    } catch {
        montagem = {};
    }
}

function textoWhatsApp() {
    const linhas = ETAPAS.map((etapa) => {
        const peca = montagem[etapa.slug];
        return `• ${etapa.nome}: ${peca ? peca.nome : "não escolhido"}`;
    });
    return `Olá! Montei uma configuração pelo site da MC Informática:\n\n${linhas.join("\n")}\n\nPodem me passar o orçamento?`;
}

function abrirWhatsAppMontagem() {
    const url = `https://wa.me/${NUMERO_WHATSAPP_MONTADOR}?text=${encodeURIComponent(textoWhatsApp())}`;
    window.open(url, "_blank");
}

function ativarLinksWhatsMontador() {
    document.querySelectorAll("[data-whats]").forEach((el) => {
        if (el.dataset.ligado) return;
        el.dataset.ligado = "1";
        el.addEventListener("click", (e) => {
            e.preventDefault();
            window.open(`https://wa.me/${NUMERO_WHATSAPP_MONTADOR}?text=${encodeURIComponent(el.dataset.whats)}`, "_blank");
        });
    });
}

function renderizarTudo() {
    renderizarEtapas();
    renderizarResumo();
}

etapasEl.addEventListener("click", (e) => {
    const botao = e.target.closest("button[data-id]");
    if (!botao) return;
    escolherPeca(botao.dataset.id, botao.dataset.categoria);
});

document.getElementById("btn-enviar").addEventListener("click", abrirWhatsAppMontagem);

document.getElementById("btn-limpar").addEventListener("click", () => {
    montagem = {};
    salvarMontagem();
    renderizarTudo();
});

async function carregarPecas() {
    try {
        const resposta = await fetch("montador-pecas.json", { cache: "no-cache" });
        if (!resposta.ok) throw new Error("HTTP " + resposta.status);
        const dados = await resposta.json();
        PECAS = Array.isArray(dados) ? dados : [];
    } catch {
        PECAS = [];
    }
    carregarMontagemSalva();
    renderizarTudo();
}

carregarPecas();
