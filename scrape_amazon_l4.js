// Scrapes Amazon India careers for L4-band marketing/account-manager roles,
// scores them against Dhruv's profile, and writes JSON + Markdown reports.
//
// Usage:
//   npm install playwright && npx playwright install chromium
//   node scrape_amazon_l4.js
//
// Note: requires outbound network access to www.amazon.jobs and the Playwright
// Chromium CDN. In restricted sandboxes both may be blocked.

const { chromium } = require('playwright');
const fs = require('fs');

const SEARCH_URLS = [
  'https://www.amazon.jobs/en/search?base_query=ads+account+manager&loc_query=india',
  'https://www.amazon.jobs/en/search?base_query=account+manager+advertising&loc_query=india',
  'https://www.amazon.jobs/en/search?base_query=marketing+manager&loc_query=india',
  'https://www.amazon.jobs/en/search?base_query=display+ads+account+manager&loc_query=india',
  'https://www.amazon.jobs/en/search?base_query=account+manager+seller+services&loc_query=india',
  'https://www.amazon.jobs/en/search?base_query=key+account+manager&loc_query=india',
];

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function scrapeSearch(page, url) {
  console.log(`Scraping ${url}...`);
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForSelector('.job-tile, .job', { timeout: 15000 });
  } catch (e) {
    console.log(`  failed to load: ${e.message}`);
    return [];
  }
  const jobs = await page.$$eval('.job-tile, .job', (nodes) =>
    nodes.map((n) => {
      const titleEl = n.querySelector('.job-title a, h3 a, a.job-link');
      const locEl = n.querySelector('.location-and-id, .location');
      const teamEl = n.querySelector('.business-category, .team');
      const dateEl = n.querySelector('.posting-date, .job-date');
      const href = titleEl ? titleEl.getAttribute('href') : null;
      const idMatch = href ? href.match(/jobs\/(\d+)/) : null;
      return {
        title: titleEl ? titleEl.textContent.trim() : '',
        url: href ? (href.startsWith('http') ? href : 'https://www.amazon.jobs' + href) : '',
        job_id: idMatch ? idMatch[1] : (href || ''),
        location: locEl ? locEl.textContent.trim() : '',
        team: teamEl ? teamEl.textContent.trim() : '',
        posted_date: dateEl ? dateEl.textContent.trim() : '',
      };
    })
  );
  console.log(`  found ${jobs.length} jobs`);
  return jobs;
}

async function scrapeDetail(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForSelector('.job-detail, #main-content, .content', { timeout: 15000 });
  return await page.evaluate(() => {
    const text = (sel) => {
      const el = document.querySelector(sel);
      return el ? el.textContent.trim() : '';
    };
    const body = document.body.innerText;
    // Section heuristics
    const grab = (label) => {
      const re = new RegExp(label + '[\\s\\S]{0,3000}?(?=PREFERRED|BASIC|DESCRIPTION|ABOUT THE TEAM|$)', 'i');
      const m = body.match(re);
      return m ? m[0] : '';
    };
    return {
      description: body,
      basic_qualifications: grab('BASIC QUALIFICATIONS'),
      preferred_qualifications: grab('PREFERRED QUALIFICATIONS'),
    };
  });
}

function isL4(job, detail) {
  const t = (job.title || '').toLowerCase();
  const d = (detail.description || '').toLowerCase();
  const seniorish = /(senior|sr\.?\b|principal|head|lead\b|director|vp|chief)/i;
  if (seniorish.test(job.title)) return false;
  if (/\bL4\b/.test(detail.description)) return true;
  const yrs = (detail.basic_qualifications || detail.description).match(/(\d+)\+?\s*(?:to|-|–)\s*(\d+)\s*years?/i);
  if (yrs) {
    const lo = parseInt(yrs[1], 10);
    const hi = parseInt(yrs[2], 10);
    if (lo <= 5 && hi <= 7 && lo >= 2) return true;
  }
  if (/\bmanager\b/.test(t) && !seniorish.test(t)) return true;
  const exact = ['account manager', 'ads account manager', 'marketing manager', 'display ads account manager'];
  if (exact.some((e) => t.includes(e))) return true;
  return false;
}

