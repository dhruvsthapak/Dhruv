require('dotenv').config();

module.exports = {
  indeed: {
    email: process.env.INDEED_EMAIL,
    password: process.env.INDEED_PASSWORD,
  },
  linkedin: {
    email: process.env.LINKEDIN_EMAIL,
    password: process.env.LINKEDIN_PASSWORD,
  },
  search: {
    jobTitle: process.env.JOB_TITLE || 'Marketing Communication Account Manager',
    locations: (process.env.LOCATIONS || 'Remote,Pune,Mumbai,Bengaluru').split(',').map(l => l.trim()),
    experienceYears: parseInt(process.env.EXPERIENCE_YEARS || '7'),
  },
  resumePath: process.env.RESUME_PATH,
  maxApplications: parseInt(process.env.MAX_APPLICATIONS_PER_RUN || '20'),
  headless: process.env.HEADLESS !== 'false',
};
