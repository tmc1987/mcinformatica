/* ============================================================
   MC INFORMÁTICA — Monte seu PC (página de montagem)
   Lógica em montador-core.js, interface em montador-ui.js.
   ============================================================ */

const CHAVE_MONTAGEM = "mc-montagem-v1";

let montagem = {};
const estado = { aberta: undefined, buscas: {} };

const etapasEl = document.getElementById("etapas");
const resumoListaEl = document.getElementById("resumo-lista");
const analiseEl = document.getElementById("analise");

function renderizarTudo() {
    if (estado.aberta === undefined) estado.aberta = primeiraPendente(montagem);
    etapasEl.innerHTML = htmlEtapas(montagem, estado);
    resumoListaEl.innerHTML = htmlListaResumo(montagem);
    analiseEl.innerHTML = htmlAnalise(montagem);
}

function escolherPeca(id, categoria) {
    const peca = PECAS.find((p) => p.id === id);
    if (!peca) return;
    if (montagem[categoria]?.id === id) {
        delete montagem[categoria];
    } else {
        if (!opcoesCompativeis(categoria, montagem).some((p) => p.id === id)) return;
        montagem[categoria] = peca;
        estado.aberta = proximaPendente(categoria, montagem);
    }
    limparIncompativeis(montagem);
    salvarMontagem();
    renderizarTudo();
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

etapasEl.addEventListener("click", (e) => {
    const cabecalho = e.target.closest("button[data-etapa]");
    if (cabecalho) {
        const slug = cabecalho.dataset.etapa;
        estado.aberta = estado.aberta === slug ? null : slug;
        renderizarTudo();
        return;
    }
    const botao = e.target.closest("button[data-id]");
    if (botao) escolherPeca(botao.dataset.id, botao.dataset.categoria);
});

ligarBuscaEtapas(etapasEl, (slug, valor) => {
    estado.buscas[slug] = valor;
});

document.getElementById("btn-limpar").addEventListener("click", () => {
    montagem = {};
    estado.aberta = undefined;
    salvarMontagem();
    renderizarTudo();
});

async function carregarPecas() {
    try {
        const resposta = await fetch("montador-pecas.json", { cache: "no-cache" });
        if (!resposta.ok) throw new Error("HTTP " + resposta.status);
        setPecas(await resposta.json());
    } catch {
        setPecas([]);
    }
    carregarMontagemSalva();
    renderizarTudo();
}

carregarPecas();
