/* ============================================================
   MC INFORMÁTICA — Comparar montagens (A e B lado a lado)
   Usa montador-core.js (regras, análise, tecnologia) e
   montador-ui.js (HTML). NUMERO_WHATSAPP vem de app.js.
   ============================================================ */

const CHAVE_COMPARAR = "mc-comparar-v1";
const LIMITE_EMPATE_DESEMPENHO = 3;
const LIMITE_EMPATE_GERAL = 2;
const CONSTRUCOES = ["A", "B"];

const configs = { A: {}, B: {} };
const estados = {
    A: { aberta: undefined, buscas: {} },
    B: { aberta: undefined, buscas: {} }
};

const elementos = {};
CONSTRUCOES.forEach((k) => {
    elementos[k] = {
        etapas: document.getElementById(`etapas-${k}`),
        resumo: document.getElementById(`resumo-lista-${k}`),
        analise: document.getElementById(`analise-${k}`),
        tecnologia: document.getElementById(`tecnologia-${k}`)
    };
});
const tabelaEl = document.getElementById("tabela-comparacao");
const vereditoEl = document.getElementById("conteudo-veredito");

function salvar() {
    const ids = {};
    CONSTRUCOES.forEach((k) => {
        ids[k] = Object.fromEntries(Object.entries(configs[k]).map(([slug, p]) => [slug, p.id]));
    });
    localStorage.setItem(CHAVE_COMPARAR, JSON.stringify(ids));
}

function carregarSalvo() {
    try {
        const ids = JSON.parse(localStorage.getItem(CHAVE_COMPARAR) || "{}");
        CONSTRUCOES.forEach((k) => {
            configs[k] = {};
            Object.entries(ids[k] || {}).forEach(([slug, id]) => {
                const peca = PECAS.find((p) => p.id === id);
                if (peca) configs[k][slug] = peca;
            });
        });
    } catch {
        configs.A = {};
        configs.B = {};
    }
}

// ---------- Comparação peça a peça ----------

function vantagemEtapa(slug, a, b) {
    if (!a || !b) return { lado: null, texto: "Falta escolher" };
    if (a.id === b.id) return { lado: null, texto: "Mesma peça" };

    const comparar = (va, vb, unidade, rotuloMelhor) => {
        const diff = va - vb;
        if (Math.abs(diff) <= LIMITE_EMPATE_DESEMPENHO) return { lado: null, texto: "Desempenho parecido" };
        const lado = diff > 0 ? "A" : "B";
        return { lado, texto: `${lado} tem ${rotuloMelhor} (+${Math.abs(diff)}${unidade})` };
    };

    if (slug === "processador") return comparar(a.specs.desempenho, b.specs.desempenho, " pts", "mais desempenho");
    if (slug === "placa_video") return comparar(a.specs.desempenho, b.specs.desempenho, " pts", "mais desempenho");
    if (slug === "memoria") {
        const diff = a.specs.capacidade - b.specs.capacidade;
        if (!diff) return { lado: null, texto: "Mesma capacidade" };
        return { lado: diff > 0 ? "A" : "B", texto: `${diff > 0 ? "A" : "B"} tem mais memória (+${Math.abs(diff)} GB)` };
    }
    if (slug === "fonte") {
        const diff = Number(a.specs.potencia) - Number(b.specs.potencia);
        if (!diff) return { lado: null, texto: "Mesma potência" };
        return { lado: diff > 0 ? "A" : "B", texto: `${diff > 0 ? "A" : "B"} tem mais potência (+${Math.abs(diff)} W)` };
    }
    if (slug === "placa_mae") {
        const diff = Number(a.specs.pcie) - Number(b.specs.pcie);
        if (!diff) return { lado: null, texto: "Mesma versão PCIe" };
        return { lado: diff > 0 ? "A" : "B", texto: `${diff > 0 ? "A" : "B"} tem PCIe mais recente` };
    }
    return { lado: null, texto: "Peças diferentes" };
}

