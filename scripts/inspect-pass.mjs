import { chromium } from 'playwright'
const SITE = 'https://date-app-j6ih.onrender.com'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await ctx.newPage()

// Log ALL network responses to the get_date_pass RPC.
page.on('response', async (r) => {
  if (r.url().includes('get_date_pass')) {
    let b = ''; try { b = (await r.text()).slice(0, 120) } catch {}
    console.log(`[net] get_date_pass -> ${r.status()} body=${b}`)
  }
})
page.on('console', (m) => console.log(`[console.${m.type()}] ${m.text()}`.slice(0, 200)))
page.on('pageerror', (e) => console.log('[pageerror] ' + e.message))

await page.goto(`${SITE}/create`, { waitUntil: 'networkidle' })
await page.locator('input[aria-label="Area"]').fill('Bukit Bintang')
await page.getByRole('button', { name: /generate/i }).click()
await page.waitForURL(/\/pass\/.+/, { timeout: 60000 })
const hash = page.url().split('/pass/')[1]
console.log('URL hash:', hash)

for (const wait of [1000, 3000, 6000, 10000]) {
  await page.waitForTimeout(wait === 1000 ? 1000 : wait - 1000)
  const t = (await page.locator('body').innerText()).replace(/\n+/g,' | ').slice(0, 160)
  console.log(`@${wait}ms: ${t}`)
}

// Directly test get_date_pass from within the page context.
const direct = await page.evaluate(async (h) => {
  const url = 'https://odepmpvuixtexmgncplw.supabase.co'
  const anon = 'sb_publishable_q4OICKlkzPFWC5TCswj02A_zD8sa4Dm'
  const res = await fetch(`${url}/rest/v1/rpc/get_date_pass`, {
    method: 'POST', headers: { apikey: anon, Authorization: `Bearer ${anon}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_share_hash: h }),
  })
  const txt = await res.text()
  return { status: res.status, len: txt.length, head: txt.slice(0, 100) }
}, hash)
console.log('direct rpc:', JSON.stringify(direct))

await browser.close()
