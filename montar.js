/* ============================================================
   MC INFORMÁTICA — Monte seu PC
   ------------------------------------------------------------
   O cliente monta uma configuração e recebe uma análise.
   As peças ficam em montador-pecas.json. Campos usados:
     id, categoria, nome, descricao, condicao, imagem (opcional)
     specs.socket        processador e placa-mãe
     specs.memoria       tipo de memória (placa-mãe e módulos)
     specs.capacidade    GB do kit de memória
     specs.tdp           consumo em W (processador e placa de vídeo)
     specs.desempenho    pontuação relativa 0-100 (processador e placa de vídeo)
     specs.potencia      W da fonte
     specs.formato       formato da placa-mãe ("ATX", "micro-ATX")
     specs.formatos      formatos aceitos pelo gabinete
   ============================================================ */

const CHAVE_MONTAGEM = "mc-montagem-v1";
const MINIMO_RAM_GB = 8;
const RAM_RECOMENDADA_GB = 16;

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
const analiseEl = document.getElementById("analise");

const pecasDaCategoria = (slug) => PECAS.filter((p) => p.categoria === slug);

// Potência mínima recomendada (margem de 20%) para o conjunto escolhido
function potenciaNecessaria(conjunto) {
    const cpu = conjunto.processador;
    if (!cpu) return null;
    const consumo = (cpu.specs.tdp || 0) + (conjunto.placa_video?.specs.tdp || 0) + 100;
    return Math.ceil(consumo * 1.2);
}

// Uma peça é compatível se combina com todas as peças já escolhidas
function ehCompativel(candidata, categoria, conjunto = montagem) {
    const cpu = conjunto.processador;
    const mae = conjunto.placa_mae;
    const memoria = conjunto.memoria;
    const fonte = conjunto.fonte;

    if (categoria === "processador" && mae) return candidata.specs.socket === mae.specs.socket;
    if (categoria === "placa_mae") {
        if (cpu && candidata.specs.socket !== cpu.specs.socket) return false;
        if (memoria && candidata.specs.memoria !== memoria.specs.memoria) return false;
        if (conjunto.gabinete && !(conjunto.gabinete.specs.formatos || []).includes(candidata.specs.formato)) return false;
        return true;
    }
    if (categoria === "memoria" && mae) return candidata.specs.memoria === mae.specs.memoria;
    if (categoria === "gabinete" && mae) return (candidata.specs.formatos || []).includes(mae.specs.formato);
    if (categoria === "fonte") {
        const necessaria = potenciaNecessaria({ ...conjunto, fonte: candidata });
        return necessaria === null || Number(candidata.specs.potencia) >= necessaria;
    }
    if (categoria === "placa_video" && fonte) {
        const necessaria = potenciaNecessaria({ ...conjunto, placa_video: candidata });
        return necessaria === null || Number(fonte.specs.potencia) >= necessaria;
    }
    return true;
}

function opcoesCompativeis(categoria, conjunto = montagem) {
    const sem = { ...conjunto };
    delete sem[categoria];
    return pecasDaCategoria(categoria).filter((p) => ehCompativel(p, categoria, sem));
}

