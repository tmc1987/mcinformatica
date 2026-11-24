/* ============================================================
   MC INFORMÁTICA — Motor do montador (compartilhado)
   ------------------------------------------------------------
   Funções puras: recebem a montagem (objeto etapa -> peça) e
   não tocam na página. Usado por montar.js e comparar.js.
   Os dados vêm de montador-pecas.json (chamar setPecas).
   ============================================================ */

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

function setPecas(lista) {
    PECAS = Array.isArray(lista) ? lista : [];
}

const pecasDaCategoria = (slug) => PECAS.filter((p) => p.categoria === slug);

const normalizar = (texto) =>
    String(texto ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// Potência recomendada: consumo estimado (CPU + GPU + 120 W de placa-mãe, memória e discos)
// com 50% de folga, arredondada para múltiplos de 50 W
function potenciaNecessaria(conjunto) {
    const cpu = conjunto.processador;
    if (!cpu) return null;
    const consumo = (cpu.specs.tdp || 0) + (conjunto.placa_video?.specs.tdp || 0) + 120;
    return Math.ceil((consumo * 1.5) / 50) * 50;
}

// Quantos cabos PCIe a placa exige: "nenhum" = 0, "8 pinos" = 1, "2x 8 pinos" = 2, "3x 8 pinos" = 3
function conectoresNecessarios(conector) {
    if (!conector || conector === "nenhum") return 0;
    const multiplo = String(conector).match(/^(\d)x/);
    return multiplo ? Number(multiplo[1]) : 1;
}

// Placa de vídeo que precisa de cabo exige fonte com a quantidade de conectores PCIe
function conectorOk(placa, fonte) {
    const necessarios = conectoresNecessarios(placa?.specs.conector);
    if (!necessarios) return true;
    return Number(fonte.specs.pcie_conectores || 0) >= necessarios;
}

// Uma peça é compatível se combina com as demais peças já escolhidas
function ehCompativel(candidata, categoria, conjunto) {
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
        if (necessaria !== null && Number(candidata.specs.potencia) < necessaria) return false;
        return conectorOk(conjunto.placa_video, candidata);
    }
    if (categoria === "placa_video" && fonte) {
        const necessaria = potenciaNecessaria({ ...conjunto, placa_video: candidata });
        if (necessaria !== null && Number(fonte.specs.potencia) < necessaria) return false;
        return conectorOk(candidata, fonte);
    }
    return true;
}

function opcoesCompativeis(categoria, conjunto) {
    const sem = { ...conjunto };
    delete sem[categoria];
    return pecasDaCategoria(categoria).filter((p) => ehCompativel(p, categoria, sem));
}

// Remove peças que deixaram de combinar depois de uma troca (altera o objeto recebido)
function limparIncompativeis(conjunto) {
    let mudou = true;
    while (mudou) {
        mudou = false;
        for (const etapa of ETAPAS) {
            const peca = conjunto[etapa.slug];
            if (!peca) continue;
            delete conjunto[etapa.slug];
            if (!ehCompativel(peca, etapa.slug, conjunto)) {
                mudou = true;
            } else {
                conjunto[etapa.slug] = peca;
            }
        }
    }
}

function sugerirMemoria(conjunto) {
    const tipo = conjunto.placa_mae?.specs.memoria;
    const kit = pecasDaCategoria("memoria")
        .filter((p) => (!tipo || p.specs.memoria === tipo) && p.specs.capacidade >= RAM_RECOMENDADA_GB)
        .sort((a, b) => a.specs.capacidade - b.specs.capacidade)[0];
    return kit ? `Opção recomendada: ${kit.nome}.` : null;
}

function sugerirFonte(conjunto, minimo) {
    const fonte = opcoesCompativeis("fonte", conjunto).filter((p) => Number(p.specs.potencia) >= minimo)[0];
    return fonte ? `Opção recomendada: ${fonte.nome}.` : null;
}

function sugerirPlacaMaePcie(conjunto, geracao) {
    const cpu = conjunto.processador;
    const mae = pecasDaCategoria("placa_mae").filter((p) =>
        Number(p.specs.pcie) >= geracao && (!cpu || p.specs.socket === cpu.specs.socket))
        .sort((a, b) => Number(a.specs.pcie) - Number(b.specs.pcie))[0];
    return mae ? `Opção com PCIe ${mae.specs.pcie}: ${mae.nome}.` : null;
}

