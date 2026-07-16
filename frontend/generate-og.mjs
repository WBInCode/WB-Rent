// Generates public/og-image.png (1200x630) with the brand Sora font,
// rendered in headless Chromium (Playwright) so Google Fonts work.
// Usage: node generate-og.mjs
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const outPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public', 'og-image.png');

const html = `<!doctype html>
<html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600&family=Sora:wght@700;800&display=swap" rel="stylesheet">
<style>
  * { margin: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; overflow: hidden; background: #0a0a0a; font-family: 'Inter', sans-serif; position: relative; }
  .glow { position: absolute; border-radius: 50%; filter: blur(90px); }
  .g1 { width: 500px; height: 500px; right: -120px; top: -150px; background: rgba(184,151,42,0.22); }
  .g2 { width: 420px; height: 420px; left: -100px; bottom: -180px; background: rgba(184,151,42,0.12); }
  .curve { position: absolute; inset: 0; }
  .wrap { position: relative; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 0 90px; }
  .badge { display: inline-flex; align-items: center; gap: 10px; padding: 10px 22px; border: 1px solid rgba(184,151,42,0.45); border-radius: 999px; color: #d4a84b; font-size: 22px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 36px; }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: #d4a84b; }
  h1 { font-family: 'Sora', sans-serif; font-weight: 800; font-size: 92px; line-height: 1.05; letter-spacing: -0.02em; color: #fff; }
  h1 .gold { background: linear-gradient(90deg, #d4a84b 0%, #b8972a 60%, #8b6914 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
  p.sub { margin-top: 28px; font-size: 30px; color: #9a9a9a; font-weight: 500; }
  .chips { display: flex; gap: 18px; margin-top: 44px; }
  .chip { padding: 12px 26px; border-radius: 14px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #d4a84b; font-size: 24px; font-weight: 600; }
  .site { position: absolute; bottom: 42px; left: 0; right: 0; text-align: center; color: #5a5a5a; font-size: 24px; font-weight: 600; letter-spacing: 0.04em; }
</style></head>
<body>
  <div class="glow g1"></div>
  <div class="glow g2"></div>
  <svg class="curve" viewBox="0 0 1200 630" fill="none">
    <path d="M-50,470 Q300,400 600,470 T1250,440" stroke="rgba(184,151,42,0.25)" stroke-width="2"/>
    <path d="M-50,520 Q350,460 650,520 T1250,500" stroke="rgba(184,151,42,0.12)" stroke-width="1.5"/>
  </svg>
  <div class="wrap">
    <div class="badge"><span class="dot"></span>Wypożyczalnia sprzętu czyszczącego</div>
    <h1>WB-<span class="gold">Rent</span></h1>
    <p class="sub">Odkurzacze piorące Kärcher · Ozonatory · Parownice</p>
    <div class="chips">
      <div class="chip">Rezerwacja online 24/7</div>
      <div class="chip">Dostawa do 30 km</div>
      <div class="chip">od 25 zł/doba</div>
    </div>
  </div>
  <div class="site">wb-rent.pl</div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);
await page.screenshot({ path: outPath, type: 'png' });
await browser.close();
console.log(`✅ og-image.png generated at ${outPath}`);