function renderizarComparacao() {
    const linhas = ETAPAS.map((etapa) => {
        const a = configs.A[etapa.slug];
        const b = configs.B[etapa.slug];
        const v = vantagemEtapa(etapa.slug, a, b);
        const marcaA = v.lado === "A" ? " vantagem" : "";
        const marcaB = v.lado === "B" ? " vantagem" : "";
        return `
            <tr>
                <th>${esc(etapa.nome)}</th>
                <td class="${marcaA}">${a ? esc(a.nome) : "<em>—</em>"}</td>
                <td class="${marcaB}">${b ? esc(b.nome) : "<em>—</em>"}</td>
                <td class="comparar-diferenca">${esc(v.texto)}</td>
            </tr>`;
    }).join("");

    tabelaEl.innerHTML = `
        <table class="comparar-tabela">
            <thead>
                <tr><th>Etapa</th><th>Configuração A</th><th>Configuração B</th><th>Diferença</th></tr>
            </thead>
            <tbody>${linhas}</tbody>
        </table>`;
}

// ---------- Veredito ----------

function escoreGeral(desempenho, nota) {
    const media = (desempenho.jogos + desempenho.trabalho + desempenho.estudo) / 3;
    return media * 0.7 + nota * 0.3;
}

function calcularVeredito() {
    const dA = desempenhoConjunto(configs.A);
    const dB = desempenhoConjunto(configs.B);
    if (!dA || !dB) return null;

    const notaA = pontuacaoMontagem(analisarMontagem(configs.A)).nota;
    const notaB = pontuacaoMontagem(analisarMontagem(configs.B)).nota;

    const usos = [
        { chave: "jogos", nome: "Jogos" },
        { chave: "trabalho", nome: "Trabalho" },
        { chave: "estudo", nome: "Estudo" }
    ].map((u) => {
        const diff = dA[u.chave] - dB[u.chave];
        const lado = Math.abs(diff) <= LIMITE_EMPATE_DESEMPENHO ? null : diff > 0 ? "A" : "B";
        return { ...u, a: dA[u.chave], b: dB[u.chave], lado };
    });

    const sA = escoreGeral(dA, notaA);
    const sB = escoreGeral(dB, notaB);
    const diffGeral = sA - sB;
    const geralLado = Math.abs(diffGeral) <= LIMITE_EMPATE_GERAL ? null : diffGeral > 0 ? "A" : "B";

    const motivos = ETAPAS
        .map((e) => ({ etapa: e.nome, ...vantagemEtapa(e.slug, configs.A[e.slug], configs.B[e.slug]) }))
        .filter((m) => m.lado);

    return { dA, dB, notaA, notaB, sA, sB, usos, geralLado, motivos };
}

function textoVeredito(v) {
    const vencedorGeral = v.geralLado
        ? `A configuração ${v.geralLado} é a melhor no conjunto.`
        : "As duas configurações estão tecnicamente empatadas no conjunto.";
    const porUso = v.usos.map((u) => {
        const quem = u.lado ? `A configuração ${u.lado} rende mais` : "Desempenho parecido";
        return `${u.nome}: ${quem} (A ${u.a} x B ${u.b}).`;
    }).join(" ");
    return { vencedorGeral, porUso };
}

function htmlVeredito() {
    const v = calcularVeredito();
    if (!v) {
        return `<p class="montador-aviso">Monte as duas configurações com processador para ver o veredito.</p>`;
    }
    const t = textoVeredito(v);
    const linhasUso = v.usos.map((u) => `
        <li class="veredito-uso">
            <strong>${esc(u.nome)}</strong>
            <span class="${u.lado ? "veredito-lado" : ""}">${u.lado ? `Configuração ${u.lado}` : "Empate"}</span>
            <small>A ${u.a} x B ${u.b}</small>
        </li>`).join("");
    const motivos = v.motivos.length
        ? v.motivos.map((m) => `<li>${esc(m.etapa)}: ${esc(m.texto)}</li>`).join("")
        : "<li>As peças têm desempenho parecido.</li>";

    return `
        <div class="veredito-geral">
            <strong>${esc(t.vencedorGeral)}</strong>
            <p>Pontuação geral: A ${Math.round(v.sA)} x B ${Math.round(v.sB)}. Compatibilidade: A ${v.notaA}/100, B ${v.notaB}/100.</p>
        </div>
        <h3 class="comparar-subtitulo">Por uso</h3>
        <ul class="veredito-usos">${linhasUso}</ul>
        <h3 class="comparar-subtitulo">O que pesou</h3>
        <ul class="veredito-motivos">${motivos}</ul>
        <p class="comparar-aviso">As pontuações de desempenho são estimativas relativas entre as peças do catálogo, não resultados de testes reais.</p>`;
}

