/**
 * Records the 60-second Annex product video.
 *
 * - Drives the live app (annex-markets.vercel.app) as a scripted tour.
 * - Injects a demo EVM wallet (the deployer key) so a real approve + buy
 *   transaction happens on Mezo Testnet on camera.
 * - Burns in a caption overlay, watermark and progress bar.
 * - Outputs a WebM that is muxed with the voiceover into an MP4.
 */
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require('playwright-core')
const { createPublicClient, createWalletClient, http } = require('viem')
const { privateKeyToAccount } = require('viem/accounts')

const EXEC = '/home/maryjane/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome'
const OUT = '/tmp/opencode/video'
const APP = process.env.APP_URL || 'https://annex-markets.vercel.app'
const RPC = 'https://rpc.test.mezo.org'
const KEY = fs.readFileSync(`${process.env.HOME}/.annex/deployer.key`, 'utf8').trim()

const account = privateKeyToAccount(KEY)
const chain = {
  id: 31611,
  name: 'Mezo Testnet',
  nativeCurrency: { name: 'Bitcoin', symbol: 'BTC', decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
  contracts: { multicall3: { address: '0xcA11bde05977b3631167028862bE2a173976CA11', blockCreated: 3669328 } },
}
const publicClient = createPublicClient({ transport: http(RPC), chain })
const walletClient = createWalletClient({ account, chain, transport: http(RPC) })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const CAPTIONS = [
  { at: 0.0, text: 'Permissionless prediction markets, on Bitcoin rails.' },
  { at: 6.5, text: 'Anyone can create a yes/no market in one transaction.' },
  { at: 12.5, text: 'Trade YES or NO against an on-chain constant-product AMM.' },
  { at: 19.0, text: 'The quote you see is the marginal price — the price you pay.' },
  { at: 26.0, text: 'Price impact and average price, straight from the contract.' },
  { at: 33.0, text: 'Winning shares redeem 1:1 for MUSD, Bitcoin-backed.' },
  { at: 40.0, text: 'No custody. No upgrade key. No admin pricing.' },
  { at: 47.0, text: 'One contract. 51 tests. Open source.' },
  { at: 53.0, text: 'Annex — live on Mezo Testnet.' },
]

const overlay = (captions, total) => `
<style>
  #annex-cap {
    position: fixed; left: 50%; bottom: 64px; transform: translateX(-50%);
    z-index: 2147483647; max-width: 1180px; padding: 14px 28px;
    background: rgba(3,4,18,0.72); border: 1px solid rgba(255,255,255,0.12);
    border-radius: 999px; backdrop-filter: blur(14px);
    color: #fff; font-family: 'Poppins', system-ui, sans-serif; font-size: 25px;
    font-weight: 500; letter-spacing: -0.01em; text-align: center; line-height: 1.35;
    opacity: 0; transition: opacity 0.45s ease;
    box-shadow: 0 18px 50px -20px rgba(0,0,0,0.9);
  }
  #annex-cap.on { opacity: 1; }
  #annex-mark {
    position: fixed; top: 30px; left: 34px; z-index: 2147483647;
    display: flex; align-items: center; gap: 10px;
    font-family: 'Outfit', system-ui, sans-serif; font-size: 21px; font-weight: 700;
    letter-spacing: -0.02em; color: #fff;
    background: rgba(3,4,18,0.55); border: 1px solid rgba(255,255,255,0.1);
    border-radius: 999px; padding: 8px 16px 8px 10px; backdrop-filter: blur(12px);
  }
  #annex-mark i {
    width: 26px; height: 26px; border-radius: 999px; display: inline-block;
    background: linear-gradient(140deg, #ffd9a0, #f7931a 45%, #8a4c05);
    box-shadow: 0 0 18px -4px rgba(255,140,0,0.9);
  }
  #annex-bar {
    position: fixed; left: 0; bottom: 0; height: 3px; z-index: 2147483647;
    background: linear-gradient(90deg, #ff8c00, #ffb454); width: 0%;
  }
</style>
<div id="annex-cap"></div>
<div id="annex-mark"><i></i>Annex</div>
<div id="annex-bar"></div>
<script>
  (function () {
    var caps = ${JSON.stringify(captions)};
    var total = ${total};
    var cap = document.getElementById('annex-cap');
    var bar = document.getElementById('annex-bar');
    var t0 = performance.now();
    function tick() {
      var t = (performance.now() - t0) / 1000;
      bar.style.width = Math.min(100, (t / total) * 100) + '%';
      var current = null;
      for (var i = 0; i < caps.length; i++) if (t >= caps[i].at) current = caps[i];
      if (current) {
        if (cap.textContent !== current.text) {
          cap.classList.remove('on');
          setTimeout(function () { cap.textContent = current.text; cap.classList.add('on'); }, 220);
        }
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  })();
</script>
`

;(async () => {
  fs.rmSync(OUT, { recursive: true, force: true })
  fs.mkdirSync(OUT, { recursive: true })

  const browser = await chromium.launch({
    executablePath: EXEC,
    args: ['--no-sandbox', '--disable-gpu', '--autoplay-policy=no-user-gesture-required'],
  })

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    recordVideo: { dir: OUT, size: { width: 1920, height: 1080 } },
    reducedMotion: 'no-preference',
  })

  // ── demo wallet provider ───────────────────────────────────────────────────
  await context.exposeFunction('__annexRpc', async ({ method, params }) => {
    switch (method) {
      case 'eth_requestAccounts':
      case 'eth_accounts':
        return [account.address]
      case 'eth_chainId':
        return '0x7b7b'
      case 'net_version':
        return '31611'
      case 'eth_sendTransaction': {
        const [tx] = params
        const hash = await walletClient.sendTransaction({
          account,
          chain,
          to: tx.to,
          data: tx.data,
          value: tx.value ? BigInt(tx.value) : undefined,
        })
        return hash
      }
      case 'eth_call':
        return publicClient.call({ ...params[0], chain })
      case 'eth_estimateGas':
        return publicClient.estimateGas(params[0])
      case 'eth_getBalance':
        return publicClient.getBalance(params[0])
      case 'eth_getTransactionCount':
        return publicClient.getTransactionCount(params[0])
      case 'eth_getTransactionReceipt':
        return publicClient.getTransactionReceipt({ hash: params[0] })
      case 'eth_blockNumber':
        return publicClient.getBlockNumber()
      case 'eth_gasPrice':
        return publicClient.getGasPrice()
      case 'eth_maxPriorityFeePerGas':
        return publicClient.getMaxPriorityFeePerGas()
      case 'eth_getBlockByNumber':
        return publicClient.getBlock({ blockTag: params[0] })
      case 'eth_getLogs':
        return publicClient.getLogs(params[0])
      case 'eth_feeHistory':
        return { baseFeePerGas: 0n, gasUsedRatio: 0, oldestBlock: 0n, reward: [] }
      case 'eth_subscribe':
      case 'eth_unsubscribe':
        return null
      case 'wallet_switchEthereumChain':
      case 'wallet_addEthereumChain':
        return null
      default:
        return null
    }
  })

  await context.addInitScript(() => {
    const listeners = {}
    const provider = {
      isMetaMask: true,
      isAnnexDemo: true,
      request: async (args) => window.__annexRpc(args),
      on: (event, cb) => {
        listeners[event] = listeners[event] || []
        listeners[event].push(cb)
      },
      removeListener: (event, cb) => {
        listeners[event] = (listeners[event] || []).filter((fn) => fn !== cb)
      },
      _emit: (event, payload) => (listeners[event] || []).forEach((cb) => cb(payload)),
    }
    window.ethereum = provider
    const info = {
      uuid: '9c1b7b4e-2a6f-4f0a-9f21-annex00000001',
      name: 'Annex Demo Wallet',
      rdns: 'io.annex.demo',
      icon: 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#f7931a"/></svg>'),
    }
    Object.defineProperty(window, 'ethereum', { value: provider, writable: false, configurable: true })
    window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: Object.freeze({ info, provider }) }))
  })

  const page = await context.newPage()
  await page.addInitScript(() => {
    window.__annexCaption = null
  })

  const TOTAL = 60
  await page.goto(APP, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.addStyleTag({ content: overlay(CAPTIONS, TOTAL) })
  await page.waitForTimeout(2600)

  console.log('shot 1: hero')
  await sleep(4200)

  console.log('shot 2: features')
  await page.evaluate(() => window.scrollTo({ top: 900, behavior: 'smooth' }))
  await sleep(3400)

  console.log('shot 3: featured markets')
  await page.evaluate(() => window.scrollTo({ top: 1750, behavior: 'smooth' }))
  await sleep(3000)

  console.log('shot 4: markets list')
  await page.goto(`${APP}/markets`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.addStyleTag({ content: overlay(CAPTIONS, TOTAL) })
  await page.waitForTimeout(2600)
  await sleep(2200)

  console.log('shot 5: market detail')
  await page.goto(`${APP}/market/0`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.addStyleTag({ content: overlay(CAPTIONS, TOTAL) })
  await page.waitForTimeout(3200)
  await sleep(2600)

  console.log('shot 6: trade panel interaction')
  const amount = page.locator('#amount')
  if (await amount.count()) {
    await amount.fill('25')
    await amount.dispatchEvent('change')
    await sleep(2400)
  }
  const quick = page.getByRole('button', { name: '50', exact: true })
  if (await quick.count()) {
    await quick.click()
    await sleep(1800)
  }

  console.log('shot 7: connect wallet')
  try {
    await page.getByRole('button', { name: /connect/i }).first().click({ timeout: 8000 })
    await sleep(1600)
    const demo = page.getByText('Annex Demo Wallet', { exact: false }).first()
    if (await demo.count()) {
      await demo.click({ timeout: 8000 })
      console.log('  connected demo wallet')
    }
    await sleep(3200)
  } catch (err) {
    console.log('  connect step skipped:', err.message.split('\n')[0])
  }

  console.log('shot 8: buy YES')
  try {
    const buy = page.getByRole('button', { name: /Buy YES/i }).first()
    if (await buy.count()) {
      await buy.click({ timeout: 8000 })
      await sleep(6000)
    }
  } catch (err) {
    console.log('  buy step skipped:', err.message.split('\n')[0])
  }

  console.log('shot 9: portfolio')
  await page.goto(`${APP}/portfolio`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.addStyleTag({ content: overlay(CAPTIONS, TOTAL) })
  await page.waitForTimeout(3600)
  await sleep(2600)

  console.log('shot 10: end card')
  await page.goto(APP, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.addStyleTag({ content: overlay(CAPTIONS, TOTAL) })
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  await page.waitForTimeout(3200)
  await sleep(3600)

  await context.close()
  await browser.close()

  const video = fs.readdirSync(OUT).find((f) => f.endsWith('.webm'))
  fs.renameSync(path.join(OUT, video), path.join(OUT, 'screen.webm'))
  console.log('raw video:', path.join(OUT, 'screen.webm'))
  process.exit(0)
})().catch((e) => {
  console.error('FAILED', e)
  process.exit(1)
})
