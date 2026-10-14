// Local relay for the Claude API. Needed because the Anthropic org's retention settings reject
// browser-originated (CORS) requests with 401; the same keys work server-side. Zero dependencies.
//
//   ANTHROPIC_API_KEY=… node scripts/claude-relay.mjs [port]      # key supplied here, browser holds none
//   node scripts/claude-relay.mjs [port]                           # browser sends its own x-api-key
//
// Listens on 127.0.0.1 only, answers CORS preflight (file:// pages have origin "null"), strips the
// browser-access headers, forwards /v1/* to api.anthropic.com and streams the response back. Never logs
// headers or bodies.
//
// Settings → "Through my Claude login (this Mac)" needs no API key: /login/* runs the turn with the Claude Agent
// SDK and the Claude Code login on this Mac (claude-login.mjs next to this file; it needs
// `npm install @anthropic-ai/claude-agent-sdk zod` next to the relay — the API-key modes stay dependency-free).
import http from 'node:http';
import https from 'node:https';
import { handleLoginRequest, loginAvailable } from './claude-login.mjs';

const port = Number(process.argv[2] ?? process.env.PORT ?? 8787);
const upstream = new URL(process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com');
const envKey = process.env.ANTHROPIC_API_KEY;

const STRIP = new Set([
  'host',
  'origin',
  'referer',
  'connection',
  'anthropic-dangerous-direct-browser-access',
  'content-length',
]);

const cors = (res, req) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || '*');
  res.setHeader('Access-Control-Expose-Headers', '*');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  res.setHeader('Access-Control-Max-Age', '600');
};

const server = http.createServer(async (req, res) => {
  cors(res, req);
  if (req.method === 'OPTIONS') {
    res.writeHead(204).end();
    return;
  }
  if (req.url === '/health') {
    res
      .writeHead(200, { 'content-type': 'application/json' })
      .end(JSON.stringify({ ok: true, keyFromEnv: Boolean(envKey), login: await loginAvailable() }));
    return;
  }
  // The CORS headers are already on res, so the login routes add none of their own.
  if (await handleLoginRequest(req, res, {})) return;
  if (!req.url?.startsWith('/v1/')) {
    res.writeHead(404).end('relay: only /v1/* is forwarded');
    return;
  }

  const headers = {};
  for (const [name, value] of Object.entries(req.headers)) {
    if (!STRIP.has(name.toLowerCase()) && value !== undefined) headers[name] = value;
  }
  if (envKey) headers['x-api-key'] = envKey;
  headers.host = upstream.host;

  const startedAt = Date.now();
  const proxied = https.request(
    {
      protocol: upstream.protocol,
      hostname: upstream.hostname,
      port: upstream.port || 443,
      path: req.url,
      method: req.method,
      headers,
    },
    (upstreamRes) => {
      const outHeaders = { ...upstreamRes.headers };
      // Our CORS headers win; the upstream's (if any) must not duplicate them.
      for (const name of Object.keys(outHeaders))
        if (name.toLowerCase().startsWith('access-control-')) delete outHeaders[name];
      res.writeHead(upstreamRes.statusCode ?? 502, outHeaders);
      upstreamRes.pipe(res);
      upstreamRes.on('end', () =>
        console.log(`${req.method} ${req.url} → ${upstreamRes.statusCode} in ${Date.now() - startedAt} ms`)
      );
    }
  );
  proxied.on('error', (error) => {
    console.error(`relay error for ${req.method} ${req.url}: ${error.message}`);
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ type: 'error', error: { type: 'relay_error', message: error.message } }));
  });
  req.pipe(proxied);
});

server.listen(port, '127.0.0.1', () => {
  console.log(
    `Claude relay listening on http://127.0.0.1:${port} → ${upstream.origin} (key from env: ${envKey ? 'yes' : 'no'})`
  );
});
