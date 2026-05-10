# Development Guide

## Architecture Overview

This is a microservices CRM platform with:
- **Go Backend**: Core API for contacts, deals, and data management
- **Node.js Backend**: Real-time messaging, webhooks, and integrations
- **React Frontend**: Modern dashboard UI
- **PostgreSQL**: Main relational database
- **Redis**: Caching and real-time pub/sub

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Or: Go 1.21+, Node.js 18+, PostgreSQL 16+, Redis 7+

### Option 1: Docker Compose (Recommended)

```bash
cd CRM
docker-compose up -d
```

Services:
- Frontend: http://localhost:3000
- Go API: http://localhost:3001
- Node API: http://localhost:3002
- PostgreSQL: localhost:5432
- Redis: localhost:6379

### Option 2: Local Development

**Terminal 1 - Go Backend:**
```bash
cd backend-go
export DATABASE_URL=postgres://crm_user:crm_password_dev@localhost:5432/crm_db
export PORT=3001
export JWT_SECRET=dev_secret
go mod download
go run cmd/main.go
```

**Terminal 2 - Node Backend:**
```bash
cd backend-node
npm install
export DATABASE_URL=postgres://crm_user:crm_password_dev@localhost:5432/crm_db
export PORT=3002
npm run dev
```

**Terminal 3 - React Frontend:**
```bash
cd frontend
npm install
npm start
```

## Database Setup

If not using Docker, create the database manually:

```sql
createdb -U crm_user crm_db

-- Connect to crm_db and run the schema in backend-go/internal/database/db.go
```

## API Endpoints

### Go API (Port 3001)

**Contacts:**
- `GET /api/contacts` - List all contacts
- `POST /api/contacts` - Create contact
- `GET /api/contacts/{id}` - Get contact
- `PUT /api/contacts/{id}` - Update contact
- `DELETE /api/contacts/{id}` - Delete contact

**Deals:**
- `GET /api/deals` - List all deals
- `POST /api/deals` - Create deal
- `GET /api/deals/{id}` - Get deal
- `PUT /api/deals/{id}` - Update deal

### Node API (Port 3002)

**Messages:**
- `POST /api/messages` - Send message
- `GET /api/messages/contact/{contact_id}` - Get contact messages

**Webhooks:**
- `POST /api/webhooks` - Create webhook
- `GET /api/webhooks` - List webhooks

### WebSocket

Connect to `ws://localhost:3002/ws` with header `X-User-ID`

## Authentication

Currently uses JWT with a shared secret. In production:
1. Implement OAuth2/OIDC
2. Add proper token refresh flows
3. Use secure key management

User ID is passed via `X-User-ID` header (temporary).

## Project Structure

```
CRM/
├── backend-go/              # Go microservice
│   ├── cmd/main.go
│   ├── internal/
│   │   ├── api/            # HTTP handlers
│   │   ├── database/       # DB connection & migrations
│   │   └── middleware/     # CORS, logging, auth
│   └── go.mod
│
├── backend-node/            # Node.js microservice
│   ├── src/
│   │   ├── index.js        # Express server + WebSocket
│   │   ├── database.js     # PostgreSQL connection
│   │   └── routes/         # API routes
│   └── package.json
│
├── frontend/                # React app
│   ├── src/
│   │   ├── App.js          # Main component
│   │   ├── pages/          # Page components
│   │   └── index.css       # Styling
│   └── package.json
│
├── docker-compose.yml       # Development stack
└── README.md
```

## Development Workflow

1. **Create a feature branch:**
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Make changes across services as needed**

3. **Test locally:**
   - Manual testing via UI (http://localhost:3000)
   - API testing via curl or Postman

4. **Commit with clear messages:**
   ```bash
   git commit -m "feat: add contact filtering"
   ```

5. **Push and create PR:**
   ```bash
   git push origin feature/my-feature
   ```

## Scaling Considerations

### Horizontal Scaling
- **Go API**: Stateless, add load balancer in front
- **Node API**: Use horizontal scaling for WebSocket (requires Redis pub/sub)
- **React**: Serve via CDN or reverse proxy

### Database
- Use connection pooling (already in code)
- Add read replicas for analytics queries
- Partition large tables by user/region
- Add appropriate indexes

### Caching
- Redis for session/cache layer
- Implement cache invalidation
- Use cache-aside pattern

### Real-time
- Redis pub/sub for cross-service messaging
- WebSocket with automatic reconnection
- Message queues for async operations

## Deployment

See `deployment.md` for Docker, Swarm, and K8s guides.

## Troubleshooting

### Services won't start
```bash
# Check logs
docker-compose logs backend-go
docker-compose logs backend-node
docker-compose logs frontend

# Reset (WARNING: loses data)
docker-compose down -v
docker-compose up -d
```

### Database connection errors
- Check `DATABASE_URL` is correct
- Verify PostgreSQL is running
- Check credentials match

### Frontend can't reach API
- Verify CORS headers in Go backend
- Check API URLs in .env files
- Ensure APIs are running and accessible

### WebSocket connection refused
- Check Node.js server is running
- Verify URL is `ws://` not `http://`
- Check X-User-ID header is sent

## Next Steps

1. **Authentication**: Replace X-User-ID header with proper JWT
2. **Email Integration**: Add SendGrid or similar
3. **SMS Integration**: Add Twilio or similar
4. **Analytics**: Build reporting dashboard
5. **Automation**: Add workflow engine
6. **Mobile App**: React Native version
7. **CI/CD**: GitHub Actions or GitLab CI
8. **Monitoring**: Prometheus/Grafana
