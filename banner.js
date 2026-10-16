/* Banner de serviços: navegação manual, rotação automática e pausa para leitura. */
(() => {
    const banner = document.querySelector(".banner-servicos");
    if (!banner) return;

    const telas = [...banner.querySelectorAll(".banner-tela")];
    const pontos = [...banner.querySelectorAll(".banner-pontos button")];
    const contador = document.getElementById("banner-contador");
    const botaoPausa = document.getElementById("banner-pausa");
    const movimentoReduzido = window.matchMedia("(prefers-reduced-motion: reduce)");
    let atual = 0;
    let timer;
    let transicao;
    let pausadoPeloUsuario = false;

    function mostrar(indice) {
        const proximo = (indice + telas.length) % telas.length;
        window.clearTimeout(transicao);
        telas.forEach(tela => {
            if (tela.classList.contains("is-exiting")) {
                tela.classList.remove("is-exiting");
                tela.hidden = true;
            }
        });

        if (proximo !== atual) {
            const anterior = telas[atual];
            anterior.classList.remove("is-active");
            if (movimentoReduzido.matches) {
                anterior.hidden = true;
            } else {
                anterior.classList.add("is-exiting");
                transicao = window.setTimeout(() => {
                    anterior.classList.remove("is-exiting");
                    anterior.hidden = true;
                }, 700);
            }
        }

        atual = proximo;
        telas[atual].hidden = false;
        telas[atual].classList.add("is-active");
        pontos.forEach((ponto, posicao) => {
            const ativo = posicao === atual;
            ponto.classList.toggle("is-active", ativo);
            if (ativo) ponto.setAttribute("aria-current", "true");
            else ponto.removeAttribute("aria-current");
        });
        contador.textContent = `${String(atual + 1).padStart(2, "0")} / ${String(telas.length).padStart(2, "0")}`;
    }

    function parar() {
        window.clearInterval(timer);
        timer = undefined;
    }

    function iniciar() {
        parar();
        if (document.hidden || movimentoReduzido.matches || pausadoPeloUsuario ||
            (window.matchMedia("(hover: hover)").matches && banner.matches(":hover")) ||
            banner.contains(document.activeElement)) return;
        timer = window.setInterval(() => mostrar(atual + 1), 15000);
    }

    botaoPausa.addEventListener("click", () => {
        pausadoPeloUsuario = !pausadoPeloUsuario;
        botaoPausa.setAttribute("aria-pressed", String(pausadoPeloUsuario));
        botaoPausa.setAttribute("aria-label", pausadoPeloUsuario ? "Retomar rotação automática" : "Pausar rotação automática");
        botaoPausa.querySelector("i").className = pausadoPeloUsuario ? "fa-solid fa-play" : "fa-solid fa-pause";
        iniciar();
    });

    banner.querySelector("#banner-anterior").addEventListener("click", () => {
        mostrar(atual - 1);
        iniciar();
    });
    banner.querySelector("#banner-proximo").addEventListener("click", () => {
        mostrar(atual + 1);
        iniciar();
    });
    pontos.forEach((ponto, indice) => ponto.addEventListener("click", () => {
        mostrar(indice);
        iniciar();
    }));

    document.addEventListener("visibilitychange", iniciar);
    movimentoReduzido.addEventListener("change", iniciar);
    banner.addEventListener("mouseenter", iniciar);
    banner.addEventListener("mouseleave", iniciar);
    banner.addEventListener("focusin", iniciar);
    banner.addEventListener("focusout", () => window.setTimeout(iniciar, 0));

    mostrar(0);
    iniciar();
})();
