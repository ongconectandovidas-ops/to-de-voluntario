// Vercel Serverless Function - gera o PDF do certificado de participação via Puppeteer.
// Anti-fraude: só gera para quem está autenticado (token Supabase) E é o próprio voluntário
// da candidatura, E a candidatura está com status "concluida" (a ONG marca isso no painel dela).
// Ninguém edita o conteúdo do certificado - vem todo do banco.
//
// ponytail: usa "puppeteer" (Chromium embutido) - funciona local e em qualquer host Node normal.
// Na Vercel (serverless, limite de tamanho de function) troque para "puppeteer-core" +
// "@sparticuz/chromium" quando for para produção lá.

const puppeteer = require("puppeteer");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function montarHtmlCertificado({ nomeVoluntario, tituloOportunidade, nomeOrganizacao, dataConclusao, codigo, urlValidacao }) {
    const dataFormatada = new Date(dataConclusao).toLocaleDateString("pt-BR", { year: "numeric", month: "long", day: "numeric" });

    return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <style>
            @page { size: A4 landscape; margin: 0; }
            body {
                margin: 0;
                font-family: Georgia, 'Times New Roman', serif;
                width: 297mm;
                height: 210mm;
                display: flex;
                align-items: center;
                justify-content: center;
                background: #fdfcf7;
            }
            .moldura {
                width: 267mm;
                height: 180mm;
                border: 3px solid #0d6efd;
                outline: 1px solid #0d6efd;
                outline-offset: -10px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                text-align: center;
                padding: 20mm;
                box-sizing: border-box;
            }
            .marca { font-size: 16px; letter-spacing: 2px; text-transform: uppercase; color: #0d6efd; font-weight: bold; }
            h1 { font-size: 34px; margin: 10mm 0 4mm; color: #222; }
            .nome { font-size: 30px; margin: 6mm 0; color: #0d6efd; font-weight: bold; border-bottom: 1px solid #ccc; padding-bottom: 4mm; }
            .texto { font-size: 16px; color: #333; max-width: 200mm; line-height: 1.6; }
            .rodape { margin-top: 12mm; font-size: 11px; color: #888; }
        </style>
    </head>
    <body>
        <div class="moldura">
            <div class="marca">Tô de Voluntário</div>
            <h1>Certificado de Participação</h1>
            <div class="nome">${nomeVoluntario}</div>
            <p class="texto">
                Certificamos que ${nomeVoluntario} atuou como voluntário(a) na ação
                <strong>"${tituloOportunidade}"</strong>, promovida por <strong>${nomeOrganizacao}</strong>,
                concluída em ${dataFormatada}.
            </p>
            <div class="rodape">Código de verificação: ${codigo}<br>Valide em: ${urlValidacao}</div>
        </div>
    </body>
    </html>
    `;
}

async function buscarUsuario(token) {
    const resposta = await fetch(SUPABASE_URL + "/auth/v1/user", {
        headers: { Authorization: "Bearer " + token, apikey: SUPABASE_ANON_KEY }
    });

    if (!resposta.ok) {
        return null;
    }

    return resposta.json();
}

async function buscarCandidatura(candidaturaId) {
    const resposta = await fetch(
        SUPABASE_URL + "/rest/v1/candidaturas?id=eq." + candidaturaId +
        "&select=id,status,codigo_certificado,voluntario_id,atualizado_em,oportunidades(titulo,organizacoes(nome_fantasia)),voluntarios(perfis(nome,sobrenome))",
        { headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: "Bearer " + SUPABASE_SERVICE_ROLE_KEY } }
    );

    if (!resposta.ok) {
        return null;
    }

    const linhas = await resposta.json();
    return linhas[0] || null;
}

module.exports = async function handler(req, res) {
    if (req.method !== "POST") {
        res.status(405).json({ erro: "Método não permitido" });
        return;
    }

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
        res.status(500).json({ erro: "Supabase não configurado nas env vars" });
        return;
    }

    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const { candidaturaId } = req.body || {};

    if (!token || !candidaturaId) {
        res.status(400).json({ erro: "Autenticação e candidaturaId são obrigatórios" });
        return;
    }

    const usuario = await buscarUsuario(token);

    if (!usuario) {
        res.status(401).json({ erro: "Sessão inválida" });
        return;
    }

    const candidatura = await buscarCandidatura(candidaturaId);

    if (!candidatura || candidatura.voluntario_id !== usuario.id) {
        res.status(403).json({ erro: "Você não tem acesso a este certificado" });
        return;
    }

    if (candidatura.status !== "concluida") {
        res.status(400).json({ erro: "Esta participação ainda não foi concluída" });
        return;
    }

    // Certificado concluído antes da migration: um update "vazio" faz o trigger do banco gerar o código.
    if (!candidatura.codigo_certificado) {
        await fetch(SUPABASE_URL + "/rest/v1/candidaturas?id=eq." + candidatura.id, {
            method: "PATCH",
            headers: {
                apikey: SUPABASE_SERVICE_ROLE_KEY,
                Authorization: "Bearer " + SUPABASE_SERVICE_ROLE_KEY,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ status: "concluida" })
        });

        candidatura.codigo_certificado = ((await buscarCandidatura(candidatura.id)) || {}).codigo_certificado;
    }

    if (!candidatura.codigo_certificado) {
        res.status(500).json({ erro: "Certificado sem código de verificação (rode a migration 20260930000000)" });
        return;
    }

    const perfil = (candidatura.voluntarios || {}).perfis || {};

    const html = montarHtmlCertificado({
        nomeVoluntario: (perfil.nome || "") + (perfil.sobrenome ? " " + perfil.sobrenome : ""),
        tituloOportunidade: (candidatura.oportunidades || {}).titulo || "",
        nomeOrganizacao: ((candidatura.oportunidades || {}).organizacoes || {}).nome_fantasia || "",
        dataConclusao: candidatura.atualizado_em,
        codigo: candidatura.codigo_certificado,
        urlValidacao: (req.headers["x-forwarded-proto"] || "http") + "://" + req.headers.host + "/documento/validar?codigo=" + candidatura.codigo_certificado
    });

    let navegador;

    try {
        navegador = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
        const pagina = await navegador.newPage();
        await pagina.setContent(html, { waitUntil: "networkidle0" });
        const pdf = await pagina.pdf({ format: "A4", landscape: true, printBackground: true });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", "attachment; filename=certificado.pdf");
        res.status(200);
        res.end(pdf);
    } catch (erro) {
        res.status(500).json({ erro: "Não foi possível gerar o certificado: " + erro.message });
    } finally {
        if (navegador) {
            await navegador.close();
        }
    }
};
