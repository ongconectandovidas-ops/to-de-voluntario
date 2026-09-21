// Vercel Serverless Function - envia o e-mail de instruções de pagamento via SMTP.
// SMTP_USER e SMTP_PASS ficam só em env var (nunca no front-end). Se for Gmail, SMTP_PASS
// precisa ser uma "senha de app" (myaccount.google.com/apppasswords, exige verificação em
// duas etapas ativada) - a senha normal da conta não funciona para SMTP.

const nodemailer = require("nodemailer");
const path = require("path");

const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const CONTATO_SUPORTE = "todevoluntario@gmail.com";

// Pix da organização é sempre o mesmo (chave estática, sem valor embutido no QR - o
// pagador digita o valor no app do banco). Mesma chave usada no modal de doacoes.html.
const PIX_COPIA_COLA = "00020126360014br.gov.bcb.pix0114+55179928212945204000053039865802BR5909Recebedor6006Brasil62070503***6304C683";
const PIX_QR_PATH = path.join(__dirname, "..", "assets", "img", "pix-qrcode.png");

function formatarValor(valor) {
    return Number(valor).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function montarHtml({ nome, metodo, valor, barCode, url, expiresAt, devMode }) {
    const corPrimaria = "#0d6efd";
    const valorFormatado = "R$ " + formatarValor(valor);
    const vencimento = expiresAt ? new Date(expiresAt).toLocaleString("pt-BR") : null;

    const blocoPagamento = metodo === "pix"
        ? `
            <p style="margin:0 0 12px;color:#333;font-size:15px;">Faça o Pix no valor de <strong>${valorFormatado}</strong> escaneando o QR Code abaixo ou usando o copia-e-cola no app do seu banco:</p>
            <div style="text-align:center;margin:16px 0;">
                <img src="cid:pixqrcode" alt="QR Code Pix" width="200" height="200" style="border:1px solid #eee;border-radius:8px;">
            </div>
            <p style="margin:0 0 6px;font-size:13px;color:#666;">Pix copia e cola:</p>
            <div style="background:#f5f6f8;border:1px solid #e2e4e8;border-radius:8px;padding:12px;word-break:break-all;font-family:monospace;font-size:12px;color:#333;">${PIX_COPIA_COLA}</div>
        `
        : `
            <p style="margin:0 0 12px;color:#333;font-size:15px;">Linha digitável do boleto:</p>
            <div style="background:#f5f6f8;border:1px solid #e2e4e8;border-radius:8px;padding:12px;word-break:break-all;font-family:monospace;font-size:13px;color:#333;">${barCode}</div>
            ${url ? `<div style="text-align:center;margin:20px 0;"><a href="${url}" style="background:${corPrimaria};color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:600;display:inline-block;font-size:14px;">Visualizar boleto</a></div>` : ""}
            ${vencimento ? `<p style="margin:0;font-size:13px;color:#666;">Vencimento: ${vencimento}</p>` : ""}
        `;

    return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;background:#ffffff;">
        <div style="background:${corPrimaria};padding:28px 24px;text-align:center;border-radius:8px 8px 0 0;">
            <h1 style="color:#fff;margin:0;font-size:20px;letter-spacing:0.3px;">Tô de Voluntário</h1>
        </div>
        <div style="padding:32px 24px;border:1px solid #eee;border-top:none;">
            ${devMode ? `<div style="background:#fff3cd;color:#664d03;padding:10px 14px;border-radius:6px;font-size:13px;margin-bottom:20px;">Modo de teste - nenhum valor real será cobrado.</div>` : ""}
            <p style="color:#333;font-size:15px;">Olá, ${nome}!</p>
            <p style="color:#333;font-size:15px;">Recebemos seu pedido de doação de <strong>${valorFormatado}</strong> via <strong>${metodo === "pix" ? "Pix" : "Boleto"}</strong>. Siga as instruções abaixo para concluir o pagamento:</p>
            ${blocoPagamento}
            <p style="color:#666;font-size:13px;margin-top:28px;">Qualquer dúvida, responda este e-mail ou fale com a gente em ${CONTATO_SUPORTE} / (17) 99223-8813.</p>
        </div>
        <div style="padding:16px;text-align:center;color:#999;font-size:12px;">
            Tô de Voluntário - Conectando pessoas e oportunidades para transformar vidas.
        </div>
    </div>
    `;
}

module.exports = async function handler(req, res) {
    if (req.method !== "POST") {
        res.status(405).json({ erro: "Método não permitido" });
        return;
    }

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        res.status(500).json({ erro: "SMTP_USER/SMTP_PASS não configuradas nas env vars da Vercel" });
        return;
    }

    const { nome, email, metodo, valor, barCode, url, expiresAt, devMode } = req.body || {};

    if (!email || !nome || !metodo || !valor) {
        res.status(400).json({ erro: "Informe nome, email, metodo e valor" });
        return;
    }

    const transportador = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_PORT === 465,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });

    try {
        const info = await transportador.sendMail({
            from: "Tô de Voluntário <" + process.env.SMTP_USER + ">",
            to: email,
            replyTo: CONTATO_SUPORTE,
            subject: "Instruções para sua doação - Tô de Voluntário",
            html: montarHtml({ nome, metodo, valor, barCode, url, expiresAt, devMode }),
            attachments: metodo === "pix" ? [{ filename: "qrcode-pix.png", path: PIX_QR_PATH, cid: "pixqrcode" }] : []
        });

        res.status(200).json({ id: info.messageId });
    } catch (erro) {
        res.status(502).json({ erro: "Não foi possível enviar o e-mail: " + erro.message });
    }
};
