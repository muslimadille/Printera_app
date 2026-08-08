/**
 * Responsive overflow discovery — Punch list generator.
 *
 * For each leaf tab at 375 / 768 / 1024 / 1440:
 *  - assert documentElement.scrollWidth <= innerWidth + 1
 *  - flag elements wider than the viewport
 *  - capture a screenshot under e2e/artifacts/responsive/
 *
 * Credentials: E2E_USERNAME + E2E_PASSWORD (or ADMIN_USERNAME / ADMIN_PASSWORD).
 *
 *   bun run test:responsive
 */
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const WIDTHS = [375, 768, 1024, 1440] as const;
const API = process.env.E2E_API_BASE || 'http://localhost:8000/api/v1';

const TAB_KEYS = [
  'hybridengine', 'itemcost', 'flat', 'templatecost',
  'diecut', 'diecut2', 'diecut3', 'diecut4', 'diecut5',
  'carryhandle', 'lidtuck', 'medicinebox1', 'box10001', 'svgnest',
  'box_diecut', 'box_diecut2', 'box_diecut3', 'box_diecut4', 'box_diecut5',
  'box_carryhandle', 'box_lidtuck', 'box_medicinebox1', 'box_box10001', 'box_svgnest',
  'box_d001', 'box_d003', 'box_t0001', 'box_t0002', 'box_a01010000', 'box_a01700000', 'box_generic',
  'templatemontage', 'magazinesheet', 'montage', 'bagcalc', 'costcalc', 'smartengine', 'mergeitems',
  'montag_itemcost', 'montag_box10001',
  'savedquotes', 'settings', 'papertypes', 'guide',
  'calculator', 'paperset', 'magazines', 'newmagazine', 'magazine', 'boxpricing', 'manual', 'employee',
  'quote', 'finishing', 'bulkimport',
  'users', 'loginhistory',
];

type Offender = { selector: string; tag: string; scrollWidth: number; clientWidth: number };
type PunchRow = { tab: string; width: number; pageOverflow: number; offenders: Offender[] };

const ARTIFACTS = path.join(process.cwd(), 'e2e', 'artifacts', 'responsive');

async function apiLogin(): Promise<{
  user: { id: string; username: string; is_admin: boolean; max_employees: number; employees_can_view_quotes: boolean; parent_user_id: string | null };
  session_token: string;
  tab_permissions: unknown[];
}> {
  const username = process.env.E2E_USERNAME || process.env.ADMIN_USERNAME;
  const password = process.env.E2E_PASSWORD || process.env.ADMIN_PASSWORD;
  if (!username || !password) {
    throw new Error('Set E2E_USERNAME/E2E_PASSWORD (or ADMIN_*) to run the overflow audit.');
  }

  const device = {
    username,
    password,
    device_info: 'Playwright overflow audit',
    device_id: `e2e-audit-${Date.now()}`,
  };

  let res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(device),
  });
  let data = await res.json();

  if (data?.device_limit_reached && Array.isArray(data.active_sessions)) {
    res = await fetch(`${API}/auth/force-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        ...device,
        terminate_session_ids: data.active_sessions.map((s: { id: string }) => s.id),
      }),
    });
    data = await res.json();
  }

  if (!data?.session_token || !data?.user) {
    throw new Error(`API login failed: ${JSON.stringify({ success: data?.success, error: data?.error })}`);
  }

  return data;
}

async function seedSession(page: Page) {
  const data = await apiLogin();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const session = {
    id: data.user.id,
    username: data.user.username,
    is_admin: data.user.is_admin,
    max_employees: data.user.max_employees ?? 0,
    employees_can_view_quotes: data.user.employees_can_view_quotes ?? false,
    parent_user_id: data.user.parent_user_id ?? null,
    session_token: data.session_token,
    expiresAt,
    pw: '',
  };
  const perms = data.tab_permissions || [];

  // Establish origin, then write session (addInitScript alone can race).
  await page.goto('/app');
  await page.evaluate(
    ({ session, perms }) => {
      localStorage.setItem('printCalc_session', JSON.stringify(session));
      localStorage.setItem('printCalc_tabPermsSnapshot', JSON.stringify(perms));
      localStorage.setItem('printCalc_layout', 'topbar');
      localStorage.setItem('printCalc_activeTab', 'itemcost');
      localStorage.setItem(`printCalc_${session.id}_activeTab`, 'itemcost');
    },
    { session, perms },
  );
  await page.reload({ waitUntil: 'networkidle' });

  // Prefer shell markers; fall back to header title if tabs remount slowly
  const shell = page.locator('[data-tour^="tab-"], [data-sidebar="sidebar"], header');
  await shell.first().waitFor({ state: 'visible', timeout: 60_000 });
  // Must not still be on the login dialog
  await expect(page.locator('#username')).toHaveCount(0, { timeout: 15_000 });
}

async function activateTab(page: Page, tabKey: string) {
  await page.evaluate((key) => {
    localStorage.setItem('printCalc_activeTab', key);
    try {
      const raw = localStorage.getItem('printCalc_session');
      if (raw) {
        const id = JSON.parse(raw).id;
        if (id) localStorage.setItem(`printCalc_${id}_activeTab`, key);
      }
    } catch { /* ignore */ }
  }, tabKey);

  // Prefer DOM click (works even when the tab strip is horizontally scrolled).
  const clicked = await page.evaluate((key) => {
    const el = document.querySelector(`[data-tour="tab-${key}"]`) as HTMLElement | null;
    if (!el) return false;
    el.scrollIntoView({ block: 'nearest', inline: 'center' });
    el.click();
    return true;
  }, tabKey);

  if (clicked) {
    await page.waitForTimeout(350);
    return;
  }

  // Nested / gated tabs with no trigger in the current strip → reload
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
}

async function measureOverflow(page: Page): Promise<{ pageOverflow: number; offenders: Offender[] }> {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const pageOverflow = Math.max(0, document.documentElement.scrollWidth - vw);
    const offenders: Offender[] = [];
    const all = document.body.querySelectorAll('*');
    for (const el of all) {
      const html = el as HTMLElement;
      if (!html.getBoundingClientRect) continue;
      const style = window.getComputedStyle(html);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const sw = html.scrollWidth;
      if (sw > vw + 1) {
        const tag = html.tagName.toLowerCase();
        const id = html.id ? `#${html.id}` : '';
        const cls = typeof html.className === 'string' && html.className
          ? '.' + html.className.trim().split(/\s+/).slice(0, 3).join('.')
          : '';
        const tour = html.getAttribute('data-tour');
        const selector = tour
          ? `[data-tour="${tour}"]`
          : `${tag}${id}${cls}`.slice(0, 120);
        offenders.push({
          selector,
          tag,
          scrollWidth: sw,
          clientWidth: html.clientWidth,
        });
        if (offenders.length >= 12) break;
      }
    }
    return { pageOverflow, offenders };
  });
}

