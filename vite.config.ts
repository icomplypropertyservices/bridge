import { defineConfig, loadEnv, type Plugin, type PreviewServer, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import fs from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'

const UPSTREAM = 'https://api.xrpl.to/v1'
const XUMM_API = 'https://xumm.app/api/v1/platform/payload'

/** Hide partner brand in error text only — never rewrite image CDN hosts. */
function sanitizeError(msg: string): string {
  return msg
    .replace(/https?:\/\/api\.xrpl\.to/gi, 'bridge-api')
    .replace(/\bxrpl\.to\b/gi, 'bridge')
    // do NOT replace "changenow" — logo CDN is content-api.changenow.io
}

function readDotEnvFile(filePath: string): Record<string, string> {
  const out: Record<string, string> = {}
  try {
    if (!fs.existsSync(filePath)) return out
    const text = fs.readFileSync(filePath, 'utf8')
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq).trim()
      let val = trimmed.slice(eq + 1).trim()
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1)
      }
      out[key] = val
    }
  } catch {
    /* ignore */
  }
  return out
}

function resolveServerEnv(mode: string, cwd: string): Record<string, string> {
  const fromVite = loadEnv(mode, cwd, '')
  const fromFile = {
    ...readDotEnvFile(path.join(cwd, '.env')),
    ...readDotEnvFile(path.join(cwd, `.env.${mode}`)),
    ...readDotEnvFile(path.join(cwd, '.env.local')),
  }
  return {
    XRPL_TO_API_KEY:
      process.env.XRPL_TO_API_KEY || fromVite.XRPL_TO_API_KEY || fromFile.XRPL_TO_API_KEY || '',
    PLATFORM_FEE_BPS:
      process.env.PLATFORM_FEE_BPS || fromVite.PLATFORM_FEE_BPS || fromFile.PLATFORM_FEE_BPS || '85',
    XUMM_API_KEY: process.env.XUMM_API_KEY || fromVite.XUMM_API_KEY || fromFile.XUMM_API_KEY || '',
    XUMM_API_SECRET:
      process.env.XUMM_API_SECRET || fromVite.XUMM_API_SECRET || fromFile.XUMM_API_SECRET || '',
  }
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}

