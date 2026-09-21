// Vercel Serverless Function - roda no servidor, nunca no navegador.
// A chave NVIDIA_API_KEY fica só em env var da Vercel (Project Settings > Environment Variables).
// Chama o endpoint compatível com OpenAI da NVIDIA NIM. LGPD: só a pergunta em si é enviada,
// nunca dados pessoais/identificáveis do usuário.

const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const NVIDIA_MODEL = "meta/llama-3.1-8b-instruct";

const SYSTEM_PROMPT = "Você é o assistente virtual do site 'Tô de Voluntário', uma plataforma que conecta " +
    "voluntários e ONGs e recebe doações via Pix/boleto. Responda em português do Brasil, de forma curta " +
    "(no máximo 3 frases) e objetiva, só sobre cadastro de voluntários/ONGs, oportunidades e doações. " +
    "Se a pergunta fugir desse assunto, diga que não pode ajudar com isso e sugira o formulário de contato.";

module.exports = async function handler(req, res) {
    if (req.method !== "POST") {
        res.status(405).json({ erro: "Método não permitido" });
        return;
    }

    const { pergunta } = req.body || {};

    if (!pergunta) {
        res.status(400).json({ erro: "Informe a pergunta" });
        return;
    }

    if (!process.env.NVIDIA_API_KEY) {
        res.status(500).json({ erro: "NVIDIA_API_KEY não configurada nas env vars da Vercel" });
        return;
    }

    try {
        const respostaNvidia = await fetch(NVIDIA_URL, {
            method: "POST",
            headers: {
                "Authorization": "Bearer " + process.env.NVIDIA_API_KEY,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: NVIDIA_MODEL,
                messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    { role: "user", content: pergunta }
                ],
                max_tokens: 200,
                temperature: 0.3
            })
        });

        const resultado = await respostaNvidia.json();

        if (!respostaNvidia.ok) {
            res.status(502).json({ erro: (resultado && resultado.error && resultado.error.message) || "Falha ao consultar a IA" });
            return;
        }

        res.status(200).json({ resposta: resultado.choices[0].message.content.trim() });
    } catch (erro) {
        res.status(502).json({ erro: "Não foi possível conectar com a IA: " + erro.message });
    }
};
