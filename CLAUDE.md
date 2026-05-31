# LYDIA CRM — MASTER BUILD PLAN
> A GoHighLevel-style CRM built for small businesses, startups, and growing teams.
> Stack: Go + Node.js + React + PostgreSQL + Redis
> Hosting: Railway (backend) + Cloudflare (frontend + CDN)
> Built by one person. Shipped in 3 months.

---

## TABLE OF CONTENTS
1. [What Lydia CRM Is](#what-lydia-crm-is)
2. [Who It's For](#who-its-for)
3. [Full Feature List](#full-feature-list)
4. [Tech Stack (Plain English)](#tech-stack-plain-english)
5. [Folder Structure (Root Tree)](#folder-structure-root-tree)
6. [Database Tables](#database-tables)
7. [How the Services Talk to Each Other](#how-the-services-talk-to-each-other)
8. [Hosting Setup](#hosting-setup)
9. [3-Month Build Timeline](#3-month-build-timeline)
10. [VS Code Prompt Guide](#vs-code-prompt-guide)
11. [CLAUDE.md (Paste Into Your Repo)](#claudemd-paste-into-your-repo)
12. [Pricing Model](#pricing-model)
13. [What Comes After Launch](#what-comes-after-launch)

---

## WHAT LYDIA CRM IS

Lydia CRM is an all-in-one sales and communication platform for small businesses
and startups. It replaces 5 separate tools with one clean dashboard.

Without Lydia, a small business owner is using:
- A spreadsheet for contacts
- Gmail for email
- A separate tool for booking
- Another tool for pipelines
- And nothing for follow-up automation

Lydia puts all of that in one place. One login. One bill.

---

## WHO IT'S FOR

- **Small business owners** — local services, consultants, coaches
- **Startups** — small sales teams that need a pipeline
- **Growing agencies** — need to manage multiple client accounts
- **Solo operators** — one person running sales + support alone

Lydia is NOT trying to compete with Salesforce or HubSpot enterprise.
It wins by being simpler, cheaper, and faster to set up.

---

## FULL FEATURE LIST

### Phase 1 — What ships at launch (Month 1–3)

#### Contacts
- [ ] Add, edit, delete contacts
- [ ] Store name, email, phone, company, source, notes
- [ ] Add custom fields (per account — e.g. "industry", "budget")
- [ ] Add tags to contacts (e.g. "hot lead", "customer")
- [ ] Smart lists — auto-filter contacts by rules (e.g. "all tagged hot lead")
- [ ] Import contacts from CSV file
- [ ] Full activity timeline per contact (every email, SMS, note, deal)

#### Pipeline / Deals
- [ ] Create multiple pipelines (e.g. "Sales", "Onboarding")
- [ ] Visual Kanban board — drag cards between stages
- [ ] Custom stages per pipeline (e.g. "New Lead → Proposal → Won")
- [ ] Assign a deal to a team member
- [ ] Set deal value and close date
- [ ] Link deals to contacts

#### Conversations Inbox (Unified)
- [ ] All emails and SMS in one inbox — no switching apps
- [ ] Two-way email (send + receive, via Resend)
- [ ] Two-way SMS (send + receive, via Twilio)
- [ ] Internal notes per conversation (only team can see)
- [ ] Assign conversations to team members
- [ ] Real-time — new messages appear without refreshing page
- [ ] Mark as open, resolved, or snoozed

#### Calendar / Appointments
- [ ] Create appointment types (e.g. "30-min call", "Demo")
- [ ] Public booking page per account (e.g. lydiacrm.com/book/yourname)
- [ ] Auto-send confirmation email/SMS on booking
- [ ] Auto-send reminder 24h before
- [ ] Connect Google Calendar — blocks taken slots
- [ ] Team member availability settings

#### Automation / Workflows
- [ ] Build simple automations — "When X happens, do Y"
- [ ] Triggers: contact created, deal moved, appointment booked, form submitted
- [ ] Actions: send email, send SMS, add tag, move deal stage, wait X days, assign to user
- [ ] Visual builder — click-and-connect blocks (no code needed)
- [ ] Delay steps — "wait 2 days then send follow-up SMS"

#### Email Marketing
- [ ] Create and send email campaigns to contact lists
- [ ] Use smart lists as audience (e.g. send to all "hot leads")
- [ ] Drag-and-drop email builder
- [ ] Variable substitution — {{contact.name}}, {{contact.company}}
- [ ] Track open rate and click rate
- [ ] Schedule emails for a specific time
- [ ] Unsubscribe link auto-included (legal requirement)
- [ ] Powered by Resend

#### Forms
- [ ] Build forms to capture leads (name, email, phone etc)
- [ ] Embed on any website (one line of code)
- [ ] Form submission → auto-creates contact in Lydia
- [ ] Form submission → can trigger automation

#### Account / Team Management
- [ ] Each customer = one "Account" (like a GHL sub-account)
- [ ] Invite team members by email
- [ ] Roles: Owner, Admin, Member (different permissions)
- [ ] Profile settings — name, timezone, avatar

#### Billing (Stripe)
- [ ] Starter plan — $49/month (1 location, 3 users, 1000 contacts)
- [ ] Pro plan — $99/month (unlimited locations, unlimited users, unlimited contacts)
- [ ] 14-day free trial (no credit card needed)
- [ ] Upgrade/downgrade from inside the app
- [ ] Cancel anytime

---

### Phase 2 — Add after first revenue (Month 4–6)
- [ ] Reputation management (auto-request Google reviews)
- [ ] Basic reporting dashboard (pipeline value, email stats, SMS usage)
- [ ] Snapshot system (save an account's setup as a template, deploy to new account)
- [ ] Website chat widget (live chat bubble on customer's website)
- [ ] Client portal (let contacts log in and see their own info)

### Phase 3 — After product-market fit (Month 7+)
- [ ] WhatsApp (Meta Cloud API — official, verified)
- [ ] AI conversation bot (replies to inbound messages automatically)
- [ ] Voice AI (handles inbound calls, books appointments)
- [ ] Mobile app (React Native wrapper)
- [ ] White-label mode (agencies sell Lydia as their own product)

---

## TECH STACK (PLAIN ENGLISH)

| What | Tool | Why |
|------|------|-----|
| Main API (all data operations) | Go (Golang) | Fast, handles many users at once, no crashes |
| Real-time messages | Node.js | Best for live updates and sending SMS/email |
| Website / Dashboard | React + Vite | Fast to build, great UI ecosystem |
| UI Components | shadcn/ui + Tailwind | Pre-built clean components, saves weeks |
| Main Database | PostgreSQL | Reliable, handles complex data, free |
| Fast Cache / Pub-Sub | Redis | Powers live inbox, job queues, sessions |
| Job Queue (email/SMS sends) | BullMQ (runs in Node) | Schedules and retries sends reliably |
| Email sending | Resend.com | Better delivery than Mailgun, simple API |
| SMS sending | Twilio | Industry standard for SMS |
| Payments | Stripe | Handles subscriptions, trials, billing |
| Frontend hosting | Cloudflare Pages | Free, fast, global CDN |
| File storage | Cloudflare R2 | 10GB free, no download fees |
| Backend hosting | Railway | Runs Go + Node + Postgres + Redis |
| API proxy (one URL) | Nginx | Frontend calls one URL, Nginx routes to Go or Node |
| Error tracking | Sentry | Tells you when something breaks in production |
| CI/CD | GitHub Actions | Auto-deploys when you push to main |

**Monthly cost at zero revenue:** ~$5–10/month (Railway Hobby plan)
**Monthly cost at 10 paying customers:** ~$15–25/month (still profitable from day 1)

---

## FOLDER STRUCTURE (ROOT TREE)

```
lydia-crm/
│
├── CLAUDE.md                          ← AI prompt rules (read this first every session)
├── README.md                          ← Project overview
├── docker-compose.yml                 ← Run everything locally with one command
├── docker-compose.prod.yml            ← Production version
├── .gitignore
├── .env.example                       ← Copy to .env and fill in secrets
│
├── nginx/
│   └── nginx.conf                     ← Routes /api → Go, /rt → Node, / → React
│
├── backend-go/                        ← The main brain. Handles all data.
│   ├── Dockerfile
│   ├── go.mod
│   ├── go.sum
│   ├── .env.example
│   │
│   ├── cmd/
│   │   └── main.go                    ← App starts here
│   │
│   └── internal/                      ← All private app code lives here
│       │
│       ├── config/
│       │   └── config.go              ← Reads environment variables
│       │
│       ├── database/
│       │   ├── db.go                  ← Connects to PostgreSQL
│       │   └── migrate.go             ← Creates/updates database tables
│       │
│       ├── middleware/
│       │   ├── auth.go                ← Checks JWT token on every request
│       │   ├── tenant.go              ← Attaches account_id to every request
│       │   ├── ratelimit.go           ← Prevents abuse
│       │   └── cors.go                ← Allows frontend to talk to API
│       │
│       ├── api/
│       │   ├── router.go              ← All URL routes defined here
│       │   │
│       │   ├── auth/
│       │   │   ├── handler.go         ← POST /auth/register, /auth/login, /auth/refresh
│       │   │   └── service.go         ← JWT creation, password hashing
│       │   │
│       │   ├── contacts/
│       │   │   ├── handler.go         ← GET/POST/PUT/DELETE /contacts
│       │   │   ├── service.go         ← Business logic
│       │   │   └── repository.go      ← Database queries for contacts
│       │   │
│       │   ├── deals/
│       │   │   ├── handler.go         ← GET/POST/PUT/DELETE /deals
│       │   │   ├── service.go
│       │   │   └── repository.go
│       │   │
│       │   ├── pipelines/
│       │   │   ├── handler.go
│       │   │   ├── service.go
│       │   │   └── repository.go
│       │   │
│       │   ├── conversations/
│       │   │   ├── handler.go         ← GET /conversations, POST /conversations/:id/messages
│       │   │   ├── service.go
│       │   │   └── repository.go
│       │   │
│       │   ├── campaigns/
│       │   │   ├── handler.go         ← Email campaigns
│       │   │   ├── service.go
│       │   │   └── repository.go
│       │   │
│       │   ├── appointments/
│       │   │   ├── handler.go
│       │   │   ├── service.go
│       │   │   └── repository.go
│       │   │
│       │   ├── automations/
│       │   │   ├── handler.go
│       │   │   ├── service.go
│       │   │   └── repository.go
│       │   │
│       │   ├── forms/
│       │   │   ├── handler.go
│       │   │   ├── service.go
│       │   │   └── repository.go
│       │   │
│       │   ├── accounts/
│       │   │   ├── handler.go         ← Account settings, team members, billing
│       │   │   ├── service.go
│       │   │   └── repository.go
│       │   │
│       │   └── webhooks/
│       │       └── handler.go         ← Receives Twilio/Stripe/Resend webhooks
│       │
│       └── models/
│           ├── account.go
│           ├── user.go
│           ├── contact.go
│           ├── deal.go
│           ├── pipeline.go
│           ├── conversation.go
│           ├── message.go
│           ├── campaign.go
│           ├── appointment.go
│           ├── automation.go
│           └── form.go
│
├── backend-node/                      ← Real-time engine. Lives messages + job queue.
│   ├── Dockerfile
│   ├── package.json
│   ├── .env.example
│   │
│   └── src/
│       ├── index.js                   ← App starts here (Express + Socket.io)
│       │
│       ├── socket/
│       │   ├── server.js              ← Socket.io setup
│       │   └── rooms.js               ← Each account = its own real-time room
│       │
│       ├── queues/
│       │   ├── email.queue.js         ← BullMQ queue for sending emails
│       │   ├── sms.queue.js           ← BullMQ queue for sending SMS
│       │   └── automation.queue.js    ← BullMQ queue for automation steps
│       │
│       ├── workers/
│       │   ├── email.worker.js        ← Picks jobs from email queue, calls Resend
│       │   ├── sms.worker.js          ← Picks jobs from SMS queue, calls Twilio
│       │   └── automation.worker.js   ← Runs automation actions
│       │
│       ├── webhooks/
│       │   ├── twilio.js              ← Receives inbound SMS from Twilio
│       │   └── resend.js              ← Receives delivery events from Resend
│       │
│       └── redis/
│           └── client.js              ← Shared Redis connection
│
├── frontend/                          ← The dashboard your customers use
│   ├── Dockerfile.dev
│   ├── Dockerfile.prod
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── .env.example
│   │
│   └── src/
│       ├── main.jsx                   ← React app starts here
│       ├── App.jsx                    ← Routes defined here
│       │
│       ├── lib/
│       │   ├── api.js                 ← Axios instance — all API calls go through here
│       │   ├── socket.js              ← Socket.io client connection
│       │   └── utils.js               ← Helper functions
│       │
│       ├── store/
│       │   ├── auth.store.js          ← Logged-in user state (Zustand)
│       │   └── ui.store.js            ← Sidebar open/close, modals (Zustand)
│       │
│       ├── hooks/
│       │   ├── useContacts.js         ← React Query hooks for contacts
│       │   ├── useDeals.js
│       │   ├── useConversations.js
│       │   └── useAccount.js
│       │
│       ├── components/                ← Reusable pieces (buttons, inputs, cards)
│       │   ├── ui/                    ← shadcn/ui components live here
│       │   ├── Layout/
│       │   │   ├── Sidebar.jsx
│       │   │   ├── Topbar.jsx
│       │   │   └── PageWrapper.jsx
│       │   ├── Contact/
│       │   │   ├── ContactCard.jsx
│       │   │   ├── ContactForm.jsx
│       │   │   └── ActivityTimeline.jsx
│       │   ├── Pipeline/
│       │   │   ├── KanbanBoard.jsx
│       │   │   ├── KanbanColumn.jsx
│       │   │   └── DealCard.jsx
│       │   ├── Inbox/
│       │   │   ├── ConversationList.jsx
│       │   │   ├── MessageThread.jsx
│       │   │   └── MessageComposer.jsx
│       │   └── Automation/
│       │       ├── WorkflowBuilder.jsx
│       │       └── WorkflowNode.jsx
│       │
│       └── pages/                     ← One file per screen
│           ├── Login.jsx
│           ├── Register.jsx
│           ├── Dashboard.jsx          ← Home screen with summary stats
│           ├── Contacts.jsx           ← Contact list + search + filters
│           ├── ContactDetail.jsx      ← Single contact with timeline
│           ├── Pipeline.jsx           ← Kanban board
│           ├── Conversations.jsx      ← Unified inbox
│           ├── Calendar.jsx           ← Appointments
│           ├── Campaigns.jsx          ← Email marketing
│           ├── Automations.jsx        ← Workflow builder
│           ├── Forms.jsx              ← Form builder
│           ├── Settings.jsx           ← Account + team + billing
│           └── Billing.jsx            ← Plan + Stripe portal
│
├── db/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql     ← Creates all tables
│   │   ├── 002_add_campaigns.sql      ← Adds campaign tables
│   │   └── 003_add_automations.sql    ← Adds automation tables
│   └── seeds/
│       └── demo_data.sql              ← Sample data for testing
│
└── docs/
    ├── api.md                         ← All API endpoints documented
    ├── setup.md                       ← How to run locally
    └── deployment.md                  ← How to deploy to Railway + Cloudflare
```

---

## DATABASE TABLES

These are the tables inside PostgreSQL. Every table has `account_id` — this makes
sure Customer A never sees Customer B's data.

```sql
-- ============================================================
-- ACCOUNTS (one per paying customer / business)
-- ============================================================
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'trial',       -- trial, starter, pro
  trial_ends_at TIMESTAMPTZ,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- USERS (people who log into Lydia)
-- ============================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',      -- owner, admin, member
  avatar_url TEXT,
  timezone TEXT DEFAULT 'UTC',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CONTACTS (the people your customers are selling to)
-- ============================================================
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  source TEXT,                              -- web, import, form, manual
  notes TEXT,
  custom_fields JSONB DEFAULT '{}',         -- flexible per-account fields
  tags TEXT[] DEFAULT '{}',                 -- array of tag strings
  assigned_to UUID REFERENCES users(id),
  is_unsubscribed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PIPELINES (a sales process, e.g. "Sales Pipeline")
-- ============================================================
CREATE TABLE pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  stages JSONB NOT NULL DEFAULT '[]',       -- [{"id":"s1","name":"New","order":1}, ...]
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DEALS (a specific opportunity in a pipeline)
-- ============================================================
CREATE TABLE deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  pipeline_id UUID NOT NULL REFERENCES pipelines(id),
  contact_id UUID NOT NULL REFERENCES contacts(id),
  assigned_to UUID REFERENCES users(id),
  name TEXT NOT NULL,
  value NUMERIC(12,2) DEFAULT 0,
  stage_id TEXT NOT NULL,                   -- matches stage id inside pipeline.stages
  probability INTEGER DEFAULT 50,
  close_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CONVERSATIONS (one thread per contact — holds all messages)
-- ============================================================
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id),
  assigned_to UUID REFERENCES users(id),
  channel TEXT NOT NULL,                    -- email, sms, note
  status TEXT NOT NULL DEFAULT 'open',      -- open, resolved, snoozed
  subject TEXT,                             -- for email threads
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MESSAGES (individual messages inside a conversation)
-- ============================================================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sent_by UUID REFERENCES users(id),        -- NULL if inbound from contact
  direction TEXT NOT NULL,                  -- inbound, outbound
  channel TEXT NOT NULL,                    -- email, sms, note
  content TEXT NOT NULL,
  status TEXT DEFAULT 'sent',              -- sent, delivered, read, failed
  external_id TEXT,                         -- Twilio SID or Resend message ID
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CAMPAIGNS (bulk email sends)
-- ============================================================
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id),
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  status TEXT DEFAULT 'draft',              -- draft, scheduled, sending, sent
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  recipient_filter JSONB DEFAULT '{}',      -- smart list filter rules
  stats JSONB DEFAULT '{"sent":0,"opens":0,"clicks":0,"unsubscribes":0}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- APPOINTMENTS
-- ============================================================
CREATE TABLE appointment_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                       -- e.g. "30-min Discovery Call"
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  description TEXT,
  assigned_to UUID REFERENCES users(id),
  slug TEXT NOT NULL,                       -- URL-safe name for booking page
  google_calendar_id TEXT,                  -- linked Google calendar
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  appointment_type_id UUID REFERENCES appointment_types(id),
  contact_id UUID REFERENCES contacts(id),
  assigned_to UUID REFERENCES users(id),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'scheduled',          -- scheduled, completed, cancelled, no_show
  notes TEXT,
  google_event_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AUTOMATIONS (workflows)
-- ============================================================
CREATE TABLE automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  trigger_type TEXT NOT NULL,               -- contact_created, deal_moved, appointment_booked, form_submitted
  trigger_config JSONB DEFAULT '{}',        -- extra filter rules for the trigger
  actions JSONB NOT NULL DEFAULT '[]',      -- ordered list of action steps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FORMS
-- ============================================================
CREATE TABLE forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  fields JSONB NOT NULL DEFAULT '[]',       -- field definitions
  settings JSONB DEFAULT '{}',              -- redirect URL, thank you message
  submission_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES — speed up every query that filters by account_id
-- ============================================================
CREATE INDEX idx_users_account         ON users(account_id);
CREATE INDEX idx_contacts_account      ON contacts(account_id);
CREATE INDEX idx_contacts_tags         ON contacts USING GIN(tags);
CREATE INDEX idx_contacts_custom       ON contacts USING GIN(custom_fields);
CREATE INDEX idx_deals_account         ON deals(account_id);
CREATE INDEX idx_deals_pipeline        ON deals(pipeline_id);
CREATE INDEX idx_conversations_account ON conversations(account_id);
CREATE INDEX idx_conversations_contact ON conversations(contact_id);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_campaigns_account     ON campaigns(account_id);
CREATE INDEX idx_appointments_account  ON appointments(account_id);
CREATE INDEX idx_automations_account   ON automations(account_id);
```

---

## HOW THE SERVICES TALK TO EACH OTHER

```
BROWSER (React)
     │
     │  one URL: https://app.lydiacrm.com
     ▼
  NGINX (router)
     │
     ├── /api/v1/*  ──────────────────► GO API (port 3001)
     │                                       │
     │                                       ├── reads/writes PostgreSQL
     │                                       ├── publishes events to Redis
     │                                       └── calls Node queue for email/SMS
     │
     ├── /rt/*  ──────────────────────► NODE SERVICE (port 3002)
     │   (real-time websocket)               │
     │                                       ├── Socket.io (live inbox updates)
     │                                       ├── BullMQ workers (email, SMS, automations)
     │                                       ├── reads Redis (subscribed to Go events)
     │                                       └── calls Resend (email) + Twilio (SMS)
     │
     └── /*  ─────────────────────────► CLOUDFLARE PAGES (React build)


INBOUND (external services calling US):
  Twilio ──► POST /webhooks/twilio ──► Node ──► saves message ──► broadcasts via Socket.io
  Resend ──► POST /webhooks/resend ──► Go  ──► updates message status
  Stripe ──► POST /webhooks/stripe ──► Go  ──► updates account plan
  Google ──► OAuth callback        ──► Go  ──► saves calendar token
```

---

## HOSTING SETUP

### Local Development (your laptop)
```bash
# One command to run everything
docker-compose up

# Services:
# React:    http://localhost:3000
# Go API:   http://localhost:3001
# Node:     http://localhost:3002
# Postgres: localhost:5432
# Redis:    localhost:6379
```

### Production (Railway + Cloudflare)

**Railway — runs 4 services:**
| Service | Cost |
|---------|------|
| Go API container | ~$2–4/month |
| Node container | ~$2–4/month |
| PostgreSQL database | included in Hobby |
| Redis | included in Hobby |
| **Total Railway** | **~$5–12/month** |

**Cloudflare — runs 2 things (both free):**
| Service | Cost |
|---------|------|
| Pages — hosts your React build | Free |
| R2 — stores uploaded files | Free (10GB) |
| CDN + SSL + DDoS protection | Free |

**Other services:**
| Service | Free tier | When you pay |
|---------|-----------|--------------|
| Resend | 3,000 emails/month free | $20/month after |
| Twilio | $15 trial credit | Pay per SMS (~$0.0079/SMS US) |
| Stripe | Free until revenue | 2.9% + 30¢ per transaction |
| Sentry | 5,000 errors/month free | $26/month after |

**Total at launch: $5–12/month**
**After 5 customers on Starter ($49/month): $245 revenue vs ~$20 costs**

---

## 3-MONTH BUILD TIMELINE

### WEEK 1–2: Fix the Foundation
These must be done before anything else. Zero new features until these are done.

```
- [ ] Replace SQLite with PostgreSQL in backend-go/internal/database/db.go
      Use: pgx/v5 driver
      Connect to: DATABASE_URL environment variable

- [ ] Replace the schema with the tables above (001_initial_schema.sql)

- [ ] Add Nginx to docker-compose.yml as the single entry point

- [ ] Build JWT auth end-to-end in Go:
      POST /api/v1/auth/register
      POST /api/v1/auth/login  (returns access token + refresh token)
      POST /api/v1/auth/refresh
      Middleware: reads JWT → extracts account_id → attaches to request context

- [ ] Protect ALL Go routes with auth middleware from day 1

- [ ] Add GitHub Actions: run go test on every push
```

### WEEK 3–4: Contacts + Pipeline
```
- [ ] Contacts CRUD (Go):
      GET  /api/v1/contacts          (list, with search and tag filter)
      POST /api/v1/contacts          (create)
      GET  /api/v1/contacts/:id      (single with activity timeline)
      PUT  /api/v1/contacts/:id      (update)
      DELETE /api/v1/contacts/:id    (delete)
      POST /api/v1/contacts/import   (CSV upload)

- [ ] Deals + Pipelines CRUD (Go)

- [ ] Frontend: Contacts list page (table with search + tag filter)
- [ ] Frontend: Contact detail page (form + activity timeline)
- [ ] Frontend: Kanban pipeline board with drag-and-drop
```

### WEEK 5–6: Conversations Inbox
```
- [ ] Conversations + Messages CRUD (Go)
- [ ] Twilio: receive inbound SMS → save as message → publish to Redis
- [ ] Resend: send outbound email → save as message
- [ ] Twilio: send outbound SMS → save as message
- [ ] Node Socket.io: subscribe to Redis → broadcast to account room
- [ ] Frontend: Unified inbox (list left, thread right)
- [ ] Frontend: Real-time — new messages appear without refresh
- [ ] Frontend: Compose email and SMS from inbox
```

### WEEK 7–8: Automation + Calendar
```
- [ ] Automation engine (Go): listen for trigger events via Redis
- [ ] BullMQ (Node): process action steps, handle wait/delay steps
- [ ] Appointment types + booking page (Go)
- [ ] Google OAuth: connect calendar, sync availability
- [ ] Auto-send confirmation + reminder via BullMQ jobs
- [ ] Frontend: Visual workflow builder
- [ ] Frontend: Calendar + booking page preview
```

### WEEK 9–10: Email Campaigns + Forms
```
- [ ] Campaigns CRUD + send (Go queues to Node worker → Resend)
- [ ] Track opens + clicks (Resend webhooks)
- [ ] Unsubscribe handling (auto-update contact.is_unsubscribed)
- [ ] Form builder (Go + Frontend)
- [ ] Form embed code generator
- [ ] Form submission → create contact → trigger automation
```

### WEEK 11–12: Billing + Production Hardening
```
- [ ] Stripe: subscription checkout, webhook handler
- [ ] Plan limits enforced in Go middleware (check plan before processing)
- [ ] 14-day trial logic (check trial_ends_at on every request)
- [ ] Rate limiting (Redis token bucket in Go middleware)
- [ ] Sentry connected to both Go and Node
- [ ] Structured logging (zerolog in Go, pino in Node)
- [ ] All environment variables documented in .env.example files
- [ ] Deploy to Railway
- [ ] Deploy frontend to Cloudflare Pages
- [ ] Custom domain: app.lydiacrm.com
- [ ] SSL verified end-to-end
- [ ] Test with 2–3 real users before opening signups
```

---

## VS CODE PROMPT GUIDE

Every time you start a new coding session in VS Code with Claude or Cursor,
paste the relevant block below at the top of your message. This keeps the AI
on-architecture and stops it from making wrong decisions.

### Paste this at the start of EVERY session:
```
Project: Lydia CRM — GoHighLevel alternative
Stack: Go (backend-go/) + Node.js (backend-node/) + React (frontend/)
Database: PostgreSQL only. Driver: pgx/v5. No SQLite ever.
Multi-tenant: Every DB query must filter by account_id from JWT context.
Auth: JWT. Access token 15 min, refresh token 7 days.
All Go routes are behind auth middleware. account_id is in the JWT payload.
Go pattern: handler → service → repository (no raw SQL outside repository files).
Error handling in Go: always use fmt.Errorf("context: %w", err). Never silent errors.
API response format: {"data": ..., "error": null, "meta": {...}}
Frontend: React + Vite + Tailwind + shadcn/ui. No inline styles.
State: React Query for server data. Zustand for UI state.
All API calls go through src/lib/api.js (Axios with JWT interceptor).
Components in src/components/. Pages in src/pages/.
```

### When working on Go database code, also add:
```
Repository rules:
- First param is always ctx context.Context
- Second param is always accountID uuid.UUID
- Never build SQL strings with string concatenation. Use $1, $2 placeholders.
- Always return typed structs, never map[string]interface{}
- Write a test for every repository function
```

### When working on the React frontend, also add:
```
Frontend rules:
- Use shadcn/ui components first before building custom ones
- Loading states: use React Query's isLoading, not manual useState
- Error states: display inline error messages, not alerts
- Forms: use react-hook-form with zod validation
- Dates: always use dayjs. Never new Date() directly in JSX.
- Keep pages thin — logic goes in hooks (src/hooks/)
```

### When working on Node.js real-time / workers, also add:
```
Node rules:
- BullMQ job names: email:send, sms:send, automation:step
- Every BullMQ job must have: accountID, data payload, retryCount
- Socket.io rooms: each account gets room named after its account_id
- Redis pub/sub channel for Go→Node events: lydia:events:{accountID}
- Workers must log success and failure with job ID and accountID
- Never store sensitive data (passwords, API keys) in job payloads — fetch from DB
```

---

## CLAUDE.md (PASTE INTO YOUR REPO)

Replace the current CLAUDE.md in the root of your repo with this:

```markdown
# LYDIA CRM — AI ASSISTANT RULES

Read this before every coding session. These rules keep the codebase consistent.

## Project
GoHighLevel-style CRM for small businesses.
Go API + Node.js real-time + React dashboard + PostgreSQL + Redis.

## The most important rule
EVERY database query must filter by account_id.
An account_id comes from the JWT token in the request context.
If a query is missing account_id, it is a critical security bug.

## Go rules
- PostgreSQL only. Driver: pgx/v5. No SQLite. No other databases.
- Pattern: handler.go calls service.go calls repository.go
- No raw SQL strings in handlers or services. Only in repository files.
- SQL placeholders: $1, $2, $3 — never string concatenation.
- All functions take ctx context.Context as first param.
- Errors: fmt.Errorf("functionName: %w", err). Never log and ignore.
- Return typed structs. Never map[string]interface{}.
- UUIDs: github.com/google/uuid package. Tables use gen_random_uuid().
- Tests required for every repository function.
- API response: {"data": ..., "error": null, "meta": {...pagination...}}

## Node.js rules
- BullMQ for all async jobs. Never setTimeout for production logic.
- Socket.io room per account_id. Never broadcast to all rooms.
- Redis pub/sub channel: lydia:events:{accountID}
- Workers: log every job start, success, and failure with job ID.
- Never put API keys or secrets in BullMQ job payloads. Fetch from env.

## React rules
- Vite + React + Tailwind + shadcn/ui. No other UI libraries.
- React Query for all server data. Zustand for UI-only state.
- All API calls go through src/lib/api.js. Never use fetch() directly.
- Forms: react-hook-form + zod. No other form libraries.
- No inline styles. No style= props. Tailwind classes only.
- Pages stay thin. Move logic to src/hooks/.

## What NOT to do (ever)
- Do not add SQLite, Prisma, or Mongoose
- Do not add Redux or MobX (we use Zustand + React Query)
- Do not write raw fetch() calls in components
- Do not store secrets in the codebase
- Do not bypass the auth middleware for any route
- Do not query the database without account_id in the WHERE clause
- Do not use string concatenation to build SQL queries

## Environment variables
backend-go:  DATABASE_URL, REDIS_URL, JWT_SECRET, RESEND_API_KEY, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, PORT
backend-node: REDIS_URL, DATABASE_URL, RESEND_API_KEY, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, PORT
frontend: VITE_API_URL, VITE_SOCKET_URL
```

---

## PRICING MODEL

Keep it dead simple. Two plans. Free trial. No hidden costs.

| | Trial | Starter | Pro |
|--|-------|---------|-----|
| Price | Free 14 days | $49/month | $99/month |
| Users | 3 | 3 | Unlimited |
| Contacts | 500 | 2,000 | Unlimited |
| Emails/month | 500 | 5,000 | 25,000 |
| SMS/month | 50 | 500 | 2,500 |
| Pipelines | 1 | 3 | Unlimited |
| Automations | 1 | 5 | Unlimited |
| Support | Email | Email | Priority |

**Revenue math:**
- 10 Starter customers = $490/month. Costs: ~$20. Profit: $470.
- 10 Pro customers = $990/month. Costs: ~$40. Profit: $950.
- 50 mixed customers = ~$3,500/month. You've got a real business.

**First customer target: Month 3.**
Offer 3 months free in exchange for feedback + a testimonial.
Use that testimonial to close the next 5 paying customers.

---

## WHAT COMES AFTER LAUNCH

Once you have revenue, in this order:

1. **Analytics dashboard** — pipeline value, email stats, conversion rates
2. **Snapshot system** — save one account's setup, clone it to a new account in one click (huge for agencies)
3. **Client portal** — let contacts log in and see their own info / appointments
4. **Reputation management** — auto-send Google review requests after appointments
5. **WhatsApp (Meta Cloud API)** — official only, no unofficial libraries. Add when you have a verified Meta Business account.
6. **AI conversation bot** — auto-replies to inbound emails/SMS using OpenAI
7. **White-label mode** — agencies rebrand Lydia as their own product. This is where serious revenue is.
8. **Mobile app** — React Native or Capacitor wrapper around the existing React app

---

*Lydia CRM — built lean, shipped fast, sold to real businesses.*
*Version 1.0 | May 2026*