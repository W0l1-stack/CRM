# CRM Platform - GoHighLevel Alternative

A scalable, open-source CRM platform built with Go, Node.js, React, and PostgreSQL.

## Features
- **Contact Management** - Store and organize customer data
- **Sales Pipeline** - Track deals through stages
- **Messaging** - Email, SMS, and in-app communication
- **Data Analysis** - Reporting and insights
- **Real-time Updates** - WebSocket support
- **Automation** - Workflow triggers and actions

## Architecture

### Microservices
- **backend-go**: Core API (contacts, pipeline, deals)
- **backend-node**: Real-time messaging, webhooks, integrations
- **frontend**: React dashboard
- **PostgreSQL**: Main database
- **Redis**: Real-time communication & caching

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Go 1.21+
- Node.js 18+
- npm/yarn

### Setup

```bash
# Start all services
docker-compose up -d

# Backend services will be available at:
# - Go API: http://localhost:3001
# - Node API: http://localhost:3002
# - Frontend: http://localhost:3000
# - PostgreSQL: localhost:5432
# - Redis: localhost:6379
```

## Project Structure

```
CRM/
├── backend-go/          # Go microservice
│   ├── cmd/
│   ├── internal/
│   ├── pkg/
│   └── go.mod
├── backend-node/        # Node.js microservice
│   ├── src/
│   ├── package.json
│   └── .env
├── frontend/            # React app
│   ├── src/
│   ├── package.json
│   └── .env
├── db-schema/           # Database migrations
├── docker/              # Docker configs
├── docs/                # Documentation
└── docker-compose.yml   # Development stack
```

## Development

Each service can be developed independently:

```bash
# Terminal 1: Go backend
cd backend-go && go run cmd/main.go

# Terminal 2: Node backend
cd backend-node && npm run dev

# Terminal 3: React frontend
cd frontend && npm start
```

## Environment Variables

Create `.env` files in each service directory (see `.env.example` files).

## Database

PostgreSQL migrations are in `db-schema/`. Run on startup:

```bash
docker exec crm-postgres psql -U crm_user -d crm_db -f /migrations/init.sql
```

## Authentication

JWT-based authentication with refresh tokens. Scale to OAuth2 later.

## Deployment

See `docs/deployment.md` for Docker, Docker Swarm, and Kubernetes guides.

## License

MIT
