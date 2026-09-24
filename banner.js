/* Banner de serviços: navegação manual, rotação automática e pausa para leitura. */
(() => {
    const banner = document.querySelector(".banner-servicos");
    if (!banner) return;

    const telas = [...banner.querySelectorAll(".banner-tela")];
    const pontos = [...banner.querySelectorAll(".banner-pontos button")];
    const contador = document.getElementById("banner-contador");
    const movimentoReduzido = window.matchMedia("(prefers-reduced-motion: reduce)");
    let atual = 0;
    let timer;

    function mostrar(indice) {
        atual = (indice + telas.length) % telas.length;
        telas.forEach((tela, posicao) => {
            const ativa = posicao === atual;
            tela.hidden = !ativa;
            tela.classList.toggle("is-active", ativa);
        });
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
        if (document.hidden || movimentoReduzido.matches || banner.matches(":hover") || banner.contains(document.activeElement)) return;
        timer = window.setInterval(() => mostrar(atual + 1), 6500);
    }

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

    banner.addEventListener("mouseenter", parar);
    banner.addEventListener("mouseleave", iniciar);
    banner.addEventListener("focusin", parar);
    banner.addEventListener("focusout", () => window.setTimeout(iniciar, 0));
    document.addEventListener("visibilitychange", iniciar);
    movimentoReduzido.addEventListener("change", iniciar);

    mostrar(0);
    iniciar();
})();
