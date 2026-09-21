
const CHAVE_STORAGE = {
    tema: "tema",
    fonte: "tamanhoFonte",
    espacamento: "espacamento",
    contraste: "contraste",
    animacoes: "animacoes",
    daltonismo: "daltonismo"
};

const preferenciasAcessibilidade = {
    tema: localStorage.getItem(CHAVE_STORAGE.tema) || "claro",
    fonte: localStorage.getItem(CHAVE_STORAGE.fonte) || "normal",
    espacamento: localStorage.getItem(CHAVE_STORAGE.espacamento) || "normal",
    contraste: localStorage.getItem(CHAVE_STORAGE.contraste) || "normal",
    animacoes: localStorage.getItem(CHAVE_STORAGE.animacoes) || "normal",
    daltonismo: localStorage.getItem(CHAVE_STORAGE.daltonismo) || "nenhum"
};

function aplicarTema() {
    document.body.classList.toggle("modo-escuro", preferenciasAcessibilidade.tema === "escuro");
}

function aplicarFonte() {
    document.body.classList.remove("fonte-pequena", "fonte-normal", "fonte-grande", "fonte-muito-grande");
    document.body.classList.add("fonte-" + preferenciasAcessibilidade.fonte);
}

function aplicarEspacamento() {
    document.body.classList.remove("espacamento-normal", "espacamento-medio", "espacamento-amplo");
    document.body.classList.add("espacamento-" + preferenciasAcessibilidade.espacamento);
}

function aplicarContraste() {
    document.body.classList.toggle("alto-contraste", preferenciasAcessibilidade.contraste === "alto");
}

function aplicarAnimacoes() {
    document.body.classList.toggle("reduzir-animacoes", preferenciasAcessibilidade.animacoes === "reduzidas");
}

function aplicarDaltonismo() {
    document.documentElement.classList.remove(
        "daltonismo-protanopia",
        "daltonismo-deuteranopia",
        "daltonismo-tritanopia",
        "daltonismo-acromatopsia"
    );

    if (preferenciasAcessibilidade.daltonismo !== "nenhum") {
        document.documentElement.classList.add("daltonismo-" + preferenciasAcessibilidade.daltonismo);
    }
}

function aplicarPreferenciasAcessibilidade() {
    aplicarTema();
    aplicarFonte();
    aplicarEspacamento();
    aplicarContraste();
    aplicarAnimacoes();
    aplicarDaltonismo();
}

function sincronizarControles() {
    document.querySelectorAll("[data-acess]").forEach(function (campo) {
        const chave = campo.dataset.acess;
        const valor = preferenciasAcessibilidade[chave];

        if (campo.type === "checkbox") {
            campo.checked =
                (chave === "tema" && valor === "escuro") ||
                (chave === "contraste" && valor === "alto") ||
                (chave === "animacoes" && valor === "reduzidas") ||
                (chave === "daltonismo" && valor === "acromatopsia");
        } else {
            campo.value = valor;
        }
    });
}

function definirPreferencia(chave, valor) {
    preferenciasAcessibilidade[chave] = valor;
    localStorage.setItem(CHAVE_STORAGE[chave], valor);
    aplicarPreferenciasAcessibilidade();
    sincronizarControles();
}

document.addEventListener("change", function (evento) {
    const campo = evento.target.closest("[data-acess]");

    if (!campo) {
        return;
    }

    const chave = campo.dataset.acess;

    if (campo.type === "checkbox") {
        if (chave === "tema") definirPreferencia("tema", campo.checked ? "escuro" : "claro");
        if (chave === "contraste") definirPreferencia("contraste", campo.checked ? "alto" : "normal");
        if (chave === "animacoes") definirPreferencia("animacoes", campo.checked ? "reduzidas" : "normal");
        if (chave === "daltonismo") definirPreferencia("daltonismo", campo.checked ? "acromatopsia" : "nenhum");
    } else {
        definirPreferencia(chave, campo.value);
    }
});


// ========================================
// FILTROS SVG PARA DALTONISMO
// Matrizes de Machado/Oliveira/Fialho (2009), padrão amplamente usado em
// ferramentas de acessibilidade para aproximar a percepção de cor.
// ========================================

function injetarFiltrosDaltonismo() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";

    svg.innerHTML = `
        <defs>
            <filter id="filtro-protanopia">
                <feColorMatrix type="matrix" values="0.567,0.433,0,0,0 0.558,0.442,0,0,0 0,0.242,0.758,0,0 0,0,0,1,0" />
            </filter>
            <filter id="filtro-deuteranopia">
                <feColorMatrix type="matrix" values="0.625,0.375,0,0,0 0.7,0.3,0,0,0 0,0.3,0.7,0,0 0,0,0,1,0" />
            </filter>
            <filter id="filtro-tritanopia">
                <feColorMatrix type="matrix" values="0.95,0.05,0,0,0 0,0.433,0.567,0,0 0,0.475,0.525,0,0 0,0,0,1,0" />
            </filter>
            <filter id="filtro-acromatopsia">
                <feColorMatrix type="matrix" values="0.299,0.587,0.114,0,0 0.299,0.587,0.114,0,0 0.299,0.587,0.114,0,0 0,0,0,1,0" />
            </filter>
        </defs>
    `;

    document.body.appendChild(svg);
}