// ---------- Compartilhamento ----------

function textoCompartilhar() {
    const v = calcularVeredito();
    const resumo = (k) => ETAPAS
        .filter((e) => configs[k][e.slug])
        .map((e) => `• ${e.nome}: ${configs[k][e.slug].nome}`)
        .join("\n");
    const cabecalho = "Comparação de montagens — MC Informática";
    if (!v) return `${cabecalho}\n\nConfiguração A:\n${resumo("A")}\n\nConfiguração B:\n${resumo("B")}`;
    const t = textoVeredito(v);
    return `${cabecalho}\n\nConfiguração A (compatibilidade ${v.notaA}/100):\n${resumo("A")}\n\nConfiguração B (compatibilidade ${v.notaB}/100):\n${resumo("B")}\n\nVeredito: ${t.vencedorGeral}\n${t.porUso}`;
}

document.getElementById("btn-compartilhar").addEventListener("click", () => {
    const url = `https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(textoCompartilhar())}`;
    window.open(url, "_blank");
});

// ---------- Renderização e eventos ----------

function renderizarColuna(k) {
    const conjunto = configs[k];
    const estado = estados[k];
    if (estado.aberta === undefined) estado.aberta = primeiraPendente(conjunto);
    elementos[k].etapas.innerHTML = htmlEtapas(conjunto, estado, k);
    elementos[k].resumo.innerHTML = htmlListaResumo(conjunto);
    elementos[k].analise.innerHTML = htmlAnalise(conjunto);
    elementos[k].tecnologia.innerHTML = htmlTecnologia(conjunto);
}

function renderizarTudo() {
    CONSTRUCOES.forEach(renderizarColuna);
    renderizarComparacao();
    vereditoEl.innerHTML = htmlVeredito();
}

function escolherPeca(k, id, categoria) {
    const conjunto = configs[k];
    const peca = PECAS.find((p) => p.id === id);
    if (!peca) return;
    if (conjunto[categoria]?.id === id) {
        delete conjunto[categoria];
    } else {
        if (!opcoesCompativeis(categoria, conjunto).some((p) => p.id === id)) return;
        conjunto[categoria] = peca;
        estados[k].aberta = proximaPendente(categoria, conjunto);
    }
    limparIncompativeis(conjunto);
    salvar();
    renderizarTudo();
}

CONSTRUCOES.forEach((k) => {
    const etapasEl = elementos[k].etapas;

    etapasEl.addEventListener("click", (e) => {
        const cabecalho = e.target.closest("button[data-etapa]");
        if (cabecalho) {
            const slug = cabecalho.dataset.etapa;
            const estado = estados[k];
            estado.aberta = estado.aberta === slug ? null : slug;
            renderizarTudo();
            return;
        }
        const botao = e.target.closest("button[data-id]");
        if (botao) escolherPeca(k, botao.dataset.id, botao.dataset.categoria);
    });

    ligarBuscaEtapas(etapasEl, (slug, valor) => {
        estados[k].buscas[slug] = valor;
    });
});

document.querySelectorAll(".btn-limpar-build").forEach((botao) => {
    botao.addEventListener("click", () => {
        const k = botao.dataset.build;
        configs[k] = {};
        estados[k].aberta = undefined;
        salvar();
        renderizarTudo();
    });
});

async function iniciar() {
    try {
        const resposta = await fetch("montador-pecas.json", { cache: "no-cache" });
        if (!resposta.ok) throw new Error("HTTP " + resposta.status);
        setPecas(await resposta.json());
    } catch {
        setPecas([]);
    }
    carregarSalvo();
    renderizarTudo();
}

iniciar();
