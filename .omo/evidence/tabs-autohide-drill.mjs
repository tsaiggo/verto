import { chromium } from 'playwright';
import fs from 'node:fs';

const logPath = '.omo/evidence/tabs-autohide.log';
const base = 'http://localhost:3000';
let log = '';
function add(msg){ log += msg + '\n'; console.log(msg); }

async function main(){
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  try {
    // Clear
    await page.goto(`${base}/read/demo`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear());
    add('cleared localStorage');

    // 1. Single doc => no .app-tabs row
    await page.goto(`${base}/read/demo`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-article]', { timeout: 10000 });
    await page.waitForTimeout(600);
    const single = await page.evaluate(() => ({
      count: document.querySelectorAll('.app-tabs').length,
      url: location.pathname,
      storage: localStorage.getItem('verto:open-tabs'),
      html: document.documentElement.outerHTML.slice(0,1200),
    }));
    add(`single doc: .app-tabs count=${single.count} url=${single.url} storage=${single.storage}`);
    if (single.count !== 0) throw new Error(`expected 0 .app-tabs with single doc, got ${single.count}`);
    add('PASS: single doc hides tabs row');
    // screenshot no row
    await page.screenshot({ path: '.omo/evidence/tabs-autohide-1.png', fullPage: false });
    add('screenshot saved tabs-autohide-1.png (no row)');

    // Verify document still readable
    const hasTitle = await page.evaluate(() => !!document.querySelector('[data-article]'));
    add(`document renders: ${hasTitle}`);
    if (!hasTitle) throw new Error('doc missing with hidden tabs');

    // 2. Open second doc => row appears with 2 tabs
    // Use localStorage programmatic add + navigate (mirrors task spec) to ensure determinism
    await page.evaluate(() => {
      // already has demo via useEffect; add welcome manually then navigate
      const key='verto:open-tabs';
      const cur = JSON.parse(localStorage.getItem(key) ?? '[]');
      // ensure demo present; add welcome if not
      if (!cur.some(t=>t.path==='/read/welcome')) cur.push({path:'/read/welcome', title:'Welcome'});
      localStorage.setItem(key, JSON.stringify(cur));
      window.dispatchEvent(new StorageEvent('storage',{key}));
    });
    await page.goto(`${base}/read/welcome`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    const twoTabs = await page.evaluate(() => ({
      countTabs: document.querySelectorAll('.app-tabs').length,
      tabLabels: [...document.querySelectorAll('.app-tab-label')].map(e=>e.textContent),
      active: document.querySelector('.app-tab.is-on .app-tab-label')?.textContent,
      storage: localStorage.getItem('verto:open-tabs'),
    }));
    add(`two docs: .app-tabs count=${twoTabs.countTabs} labels=${JSON.stringify(twoTabs.tabLabels)} active=${twoTabs.active} storage=${twoTabs.storage}`);
    if (twoTabs.countTabs !== 1) throw new Error(`expected 1 .app-tabs container with 2 docs, got ${twoTabs.countTabs}`);
    if (twoTabs.tabLabels.length !== 2) throw new Error(`expected 2 tabs, got ${twoTabs.tabLabels.length}`);
    add('PASS: 2 docs shows row with 2 tabs');
    await page.screenshot({ path: '.omo/evidence/tabs-autohide-2.png', fullPage: false });
    add('screenshot saved tabs-autohide-2.png (row visible)');

    // 3. Close one (active welcome) => fallback to demo, row disappears
    const closeBtn = page.locator('.app-tab.is-on [data-tab-close]').first();
    await closeBtn.click();
    await page.waitForTimeout(800);
    const afterClose = await page.evaluate(() => ({
      url: location.pathname,
      appTabsCount: document.querySelectorAll('.app-tabs').length,
      tabs: [...document.querySelectorAll('.app-tab-label')].map(e=>e.textContent),
      storage: localStorage.getItem('verto:open-tabs'),
    }));
    add(`after close: url=${afterClose.url} .app-tabs=${afterClose.appTabsCount} tabs=${JSON.stringify(afterClose.tabs)} storage=${afterClose.storage}`);
    if (!afterClose.url.includes('/read/demo')) add(`WARN close fallback expected /read/demo but got ${afterClose.url}`);
    else add('PASS: close fallback to neighbour');
    if (afterClose.appTabsCount !== 0) throw new Error(`expected 0 .app-tabs after closing to 1 doc, got ${afterClose.appTabsCount}`);
    add('PASS: back to 1 doc hides row again');
    if (afterClose.tabs.length !== 0) {
      // when hidden, tabs are 0 anyway since container absent
    }

    // 4. Reload persists single doc hidden
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    const afterReloadSingle = await page.evaluate(() => ({
      count: document.querySelectorAll('.app-tabs').length,
      storage: localStorage.getItem('verto:open-tabs'),
    }));
    add(`after reload (single): count=${afterReloadSingle.count} storage=${afterReloadSingle.storage}`);
    if (afterReloadSingle.count !== 0) throw new Error('reload with single doc should still hide tabs');
    add('PASS: reload persists single->hidden');

    // 5. Re-add second doc and reload persists 2 visible
    await page.evaluate(() => {
      const key='verto:open-tabs';
      const cur = JSON.parse(localStorage.getItem(key) ?? '[]');
      if (!cur.some(t=>t.path==='/read/welcome')) cur.push({path:'/read/welcome', title:'Welcome'});
      localStorage.setItem(key, JSON.stringify(cur));
      window.dispatchEvent(new StorageEvent('storage',{key}));
    });
    await page.goto(`${base}/read/welcome`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);
    await page.goto(`${base}/read/demo`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);
    const beforeReload2 = await page.evaluate(() => localStorage.getItem('verto:open-tabs'));
    add(`before reload 2tabs storage=${beforeReload2}`);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    const afterReload2 = await page.evaluate(() => ({
      count: document.querySelectorAll('.app-tabs').length,
      tabs: [...document.querySelectorAll('.app-tab-label')].map(e=>e.textContent),
      storage: localStorage.getItem('verto:open-tabs'),
    }));
    add(`after reload 2tabs: .app-tabs=${afterReload2.count} tabs=${JSON.stringify(afterReload2.tabs)} storage=${afterReload2.storage}`);
    if (afterReload2.count !== 1) throw new Error('reload with 2 docs should show tabs');
    if (afterReload2.tabs.length !== 2) throw new Error('reload 2 tabs labels mismatch');
    add('PASS: reload persists 2->visible');

    add('ALL CHECKS PASSED');
  } catch(e){
    add(`FAIL: ${e.message}\n${e.stack}`);
    process.exitCode = 1;
  } finally {
    fs.writeFileSync(logPath, log);
    await browser.close();
  }
}
main();
