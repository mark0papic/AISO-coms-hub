# AISO Comms Hub

Automation that generates channel-specific communication drafts from a Notion database using Claude AI.

When a Notion page's Status is set to **"Ready for Comms"**, this automation:
1. Reads the page's brief and metadata
2. Generates drafts for 8 channels (WhatsApp, Email, LinkedIn, Instagram, Luma, Ambassador, Internal Brief)
3. Writes the drafts back into the page's properties
4. Sets Status to **"Generated"**

No content is auto-posted. This generates drafts only.

---

## Setup

### 1. Create a Notion Integration

1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Click **"New integration"**
3. Name it (e.g. "AISO Comms Hub")
4. Select the workspace containing your database
5. Under **Capabilities**, ensure it has:
   - Read content
   - Update content
   - Read user information (optional)
6. Copy the **Internal Integration Secret** (starts with `secret_`)

### 2. Share Database with Integration

1. Open your "AISO Comms Hub" database in Notion
2. Click the **"..."** menu in the top right
3. Click **"Connections"** > **"Connect to"** > select your integration
4. Do the same for your **Brand Voice Reference** page

### 3. Get IDs

**Database ID:** Open the database as a full page. The URL looks like:
```
https://www.notion.so/your-workspace/abc123def456...?v=...
```
The database ID is the long hex string before `?v=`. Format it as a UUID: `abc123de-f456-...`

**Brand Voice Page ID:** Open the brand voice page. Same URL pattern — the hex string is the page ID.

### 4. Configure Environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

```env
NOTION_API_KEY=secret_your_key_here
NOTION_DATABASE_ID=your-database-uuid
NOTION_BRAND_VOICE_PAGE_ID=your-page-uuid
ANTHROPIC_API_KEY=sk-ant-your_key_here
```

### 5. Install Dependencies

```bash
npm install
```

---

## Usage

### Run Once (Testing)

```bash
npm run once
```

Processes all pages with Status "Ready for Comms" and exits.

### Run with Polling (Local Development)

```bash
npm run start
```

Polls every 60 seconds (configurable via `POLL_INTERVAL_MS` in `.env`). Useful for development. Press Ctrl+C to stop.

---

## Notion Database Schema

### Required Input Properties

| Property | Type | Description |
|---|---|---|
| Title | title | Name of the communication item |
| Status | status | Values: Draft, Ready for Comms, Generated, Sent, Archived |
| Type | select | e.g. Event, Campaign, Update |
| Pillar | select | e.g. Wellbeing, Career, Social |
| Primary Audience | multi_select | Target audience segments |
| Core Brief | rich_text | The main brief/description |

### Optional Input Properties

| Property | Type |
|---|---|
| Event Date | date |
| Event Time | rich_text |
| Location | rich_text |
| Deadline | date |
| Signup Link | url |
| Partners or Speakers | rich_text |
| Selectivity Level | select |
| Incentives | rich_text |

### Output Properties (created by you, populated by automation)

| Property | Type |
|---|---|
| WhatsApp Message | rich_text |
| Member Email Subject | rich_text |
| Member Email Body | rich_text |
| LinkedIn Post | rich_text |
| Instagram Caption | rich_text |
| Luma Description | rich_text |
| Ambassador Message | rich_text |
| Internal AISO Brief | rich_text |

### Meta Properties

| Property | Type |
|---|---|
| Last Generated At | date |
| Generation Version | rich_text |

---

## Deploy with GitHub Actions

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/your-org/aiso-comms-hub.git
git push -u origin main
```

### 2. Set Repository Secrets

Go to your repo > **Settings** > **Secrets and variables** > **Actions** > **New repository secret**:

- `NOTION_API_KEY`
- `NOTION_DATABASE_ID`
- `NOTION_BRAND_VOICE_PAGE_ID`
- `ANTHROPIC_API_KEY`

### 3. Cron Schedule

The workflow at `.github/workflows/cron.yml` runs every 15 minutes during working hours (9am-10pm UTC, Mon-Fri).

You can also trigger it manually from the **Actions** tab using the "Run workflow" button.

---

## Architecture

### Status Transitions

```
Draft --> Ready for Comms --> Generated --> Sent --> Archived
              ^                   |
              |                   |
              +--- (manual) ------+  (if re-generation needed)
```

The automation only handles the **Ready for Comms -> Generated** transition.

### Idempotency

- **Query filter:** Only pages with `Status == "Ready for Comms"` are fetched.
- **Atomic writes:** All 8 drafts, the status change, and metadata are written in a single Notion API call. If the write fails, nothing changes.
- **Recency guard:** Pages generated within the last 5 minutes are skipped even if re-queried.
- **Failure isolation:** If generation fails for one page, other pages still get processed. Failed pages remain at "Ready for Comms" for the next run.

### Rate Limiting

- Proactive: Token-bucket throttle at 2.5 requests/second (Notion allows 3/s).
- Reactive: Exponential backoff with Retry-After header support on HTTP 429/5xx.

### Brand Voice

The automation reads the "AISO Brand Voice Reference" Notion page content and injects it into the LLM prompt. It's cached in memory for 5 minutes per run.

---

## Configuration

| Env Variable | Required | Default | Description |
|---|---|---|---|
| `NOTION_API_KEY` | Yes | - | Notion integration secret |
| `NOTION_DATABASE_ID` | Yes | - | Database UUID |
| `NOTION_BRAND_VOICE_PAGE_ID` | Yes | - | Brand voice page UUID |
| `ANTHROPIC_API_KEY` | Yes | - | Anthropic API key |
| `CLAUDE_MODEL` | No | `claude-sonnet-4-20250514` | Claude model to use |
| `MAX_PAGES_PER_RUN` | No | `10` | Max pages processed per run |