function score(job, detail) {
  const t = (job.title || '').toLowerCase();
  const loc = (job.location || '').toLowerCase();
  const d = (detail.description || '').toLowerCase();

  // Experience match
  let exp = 70;
  const yrs = (detail.basic_qualifications || d).match(/(\d+)\+?\s*(?:to|-|–)\s*(\d+)\s*years?/i);
  if (yrs) {
    const lo = +yrs[1], hi = +yrs[2];
    if (lo <= 7 && hi >= 5) exp = 95;
    else if (lo <= 8 && hi >= 4) exp = 80;
    else exp = 50;
  }
  if (/\bL4\b/.test(detail.description)) exp = Math.max(exp, 90);
  if (/(senior|principal|director)/i.test(job.title)) exp = 30;

  // Skills match
  let skills = 50;
  const skillHits = [
    /paid (media|search|social|ads)/, /meta ads|facebook ads/, /google ads|adwords/, /lifecycle/,
    /retention/, /ga4|google analytics/, /looker/, /cpa|cac|roas/, /a\/?b test/, /key account/,
    /campaign/, /performance marketing/, /seller/, /advertis/, /account management/,
  ].reduce((a, re) => a + (re.test(d) ? 1 : 0), 0);
  skills = Math.min(100, 40 + skillHits * 7);

  // Location match
  let location = 60;
  if (/(pune|bangalore|bengaluru|mumbai|remote|virtual)/.test(loc)) location = 100;

  // Domain match
  let domain = 60;
  if (/(advertis|ads|seller|ecommerce|e-commerce|marketplace|brand|marketing)/.test(d + ' ' + t)) domain = 95;

  const overall = Math.round(exp * 0.3 + skills * 0.4 + location * 0.15 + domain * 0.15);
  return { experience_match: exp, skills_match: skills, location_match: location, domain_match: domain, overall_score: overall };
}

function reason(job, detail, s) {
  const bits = [];
  if (s.skills_match >= 70) bits.push('JD overlaps paid media / account management toolkit');
  if (s.location_match === 100) bits.push(`based in ${job.location}`);
  if (/\bL4\b/.test(detail.description)) bits.push('explicit L4 band');
  if (!bits.length) bits.push('manager-level scope in Amazon India');
  return bits.join('; ');
}

function watchOuts(job, detail) {
  const d = (detail.description || '').toLowerCase();
  const out = [];
  if (/sql|python|tableau/.test(d)) out.push('asks for SQL/analytics tooling Dhruv has limited exposure to');
  if (/manage.{0,20}team|direct reports|people manager/.test(d)) out.push('expects prior direct reports');
  if (!/(pune|bangalore|bengaluru|mumbai|remote)/.test((job.location || '').toLowerCase())) out.push(`location ${job.location} outside preferred metros`);
  if (!out.length) out.push('confirm comp meets 12 LPA floor');
  return out.join('; ');
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ userAgent: UA });
  const page = await ctx.newPage();

  const all = new Map();
  for (const url of SEARCH_URLS) {
    const jobs = await scrapeSearch(page, url);
    for (const j of jobs) if (j.job_id && !all.has(j.job_id)) all.set(j.job_id, j);
    await sleep(2000);
  }
  console.log(`\nTotal unique jobs: ${all.size}\n`);

  const matches = [];
  for (const job of all.values()) {
    if (!job.url) continue;
    try {
      console.log(`Detail: ${job.title} (${job.job_id})`);
      const detail = await scrapeDetail(page, job.url);
      if (!isL4(job, detail)) { await sleep(2000); continue; }
      const s = score(job, detail);
      matches.push({
        ...job,
        ...s,
        reason: reason(job, detail, s),
        watch_outs: watchOuts(job, detail),
      });
    } catch (e) {
      console.log(`  skip ${job.job_id}: ${e.message}`);
    }
    await sleep(2000);
  }

  matches.sort((a, b) => b.overall_score - a.overall_score);

  fs.writeFileSync('amazon_l4_matches.json', JSON.stringify(matches, null, 2));

  const md = ['# Amazon India L4 Matches for Dhruv', ''];
  matches.forEach((m, i) => {
    md.push(`## ${i + 1}. ${m.title}`);
    md.push(`- Score: ${m.overall_score} of 100 (exp ${m.experience_match}, skills ${m.skills_match}, loc ${m.location_match}, domain ${m.domain_match})`);
    md.push(`- Location: ${m.location}`);
    md.push(`- Job ID: ${m.job_id}`);
    md.push(`- Link: ${m.url}`);
    md.push(`- Why it fits: ${m.reason}`);
    md.push(`- Watch outs: ${m.watch_outs}`);
    md.push('');
  });
  fs.writeFileSync('amazon_l4_matches.md', md.join('\n'));

  console.log('\n=== TOP 5 ===');
  matches.slice(0, 5).forEach((m, i) => {
    console.log(`${i + 1}. ${m.title} — ${m.overall_score}/100 — ${m.location}`);
    console.log(`   ${m.url}`);
    console.log(`   ${m.reason}`);
  });

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
