// REAL browser test of the deployed site — drives the UI like a user.
import { chromium } from 'playwright'

const SITE = 'https://date-app-j6ih.onrender.com'
const browser = await chromium.launch()
const results = []

async function testArea(area) {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  const consoleErrors = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message))

  try {
    await page.goto(`${SITE}/create`, { waitUntil: 'networkidle', timeout: 30000 })

    // Fill the "Where?" field.
    const areaInput = page.locator('input[aria-label="Area"]')
    await areaInput.waitFor({ timeout: 10000 })
    await areaInput.fill(area)

    // Click Generate.
    await page.getByRole('button', { name: /generate/i }).click()

    // Wait for navigation to /pass/ OR an error toast, up to 60s.
    const t0 = Date.now()
    let outcome = 'unknown'
    try {
      await page.waitForURL(/\/pass\/.+/, { timeout: 60000 })
      outcome = 'navigated'
    } catch {
      // Check for an error toast instead.
      const toast = await page.locator('text=/couldn|try again|longer than expected|problem/i').count()
      outcome = toast > 0 ? 'error-toast' : 'STUCK'
    }
    const ms = Date.now() - t0

    if (outcome === 'navigated') {
      // Confirm a stop/venue actually rendered in the sheet.
      await page.waitForTimeout(3000) // let the pass load
      const bodyText = await page.locator('body').innerText()
      const hasStops = /\d{1,2}:\d{2}\s?(AM|PM)/i.test(bodyText) || /stops/i.test(bodyText)
      results.push(`${area}: ✅ navigated to pass in ${ms}ms, content rendered: ${hasStops} | URL: ${page.url()}`)
    } else {
      results.push(`${area}: ${outcome === 'error-toast' ? '⚠️ graceful error toast' : '❌ STUCK (no nav, no toast)'} after ${ms}ms`)
    }
    if (consoleErrors.length) results.push(`   console errors: ${consoleErrors.slice(0,3).join(' | ')}`)
  } catch (e) {
    results.push(`${area}: ❌ THREW ${e.message}`)
  } finally {
    await ctx.close()
  }
}

await testArea('Bukit Bintang')       // seeded, should be fast
await testArea('Penang')              // fresh-ish
await testArea('Melbourne')           // fresh worldwide

await browser.close()
console.log('\n===== BROWSER E2E RESULTS =====')
results.forEach((r) => console.log(r))