// Diagnóstico completo da montagem: lista de itens com nível ok, aviso, erro ou info
function analisarMontagem(conjunto) {
    const itens = [];
    const cpu = conjunto.processador;
    const mae = conjunto.placa_mae;
    const memoria = conjunto.memoria;
    const video = conjunto.placa_video;
    const fonte = conjunto.fonte;
    const gabinete = conjunto.gabinete;

    const faltam = ETAPAS.filter((e) => e.obrigatoria && !conjunto[e.slug]).map((e) => e.nome);
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
            itens.push({ nivel: "erro", titulo: "Memória insuficiente", texto: `${memoria.specs.capacidade} GB é abaixo do mínimo recomendado.`, sugestao: sugerirMemoria(conjunto) });
        } else if (gargaloRam) {
            itens.push({ nivel: "aviso", titulo: "Memória pode limitar o sistema", texto: `${memoria.specs.capacidade} GB para este processador${video ? " e placa de vídeo" : ""}. Para jogos e trabalho pesado, o ideal é ${RAM_RECOMENDADA_GB} GB.`, sugestao: sugerirMemoria(conjunto) });
        }
    }

    if (cpu && video) {
        const cpuScore = cpu.specs.desempenho;
        const gpuScore = video.specs.desempenho;
        if (cpuScore < gpuScore * 0.75) {
            const melhor = opcoesCompativeis("processador", conjunto).filter((p) => p.specs.desempenho >= gpuScore * 0.9)
                .sort((a, b) => a.specs.desempenho - b.specs.desempenho)[0];
            itens.push({ nivel: "aviso", titulo: "Processador limita a placa de vídeo", texto: `${cpu.nome} vai segurar o desempenho de ${video.nome}.`, sugestao: melhor ? `Opção compatível mais equilibrada: ${melhor.nome}.` : null });
        } else if (gpuScore < cpuScore * 0.5) {
            const melhor = pecasDaCategoria("placa_video").filter((p) => p.specs.desempenho >= cpuScore * 0.8 && ehCompativel(p, "placa_video", conjunto))
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

    if (video && mae) {
        const geracaoMae = Number(mae.specs.pcie);
        const geracaoVideo = Number(video.specs.pcie);
        if (geracaoMae < geracaoVideo) {
            itens.push({ nivel: "aviso", titulo: "Versão PCIe", texto: `${video.nome} usa PCIe ${video.specs.pcie}, mas a placa-mãe tem PCIe ${mae.specs.pcie}. A placa de vídeo funciona, porém com perda de desempenho.`, sugestao: sugerirPlacaMaePcie(conjunto, geracaoVideo) });
        } else {
            itens.push({ nivel: "ok", titulo: "Versão PCIe", texto: `Placa-mãe PCIe ${mae.specs.pcie} compatível com a placa de vídeo PCIe ${video.specs.pcie}.` });
        }
    }

    if (video) {
        if (video.specs.conector === "nenhum") {
            itens.push({ nivel: "ok", titulo: "Energia da placa de vídeo", texto: "Esta placa é alimentada só pelo slot PCIe, sem cabo extra." });
        } else if (!fonte) {
            itens.push({ nivel: "info", titulo: "Energia da placa de vídeo", texto: `Esta placa precisa de conector de ${video.specs.conector}. Escolha a fonte para verificar.` });
        } else if (conectorOk(video, fonte)) {
            itens.push({ nivel: "ok", titulo: "Energia da placa de vídeo", texto: `A fonte tem conector PCIe para a placa (${video.specs.conector}).` });
        } else {
            itens.push({ nivel: "erro", titulo: "Fonte sem conector PCIe", texto: `A placa de vídeo precisa de conector de ${video.specs.conector}, e a fonte escolhida não tem.`, sugestao: sugerirFonte(conjunto, 0) });
        }
    }

    const necessaria = potenciaNecessaria(conjunto);
    if (fonte && necessaria) {
        itens.push(Number(fonte.specs.potencia) >= necessaria
            ? { nivel: "ok", titulo: "Fonte", texto: `${fonte.specs.potencia} W atende o consumo estimado com folga (recomendado: ${necessaria} W).` }
            : { nivel: "erro", titulo: "Fonte insuficiente", texto: `O conjunto recomenda pelo menos ${necessaria} W, e a fonte tem ${fonte.specs.potencia} W.`, sugestao: sugerirFonte(conjunto, necessaria) });
    }

    return itens;
}

// Nota de equilíbrio (0 a 100) derivada dos erros e avisos da análise
function pontuacaoMontagem(itens) {
    const erros = itens.filter((i) => i.nivel === "erro").length;
    const avisos = itens.filter((i) => i.nivel === "aviso").length;
    const nota = Math.max(0, 100 - erros * 30 - avisos * 10);
    const equilibrio = nota >= 85 ? "Excelente" : nota >= 65 ? "Bom" : nota >= 40 ? "Atenção" : "Incompleto";
    return { nota, equilibrio };
}

// Desempenho estimado por uso (escala relativa 0-100, não é benchmark)
// Processador e placa de vídeo usam a pontuação da base; memória entra como fator de capacidade.
function desempenhoConjunto(conjunto) {
    const cpu = conjunto.processador;
    if (!cpu) return null;
    const cpuScore = cpu.specs.desempenho || 0;
    const video = conjunto.placa_video;
    const gpuScore = video ? (video.specs.desempenho || 0) : 0;
    const ram = conjunto.memoria?.specs.capacidade || 0;

    const ajusteRam = ram >= 32 ? 5 : ram >= RAM_RECOMENDADA_GB ? 0 : ram >= MINIMO_RAM_GB ? -5 : -12;
    const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));

    const jogos = video
        ? 0.75 * gpuScore + 0.25 * cpuScore + ajusteRam
        : 0.35 * cpuScore + ajusteRam;
    const trabalho = 0.7 * cpuScore + (video ? 0.2 * gpuScore : 0) + ajusteRam * 1.5;
    const estudo = 0.8 * cpuScore + ajusteRam;

    return {
        jogos: clamp(jogos),
        trabalho: clamp(trabalho),
        estudo: clamp(estudo),
        semPlacaDeVideo: !video
    };
}

