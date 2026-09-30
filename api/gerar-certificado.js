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

const fs = require("fs");
const path = require("path");

const LOGO = "data:image/png;base64," + fs.readFileSync(path.join(__dirname, "..", "assets", "img", "logo-certificado.png")).toString("base64");

function esc(t) {
    return String(t == null ? "" : t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function dataBr(d) {
    // "YYYY-MM-DD" (coluna date) é exibido como está; timestamps convertem para o fuso de SP
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
        return d.split("-").reverse().join("/");
    }

    return new Date(d).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

// Modelo oficial: moldura dourada dupla, título espaçado, logo no rodapé.
function montarHtmlCertificado(d) {
    return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <style>
            @page { size: A4 landscape; margin: 0; }
            * { box-sizing: border-box; }
            body { margin: 0; width: 297mm; height: 210mm; background: #fff; font-family: Georgia, 'Times New Roman', serif; color: #2b2b2b; position: relative; }
            .moldura { position: absolute; inset: 12mm; border: 1.2mm solid #c9a24b; }
            .moldura::after { content: ""; position: absolute; inset: 1.2mm; border: 0.3mm solid #c9a24b; }
            .conteudo { position: absolute; inset: 12mm; text-align: center; padding: 22mm 16mm 0; }
            h1 { font-size: 27px; font-weight: 400; letter-spacing: 6px; line-height: 1.8; margin: 0; text-transform: uppercase; }
            .certificamos { font-family: Arial, sans-serif; font-size: 13px; margin-top: 20mm; }
            .nome { font-size: 34px; text-transform: uppercase; margin-top: 12mm; font-weight: 400; }
            .linha { width: 140mm; height: 0.4mm; margin: 4mm auto 8mm; background: linear-gradient(90deg, transparent, #c9803a, transparent); }
            .texto { font-family: Arial, sans-serif; font-size: 14.5px; line-height: 1.55; }
            .org { font-family: Arial, sans-serif; font-size: 14.5px; margin-top: 2mm; }
            .rodape { position: absolute; left: 0; right: 0; bottom: 26mm; display: flex; justify-content: space-between; align-items: flex-start; padding: 0 22mm; }
            .rodape > div { width: 70mm; font-family: Arial, sans-serif; font-size: 8px; letter-spacing: 2px; line-height: 1.8; text-transform: uppercase; }
            .rodape img { width: 22mm; }
            .assinatura { border-top: 0.3mm solid #999; padding-top: 2mm; }
        </style>
    </head>
    <body>
        <div class="moldura"></div>
        <div class="conteudo">
            <h1>Certificado de Participação<br>em Trabalho Voluntário</h1>
            <div class="certificamos">Certificamos que</div>
            <div class="nome">${esc(d.nomeVoluntario)}</div>
            <div class="linha"></div>
            <div class="texto">
                participou de atividades de trabalho voluntário junto à ${esc(d.nomeOrganizacao)}<br>
                no período de ${dataBr(d.dataInicial)} a ${dataBr(d.dataFinal)},${d.horas ? " totalizando " + d.horas + " horas de trabalho voluntário," : ""}<br>realizando atividades relacionadas a ${esc(d.atividade)}.<br>
                Certificamos a participação do(a) voluntário(a) nas atividades descritas neste documento,<br>
                para fins de comprovação de sua atuação voluntária.
            </div>
            <div class="org">
                Organização responsável: ${esc(d.nomeOrganizacao)} &nbsp;|&nbsp; CNPJ: ${esc(d.cnpj || "não informado")} &nbsp;|&nbsp; Cidade/UF: ${esc(d.cidade)}${d.estado ? " – " + esc(d.estado) : ""}
            </div>
        </div>
        <div class="rodape">
            <div class="assinatura">Responsável pela organização<br><br>${esc(d.responsavel)}</div>
            <img src="${LOGO}">
            <div>Data de emissão: ${dataBr(new Date())}<br>Código de verificação:<br>${esc(d.codigo)}<br><span style="letter-spacing:0;text-transform:none;word-break:break-all;display:block">Valide em: ${esc(d.urlValidacao)}</span></div>
        </div>
    </body>
    </html>`;
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
        "&select=id,status,codigo_certificado,voluntario_id,criado_em,atualizado_em,data_inicio,data_fim,horas,oportunidades(titulo,organizacoes(nome_fantasia,cnpj,cidade,estado,perfis(nome,sobrenome))),voluntarios(perfis(nome,sobrenome))",
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

    const oportunidade = candidatura.oportunidades || {};
    const org = oportunidade.organizacoes || {};
    const resp = org.perfis || {};

    const html = montarHtmlCertificado({
        nomeVoluntario: (perfil.nome || "") + (perfil.sobrenome ? " " + perfil.sobrenome : ""),
        atividade: oportunidade.titulo || "",
        nomeOrganizacao: org.nome_fantasia || "",
        cnpj: org.cnpj,
        cidade: org.cidade || "",
        estado: org.estado,
        responsavel: (resp.nome || "") + (resp.sobrenome ? " " + resp.sobrenome : ""),
        dataInicial: candidatura.data_inicio || candidatura.criado_em,
        dataFinal: candidatura.data_fim || candidatura.atualizado_em,
        horas: candidatura.horas,
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
