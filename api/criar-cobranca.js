// Vercel Serverless Function - roda no servidor, nunca no navegador.
// A chave ABACATEPAY_API_KEY fica só em env var da Vercel (Project Settings > Environment Variables).
// Se a chave usada for "abc_dev_...", a AbacatePay simula a cobrança (devMode: true) - sem risco de
// cobrança real. Docs: https://docs.abacatepay.com/pages/transparents/create
//
// Só gera BOLETO - o Pix da organização é uma chave estática fixa (ver assets/img/pix-qrcode.png
// e PIX_COPIA_COLA em api/enviar-email.js / doacoes.html), não passa mais por essa function.

const ABACATEPAY_URL = "https://api.abacatepay.com/v2/transparents/create";

module.exports = async function handler(req, res) {
    if (req.method !== "POST") {
        res.status(405).json({ erro: "Método não permitido" });
        return;
    }

    const apiKey = process.env.ABACATEPAY_API_KEY;

    if (!apiKey) {
        res.status(500).json({ erro: "ABACATEPAY_API_KEY não configurada nas env vars da Vercel" });
        return;
    }

    const { metodo, valor, nome, email, cpfCnpj } = req.body || {};

    if (metodo !== "boleto") {
        res.status(400).json({ erro: "metodo precisa ser 'boleto'" });
        return;
    }

    const valorNumero = Number(valor);

    if (!valorNumero || valorNumero <= 0) {
        res.status(400).json({ erro: "Valor inválido" });
        return;
    }

    if (!nome || !cpfCnpj) {
        res.status(400).json({ erro: "Boleto exige nome e CPF/CNPJ do pagador" });
        return;
    }

    const corpo = {
        method: "BOLETO",
        data: {
            amount: Math.round(valorNumero * 100),
            description: "Doação - Tô de Voluntário",
            dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
            customer: { name: nome, taxId: cpfCnpj, email: email || undefined }
        }
    };

    let respostaAbacate;
    let resultado;

    try {
        respostaAbacate = await fetch(ABACATEPAY_URL, {
            method: "POST",
            headers: {
                "Authorization": "Bearer " + apiKey,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(corpo)
        });
        resultado = await respostaAbacate.json();
    } catch (erro) {
        res.status(502).json({ erro: "Falha ao conectar com a AbacatePay" });
        return;
    }

    if (!respostaAbacate.ok || !resultado.success) {
        res.status(respostaAbacate.status >= 400 ? respostaAbacate.status : 502).json({
            erro: (resultado && resultado.error) || "Não foi possível gerar a cobrança"
        });
        return;
    }

    const dados = resultado.data;

    res.status(200).json({
        id: dados.id,
        status: dados.status,
        devMode: dados.devMode,
        barCode: dados.barCode || null,
        url: dados.url || null,
        expiresAt: dados.expiresAt || null
    });
};
