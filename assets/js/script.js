// ========================================
// BOTÕES DE CADASTRO (Home)
// ========================================

function irPara(id, destino) {
    const botao = document.getElementById(id);

    if (botao) {
        botao.addEventListener("click", function () {
            window.location.href = destino;
        });
    }
}

irPara("botaoHeroVoluntario", "paginas/cadastro-voluntario.html");
irPara("botaoHeroOng", "paginas/cadastro-ong.html");
irPara("botaoFinalVoluntario", "paginas/cadastro-voluntario.html");
irPara("botaoFinalOng", "paginas/cadastro-ong.html");


// ========================================
// LINK "ENTRAR" -> "PAINEL" QUANDO LOGADO
// ========================================

async function atualizarLinkEntrar() {
    if (!supabaseClient) {
        return;
    }

    const linkEntrar = document.querySelector('.menu a[href$="entrar.html"]');

    if (!linkEntrar) {
        return;
    }

    const { data: sessaoData } = await supabaseClient.auth.getSession();

    if (!sessaoData.session) {
        return;
    }

    const { data: perfil } = await supabaseClient
        .from("perfis")
        .select("tipo_conta")
        .eq("id", sessaoData.session.user.id)
        .single();

    const destinoPorTipo = {
        admin: "painel-admin.html",
        ong: "painel-ong.html"
    };

    const destino = destinoPorTipo[perfil ? perfil.tipo_conta : ""] || "configuracoes.html";

    linkEntrar.textContent = "Painel";
    linkEntrar.href = caminhoPagina(destino);
}


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


// ========================================
// OPORTUNIDADES (Supabase)
// ========================================

function caminhoPagina(nomeArquivo) {
    return window.location.pathname.includes("/paginas/") ? nomeArquivo : "paginas/" + nomeArquivo;
}

function textoLocalOportunidade(op) {
    if (op.modalidade === "virtual") {
        return "Online";
    }

    if (op.cidade && op.estado) {
        return op.cidade + " - " + op.estado;
    }

    return op.cidade || "A combinar";
}

function textoModalidade(modalidade) {
    if (modalidade === "virtual") {
        return "Online";
    }

    if (modalidade === "hibrido") {
        return "Híbrido";
    }

    return "Presencial";
}

function criarBotaoParticipar(oportunidadeId) {
    const botao = document.createElement("button");
    botao.textContent = "Participar";
    botao.classList.add("btn-participar");
    botao.dataset.oportunidadeId = oportunidadeId;
    return botao;
}

function criarCardVaga(op) {
    const vaga = document.createElement("div");
    vaga.className = "vaga";

    const texto = document.createElement("div");
    texto.className = "texto-vaga";

    const titulo = document.createElement("h3");
    titulo.textContent = op.titulo;

    const local = document.createElement("p");
    local.className = "local";
    local.innerHTML = '<i class="bi bi-geo-alt-fill" aria-hidden="true"></i> ';
    local.append(textoLocalOportunidade(op));

    const descricao = document.createElement("p");
    descricao.textContent = op.descricao;

    texto.append(titulo, local, descricao);
    vaga.append(texto, criarBotaoParticipar(op.id));

    return vaga;
}

function criarCardOportunidade(op) {
    const card = document.createElement("div");
    card.className = "card-oportunidade";

    const tipo = document.createElement("span");
    tipo.className = op.modalidade === "virtual" ? "tipo online" : "tipo";
    tipo.textContent = textoModalidade(op.modalidade);

    const titulo = document.createElement("h3");
    titulo.textContent = op.titulo;

    const ong = document.createElement("p");
    ong.className = "ong";
    ong.textContent = op.organizacoes ? op.organizacoes.nome_fantasia : "";

    const descricao = document.createElement("p");
    descricao.textContent = op.descricao;

    const cidade = document.createElement("p");
    cidade.className = "cidade";
    cidade.innerHTML = '<i class="bi bi-geo-alt-fill" aria-hidden="true"></i> ';
    cidade.append(textoLocalOportunidade(op));

    const botoes = document.createElement("div");
    botoes.className = "botoes-card";
    botoes.append(criarBotaoParticipar(op.id));

    card.append(tipo, titulo, ong, descricao, cidade, botoes);

    return card;
}

function mostrarMensagemLista(container, texto) {
    container.innerHTML = "";

    const mensagem = document.createElement("p");
    mensagem.className = "texto-ajuda";
    mensagem.textContent = texto;

    container.appendChild(mensagem);
}

async function carregarOportunidadesDestaque() {
    const lista = document.getElementById("listaOportunidadesDestaque");

    if (!lista || !supabaseClient) {
        return;
    }

    const { data, error } = await supabaseClient
        .from("oportunidades")
        .select("id, titulo, descricao, cidade, estado, modalidade")
        .eq("status", "aberta")
        .order("cliques", { ascending: false })
        .order("criado_em", { ascending: false })
        .limit(3);

    if (error || !data || data.length === 0) {
        mostrarMensagemLista(lista, "Nenhuma oportunidade em destaque no momento.");
        return;
    }

    lista.innerHTML = "";
    data.forEach(function (op) {
        lista.appendChild(criarCardVaga(op));
    });
}