// Explicação de cada categoria para o visitante
const GLOSSARIO = {
    processador: "Executa os programas. Núcleos e threads definem quantas tarefas ele faz ao mesmo tempo.",
    placa_mae: "Conecta todas as peças. O chipset define recursos como overclock, versão PCIe e portas.",
    memoria: "Memória de trabalho. Mais capacidade permite mais programas abertos; a velocidade ajuda na fluidez.",
    armazenamento: "Guarda o sistema e os arquivos. SSDs são muito mais rápidos que HDs.",
    placa_video: "Processa imagens e gráficos. A memória de vídeo (VRAM) e a arquitetura definem o desempenho em jogos.",
    fonte: "Fornece energia para todas as peças. A certificação 80 Plus indica a eficiência da conversão de energia.",
    gabinete: "Abriga e ventila as peças. O formato precisa aceitar o tamanho da placa-mãe."
};

const GLOSSARIO_TERMOS = {
    "PCIe": "Barramento que liga a placa de vídeo e outras peças à placa-mãe. Versões mais novas (4.0, 5.0) transferem dados mais rápido.",
    "TDP": "Consumo máximo estimado da peça em watts. Usado para dimensionar a fonte.",
    "VRAM": "Memória dedicada da placa de vídeo, usada para texturas e imagens.",
    "Ray tracing": "Simula a luz de forma realista. Exige hardware específico para rodar bem.",
    "DLSS": "Tecnologia NVIDIA que aumenta a resolução com inteligência artificial, ganhando desempenho.",
    "FSR": "Tecnologia AMD que aumenta a resolução por software, ganhando desempenho.",
    "Overclock": "Permite acelerar a peça além da velocidade de fábrica."
};

// Arquitetura da placa de vídeo, deduzida do nome do modelo
function arquiteturaGPU(nome) {
    if (/GTX 1(050|060|070|080)/.test(nome)) return "Pascal";
    if (/GTX 16\d\d/.test(nome)) return "Turing (sem ray tracing)";
    if (/RTX 20\d\d/.test(nome)) return "Turing";
    if (/RTX 30\d\d/.test(nome)) return "Ampere";
    if (/RTX 40\d\d/.test(nome)) return "Ada Lovelace";
    if (/RTX 50\d\d/.test(nome)) return "Blackwell";
    if (/RX (550|570|580)/.test(nome)) return "Polaris (sem ray tracing)";
    if (/RX 5[5-7]\d\d/.test(nome)) return "RDNA 1 (sem ray tracing)";
    if (/RX 6[5-9]\d\d|RX 6[89]\d\d/.test(nome)) return "RDNA 2";
    if (/RX 7[5-9]\d\d/.test(nome)) return "RDNA 3";
    if (/RX 9\d\d\d/.test(nome)) return "RDNA 4";
    if (/Arc/.test(nome)) return "Intel Xe (Arc)";
    return "—";
}

