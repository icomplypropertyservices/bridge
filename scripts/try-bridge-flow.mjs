import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'

const result = {
  steps: [],
  errors: [],
  create: null,
  deepLink: null,
  expectedDeepLink: null,
  console: [],
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
page.on('console', (m) => result.console.push(`[${m.type()}] ${m.text()}`))
page.on('pageerror', (e) => result.console.push(`[pageerror] ${e.message}`))

let createBody = null
page.on('response', async (res) => {
  if (res.url().includes('/v1/bridge/create') && res.request().method() === 'POST') {
    try {
      createBody = await res.json()
    } catch {
      /* ignore */
    }
  }
})

try {
  await page.goto('http://localhost:5177/', { waitUntil: 'domcontentloaded', timeout: 45000 })
  result.steps.push('loaded app')

  // Wait until currencies loaded (XRP shown, not "Select")
  await page.waitForFunction(
    () => {
      const t = document.body.innerText
      return t.includes('Bridge assets') && (t.includes('XRP') || t.includes('Ripple')) && !t.includes('Rate limit exceeded')
    },
    { timeout: 45000 },
  )
  result.steps.push('currencies loaded')

  // Click YOU RECEIVE select button (contains current token name)
  const receiveSection = page.locator('label:has-text("YOU RECEIVE"), div:has-text("YOU RECEIVE")').first()
  // Prefer: the button under the YOU RECEIVE label in the form
  const currencyButtons = page.locator('.glass-card button').filter({
    has: page.locator('div.font-semibold, .font-semibold'),
  })
  // First is YOU SEND, second is YOU RECEIVE
  const count = await currencyButtons.count()
  result.steps.push(`currency buttons=${count}`)
  if (count < 2) throw new Error('currency selectors not ready')

  await currencyButtons.nth(1).click()
  result.steps.push('opened receive picker')

  const search = page.locator('input[placeholder*="Search"]')
  await search.waitFor({ timeout: 5000 })
  await search.fill('btc')
  await page.waitForTimeout(500)

  // Click option with ticker BTC and name Bitcoin on btc network
  await page.locator('button').filter({ hasText: /^BTC$/ }).first().click({ timeout: 5000 }).catch(async () => {
    await page.getByRole('button', { name: /Bitcoin/i }).first().click()
  })
  result.steps.push('selected BTC')

  await page.fill('input[placeholder*="Paste receiving"]', 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh')
  result.steps.push('filled destination')

  // Wait for estimate to settle (optional)
  await page.waitForTimeout(800)

  const popupPromise = page.waitForEvent('popup', { timeout: 12000 }).catch(() => null)

  const bridgeBtn = page.getByRole('button', { name: /Bridge /i })
  await bridgeBtn.click()
  result.steps.push('clicked Bridge')

  const deposit = page.waitForSelector('text=Deposit to complete', { timeout: 30000 }).then(() => 'deposit')
  const failed = page.waitForSelector('text=Bridge failed', { timeout: 30000 }).then(() => 'failed')
  const outcome = await Promise.race([deposit, failed])
  result.steps.push(`outcome=${outcome}`)

  if (outcome === 'deposit') {
    const popup = await popupPromise
    if (popup) {
      result.deepLink = popup.url()
      result.steps.push(`popup: ${popup.url()}`)
      await popup.close().catch(() => {})
    }
    const openA = page.locator('a:has-text("Open in Xaman")')
    if (await openA.count()) {
      result.deepLink = result.deepLink || (await openA.first().getAttribute('href'))
      result.steps.push(`href: ${await openA.first().getAttribute('href')}`)
    }
    const qr = await page.locator('img[alt*="Xaman" i], img[alt*="Scan" i]').count()
    result.steps.push(qr ? 'QR present' : 'QR missing')
    result.steps.push((await page.locator('text=Bridge status').count()) ? 'status panel' : 'no status')
    result.steps.push((await page.locator('text=waiting').count()) ? 'status waiting' : 'status other')
  }

  if (createBody) {
    result.create = {
      id: createBody.id,
      payin: createBody.payinAddress,
      tag: createBody.payinExtraId,
      amount: createBody.directedAmount ?? createBody.fromAmount,
      to: createBody.toCurrency,
      from: createBody.fromCurrency,
    }
    result.expectedDeepLink = `https://xaman.app/detect/request:${createBody.payinAddress}?amount=${createBody.directedAmount ?? createBody.fromAmount}&network=XRPL&dt=${createBody.payinExtraId}`
    if (result.deepLink && result.expectedDeepLink) {
      result.deepLinkMatches =
        result.deepLink.startsWith(result.expectedDeepLink.split('?')[0]) ||
        result.deepLink.includes(createBody.payinAddress)
    }
  }

  await page.screenshot({ path: 'bridge-flow-test.png', fullPage: true })
  result.screenshot = 'bridge-flow-test.png'
} catch (e) {
  result.errors.push(e.message)
  try {
    await page.screenshot({ path: 'bridge-flow-error.png', fullPage: true })
    result.screenshot = 'bridge-flow-error.png'
  } catch {
    /* ignore */
  }
}

result.console = result.console.filter((l) => !l.includes('React DevTools')).slice(-25)
writeFileSync('bridge-flow-result.json', JSON.stringify(result, null, 2))
console.log(JSON.stringify(result, null, 2))
await browser.close()
process.exit(result.errors.length || result.steps.includes('outcome=failed') ? 1 : 0)
