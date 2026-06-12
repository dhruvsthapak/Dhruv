const logger = require('./logger');

async function loginLinkedIn(page, config) {
  logger.info('Logging into LinkedIn...');
  await page.goto('https://www.linkedin.com/login');
  await page.fill('#username', config.linkedin.email);
  await page.fill('#password', config.linkedin.password);
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 });
  logger.info('Logged into LinkedIn successfully.');
}

async function searchAndApplyLinkedIn(page, config, dryRun = false) {
  let totalApplied = 0;

  for (const location of config.search.locations) {
    if (totalApplied >= config.maxApplications) break;

    const query = encodeURIComponent(config.search.jobTitle);
    const loc = encodeURIComponent(location);
    // f_AL=true filters for Easy Apply only
    const url = `https://www.linkedin.com/jobs/search/?keywords=${query}&location=${loc}&f_AL=true&sortBy=DD`;

    logger.info(`Searching LinkedIn: "${config.search.jobTitle}" in "${location}"`);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const jobCards = await page.$$('.job-card-container');
    logger.info(`Found ${jobCards.length} jobs on LinkedIn for location: ${location}`);

    for (const card of jobCards) {
      if (totalApplied >= config.maxApplications) break;

      try {
        await card.click();
        await page.waitForTimeout(2000);

        const title = await page.$eval('.job-details-jobs-unified-top-card__job-title', el => el.innerText).catch(() => 'Unknown');

        const easyApplyBtn = await page.$('button.jobs-apply-button:has-text("Easy Apply")');
        if (!easyApplyBtn) {
          logger.info(`Skipping (no Easy Apply): ${title}`);
          continue;
        }

        if (dryRun) {
          logger.info(`[DRY RUN] Would apply to: ${title} @ ${location}`);
          totalApplied++;
          continue;
        }

        await easyApplyBtn.click();
        await page.waitForTimeout(2000);

        await handleLinkedInEasyApply(page, config);

        logger.success(`Applied to: ${title} @ ${location}`);
        totalApplied++;
        await page.waitForTimeout(2000);

      } catch (err) {
        logger.error(`Error applying on LinkedIn: ${err.message}`);
      }
    }
  }

  logger.info(`LinkedIn: Total applications submitted = ${totalApplied}`);
  return totalApplied;
}

async function handleLinkedInEasyApply(page, config) {
  // Step through LinkedIn Easy Apply modal (up to 10 steps)
  for (let step = 0; step < 10; step++) {
    await page.waitForTimeout(1500);

    // Upload resume if prompted
    const uploadBtn = await page.$('label[aria-label*="resume"], input[name="file"]');
    if (uploadBtn && config.resumePath) {
      const fileInput = await page.$('input[type="file"]');
      if (fileInput) {
        await fileInput.setInputFiles(config.resumePath);
        await page.waitForTimeout(1500);
      }
    }

    // Fill phone number if empty
    const phoneInput = await page.$('input[id*="phoneNumber"]');
    if (phoneInput) {
      const val = await phoneInput.inputValue();
      if (!val) await phoneInput.fill('0000000000');
    }

    // Click Next / Review / Submit
    const nextBtn = await page.$('button[aria-label="Continue to next step"], button[aria-label="Review your application"], button[aria-label="Submit application"]');
    if (!nextBtn) break;

    const label = await nextBtn.getAttribute('aria-label');
    await nextBtn.click();
    await page.waitForTimeout(1500);

    if (label && label.toLowerCase().includes('submit')) break;
  }

  // Close the modal if it's still open
  const closeBtn = await page.$('button[aria-label="Dismiss"]');
  if (closeBtn) await closeBtn.click();
}

module.exports = { loginLinkedIn, searchAndApplyLinkedIn };
