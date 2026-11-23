/* ============================================================
   MC INFORMÁTICA — Avaliações das montagens
   ------------------------------------------------------------
   Usa o Supabase (plano gratuito). Configure em avaliacoes-config.js.
   Avaliações novas ficam ocultas até serem aprovadas no painel
   do Supabase (coluna "aprovado" = true).
   ============================================================ */

const avaliacoesEl = document.getElementById("avaliacoes-lista");
const formAvaliacao = document.getElementById("form-avaliacao");
const avisoAvaliacao = document.getElementById("aviso-avaliacao");

const configurado = () => SUPABASE_URL && SUPABASE_ANON_KEY;

function cabecalhos(extra = {}) {
    return {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        ...extra
    };
}

function estrelas(nota) {
    return "★".repeat(nota) + "☆".repeat(5 - nota);
}

function resumoMontagem(montagem) {
    if (!montagem) return "";
    const linhas = Object.entries(montagem).map(([etapa, id]) => {
        const nome = ETAPAS.find((e) => e.slug === etapa)?.nome || etapa;
        return `<li>${esc(nome)}: ${esc(id)}</li>`;
    });
    return linhas.length ? `<ul class="avaliacao-montagem">${linhas.join("")}</ul>` : "";
}

function cartaoAvaliacao(a) {
    const foto = a.foto_url
        ? `<img class="avaliacao-foto" src="${esc(a.foto_url)}" alt="Foto da montagem de ${esc(a.nome)}" loading="lazy">`
        : "";
    return `
        <article class="avaliacao">
            <header>
                <strong>${esc(a.nome)}</strong>
                <span class="avaliacao-nota" aria-label="${a.nota} de 5 estrelas">${estrelas(a.nota)}</span>
            </header>
            <p>${esc(a.comentario)}</p>
            ${foto}
            ${resumoMontagem(a.montagem)}
        </article>`;
}

async function carregarAvaliacoes() {
    if (!configurado()) {
        avaliacoesEl.innerHTML = '<p class="montador-aviso">As avaliações estão sendo preparadas.</p>';
        return;
    }
    try {
        const url = `${SUPABASE_URL}/rest/v1/avaliacoes?aprovado=eq.true&select=*&order=criado_em.desc&limit=30`;
        const resposta = await fetch(url, { headers: cabecalhos() });
        if (!resposta.ok) throw new Error("HTTP " + resposta.status);
        const dados = await resposta.json();
        avaliacoesEl.innerHTML = dados.length
            ? dados.map(cartaoAvaliacao).join("")
            : '<p class="montador-aviso">Ainda não há avaliações publicadas. Seja o primeiro!</p>';
    } catch {
        avaliacoesEl.innerHTML = '<p class="montador-aviso">Não foi possível carregar as avaliações agora.</p>';
    }
}

async function enviarFoto(arquivo) {
    const extensao = (arquivo.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const caminho = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extensao}`;
    const resposta = await fetch(`${SUPABASE_URL}/storage/v1/object/fotos/${caminho}`, {
        method: "POST",
        headers: cabecalhos({ "Content-Type": arquivo.type || "application/octet-stream" }),
        body: arquivo
    });
    if (!resposta.ok) throw new Error("upload");
    return `${SUPABASE_URL}/storage/v1/object/public/fotos/${caminho}`;
}

function montagemAtual() {
    try {
        return JSON.parse(localStorage.getItem(CHAVE_MONTAGEM) || "{}");
    } catch {
        return {};
    }
}

function mostrarAviso(texto, tipo = "ok") {
    avisoAvaliacao.textContent = texto;
    avisoAvaliacao.dataset.tipo = tipo;
}

formAvaliacao?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!configurado()) {
        mostrarAviso("O envio de avaliações ainda não está ativo.", "erro");
        return;
    }

    const dados = new FormData(formAvaliacao);
    const nome = String(dados.get("nome") || "").trim();
    const nota = Number(dados.get("nota"));
    const comentario = String(dados.get("comentario") || "").trim();
    const foto = dados.get("foto");

    if (nome.length < 2 || comentario.length < 10 || !(nota >= 1 && nota <= 5)) {
        mostrarAviso("Preencha nome, nota e um comentário com pelo menos 10 letras.", "erro");
        return;
    }
    if (foto && foto.size > 0 && foto.size > 3 * 1024 * 1024) {
        mostrarAviso("A foto precisa ter no máximo 3 MB.", "erro");
        return;
    }

    const botao = formAvaliacao.querySelector("button[type=submit]");
    botao.disabled = true;
    mostrarAviso("Enviando sua avaliação...");

    try {
        let fotoUrl = null;
        if (foto && foto.size > 0) fotoUrl = await enviarFoto(foto);

        const resposta = await fetch(`${SUPABASE_URL}/rest/v1/avaliacoes`, {
            method: "POST",
            headers: cabecalhos({ "Content-Type": "application/json", Prefer: "return=minimal" }),
            body: JSON.stringify({
                nome,
                nota,
                comentario,
                foto_url: fotoUrl,
                montagem: montagemAtual(),
                aprovado: false
            })
        });
        if (!resposta.ok) throw new Error("insert");

        formAvaliacao.reset();
        mostrarAviso("Obrigado! Sua avaliação será publicada depois de uma análise rápida.");
    } catch {
        mostrarAviso("Não foi possível enviar agora. Tente novamente em instantes.", "erro");
    } finally {
        botao.disabled = false;
    }
});

carregarAvaliacoes();