// Recursos de tecnologia da placa de vídeo
function recursosGPU(nome) {
    if (/RTX/.test(nome)) return "Ray tracing e DLSS (upscaling por IA)";
    if (/RX (6[5-9]\d\d|7\d\d\d|9\d\d\d)/.test(nome) || /Arc/.test(nome)) return "Ray tracing e FSR (upscaling por software)";
    if (/RX 5[5-7]\d\d|RX (550|570|580)/.test(nome)) return "Sem ray tracing em hardware";
    if (/GTX/.test(nome)) return "Sem ray tracing em hardware";
    return "—";
}

// Lista de tecnologias da peça, em linguagem simples: [rótulo, valor]
function infoTecnologia(peca) {
    const s = peca.specs || {};
    const n = peca.nome || "";
    const d = peca.descricao || "";
    const itens = [];

    if (peca.categoria === "processador") {
        const nucleos = d.match(/(\d+) núcleos \/ (\d+) threads/);
        if (nucleos) itens.push(["Núcleos / threads", `${nucleos[1]} / ${nucleos[2]}`]);
        const geracao = d.match(/(\d+)ª geração/);
        if (geracao) itens.push(["Geração", `${geracao[1]}ª`]);
        if (/X3D/.test(n)) itens.push(["Cache 3D", "Memória de cache empilhada (V-Cache), acelera jogos"]);
        if (/desbloqueado/i.test(d)) itens.push(["Overclock", "Liberado (modelo sem trava)"]);
        if (/gráficos/i.test(d)) itens.push(["Vídeo integrado", "Gráficos Radeon no próprio processador"]);
        itens.push(["Socket", s.socket]);
        itens.push(["Consumo (TDP)", `${s.tdp} W`]);
    }

    if (peca.categoria === "placa_mae") {
        const chipset = n.match(/\b([ABHXZ]\d{2,3})\b/);
        if (chipset) itens.push(["Chipset", chipset[1]]);
        itens.push(["Socket", s.socket]);
        itens.push(["Memória", s.memoria]);
        itens.push(["Formato", s.formato]);
        itens.push(["PCIe", `${s.pcie} (slot da placa de vídeo)`]);
        const overclock = chipset && /^[XZ]/.test(chipset[1]) ? "Sim (chipset X ou Z)" : "Limitado (chipset A, B ou H)";
        itens.push(["Overclock", overclock]);
    }

    if (peca.categoria === "memoria") {
        itens.push(["Tipo", s.memoria]);
        itens.push(["Capacidade", `${s.capacidade} GB`]);
        const velocidade = n.match(/(\d{3,4}) MHz/);
        if (velocidade) itens.push(["Velocidade", `${velocidade[1]} MHz`]);
    }

    if (peca.categoria === "placa_video") {
        const vram = n.match(/(\d+) GB/);
        if (vram) itens.push(["Memória de vídeo (VRAM)", `${vram[1]} GB`]);
        itens.push(["Arquitetura", arquiteturaGPU(n)]);
        itens.push(["Recursos", recursosGPU(n)]);
        itens.push(["PCIe", s.pcie]);
        itens.push(["Energia", s.conector === "nenhum" ? "Só pelo slot PCIe" : `Cabo de ${s.conector}`]);
        itens.push(["Consumo (TDP)", `${s.tdp} W`]);
    }

    if (peca.categoria === "armazenamento") {
        let tipo = "SSD SATA";
        if (/NVMe/i.test(n)) tipo = "SSD NVMe (PCIe, muito rápido)";
        else if (/HD/.test(n)) tipo = "HD mecânico (disco giratório)";
        itens.push(["Tipo", tipo]);
    }

    if (peca.categoria === "fonte") {
        itens.push(["Potência", `${s.potencia} W`]);
        const certificacao = n.match(/80 Plus (\w+)/);
        if (certificacao) itens.push(["Certificação 80 Plus", certificacao[1]]);
        itens.push(["Conectores PCIe", `${s.pcie_conectores ?? 0}`]);
    }

    if (peca.categoria === "gabinete") {
        itens.push(["Formatos aceitos", (s.formatos || []).join(", ")]);
    }

    return itens;
}