// ========================================
// PAINEL FLUTUANTE DE ACESSIBILIDADE
// ========================================

function injetarPainelAcessibilidade() {
    const html = `
        <button type="button" class="botao-acessibilidade" data-bs-toggle="offcanvas"
                data-bs-target="#painelAcessibilidade" aria-controls="painelAcessibilidade"
                aria-label="Abrir opções de acessibilidade">
            <i class="bi bi-universal-access-circle" aria-hidden="true"></i>
        </button>

        <div class="offcanvas offcanvas-start" tabindex="-1" id="painelAcessibilidade"
             aria-labelledby="painelAcessibilidadeLabel">
            <div class="offcanvas-header">
                <h2 class="offcanvas-title h5" id="painelAcessibilidadeLabel">
                    <i class="bi bi-universal-access-circle" aria-hidden="true"></i>
                    Acessibilidade
                </h2>
                <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Fechar"></button>
            </div>
            <div class="offcanvas-body">

                <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" role="switch" id="fltTema" data-acess="tema">
                    <label class="form-check-label" for="fltTema">Modo escuro</label>
                </div>

                <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" role="switch" id="fltContraste" data-acess="contraste">
                    <label class="form-check-label" for="fltContraste">Alto contraste</label>
                </div>

                <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" role="switch" id="fltAnimacoes" data-acess="animacoes">
                    <label class="form-check-label" for="fltAnimacoes">Reduzir animações</label>
                </div>

                <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" role="switch" id="fltPretoBranco" data-acess="daltonismo">
                    <label class="form-check-label" for="fltPretoBranco">Tela em preto e branco</label>
                </div>

                <div class="mb-3 mt-3">
                    <label for="fltFonte" class="form-label">Tamanho do texto</label>
                    <select class="form-select" id="fltFonte" data-acess="fonte">
                        <option value="pequena">Pequeno</option>
                        <option value="normal">Normal</option>
                        <option value="grande">Grande</option>
                        <option value="muito-grande">Muito grande</option>
                    </select>
                </div>

                <div class="mb-3">
                    <label for="fltEspacamento" class="form-label">Espaçamento entre linhas</label>
                    <select class="form-select" id="fltEspacamento" data-acess="espacamento">
                        <option value="normal">Normal</option>
                        <option value="medio">Médio</option>
                        <option value="amplo">Amplo</option>
                    </select>
                </div>

                <div class="mb-3">
                    <label for="fltDaltonismo" class="form-label">Ajuste de cores (daltonismo)</label>
                    <select class="form-select" id="fltDaltonismo" data-acess="daltonismo">
                        <option value="nenhum">Nenhum</option>
                        <option value="protanopia">Protanopia</option>
                        <option value="deuteranopia">Deuteranopia</option>
                        <option value="tritanopia">Tritanopia</option>
                        <option value="acromatopsia">Acromatopsia (preto e branco)</option>
                    </select>
                </div>

                <button type="button" class="btn btn-outline-primary w-100" data-acao="abrir-libras">
                    <i class="bi bi-hand-index-thumb" aria-hidden="true"></i>
                    Tradutor de Libras (VLibras)
                </button>

            </div>
        </div>
    `;

    document.body.insertAdjacentHTML("beforeend", html);
}

document.addEventListener("click", function (evento) {
    if (evento.target.closest('[data-acao="abrir-libras"]')) {
        const botaoVLibras = document.querySelector("[vw-access-button]");

        if (botaoVLibras) {
            botaoVLibras.click();
        }
    }
});


// ========================================
// VLIBRAS - TRADUTOR DE LIBRAS DO GOVERNO FEDERAL
// ========================================

function iniciarVLibras() {
    const wrapper = document.createElement("div");
    wrapper.setAttribute("vw", "");
    wrapper.className = "enabled";
    wrapper.innerHTML = `
        <div vw-access-button class="active"></div>
        <div vw-plugin-wrapper>
            <div class="vw-plugin-top-wrapper"></div>
        </div>
    `;
    document.body.appendChild(wrapper);

    const script = document.createElement("script");
    script.src = "https://vlibras.gov.br/app/vlibras-plugin.js";
    script.onload = function () {
        if (window.VLibras) {
            new window.VLibras.Widget("https://vlibras.gov.br/app");
        }
    };
    document.body.appendChild(script);
}


// ========================================
// INICIALIZAÇÃO
// ========================================

injetarFiltrosDaltonismo();
injetarPainelAcessibilidade();
iniciarVLibras();
aplicarPreferenciasAcessibilidade();
sincronizarControles();
