/**
 * Token logo collector (bounded):
 * 1) Featured + known LOCAL list
 * 2) cryptocurrency-icons SDK @0.18.1 then @master
 * 3) Inventory public/logos A–Z and emit LOCAL_TICKERS for logos.ts
 */
import { writeFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const OUT = join(ROOT, 'public', 'logos')
const SDK = '0.18.1'
const GH = 'master'

mkdirSync(OUT, { recursive: true })

const FEATURED = [
  'ada', 'arb', 'atom', 'avax', 'bnb', 'btc', 'doge', 'dot', 'eth', 'link',
  'ltc', 'matic', 'near', 'rdl', 'shib', 'sol', 'ton', 'trx', 'usdc', 'usdt',
  'xlm', 'xrp', 'op', 'base', 'sui', 'apt', 'fil', 'etc', 'bch', 'xmr',
  'algo', 'vet', 'icp', 'hbar', 'inj', 'sei', 'tia', 'pepe', 'floki', 'uni',
  'aave', 'mkr', 'crv', 'snx', 'comp', 'grt', 'sand', 'mana', 'enj', 'axs',
]

async function tryDownload(url, dest) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(12000) })
    if (!r.ok) return false
    const buf = Buffer.from(await r.arrayBuffer())
    if (buf.length < 80) return false
    writeFileSync(dest, buf)
    return true
  } catch {
    return false
  }
}

const existing = new Set(
  readdirSync(OUT).map((f) => f.replace(/\.(svg|png|jpg|jpeg|webp)$/i, '').toLowerCase()),
)

const want = [...new Set(FEATURED.map((t) => t.toLowerCase()))].sort((a, b) => a.localeCompare(b))
const downloaded = []
const failed = []

for (const t of want) {
  if (existing.has(t)) continue
  const svg = join(OUT, `${t}.svg`)
  const candidates = [
    `https://cdn.jsdelivr.net/npm/cryptocurrency-icons@${SDK}/svg/color/${t}.svg`,
    `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@${GH}/svg/color/${t}.svg`,
  ]
  let ok = false
  for (const url of candidates) {
    if (await tryDownload(url, svg)) {
      downloaded.push(t)
      existing.add(t)
      ok = true
      break
    }
  }
  if (!ok) failed.push(t)
}

// Rebuild LOCAL_TICKERS in logos.ts from disk (A–Z)
const files = readdirSync(OUT)
  .filter((f) => /\.(svg|png|jpg|jpeg|webp)$/i.test(f))
  .sort((a, b) => a.localeCompare(b))

const tickers = files
  .map((f) => f.replace(/\.(svg|png|jpg|jpeg|webp)$/i, '').toLowerCase())
  .sort((a, b) => a.localeCompare(b))

const extMap = {}
for (const f of files) {
  const m = f.match(/^(.+)\.(svg|png|jpg|jpeg|webp)$/i)
  if (!m) continue
  const t = m[1].toLowerCase()
  const ext = m[2].toLowerCase()
  if (ext !== 'svg') extMap[t] = ext === 'jpeg' ? 'jpg' : ext
}

const logosPath = join(ROOT, 'src', 'lib', 'logos.ts')
let src = readFileSync(logosPath, 'utf8')

const tickersBlock = tickers.map((t) => `  '${t}',`).join('\n')
src = src.replace(
  /export const LOCAL_TICKERS = \[[\s\S]*?\] as const/,
  `export const LOCAL_TICKERS = [\n${tickersBlock}\n] as const`,
)

const extLines = Object.keys(extMap)
  .sort((a, b) => a.localeCompare(b))
  .map((k) => `  ${k}: '${extMap[k]}',`)
  .join('\n')
src = src.replace(
  /const LOCAL_EXT: Record<string, string> = \{[\s\S]*?\}/,
  `const LOCAL_EXT: Record<string, string> = {\n${extLines}\n}`,
)

writeFileSync(logosPath, src)

console.log('=== public/logos (A–Z) ===')
console.log(files.join('\n'))
console.log(`\nSDK primary: cryptocurrency-icons@${SDK}`)
console.log(`SDK secondary: cryptocurrency-icons@${GH}`)
console.log(`tickers on disk: ${tickers.length}`)
console.log(`downloaded: ${downloaded.length}`, downloaded.join(', ') || '(none)')
console.log(`failed: ${failed.length}`, failed.join(', ') || '(none)')
console.log('updated src/lib/logos.ts LOCAL_TICKERS + LOCAL_EXT')
