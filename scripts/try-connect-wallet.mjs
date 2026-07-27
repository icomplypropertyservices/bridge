/**
 * Smoke test for the WalletConnect surfaces.
 *
 * Verifies, against a running dev server:
 *  1. the app boots with no page errors
 *  2. AppKit's modal opens for the EVM namespace and renders a wc: QR
 *  3. AppKit's modal opens for the Solana namespace
 *  4. the XRPL (Joey) pairing produces a real `wc:` URI and QR
 *
 * Usage: node scripts/try-connect-wallet.mjs [baseUrl]
 */
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'

const BASE = process.argv[2] || 'http://localhost:5177/'

const result = { base: BASE, steps: [], errors: [], console: [] }

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
page.on('console', (m) => {
  if (m.type() === 'error') result.console.push(`[error] ${m.text()}`)
})
page.on('pageerror', (e) => result.errors.push(`[pageerror] ${e.message}`))

const step = (s) => {
  result.steps.push(s)
  console.log(`· ${s}`)
}

async function openWalletMenu() {
  const btn = page.getByRole('button', { name: /Connect Wallet/i }).first()
  await btn.waitFor({ timeout: 20000 })
  await btn.click()
  await page.waitForTimeout(300)
}

/**
 * AppKit's modal opens on the wallet list. Click its "WalletConnect" entry
 * (deep inside shadow DOM) to reach the QR view.
 */
async function clickWalletConnectEntry() {
  return page.evaluate(() => {
    const walk = (root) => {
      for (const el of root.querySelectorAll('*')) {
        if (
          el.tagName === 'BUTTON' &&
          /walletconnect/i.test(el.textContent || '') &&
          typeof el.click === 'function'
        ) {
          el.click()
          return true
        }
        if (el.shadowRoot && walk(el.shadowRoot)) return true
      }
      return false
    }
    return walk(document)
  })
}

/** AppKit renders into shadow DOM; find any wc: URI it has produced. */
async function findWcUri(timeoutMs = 25000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const uri = await page.evaluate(() => {
      const seen = []
      const walk = (root) => {
        for (const el of root.querySelectorAll('*')) {
          if (el.tagName === 'WUI-QR-CODE' && el.getAttribute('uri')) {
            seen.push(el.getAttribute('uri'))
          }
          if (el.shadowRoot) walk(el.shadowRoot)
        }
      }
      walk(document)
      return seen.find((u) => u.startsWith('wc:')) || null
    })
    if (uri) return uri
    await page.waitForTimeout(500)
  }
  return null
}

