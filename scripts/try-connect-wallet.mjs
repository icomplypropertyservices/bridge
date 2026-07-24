import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'

const result = { steps: [], errors: [], payload: null, config: null, console: [] }

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
page.on('console', (m) => result.console.push(`[${m.type()}] ${m.text()}`))
page.on('pageerror', (e) => result.console.push(`[pageerror] ${e.message}`))

let createBody = null
page.on('response', async (res) => {
  try {
    if (res.url().includes('/api/xaman/payload') && res.request().method() === 'POST') {
      createBody = { status: res.status(), body: await res.json() }
    }
    if (res.url().includes('/api/config')) {
      result.config = await res.json()
    }
  } catch {}
})

try {
  await page.goto('http://localhost:5177/', { waitUntil: 'networkidle', timeout: 45000 })
  result.steps.push('loaded')

  // Click Connect Wallet
  const btn = page.getByRole('button', { name: /Connect Wallet/i })
  await btn.waitFor({ timeout: 15000 })
  await btn.click()
  result.steps.push('clicked Connect Wallet')

  // Wait for modal or error toast
  const modal = page.waitForSelector('text=Connect Wallet', { timeout: 20000 }).then(() => 'modal')
  const waiting = page.waitForSelector('text=Waiting for Xaman', { timeout: 20000 }).then(() => 'waiting')
  const qr = page.waitForSelector('img[alt*="Scan" i], img[alt*="Xaman" i]', { timeout: 20000 }).then(() => 'qr')
  const failed = page.waitForSelector('text=Could not start', { timeout: 20000 }).then(() => 'failed')

  // Modal title exists already in header - wait for QR or waiting text specifically
  await page.waitForTimeout(500)
  const hasWaiting = await page.locator('text=Waiting for Xaman').count()
  const hasQr = await page.locator('img[alt="Scan with Xaman"]').count()
  const hasOpen = await page.locator('text=Open in Xaman app').count()

  result.steps.push(`waitingText=${hasWaiting} qr=${hasQr} openBtn=${hasOpen}`)

  if (createBody) {
    result.payload = {
      status: createBody.status,
      uuid: createBody.body?.uuid,
      hasQr: Boolean(createBody.body?.refs?.qr_png),
      next: createBody.body?.next?.always,
    }
    result.steps.push(`payload uuid=${createBody.body?.uuid}`)
  } else {
    result.steps.push('no payload response captured')
  }

  // Poll endpoint once if we have uuid
  if (createBody?.body?.uuid) {
    const poll = await page.request.get(
      `http://localhost:5177/api/xaman/payload?uuid=${createBody.body.uuid}`,
    )
    const pj = await poll.json()
    result.poll = {
      status: poll.status(),
      signed: pj?.meta?.signed,
      cancelled: pj?.meta?.cancelled,
      expired: pj?.meta?.expired,
      resolved: pj?.meta?.resolved,
    }
    result.steps.push(`poll signed=${pj?.meta?.signed} resolved=${pj?.meta?.resolved}`)
  }

  await page.screenshot({ path: 'connect-wallet-test.png', fullPage: true })
  result.screenshot = 'connect-wallet-test.png'

  // Success criteria: payload created with QR + next link
  if (!createBody?.body?.uuid || !createBody.body?.refs?.qr_png) {
    result.errors.push('SignIn payload missing uuid or qr_png')
  }
  if (hasOpen < 1 && hasQr < 1) {
    result.errors.push('Connect modal UI incomplete')
  }
} catch (e) {
  result.errors.push(e.message)
  try {
    await page.screenshot({ path: 'connect-wallet-error.png', fullPage: true })
    result.screenshot = 'connect-wallet-error.png'
  } catch {}
}

result.console = result.console.filter((l) => !l.includes('React DevTools') && !l.includes('Download the')).slice(-20)
writeFileSync('connect-wallet-result.json', JSON.stringify(result, null, 2))
console.log(JSON.stringify(result, null, 2))
await browser.close()
process.exit(result.errors.length ? 1 : 0)
