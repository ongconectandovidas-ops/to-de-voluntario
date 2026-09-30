// Servidor SÓ para desenvolvimento local: serve os arquivos estáticos do site
// E as Vercel Functions em api/*.js (simulando POST + req.body já parseado),
// sem precisar instalar/logar na Vercel CLI. Na Vercel de verdade (produção),
// isso não é usado - lá cada arquivo em api/ já roda como function nativa.
//
// Uso: node dev-server.js   (depois abra http://localhost:8935)

const http = require("http");
const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, "utf8").split("\n").forEach(function (linha) {
        const match = linha.match(/^([\w.-]+)\s*=\s*(.*)$/);
        if (match && !process.env[match[1]]) {
            process.env[match[1]] = match[2].trim();
        }
    });
}

const PORTA = process.env.PORTA || 9018;

const TIPOS_MIME = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css",
    ".js": "text/javascript",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon"
};

function lerCorpoJson(req) {
    return new Promise(function (resolve) {
        let corpo = "";
        req.on("data", function (pedaco) { corpo += pedaco; });
        req.on("end", function () {
            try {
                resolve(corpo ? JSON.parse(corpo) : {});
            } catch (erro) {
                resolve({});
            }
        });
    });
}

const servidor = http.createServer(async function (req, res) {
    let urlPath = req.url.split("?")[0];

    // Mesmos rewrites do vercel.json: /entrar (ou /entrar.html) -> paginas/entrar.html
    if (urlPath === "/documento/validar") {
        urlPath = "/paginas/validar-certificado.html";
    }

    const limpa = urlPath.match(/^\/([\w-]+)(\.html)?$/);

    if (limpa && fs.existsSync(path.join(__dirname, "paginas", limpa[1] + ".html"))) {
        urlPath = "/paginas/" + limpa[1] + ".html";
    }

    if (urlPath.startsWith("/api/")) {
        const nomeFuncao = urlPath.replace("/api/", "").replace(/\.js$/, "");
        const caminhoFuncao = path.join(__dirname, "api", nomeFuncao + ".js");

        if (!fs.existsSync(caminhoFuncao)) {
            res.writeHead(404).end("Function não encontrada");
            return;
        }

        req.body = await lerCorpoJson(req);
        res.status = function (codigo) { res.statusCode = codigo; return res; };
        res.json = function (objeto) {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(objeto));
        };

        try {
            delete require.cache[require.resolve(caminhoFuncao)];
            const handler = require(caminhoFuncao);
            await handler(req, res);
        } catch (erro) {
            res.statusCode = 500;
            res.end(JSON.stringify({ erro: "Erro interno na function: " + erro.message }));
        }
        return;
    }

    const caminhoArquivo = path.join(__dirname, urlPath === "/" ? "/index.html" : urlPath);

    fs.readFile(caminhoArquivo, function (erro, conteudo) {
        if (erro) {
            res.writeHead(404).end("Não encontrado");
            return;
        }
        const ext = path.extname(caminhoArquivo);
        res.writeHead(200, { "Content-Type": TIPOS_MIME[ext] || "application/octet-stream" });
        res.end(conteudo);
    });
});

servidor.listen(PORTA, function () {
    console.log("Servidor local (site + api/) rodando em http://localhost:" + PORTA);
});