// Diagnóstico completo da montagem
function analisarMontagem() {
    const itens = [];
    const cpu = montagem.processador;
    const mae = montagem.placa_mae;
    const memoria = montagem.memoria;
    const video = montagem.placa_video;
    const fonte = montagem.fonte;
    const gabinete = montagem.gabinete;

    const faltam = ETAPAS.filter((e) => e.obrigatoria && !montagem[e.slug]).map((e) => e.nome);
    if (faltam.length) {
        itens.push({ nivel: "info", titulo: "Peças pendentes", texto: `Escolha: ${faltam.join(", ")}.` });
    }

    if (cpu && mae) {
        itens.push(cpu.specs.socket === mae.specs.socket
            ? { nivel: "ok", titulo: "Socket", texto: `${cpu.nome} e ${mae.nome} usam o mesmo socket (${cpu.specs.socket}).` }
            : { nivel: "erro", titulo: "Socket", texto: "Processador e placa-mãe têm sockets diferentes." });
    }

    if (mae && memoria) {
        itens.push(mae.specs.memoria === memoria.specs.memoria
            ? { nivel: "ok", titulo: "Memória", texto: `Tipo ${memoria.specs.memoria} compatível com a placa-mãe.` }
            : { nivel: "erro", titulo: "Memória", texto: `A placa-mãe usa ${mae.specs.memoria} e a memória escolhida é ${memoria.specs.memoria}.` });
    }

    if (memoria) {
        const gargaloRam = memoria.specs.capacidade < RAM_RECOMENDADA_GB && (cpu?.specs.desempenho >= 60 || video);
        if (memoria.specs.capacidade < MINIMO_RAM_GB) {
            itens.push({ nivel: "erro", titulo: "Memória insuficiente", texto: `${memoria.specs.capacidade} GB é abaixo do mínimo recomendado.`, sugestao: sugerirMemoria() });
        } else if (gargaloRam) {
            itens.push({ nivel: "aviso", titulo: "Memória pode limitar o sistema", texto: `${memoria.specs.capacidade} GB para este processador${video ? " e placa de vídeo" : ""}. Para jogos e trabalho pesado, o ideal é ${RAM_RECOMENDADA_GB} GB.`, sugestao: sugerirMemoria() });
        }
    }

    if (cpu && video) {
        const cpuScore = cpu.specs.desempenho;
        const gpuScore = video.specs.desempenho;
        if (cpuScore < gpuScore * 0.75) {
            const melhor = opcoesCompativeis("processador").filter((p) => p.specs.desempenho >= gpuScore * 0.9)
                .sort((a, b) => a.specs.desempenho - b.specs.desempenho)[0];
            itens.push({ nivel: "aviso", titulo: "Processador limita a placa de vídeo", texto: `${cpu.nome} vai segurar o desempenho de ${video.nome}.`, sugestao: melhor ? `Opção compatível mais equilibrada: ${melhor.nome}.` : null });
        } else if (gpuScore < cpuScore * 0.5) {
            const melhor = pecasDaCategoria("placa_video").filter((p) => p.specs.desempenho >= cpuScore * 0.8 && ehCompativel(p, "placa_video"))
                .sort((a, b) => a.specs.desempenho - b.specs.desempenho)[0];
            itens.push({ nivel: "aviso", titulo: "Placa de vídeo limita o processador", texto: `${video.nome} não aproveita bem ${cpu.nome}.`, sugestao: melhor ? `Opção mais equilibrada: ${melhor.nome}.` : null });
        } else {
            itens.push({ nivel: "ok", titulo: "Equilíbrio processador x placa de vídeo", texto: "As duas peças têm desempenho próximo." });
        }
    }

    if (mae && gabinete) {
        itens.push((gabinete.specs.formatos || []).includes(mae.specs.formato)
            ? { nivel: "ok", titulo: "Gabinete", texto: `Gabinete aceita placa ${mae.specs.formato}.` }
            : { nivel: "erro", titulo: "Gabinete", texto: `O gabinete não aceita placa ${mae.specs.formato}.` });
    }

    const necessaria = potenciaNecessaria(montagem);
    if (fonte && necessaria) {
        itens.push(Number(fonte.specs.potencia) >= necessaria
            ? { nivel: "ok", titulo: "Fonte", texto: `${fonte.specs.potencia} W atende o consumo estimado (mínimo ${necessaria} W).` }
            : { nivel: "erro", titulo: "Fonte insuficiente", texto: `O conjunto pede pelo menos ${necessaria} W, e a fonte tem ${fonte.specs.potencia} W.`, sugestao: sugerirFonte(necessaria) });
    }

    return itens;
}

function sugerirMemoria() {
    const tipo = montagem.placa_mae?.specs.memoria;
    const kit = pecasDaCategoria("memoria")
        .filter((p) => (!tipo || p.specs.memoria === tipo) && p.specs.capacidade >= RAM_RECOMENDADA_GB)
        .sort((a, b) => a.specs.capacidade - b.specs.capacidade)[0];
    return kit ? `Opção recomendada: ${kit.nome}.` : null;
}

function sugerirFonte(minimo) {
    const fonte = opcoesCompativeis("fonte").filter((p) => Number(p.specs.potencia) >= minimo)[0];
    return fonte ? `Opção recomendada: ${fonte.nome}.` : null;
}

function escolherPeca(id, categoria) {
    const peca = PECAS.find((p) => p.id === id);
    if (!peca) return;
    if (montagem[categoria]?.id === id) {
        delete montagem[categoria];
    } else {
        if (!opcoesCompativeis(categoria).some((p) => p.id === id)) return;
        montagem[categoria] = peca;
        etapaAberta = proximaPendente(categoria);
    }
    limparIncompativeis();
    salvarMontagem();
    renderizarTudo();
}

