import { defineConfig, loadEnv, type Plugin, type PreviewServer, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import fs from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
// Shared handlers (JS) — one implementation for Vite + Vercel
// @ts-expect-error resolved at runtime by Node ESM
import { buildConfigJson, proxyBridge, proxyXaman } from './server/handlers.mjs'

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
    ...Object.fromEntries(
      [
        'PLATFORM_FEE_ADDRESS',
        'PLATFORM_FEE_ADDRESS_XRPL',
        'PLATFORM_FEE_ADDRESS_EVM',
        'PLATFORM_FEE_ADDRESS_ETH',
        'PLATFORM_FEE_ADDRESS_SOL',
        'PLATFORM_FEE_ADDRESS_SOLANA',
        'PLATFORM_FEE_ADDRESS_XLM',
        'PLATFORM_FEE_ADDRESS_STELLAR',
      ].map((k) => [k, process.env[k] || fromVite[k] || fromFile[k] || '']),
    ),
  }
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

function send(
  res: ServerResponse,
  out: { status: number; body: string; contentType: string; cacheControl?: string },
) {
  res.statusCode = out.status
  res.setHeader('Content-Type', out.contentType)
  if (out.cacheControl) res.setHeader('Cache-Control', out.cacheControl)
  res.end(out.body)
}

function attachBridgeMiddleware(
  server: ViteDevServer | PreviewServer,
  env: Record<string, string>,
) {
  const cfg = buildConfigJson(env)
  if (!cfg.bridgeKeyed) console.warn('[riddle-bridge] XRPL_TO_API_KEY empty — running unauthenticated at a low rate limit')
  else console.info('[riddle-bridge] Bridge API key present')
  if (!cfg.xamanReady) console.warn('[riddle-bridge] Xaman keys missing — Sign-In hidden')
  else console.info('[riddle-bridge] Xaman Sign-In ready')

  const getCache = new Map<string, { out: { status: number; body: string; contentType: string; cacheControl?: string }; expires: number }>()

  server.middlewares.use('/api/config', (_req, res) => {
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 'no-store')
    res.end(JSON.stringify(cfg))
  })

  server.middlewares.use('/api/xaman/payload', async (req, res) => {
    try {
      const url = new URL(req.url || '', 'http://local')
      const body = req.method === 'POST' || req.method === 'PUT' ? await readBody(req) : undefined
      const out = await proxyXaman(
        {
          method: req.method || 'GET',
          uuid: url.searchParams.get('uuid') || undefined,
          body,
        },
        env,
      )
      send(res, out)
    } catch (e) {
      res.statusCode = 502
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: e instanceof Error ? e.message : 'proxy error' }))
    }
  })

  server.middlewares.use(async (req, res, next) => {
    const rawUrl = req.url || ''
    if (!rawUrl.startsWith('/v1/bridge')) return next()

    try {
      const url = new URL(rawUrl, 'http://local')
      const cacheKey = rawUrl
      if (req.method === 'GET') {
        const hit = getCache.get(cacheKey)
        if (hit && hit.expires > Date.now()) {
          res.setHeader('X-Cache', 'HIT')
          send(res, hit.out)
          return
        }
      }

      const body =
        req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH'
          ? await readBody(req)
          : undefined

      const out = await proxyBridge(
        {
          method: req.method || 'GET',
          path: url.pathname.replace(/^\/v1/, ''),
          query: url.searchParams,
          body,
        },
        env,
      )

      if (req.method === 'GET' && out.status < 400 && url.pathname.includes('currencies')) {
        getCache.set(cacheKey, { out, expires: Date.now() + 10 * 60 * 1000 })
      }

      send(res, out)
    } catch (e) {
      res.statusCode = 502
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: e instanceof Error ? e.message : 'proxy error' }))
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
      alias: { '@': path.resolve(__dirname, 'src') },
    },
    server: { port: 5177, host: true },
    preview: { port: 5177 },
  }
})
