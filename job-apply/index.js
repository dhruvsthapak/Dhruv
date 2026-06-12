const { chromium } = require('playwright');
const config = require('./config');
const logger = require('./logger');
const { loginIndeed, searchAndApplyIndeed } = require('./indeed');
const { loginLinkedIn, searchAndApplyLinkedIn } = require('./linkedin');

const dryRun = process.argv.includes('--dry-run');

(async () => {
  if (dryRun) logger.info('=== DRY RUN MODE — no real applications will be submitted ===');

  // Validate credentials
  if (!config.indeed.email || !config.linkedin.email) {
    logger.error('Missing credentials. Please copy .env.example to .env and fill in your details.');
    process.exit(1);
  }

  const browser = await chromium.launch({
    headless: config.headless,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  });

  let totalApplied = 0;

  try {
    // --- Indeed ---
    const indeedPage = await context.newPage();
    await loginIndeed(indeedPage, config);
    const indeedCount = await searchAndApplyIndeed(indeedPage, config, dryRun);
    totalApplied += indeedCount;
    await indeedPage.close();

    // --- LinkedIn ---
    const linkedinPage = await context.newPage();
    await loginLinkedIn(linkedinPage, config);
    const linkedinCount = await searchAndApplyLinkedIn(linkedinPage, config, dryRun);
    totalApplied += linkedinCount;
    await linkedinPage.close();

  } catch (err) {
    logger.error(`Fatal error: ${err.message}`);
  } finally {
    await browser.close();
    logger.info(`=== Done! Total applications submitted: ${totalApplied} ===`);
  }
})();