async function carregarFiltroTabela(idSelect, tabela) {
    const select = document.getElementById(idSelect);

    if (!select || !supabaseClient) {
        return;
    }

    const { data, error } = await supabaseClient.from(tabela).select("id, nome").order("nome");

    if (error || !data) {
        return;
    }

    data.forEach(function (linha) {
        const opcao = document.createElement("option");
        opcao.value = linha.id;
        opcao.textContent = linha.nome;
        select.appendChild(opcao);
    });
}

async function buscarOportunidades() {
    const container = document.getElementById("cardsOportunidades");

    if (!container || !supabaseClient) {
        return;
    }

    const texto = document.getElementById("buscaTexto").value.trim();
    const estadoFiltro = document.getElementById("estado").value;
    const cidadeFiltro = document.getElementById("cidade").value;
    const causaFiltro = document.getElementById("causaFiltro").value;
    const habilidadeFiltro = document.getElementById("habilidadeFiltro").value;
    const disponibilidadeFiltro = document.getElementById("disponibilidadeFiltro").value;
    const diasFiltro = document.getElementById("diasFiltro").value;

    let campos = "id, titulo, descricao, cidade, estado, modalidade, periodo, dias_atuacao, causa_id, organizacoes(nome_fantasia)";

    if (habilidadeFiltro) {
        campos += ", oportunidade_habilidades!inner(habilidade_id)";
    }

    let consulta = supabaseClient.from("oportunidades").select(campos).eq("status", "aberta");

    if (texto) {
        consulta = consulta.ilike("titulo", "%" + texto + "%");
    }

    if (estadoFiltro) {
        consulta = consulta.eq("estado", estadoFiltro);
    }

    if (cidadeFiltro) {
        consulta = consulta.eq("cidade", cidadeFiltro);
    }

    if (causaFiltro) {
        consulta = consulta.eq("causa_id", causaFiltro);
    }

    if (disponibilidadeFiltro) {
        consulta = consulta.eq("periodo", disponibilidadeFiltro);
    }

    if (diasFiltro) {
        consulta = consulta.eq("dias_atuacao", diasFiltro);
    }

    if (habilidadeFiltro) {
        consulta = consulta.eq("oportunidade_habilidades.habilidade_id", habilidadeFiltro);
    }

    const { data, error } = await consulta.order("criado_em", { ascending: false });

    if (error) {
        mostrarMensagemLista(container, "Não foi possível carregar as oportunidades. Tente novamente.");
        return;
    }

    if (!data || data.length === 0) {
        mostrarMensagemLista(container, "Nenhuma oportunidade encontrada com esses filtros.");
        return;
    }

    container.innerHTML = "";
    data.forEach(function (op) {
        container.appendChild(criarCardOportunidade(op));
    });
}

const containerCardsOportunidades = document.getElementById("cardsOportunidades");
const botaoBuscarOportunidades = document.getElementById("botaoBuscarOportunidades");

if (botaoBuscarOportunidades) {
    botaoBuscarOportunidades.addEventListener("click", function (evento) {
        evento.preventDefault();
        buscarOportunidades();
    });
}

// supabase-client.js carrega depois deste arquivo, então "supabaseClient" só
// existe quando os scripts terminam de rodar - por isso essas chamadas
// esperam o DOMContentLoaded em vez de rodar direto aqui.
document.addEventListener("DOMContentLoaded", function () {
    if (containerCardsOportunidades) {
        carregarFiltroTabela("causaFiltro", "causas");
        carregarFiltroTabela("habilidadeFiltro", "habilidades");
        buscarOportunidades();
    }

    carregarOportunidadesDestaque();
    atualizarLinkEntrar();
});

async function participar(oportunidadeId, botao) {
    if (!supabaseClient) {
        alert("Participação indisponível no momento (Supabase não configurado).");
        return;
    }

    supabaseClient.rpc("incrementar_cliques_oportunidade", { id_oportunidade: oportunidadeId });

    const { data: sessaoData } = await supabaseClient.auth.getSession();

    if (!sessaoData.session) {
        window.location.href = caminhoPagina("entrar.html");
        return;
    }

    const textoOriginal = botao.textContent;
    botao.disabled = true;
    botao.textContent = "Enviando...";

    const { error } = await supabaseClient.from("candidaturas").insert({
        oportunidade_id: oportunidadeId,
        voluntario_id: sessaoData.session.user.id
    });

    if (error) {
        botao.disabled = false;

        if (error.code === "23505") {
            botao.textContent = "Inscrição já enviada";
            return;
        }

        botao.textContent = textoOriginal;

        if (error.code === "23503") {
            alert("Apenas contas de voluntário podem se candidatar a oportunidades.");
        } else {
            alert("Não foi possível enviar sua candidatura: " + error.message);
        }

        return;
    }

    botao.textContent = "Inscrição enviada";
}

document.addEventListener("click", function (evento) {
    const botao = evento.target.closest(".btn-participar");

    if (!botao) {
        return;
    }

    participar(botao.dataset.oportunidadeId, botao);
});
