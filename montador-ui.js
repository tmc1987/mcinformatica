/* ============================================================
   MC INFORMÁTICA — Interface do montador (compartilhada)
   Depende de montador-core.js e da função esc() do app.js.
   ============================================================ */

const ICONE_NIVEL = {
    ok: "fa-solid fa-circle-check",
    aviso: "fa-solid fa-triangle-exclamation",
    erro: "fa-solid fa-circle-xmark",
    info: "fa-solid fa-circle-info"
};

function primeiraPendente(conjunto) {
    return (ETAPAS.find((e) => !conjunto[e.slug]) || {}).slug || null;
}

function proximaPendente(categoria, conjunto) {
    const indiceAtual = ETAPAS.findIndex((e) => e.slug === categoria);
    const ordem = [...ETAPAS.slice(indiceAtual + 1), ...ETAPAS.slice(0, indiceAtual + 1)];
    const pendente = ordem.find((e) => e.obrigatoria && !conjunto[e.slug]) || ordem.find((e) => !conjunto[e.slug]);
    return pendente ? pendente.slug : null;
}

function htmlLinha(peca, escolhida, termo) {
    const ativa = escolhida && escolhida.id === peca.id;
    const texto = normalizar(`${peca.nome} ${peca.descricao}`);
    const oculta = termo && !texto.includes(termo);
    return `
        <li class="montador-linha${ativa ? " selecionada" : ""}" data-texto="${esc(texto)}"${oculta ? " hidden" : ""}>
            <div class="montador-linha-info">
                <strong>${esc(peca.nome)}</strong>
                <span>${esc(peca.descricao)}</span>
            </div>
            <button class="btn ${ativa ? "btn-secundario" : "btn-escolher"}" data-id="${esc(peca.id)}" data-categoria="${esc(peca.categoria)}">
                ${ativa ? '<i class="fa-solid fa-check"></i> Escolhida' : "Escolher"}
            </button>
        </li>`;
}

// estado: { aberta, buscas } — "aberta" é o slug da etapa aberta (ou null)
function htmlEtapas(conjunto, estado, prefixo = "") {
    if (PECAS.length === 0) {
        return `
            <div class="catalogo-vazio">
                <i class="fa-solid fa-screwdriver-wrench"></i>
                <h3>Montador em preparação</h3>
                <p>Estamos cadastrando as peças disponíveis. Volte em breve para montar sua configuração.</p>
            </div>`;
    }
    return ETAPAS.map((etapa, indice) => {
        const escolhida = conjunto[etapa.slug];
        const aberta = estado.aberta === etapa.slug;
        const opcoes = opcoesCompativeis(etapa.slug, conjunto);
        const busca = estado.buscas[etapa.slug] || "";
        const termo = normalizar(busca.trim());
        const visiveis = opcoes.filter((p) => normalizar(`${p.nome} ${p.descricao}`).includes(termo)).length;
        const corpo = opcoes.length === 0
            ? '<div class="montador-etapa-corpo"><p class="montador-aviso">Nenhuma peça compatível com as escolhas atuais.</p></div>'
            : `<div class="montador-etapa-corpo">
                    <input type="search" class="montador-busca" data-etapa="${etapa.slug}" data-prefixo="${prefixo}" placeholder="Buscar ${esc(etapa.nome.toLowerCase())}..." value="${esc(busca)}" aria-label="Buscar ${esc(etapa.nome)}">
                    <ul class="montador-lista">${opcoes.map((p) => htmlLinha(p, escolhida, termo)).join("")}</ul>
                    <p class="montador-sem-resultado"${visiveis ? " hidden" : ""}>Nenhuma peça encontrada com essa busca.</p>
                </div>`;
        const situacao = escolhida
            ? `<span class="montador-escolhida"><i class="fa-solid fa-check"></i> ${esc(escolhida.nome)}</span>`
            : (etapa.obrigatoria ? "" : '<span class="montador-opcional">Opcional</span>');
        return `
            <section class="montador-etapa${escolhida ? " concluida" : ""}${aberta ? " aberta" : ""}">
                <button class="montador-etapa-cabecalho" data-etapa="${etapa.slug}" data-prefixo="${prefixo}" aria-expanded="${aberta}">
                    <span class="montador-numero">${indice + 1}</span>
                    <i class="${ICONES_ETAPA[etapa.slug]}"></i>
                    <h2>${esc(etapa.nome)}</h2>
                    ${situacao}
                    <i class="fa-solid fa-chevron-down montador-seta"></i>
                </button>
                ${aberta ? corpo : ""}
            </section>`;
    }).join("");
}