// Remove peças que deixaram de combinar depois de uma troca
function limparIncompativeis() {
    let mudou = true;
    while (mudou) {
        mudou = false;
        for (const etapa of ETAPAS) {
            const peca = montagem[etapa.slug];
            if (!peca) continue;
            delete montagem[etapa.slug];
            if (!ehCompativel(peca, etapa.slug)) {
                mudou = true;
            } else {
                montagem[etapa.slug] = peca;
            }
        }
    }
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

const normalizar = (texto) =>
    String(texto ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const buscas = {};

function linhaPeca(peca, escolhida, termo = "") {
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

function corpoEtapa(etapa, escolhida, opcoes) {
    const busca = buscas[etapa.slug] || "";
    const termo = normalizar(busca.trim());
    const visiveis = opcoes.filter((p) => normalizar(`${p.nome} ${p.descricao}`).includes(termo)).length;
    return `
        <div class="montador-etapa-corpo">
            <input type="search" class="montador-busca" data-etapa="${etapa.slug}" placeholder="Buscar ${esc(etapa.nome.toLowerCase())}..." value="${esc(busca)}" aria-label="Buscar ${esc(etapa.nome)}">
            <ul class="montador-lista">${opcoes.map((p) => linhaPeca(p, escolhida, termo)).join("")}</ul>
            <p class="montador-sem-resultado"${visiveis ? " hidden" : ""}>Nenhuma peça encontrada com essa busca.</p>
        </div>`;
}

let etapaAberta = undefined;

function proximaPendente(categoria) {
    const indiceAtual = ETAPAS.findIndex((e) => e.slug === categoria);
    const depois = ETAPAS.slice(indiceAtual + 1);
    const antes = ETAPAS.slice(0, indiceAtual + 1);
    const pendente = [...depois, ...antes].find((e) => e.obrigatoria && !montagem[e.slug])
        || [...depois, ...antes].find((e) => !montagem[e.slug]);
    return pendente ? pendente.slug : null;
}

function renderizarEtapas() {
    if (PECAS.length === 0) {
        etapasEl.innerHTML = `
            <div class="catalogo-vazio">
                <i class="fa-solid fa-screwdriver-wrench"></i>
                <h3>Montador em preparação</h3>
                <p>Estamos cadastrando as peças disponíveis. Volte em breve para montar sua configuração.</p>
            </div>`;
        return;
    }

    if (etapaAberta === undefined) {
        etapaAberta = (ETAPAS.find((e) => !montagem[e.slug]) || {}).slug || null;
    }

    etapasEl.innerHTML = ETAPAS.map((etapa, indice) => {
        const escolhida = montagem[etapa.slug];
        const aberta = etapaAberta === etapa.slug;
        const opcoes = opcoesCompativeis(etapa.slug);
        const corpo = opcoes.length === 0
            ? '<div class="montador-etapa-corpo"><p class="montador-aviso">Nenhuma peça compatível com as escolhas atuais.</p></div>'
            : corpoEtapa(etapa, escolhida, opcoes);
        const situacao = escolhida
            ? `<span class="montador-escolhida"><i class="fa-solid fa-check"></i> ${esc(escolhida.nome)}</span>`
            : (etapa.obrigatoria ? "" : '<span class="montador-opcional">Opcional</span>');
        return `
            <section class="montador-etapa${escolhida ? " concluida" : ""}${aberta ? " aberta" : ""}">
                <button class="montador-etapa-cabecalho" data-etapa="${etapa.slug}" aria-expanded="${aberta}">
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

function renderizarResumo() {
    resumoListaEl.innerHTML = ETAPAS.map((etapa) => {
        const peca = montagem[etapa.slug];
        return `<li class="${peca ? "ok" : "pendente"}">
            <strong>${esc(etapa.nome)}:</strong>
            ${peca ? esc(peca.nome) : "<em>não escolhido</em>"}
        </li>`;
    }).join("");

    const itens = analisarMontagem();
    const erros = itens.filter((i) => i.nivel === "erro").length;
    const avisos = itens.filter((i) => i.nivel === "aviso").length;
    const nota = Math.max(0, 100 - erros * 30 - avisos * 10);
    const equilibrio = nota >= 85 ? "Excelente" : nota >= 65 ? "Bom" : nota >= 40 ? "Atenção" : "Incompleto";

    if (!itens.length) {
        analiseEl.innerHTML = "";
        return;
    }

    analiseEl.innerHTML = `
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

const ICONE_NIVEL = {
    ok: "fa-solid fa-circle-check",
    aviso: "fa-solid fa-triangle-exclamation",
    erro: "fa-solid fa-circle-xmark",
    info: "fa-solid fa-circle-info"
};

function renderizarTudo() {
    renderizarEtapas();
    renderizarResumo();
}

etapasEl.addEventListener("input", (e) => {
    const campo = e.target.closest(".montador-busca");
    if (!campo) return;
    const slug = campo.dataset.etapa;
    buscas[slug] = campo.value;
    const termo = normalizar(campo.value.trim());
    const bloco = campo.closest(".montador-etapa-corpo");
    let visiveis = 0;
    bloco.querySelectorAll(".montador-linha").forEach((linha) => {
        const ok = !termo || linha.dataset.texto.includes(termo);
        linha.hidden = !ok;
        if (ok) visiveis++;
    });
    bloco.querySelector(".montador-sem-resultado").hidden = visiveis > 0;
});

etapasEl.addEventListener("click", (e) => {
    const cabecalho = e.target.closest("button[data-etapa]");
    if (cabecalho) {
        const slug = cabecalho.dataset.etapa;
        etapaAberta = etapaAberta === slug ? null : slug;
        renderizarEtapas();
        return;
    }
    const botao = e.target.closest("button[data-id]");
    if (!botao) return;
    escolherPeca(botao.dataset.id, botao.dataset.categoria);
});

document.getElementById("btn-limpar").addEventListener("click", () => {
    montagem = {};
    etapaAberta = undefined;
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
