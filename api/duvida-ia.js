// Vercel Serverless Function - roda no servidor, nunca no navegador.
// A chave GROQ_API_KEY fica só em env var da Vercel (Project Settings > Environment Variables).
// Groq (API compatível com OpenAI): inferência muito rápida. A resposta sai em streaming (texto puro)
// para o chat começar a mostrar na hora. LGPD: só a pergunta é enviada, nunca dados do usuário.

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";

const SYSTEM_PROMPT = "Você é o assistente virtual do site 'Tô de Voluntário', que conecta voluntários e ONGs e recebe doações. " +
    "Responda em português do Brasil, em no máximo 3 frases, SOMENTE com base nos fatos abaixo. " +
    "Se a resposta não estiver nos fatos ou a pergunta fugir do assunto, diga que não sabe e indique o formulário da página Contato. " +
    "Texto simples, sem markdown nem asteriscos. Nunca invente recursos, prazos, documentos ou recibos. Nunca peça nem repita dados pessoais. " +
    "FATOS: " +
    "Doações: página Doações; pagamento por Pix (QR Code ou copia-e-cola) ou boleto. " +
    "Cadastro: menu 'Cadastre-se' > 'Sou voluntário(a)' ou 'Sou ONG/empresa'; o acesso é liberado logo após o cadastro, sem confirmar e-mail. CNPJ da ONG é opcional, mas se informado precisa ser válido. " +
    "Oportunidades: página Oportunidades, com filtro por cidade e área; o voluntário clica em Participar (precisa estar logado). " +
    "Voluntário: acompanha candidaturas em Configurações/Painel; status: Pendente, Aprovada, Recusada, Concluída. " +
    "ONG: publica oportunidades no painel, aprova ou recusa candidaturas, marca como concluída e pode exportar a lista de candidatos em PDF. " +
    "Certificado: quando a ONG conclui a participação, o voluntário baixa o certificado em PDF em Configurações; o código de 6 caracteres do rodapé é validado na página /documento/validar. " +
    "Contato: formulário e agendamento de reunião na página Contato; e-mail todevoluntario@gmail.com.";

// Dados públicos do site (oportunidades abertas e ONGs) injetados no prompt, para o assistente
// responder "quais vagas existem?". Só colunas públicas via chave anon + RLS: nunca voluntários,
// candidaturas, CNPJ, razão social ou contatos. ponytail: cabe no prompt até ~25 itens de cada;
// acima disso, trocar por tool use (a IA consulta o banco sob demanda) ou busca por palavra-chave.
let contextoCache = { ate: 0, texto: "" };

async function contextoDoSite() {
    if (Date.now() < contextoCache.ate) {
        return contextoCache.texto;
    }

    const base = process.env.SUPABASE_URL;
    const chave = process.env.SUPABASE_ANON_KEY;

    if (!base || !chave) {
        return "";
    }

    const consultar = function (caminho) {
        return fetch(base + "/rest/v1/" + caminho, { headers: { apikey: chave, Authorization: "Bearer " + chave } })
            .then(function (r) { return r.ok ? r.json() : []; })
            .catch(function () { return []; });
    };

    const [oportunidades, organizacoes] = await Promise.all([
        consultar("oportunidades?status=eq.aberta&order=criado_em.desc&limit=25" +
            "&select=titulo,cidade,estado,modalidade,periodo,dias_atuacao,vagas_disponiveis,causas(nome),organizacoes(nome_fantasia)"),
        consultar("organizacoes?order=criado_em.desc&limit=25&select=nome_fantasia,cidade,estado,descricao")
    ]);

    const curto = function (texto) { return texto ? String(texto).slice(0, 120) : undefined; };

    const dados = {
        oportunidades_abertas: oportunidades.map(function (o) {
            return {
                titulo: o.titulo,
                ong: o.organizacoes && o.organizacoes.nome_fantasia,
                causa: o.causas && o.causas.nome,
                local: [o.cidade, o.estado].filter(Boolean).join("/") || undefined,
                modalidade: o.modalidade,
                periodo: o.periodo,
                dias: o.dias_atuacao,
                vagas: o.vagas_disponiveis
            };
        }),
        ongs_cadastradas: organizacoes.map(function (g) {
            return {
                nome: g.nome_fantasia,
                local: [g.cidade, g.estado].filter(Boolean).join("/") || undefined,
                sobre: curto(g.descricao)
            };
        })
    };

    const texto = " DADOS ATUAIS DO SITE (JSON; use para perguntas sobre vagas e ONGs; se nada corresponder, diga que no momento não há): " +
        JSON.stringify(dados);

    contextoCache = { ate: Date.now() + 60000, texto };
    return texto;
}

// ponytail: cache em memória por instância da function (some em cold start), máx. 200 perguntas, 60 s
// (as respostas dependem de dados que mudam).
const cache = new Map();

function chave(pergunta) {
    return pergunta.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, "").replace(/\s+/g, " ").trim();
}

module.exports = async function handler(req, res) {
    if (req.method !== "POST") {
        res.status(405).json({ erro: "Método não permitido" });
        return;
    }

    const pergunta = String((req.body || {}).pergunta || "").trim().slice(0, 500);

    if (!pergunta) {
        res.status(400).json({ erro: "Informe a pergunta" });
        return;
    }

    if (!process.env.GROQ_API_KEY) {
        res.status(500).json({ erro: "GROQ_API_KEY não configurada nas env vars da Vercel" });
        return;
    }

    const emCache = cache.get(chave(pergunta));

    if (emCache) {
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.status(200);
        res.end(emCache);
        return;
    }

    try {
        const respostaGroq = await fetch(GROQ_URL, {
            method: "POST",
            headers: {
                "Authorization": "Bearer " + process.env.GROQ_API_KEY,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: GROQ_MODEL,
                messages: [
                    { role: "system", content: SYSTEM_PROMPT + await contextoDoSite() },
                    { role: "user", content: pergunta }
                ],
                // gpt-oss raciocina antes de responder: "low" corta o atraso; max_tokens cobre raciocínio + resposta.
                ...(GROQ_MODEL.includes("gpt-oss") ? { reasoning_effort: "low", max_tokens: 400 } : { max_tokens: 150 }),
                temperature: 0.3,
                stream: true
            })
        });

        if (!respostaGroq.ok) {
            const erro = await respostaGroq.json().catch(function () { return {}; });
            res.status(502).json({ erro: (erro.error && erro.error.message) || "Falha ao consultar a IA" });
            return;
        }

        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.status(200);

        const decodificador = new TextDecoder();
        let resto = "";
        let completo = "";

        for await (const pedaco of respostaGroq.body) {
            resto += decodificador.decode(pedaco, { stream: true });
            const linhas = resto.split("\n");
            resto = linhas.pop();

            for (const linha of linhas) {
                if (!linha.startsWith("data: ") || linha === "data: [DONE]") {
                    continue;
                }

                try {
                    const texto = JSON.parse(linha.slice(6)).choices[0].delta.content;

                    if (texto) {
                        completo += texto;
                        res.write(texto);
                    }
                } catch (e) { /* linha SSE incompleta/keep-alive */ }
            }
        }

        if (completo) {
            if (cache.size >= 200) {
                cache.delete(cache.keys().next().value);
            }

            cache.set(chave(pergunta), completo.trim());
            setTimeout(function () { cache.delete(chave(pergunta)); }, 60000).unref();
        }

        res.end();
    } catch (erro) {
        if (res.headersSent) {
            res.end();
        } else {
            res.status(502).json({ erro: "Não foi possível conectar com a IA: " + erro.message });
        }
    }
};
