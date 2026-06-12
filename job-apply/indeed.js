const logger = require('./logger');

async function loginIndeed(page, config) {
  logger.info('Logging into Indeed...');
  await page.goto('https://secure.indeed.com/auth');
  await page.fill('input[name="__email"]', config.indeed.email);
  await page.click('button[type="submit"]');
  await page.waitForSelector('input[name="__password"]', { timeout: 10000 });
  await page.fill('input[name="__password"]', config.indeed.password);
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 });
  logger.info('Logged into Indeed successfully.');
}

async function searchAndApplyIndeed(page, config, dryRun = false) {
  let totalApplied = 0;

  for (const location of config.search.locations) {
    if (totalApplied >= config.maxApplications) break;

    const query = encodeURIComponent(config.search.jobTitle);
    const loc = encodeURIComponent(location === 'Remote' ? 'remote' : location);
    const url = `https://www.indeed.com/jobs?q=${query}&l=${loc}&fromage=7&sort=date`;

    logger.info(`Searching Indeed: "${config.search.jobTitle}" in "${location}"`);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const jobCards = await page.$$('a.jcs-JobTitle');
    logger.info(`Found ${jobCards.length} jobs on Indeed for location: ${location}`);

    for (const card of jobCards) {
      if (totalApplied >= config.maxApplications) break;

      try {
        const title = await card.innerText();
        await card.click();
        await page.waitForTimeout(2000);

        // Check for Indeed Easy Apply button
        const applyBtn = await page.$('button[id="indeedApplyButton"], button.ia-IndeedApplyButton');
        if (!applyBtn) {
          logger.info(`Skipping (no Easy Apply): ${title}`);
          continue;
        }

        if (dryRun) {
          logger.info(`[DRY RUN] Would apply to: ${title} @ ${location}`);
          totalApplied++;
          continue;
        }

        await applyBtn.click();
        await page.waitForTimeout(3000);

        // Handle multi-step Indeed apply modal
        await handleIndeedApplyModal(page, config);

        logger.success(`Applied to: ${title} @ ${location}`);
        totalApplied++;
        await page.waitForTimeout(2000);

      } catch (err) {
        logger.error(`Error applying on Indeed: ${err.message}`);
      }
    }
  }

  logger.info(`Indeed: Total applications submitted = ${totalApplied}`);
  return totalApplied;
}

async function handleIndeedApplyModal(page, config) {
  // Step through the Indeed apply modal (up to 10 steps)
  for (let step = 0; step < 10; step++) {
    await page.waitForTimeout(1500);

    // Upload resume if prompted
    const resumeInput = await page.$('input[type="file"]');
    if (resumeInput && config.resumePath) {
      await resumeInput.setInputFiles(config.resumePath);
      await page.waitForTimeout(1500);
    }

    // Click Continue / Next / Submit
    const continueBtn = await page.$('button[aria-label="Continue"], button:has-text("Continue"), button:has-text("Next"), button:has-text("Submit your application")');
    if (!continueBtn) break;

    const btnText = await continueBtn.innerText();
    await continueBtn.click();
    await page.waitForTimeout(1500);

    if (btnText.toLowerCase().includes('submit')) break;
  }
}

module.exports = { loginIndeed, searchAndApplyIndeed };