function htmlListaResumo(conjunto) {
    return ETAPAS.map((etapa) => {
        const peca = conjunto[etapa.slug];
        return `<li class="${peca ? "ok" : "pendente"}">
            <strong>${esc(etapa.nome)}:</strong>
            ${peca ? esc(peca.nome) : "<em>não escolhido</em>"}
        </li>`;
    }).join("");
}

function htmlAnalise(conjunto) {
    const itens = analisarMontagem(conjunto);
    if (!itens.length) return "";
    const { nota, equilibrio } = pontuacaoMontagem(itens);
    return `
        <div class="analise-nota analise-${nota >= 65 ? "boa" : "fraca"}">
            <strong>${nota}/100</strong>
            <span>Equilíbrio: ${equilibrio}</span>
        </div>
        <ul class="analise-itens">
            ${itens.map((i) => `
                <li class="analise-item nivel-${i.nivel}">
                    <i class="${ICONE_NIVEL[i.nivel]}" aria-hidden="true"></i>
                    <div>
                        <strong>${esc(i.titulo)}</strong>
                        <p>${esc(i.texto)}</p>
                        ${i.sugestao ? `<p class="analise-sugestao">${esc(i.sugestao)}</p>` : ""}
                    </div>
                </li>`).join("")}
        </ul>`;
}

// Bloco "Tecnologia da montagem": uma explicação por componente escolhido
function htmlTecnologia(conjunto) {
    const escolhidas = ETAPAS.filter((e) => conjunto[e.slug]);
    if (!escolhidas.length) {
        return '<p class="montador-aviso">Escolha as peças para ver a tecnologia de cada componente.</p>';
    }
    const cards = escolhidas.map((etapa) => {
        const peca = conjunto[etapa.slug];
        const linhas = infoTecnologia(peca)
            .map(([rotulo, valor]) => `<div class="tec-linha"><dt>${esc(rotulo)}</dt><dd>${esc(valor)}</dd></div>`)
            .join("");
        return `
            <article class="tec-card">
                <h3><i class="${ICONES_ETAPA[etapa.slug]}"></i> ${esc(etapa.nome)}</h3>
                <p class="tec-glossario">${esc(GLOSSARIO[etapa.slug])}</p>
                <dl class="tec-lista">${linhas}</dl>
            </article>`;
    }).join("");
    const termos = Object.entries(GLOSSARIO_TERMOS)
        .map(([termo, texto]) => `<div class="tec-termo"><dt>${esc(termo)}</dt><dd>${esc(texto)}</dd></div>`)
        .join("");
    return `
        <div class="tec-cards">${cards}</div>
        <details class="tec-termos">
            <summary>O que significam os termos</summary>
            <dl>${termos}</dl>
        </details>`;
}

// Liga busca e cabeçalhos de etapa (sem re-renderizar a busca, para não perder o foco)
function ligarBuscaEtapas(container, aoBuscar) {
    container.addEventListener("input", (e) => {
        const campo = e.target.closest(".montador-busca");
        if (!campo) return;
        const termo = normalizar(campo.value.trim());
        const bloco = campo.closest(".montador-etapa-corpo");
        let visiveis = 0;
        bloco.querySelectorAll(".montador-linha").forEach((linha) => {
            const ok = !termo || linha.dataset.texto.includes(termo);
            linha.hidden = !ok;
            if (ok) visiveis++;
        });
        bloco.querySelector(".montador-sem-resultado").hidden = visiveis > 0;
        aoBuscar(campo.dataset.etapa, campo.value);
    });
}
