# Job Auto-Apply Bot

Automatically applies to **Marketing Communication & Account Manager** jobs on **Indeed** and **LinkedIn** using Playwright (headless Chrome).

## Setup

### 1. Install dependencies
```bash
cd job-apply
npm install
npx playwright install chromium
```

### 2. Configure credentials
```bash
cp .env.example .env
# Edit .env with your login credentials and resume path
```

### 3. Run

**Dry run first (recommended — no real applications submitted):**
```bash
npm run apply:dry
```

**Live run:**
```bash
npm run apply
```

## Configuration (`.env`)

| Variable | Description |
|---|---|
| `INDEED_EMAIL` / `INDEED_PASSWORD` | Your Indeed login |
| `LINKEDIN_EMAIL` / `LINKEDIN_PASSWORD` | Your LinkedIn login |
| `JOB_TITLE` | Job title to search for |
| `LOCATIONS` | Comma-separated: `Remote,Pune,Mumbai,Bengaluru` |
| `RESUME_PATH` | Absolute path to your PDF resume |
| `MAX_APPLICATIONS_PER_RUN` | Max applications per run (default: 20) |
| `HEADLESS` | Set to `false` to watch the browser (default: `true`) |

## Notes
- Only applies to **Easy Apply** / **Indeed Apply** jobs
- Logs all activity to `applications.log`
- Set `HEADLESS=false` in `.env` to watch the browser fill forms in real time