try {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForTimeout(2500)
  step('app loaded')

  // --- 1. wallet menu lists all three stacks -------------------------------
  await openWalletMenu()
  // Count the menu's Connect rows rather than page text — "Xaman" also appears
  // in the how-it-works copy, which made a body-text match a false positive.
  const rows = await page.getByRole('button', { name: /^Connect$/ }).count()
  const menuText = await page.locator('body').innerText()
  const hasEvm = /Ethereum \/ EVM/i.test(menuText)
  const hasSol = /Phantom, Solflare/i.test(menuText)
  const hasJoey = /Joey Wallet/i.test(menuText)
  const hasXaman = /Sign-In \+ deep link/i.test(menuText)
  const hasStellar = /LOBSTR/i.test(menuText)
  step(`connect rows=${rows} stellar=${hasStellar}`)
  if (!hasStellar) result.errors.push('Stellar option missing from wallet menu')
  step(`menu: evm=${hasEvm} solana=${hasSol} joey=${hasJoey} xaman=${hasXaman}`)
  result.menu = { evm: hasEvm, solana: hasSol, joey: hasJoey, xaman: hasXaman }
  if (!hasEvm || !hasSol || !hasJoey) result.errors.push('wallet menu missing a stack')
  if (!hasXaman) result.errors.push('Xaman option missing from wallet menu')

  // --- 2. XRPL / Joey pairing ----------------------------------------------
  await page.getByRole('button', { name: /^Connect$/ }).nth(3).click()
  step('clicked Joey connect')

  const joeyQr = await page
    .locator('img[alt="Scan with Joey Wallet"]')
    .first()
    .waitFor({ timeout: 30000 })
    .then(() => true)
    .catch(() => false)
  const joeyModal = await page.locator('text=Connect XRPL wallet').count()
  result.xrpl = { modal: joeyModal > 0, qr: joeyQr }
  step(`xrpl modal=${joeyModal > 0} qr=${joeyQr}`)
  if (!joeyQr) result.errors.push('XRPL pairing produced no QR (no wc: URI)')

  await page.screenshot({ path: 'wc-xrpl.png', fullPage: true })

  // close the Joey modal
  await page.keyboard.press('Escape').catch(() => {})
  await page.mouse.click(5, 5)
  await page.waitForTimeout(800)

  // --- 3. AppKit EVM modal --------------------------------------------------
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  await openWalletMenu()
  await page
    .getByRole('button', { name: /^Connect$/ })
    .first()
    .click()
  step('clicked EVM connect')
  await page.waitForTimeout(2500)

  const modalPresent = await page.locator('w3m-modal').count()
  const clicked = await clickWalletConnectEntry()
  step(`evm modal=${modalPresent > 0} walletconnect-entry=${clicked}`)

  const evmUri = await findWcUri(25000)
  result.evm = {
    modal: modalPresent > 0,
    entryClicked: clicked,
    wcUri: evmUri ? `${evmUri.slice(0, 32)}…` : null,
  }
  step(`evm wcUri=${Boolean(evmUri)}`)
  if (!modalPresent) result.errors.push('AppKit modal did not mount for EVM')
  if (!evmUri) result.errors.push('AppKit produced no wc: URI for EVM')

  await page.screenshot({ path: 'wc-evm.png', fullPage: true })

  // --- 4. AppKit Solana modal ----------------------------------------------
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  await openWalletMenu()
  const connectButtons = page.getByRole('button', { name: /^Connect$/ })
  await connectButtons.nth(1).click()
  step('clicked Solana connect')
  await page.waitForTimeout(2500)

  await clickWalletConnectEntry()
  const solUri = await findWcUri(25000)
  result.solana = { wcUri: solUri ? `${solUri.slice(0, 32)}…` : null }
  step(`solana wcUri=${Boolean(solUri)}`)
  if (!solUri) result.errors.push('AppKit produced no wc: URI for Solana')

  await page.screenshot({ path: 'wc-solana.png', fullPage: true })

  // --- 5. Xaman Sign-In (server payload, not WalletConnect) ----------------
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  await openWalletMenu()
  await page.getByRole('button', { name: /^Connect$/ }).nth(4).click()
  step('clicked Xaman connect')

  const xamanQr = await page
    .locator('img[alt="Scan with Xaman"]')
    .first()
    .waitFor({ timeout: 30000 })
    .then(() => true)
    .catch(() => false)
  const xamanModal = await page.locator('text=Connect Xaman').count()
  result.xaman = { modal: xamanModal > 0, qr: xamanQr }
  step(`xaman modal=${xamanModal > 0} qr=${xamanQr}`)
  if (!xamanQr) result.errors.push('Xaman Sign-In produced no QR')

  await page.screenshot({ path: 'wc-xaman.png', fullPage: true })

  // --- 6. Stellar pairing ---------------------------------------------------
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  await openWalletMenu()
  await page.getByRole('button', { name: /^Connect$/ }).nth(2).click()
  step('clicked Stellar connect')

  const stellarQr = await page
    .locator('img[alt="Scan with LOBSTR"]')
    .first()
    .waitFor({ timeout: 30000 })
    .then(() => true)
    .catch(() => false)
  const stellarModal = await page.locator('text=Connect Stellar wallet').count()
  result.stellar = { modal: stellarModal > 0, qr: stellarQr }
  step(`stellar modal=${stellarModal > 0} qr=${stellarQr}`)
  if (!stellarQr) result.errors.push('Stellar pairing produced no QR')

  await page.screenshot({ path: 'wc-stellar.png', fullPage: true })
} catch (e) {
  result.errors.push(e.message)
  await page.screenshot({ path: 'wc-error.png', fullPage: true }).catch(() => {})
}

result.console = result.console.slice(-15)
writeFileSync('wc-result.json', JSON.stringify(result, null, 2))
console.log('\n' + JSON.stringify(result, null, 2))
await browser.close()
process.exit(result.errors.length ? 1 : 0)
