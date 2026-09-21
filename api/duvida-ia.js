// Vercel Serverless Function - roda no servidor, nunca no navegador.
// A chave NVIDIA_API_KEY fica só em env var da Vercel (Project Settings > Environment Variables).
//
// ponytail: ainda mocado (sem chamada real pra NVIDIA). Quando for ligar de verdade, chamar o
// endpoint compatível com OpenAI da NVIDIA NIM (https://integrate.api.nvidia.com/v1/chat/completions)
// com "Authorization: Bearer " + process.env.NVIDIA_API_KEY e um modelo gratuito (ex.: da família
// Llama/Mistral disponível no catálogo NIM). LGPD: nunca enviar dados pessoais/identificáveis do
// usuário nessa chamada - só a pergunta em si.

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

    res.status(200).json({
        mocado: true,
        resposta: "Resposta de exemplo - a chamada real para a IA da NVIDIA ainda não foi implementada.",
        pergunta: pergunta
    });
};