test.describe('Responsive overflow audit', () => {
  test.setTimeout(20 * 60 * 1000);

  test('build punch list for all tabs × breakpoints', async ({ page }) => {
    fs.mkdirSync(ARTIFACTS, { recursive: true });
    await seedSession(page);

    const punch: PunchRow[] = [];

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      for (const tab of TAB_KEYS) {
        await activateTab(page, tab);
        const { pageOverflow, offenders } = await measureOverflow(page);
        const shot = path.join(ARTIFACTS, `${tab}-${width}.png`);
        await page.screenshot({ path: shot, fullPage: false });

        if (pageOverflow > 1 || offenders.some((o) => o.scrollWidth > width + 8)) {
          punch.push({ tab, width, pageOverflow, offenders });
        }
      }
    }

    const reportPath = path.join(ARTIFACTS, 'punch-list.json');
    fs.writeFileSync(reportPath, JSON.stringify({ generatedAt: new Date().toISOString(), punch }, null, 2));

    const md: string[] = [
      '# Responsive punch list',
      '',
      `Generated: ${new Date().toISOString()}`,
      `Breakpoints: ${WIDTHS.join(', ')}`,
      `Tabs scanned: ${TAB_KEYS.length}`,
      `Rows flagged: ${punch.length}`,
      '',
    ];
    const pageFails = punch.filter((p) => p.pageOverflow > 1);
    if (pageFails.length === 0) {
      md.push('✅ No page-level overflow detected.');
    } else {
      md.push('| Tab | Width | Page overflow (px) | Top offenders |');
      md.push('|-----|------:|-------------------:|---------------|');
      for (const row of pageFails) {
        const offs = row.offenders.slice(0, 4).map((o) => `\`${o.selector}\` (${o.scrollWidth})`).join('<br>');
        md.push(`| ${row.tab} | ${row.width} | ${row.pageOverflow} | ${offs} |`);
      }
    }
    fs.writeFileSync(path.join(ARTIFACTS, 'punch-list.md'), md.join('\n'));

    console.log(`Punch list → ${reportPath} (pageFails=${pageFails.length}, flagged=${punch.length})`);
    expect(pageFails, `Page overflow on ${pageFails.length} tab×width combos — see e2e/artifacts/responsive/punch-list.md`).toHaveLength(0);
  });
});