function attachBridgeMiddleware(
  server: ViteDevServer | PreviewServer,
  env: Record<string, string>,
) {
  const apiKey = (env.XRPL_TO_API_KEY || '').trim()
  const feeBps = Number(env.PLATFORM_FEE_BPS || '85')
  const xummKey = (env.XUMM_API_KEY || '').trim()
  const xummSecret = (env.XUMM_API_SECRET || '').trim()
  const xamanReady = Boolean(xummKey && xummSecret)

  const getCache = new Map<string, { body: string; status: number; expires: number }>()
  const CACHE_MS: Record<string, number> = {
    '/bridge/currencies': 10 * 60 * 1000,
    '/bridge/min-amount': 60 * 1000,
  }

  if (!apiKey) {
    console.warn('[riddle-bridge] XRPL_TO_API_KEY is empty — bridge routes will fail auth')
  } else {
    console.info(`[riddle-bridge] Bridge API key loaded (…${apiKey.slice(-4)})`)
  }
  if (xamanReady) {
    console.info(`[riddle-bridge] Xaman credentials loaded (…${xummKey.slice(-4)})`)
  } else {
    console.warn('[riddle-bridge] XUMM_API_KEY/SECRET missing — Connect Wallet will fail')
  }

  server.middlewares.use('/api/config', (_req: IncomingMessage, res: ServerResponse) => {
    res.setHeader('Content-Type', 'application/json')
    res.end(
      JSON.stringify({
        platformFeeBps: Number.isFinite(feeBps) ? feeBps : 85,
        platformFeePercent: ((Number.isFinite(feeBps) ? feeBps : 85) / 100).toFixed(2),
        brand: 'Riddle Bridge',
        bridgeReady: Boolean(apiKey),
        xamanReady,
      }),
    )
  })

  // Server-only Xaman Platform API (Sign-In + poll). Keys never sent to the browser.
  server.middlewares.use('/api/xaman/payload', async (req: IncomingMessage, res: ServerResponse) => {
    try {
      if (!xamanReady) {
        res.statusCode = 503
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'Xaman not configured on server' }))
        return
      }

      const headers: Record<string, string> = {
        Accept: 'application/json',
        'X-API-Key': xummKey,
        'X-API-Secret': xummSecret,
      }

      if (req.method === 'POST') {
        const raw = await readBody(req)
        headers['Content-Type'] = 'application/json'
        const upstream = await fetch(XUMM_API, {
          method: 'POST',
          headers,
          body: raw.toString('utf8'),
        })
        const text = await upstream.text()
        res.statusCode = upstream.status
        res.setHeader('Content-Type', 'application/json')
        res.end(text)
        return
      }

      if (req.method === 'GET') {
        const url = new URL(req.url || '', 'http://local')
        const uuid = url.searchParams.get('uuid')
        if (!uuid) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'uuid required' }))
          return
        }
        const upstream = await fetch(`${XUMM_API}/${encodeURIComponent(uuid)}`, { headers })
        const text = await upstream.text()
        res.statusCode = upstream.status
        res.setHeader('Content-Type', 'application/json')
        res.end(text)
        return
      }

      res.statusCode = 405
      res.end('Method not allowed')
    } catch (e) {
      res.statusCode = 502
      res.setHeader('Content-Type', 'application/json')
      res.end(
        JSON.stringify({
          error: sanitizeError(e instanceof Error ? e.message : 'Xaman proxy error'),
        }),
      )
    }
  })

  // Bridge proxy + deposit deep links stay client-side payment-request.
  server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const rawUrl = req.url || ''
    if (!rawUrl.startsWith('/v1/bridge')) return next()

    try {
      if (!apiKey) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'Bridge API key not configured on server' }))
        return
      }

      const pathOnly = rawUrl.split('?')[0].replace(/^\/v1/, '')
      const cacheTtl = req.method === 'GET' ? CACHE_MS[pathOnly] : 0
      if (cacheTtl) {
        const hit = getCache.get(rawUrl)
        if (hit && hit.expires > Date.now()) {
          res.statusCode = hit.status
          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Cache-Control', 'public, max-age=60')
          res.setHeader('X-Cache', 'HIT')
          res.end(hit.body)
          return
        }
      }

      const target = `${UPSTREAM}${rawUrl.replace(/^\/v1/, '')}`
      const headers: Record<string, string> = {
        Accept: 'application/json',
        'User-Agent': 'RiddleBridge/1.0',
        'X-Api-Key': apiKey,
      }

      let body: Buffer | undefined
      if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
        body = await readBody(req)
        headers['Content-Type'] = String(req.headers['content-type'] || 'application/json')
      }

      const upstream = await fetch(target, {
        method: req.method || 'GET',
        headers,
        body: body && body.length ? body : undefined,
      })

      let text = await upstream.text()
      // Logo hosts: upstream sometimes returns dead content-api.bridge.io — fix to real CDN
      if (upstream.ok) {
        text = text.replace(/content-api\.bridge\.io/g, 'content-api.changenow.io')
      } else {
        text = sanitizeError(text)
      }

      if (cacheTtl && upstream.ok) {
        getCache.set(rawUrl, {
          body: text,
          status: upstream.status,
          expires: Date.now() + cacheTtl,
        })
      }

      res.statusCode = upstream.status
      res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json')
      res.setHeader('Cache-Control', cacheTtl ? 'public, max-age=60' : 'no-store')
      res.end(text)
    } catch (e) {
      res.statusCode = 502
      res.setHeader('Content-Type', 'application/json')
      res.end(
        JSON.stringify({
          error: sanitizeError(e instanceof Error ? e.message : 'Bridge proxy error'),
        }),
      )
    }
  })
}

function bridgeApiPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'riddle-bridge-api',
    configureServer(server) {
      attachBridgeMiddleware(server, env)
    },
    configurePreviewServer(server) {
      attachBridgeMiddleware(server, env)
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = resolveServerEnv(mode, process.cwd())
  return {
    plugins: [react(), bridgeApiPlugin(env)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    server: {
      port: 5177,
      host: true,
    },
    preview: {
      port: 5177,
    },
  }
})
