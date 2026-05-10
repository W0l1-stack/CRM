# CRM Platform - Project Documentation

## Overview
Production-ready GoHighLevel-like CRM platform built with Go, Node.js, React, and PostgreSQL.

## Tech Stack
- **Backend**: Go (core API) + Node.js (real-time)
- **Frontend**: React
- **Database**: PostgreSQL
- **Cache/Pub-Sub**: Redis
- **Deployment**: Docker/Docker Compose

## Features (Phase 1 - MVP)
- ✅ Contact management
- ✅ Sales pipeline (deals)
- ✅ Messaging infrastructure
- ✅ Real-time updates via WebSocket
- 🔄 JWT authentication (basic)

## Architecture
Monorepo with three independent services:
- `backend-go/` - REST API for CRUD operations
- `backend-node/` - Real-time messaging + webhooks
- `frontend/` - React dashboard
- `docker-compose.yml` - Orchestrates all services

## Getting Started

### Quick Start
```bash
docker-compose up -d
# Visit http://localhost:3000 (use demo login)
```

### Manual Setup
```bash
# Terminal 1: Go API
cd backend-go && go run cmd/main.go

# Terminal 2: Node API
cd backend-node && npm install && npm run dev

# Terminal 3: React
cd frontend && npm install && npm start
```

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_URL` - Redis connection
- `JWT_SECRET` - Secret for token signing
- `PORT` - Service port

See `.env.example` files in each service.

## Key Files
- `docker-compose.yml` - Development environment
- `backend-go/internal/database/db.go` - DB schema
- `backend-go/internal/api/` - HTTP handlers
- `backend-node/src/routes/` - Real-time routes
- `frontend/src/pages/` - React components

## Next Steps
1. Implement proper authentication (OAuth2)
2. Add email/SMS integrations
3. Build analytics dashboard
4. Create automation workflows
5. Add mobile app

See `docs/development.md` for full development guide.
