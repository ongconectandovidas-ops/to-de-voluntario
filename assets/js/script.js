// ========================================
// ESTADO → CIDADE (API do IBGE, sem lista fixa de estados)
// ========================================

const estado = document.getElementById("estado");
const cidade = document.getElementById("cidade");

async function carregarEstados() {
    if (!estado) {
        return;
    }

    try {
        const resposta = await fetch(
            "https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome"
        );
        const estados = await resposta.json();

        estado.innerHTML = '<option value="">Estado</option>';

        estados.forEach(function (uf) {
            const option = document.createElement("option");
            option.value = uf.sigla;
            option.textContent = uf.nome;
            estado.appendChild(option);
        });
    } catch (erro) {
        estado.innerHTML = '<option value="">Não foi possível carregar os estados</option>';
    }
}

async function carregarCidades(uf) {
    if (!cidade) {
        return;
    }

    cidade.innerHTML = '<option value="">Cidade</option>';

    if (!uf) {
        return;
    }

    try {
        const resposta = await fetch(
            `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`
        );
        const cidades = await resposta.json();

        cidades.forEach(function (municipio) {
            const option = document.createElement("option");
            option.value = municipio.nome;
            option.textContent = municipio.nome;
            cidade.appendChild(option);
        });
    } catch (erro) {
        cidade.innerHTML = '<option value="">Não foi possível carregar as cidades</option>';
    }
}

if (estado && cidade) {
    carregarEstados();

    estado.addEventListener("change", function () {
        carregarCidades(estado.value);
    });
}


// ========================================
// CONFIGURAÇÕES - ABAS
// ========================================

const botoesAba = document.querySelectorAll(".aba-btn");
const conteudosAba = document.querySelectorAll(".aba-conteudo");

function abrirAba(nomeAba) {
    if (!nomeAba) {
        nomeAba = "perfil";
    }

    botoesAba.forEach(function (botao) {
        botao.classList.remove("ativo");
    });

    conteudosAba.forEach(function (conteudo) {
        conteudo.classList.remove("ativo");
    });

    const botaoSelecionado = document.querySelector(`.aba-btn[data-aba="${nomeAba}"]`);
    const conteudoSelecionado = document.getElementById(nomeAba);

    if (botaoSelecionado && conteudoSelecionado) {
        botaoSelecionado.classList.add("ativo");
        conteudoSelecionado.classList.add("ativo");
    }
}

botoesAba.forEach(function (botao) {
    botao.addEventListener("click", function () {
        abrirAba(botao.dataset.aba);
    });
});

// Permite abrir uma aba específica vindo de um link 
const parametros = new URLSearchParams(window.location.search);
abrirAba(parametros.get("aba"));


// ========================================
// MENU LATERAL (SIDEBAR DE CONFIGURAÇÕES)
// ========================================

const menuToggle = document.querySelector(".menu-toggle");
const sidebarLateral = document.querySelector(".sidebar-lateral");
const fecharSidebar = document.querySelector(".fechar-sidebar");

if (menuToggle && sidebarLateral) {
    menuToggle.addEventListener("click", function () {
        sidebarLateral.classList.add("ativo");
    });
}

if (fecharSidebar && sidebarLateral) {
    fecharSidebar.addEventListener("click", function () {
        sidebarLateral.classList.remove("ativo");
    });
}

document.querySelectorAll('[role="button"]').forEach(function (elemento) {
    elemento.addEventListener("keydown", function (evento) {
        if (evento.key === "Enter" || evento.key === " ") {
            evento.preventDefault();
            elemento.click();
        }
    });
});
