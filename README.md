# TaskPulse AI - Production Architecture

🚀 **AI-powered Slack bot for ClickUp task management**

## Overview

TaskPulse AI is a multi-tenant SaaS platform that integrates Slack workspaces with ClickUp to provide intelligent task management through AI-powered workflows. Built with Node.js, TypeScript, MongoDB, Redis, and Sim AI.

## Features

### 🤖 AI-Powered Workflows
- **Task Assignment Notifications**: Smart notifications with AI formatting
- **Daily Digest**: Personalized morning summaries of all tasks
- **Comment Summarization**: AI summaries of task discussions
- **Focus Mode**: Top 3 priority task recommendations
- **Task Explainer**: Detailed task breakdowns for developers

### 🏢 Multi-Tenant Architecture
- Separate Slack workspace support
- Isolated ClickUp team connections
- Tenant-specific user mappings
- Usage-based billing and limits

### 🔧 Core Integrations
- **Slack**: Bot commands, DMs, and channel notifications
- **ClickUp**: Task management, webhooks, and API integration
- **Sim AI**: Workflow automation and content generation

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    MULTI-TENANT TASKPULSE AI ARCHITECTURE                       │
└─────────────────────────────────────────────────────────────────────────────────┘
     Tenant A                    Tenant B                    Tenant C
  ┌───────────────┐          ┌───────────────┐          ┌───────────────┐
  │ Slack Team A  │          │ Slack Team B  │          │ Slack Team C  │
  │ ClickUp Ws A  │          │ ClickUp Ws B  │          │ ClickUp Ws C  │
  └───────┬───────┘          └───────┬───────┘          └───────┬───────┘
          │                          │                          │
          └──────────────────────────┼──────────────────────────┘
                                     ▼
                    ┌────────────────────────────────┐
                    │        API GATEWAY             │
                    │   (Tenant ID Resolution)       │
                    └───────────────┬────────────────┘
                                    │
                    ┌───────────────┴────────────────┐
                    │      SIM AI WORKFLOWS          │
                    │  (Receive tenant context)      │
                    └───────────────┬────────────────┘
                                    │
                    ┌───────────────┴────────────────┐
                    │        MONGODB                 │
                    │  (Tenant-Isolated Data)        │
                    └────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 20+
- MongoDB 7.0+
- Redis 7.0+
- Slack App credentials
- ClickUp API credentials
- Sim AI API key

### Installation

1. **Clone and install dependencies**
   ```bash
   git clone <repository-url>
   cd taskpulse-ai
   npm install
   ```

2. **Environment setup**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Start with Docker (Recommended)**
   ```bash
   docker-compose up -d
   ```

4. **Or start locally**
   ```bash
   # Start MongoDB and Redis
   mongod
   redis-server
   
   # Start the application
   npm run dev
   ```

### Environment Variables

```bash
# Server
NODE_ENV=production
PORT=3000
API_URL=https://api.taskpulse.ai

# Database
MONGODB_URI=mongodb://localhost:27017/taskpulse
REDIS_URL=redis://localhost:6379

# Slack App
SLACK_CLIENT_ID=your_slack_client_id
SLACK_CLIENT_SECRET=your_slack_client_secret
SLACK_SIGNING_SECRET=your_slack_signing_secret

# ClickUp API
CLICKUP_CLIENT_ID=your_clickup_client_id
CLICKUP_CLIENT_SECRET=your_clickup_client_secret
CLICKUP_API_TOKEN=your_clickup_api_token

# Sim AI
SIM_API_KEY=your_sim_api_key
SIM_WORKSPACE_ID=your_workspace_id

# Security
JWT_SECRET=your_jwt_secret_min_32_chars
ENCRYPTION_KEY=your_32_byte_encryption_key
```

## Development

### Project Structure

```
taskpulse-ai/
├── src/
│   ├── api/                 # API routes and controllers
│   ├── config/              # Database and Redis configuration
│   ├── models/              # MongoDB models (Tenant, User, TaskCache)
│   ├── services/            # Business logic (Slack, ClickUp, Sim AI)
│   │   ├── queue/           # Job processing with BullMQ
│   │   └── processors/      # Queue job processors
│   ├── utils/               # Utilities (logger, encryption)
│   └── app.ts               # Express app setup
├── workers/                 # Background workers
├── docker-compose.yml       # Docker configuration
├── Dockerfile              # Container build
└── package.json            # Dependencies
```

### Running Tests

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Coverage
npm run test:coverage
```

### Code Quality

```bash
# Linting
npm run lint

# Type checking
npm run type-check

# Format code
npm run format
```

## Deployment

### Docker Production

```bash
# Build and deploy
docker-compose -f docker-compose.yml --profile production up -d

# Scale workers
docker-compose up -d --scale worker=3
```

### Manual Deployment

```bash
# Build application
npm run build

# Start production server
npm start

# Start workers
npm run worker:digest
npm run worker:sync
```

### Environment-Specific Configs

- **Development**: `npm run dev`
- **Staging**: `npm run build && npm start`
- **Production**: Docker with multi-stage builds

## API Documentation

### Webhook Endpoints

- `POST /webhooks/clickup` - ClickUp event handling
- `POST /webhooks/clickup/register` - Register ClickUp webhooks
- `DELETE /webhooks/clickup/:webhookId` - Delete webhooks

### Slack Endpoints

- `POST /slack/events` - Slack Events API
- `POST /slack/commands/focus` - Focus mode command
- `POST /slack/commands/task` - Task explainer command
- `POST /slack/interactive` - Interactive components

### Admin API

- `GET /api/admin/tenant` - Get tenant information
- `PUT /api/admin/tenant` - Update tenant settings
- `GET /api/admin/integrations` - Integration status
- `GET /api/admin/users/mapping` - User mappings

## Monitoring & Logging

### Health Checks

- `GET /health` - Application health status
- Docker health checks for all services
- Database connectivity checks

### Logging

- Winston structured logging
- Log levels: error, warn, info, debug
- Separate logs for different components
- Production log rotation

### Metrics (Optional)

- Prometheus metrics collection
- Grafana dashboards
- Queue performance metrics
- API response times

## Security

### Authentication & Authorization

- JWT tokens for API access
- OAuth flows for Slack and ClickUp
- Role-based permissions (owner, admin, member, viewer)
- Tenant data isolation

### Data Protection

- Encryption at rest for sensitive data
- Encrypted OAuth tokens
- Rate limiting per tenant
- Webhook signature verification

### Compliance

- GDPR data handling
- Data retention policies
- User data export/deletion
- Audit logging

## Scaling

### Horizontal Scaling

```yaml
# docker-compose.yml
services:
  worker:
    deploy:
      replicas: 3
```

### Database Scaling

- MongoDB replica sets
- Redis clustering
- Connection pooling
- Read replicas

### Queue Scaling

- BullMQ job priorities
- Worker concurrency controls
- Queue partitioning by tenant
- Dead letter queues

## Troubleshooting

### Common Issues

1. **MongoDB Connection Failed**
   - Check connection string
   - Verify network connectivity
   - Check authentication

2. **Redis Connection Issues**
   - Verify Redis is running
   - Check connection URL
   - Monitor memory usage

3. **Slack Bot Not Responding**
   - Verify bot token
   - Check webhook URLs
   - Review bot permissions

4. **ClickUp API Errors**
   - Refresh expired tokens
   - Check rate limits
   - Verify workspace access

### Debug Mode

```bash
# Enable debug logging
LOG_LEVEL=debug npm run dev

# Monitor queues
npm run queue:monitor

# Database queries
DEBUG=mongodb npm run dev
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

### Development Guidelines

- Follow TypeScript best practices
- Write comprehensive tests
- Update documentation
- Use semantic versioning
- Follow conventional commits

## Support

- 📧 Email: support@taskpulse.ai
- 💬 Slack: [Join our community]
- 📖 Docs: [Documentation site]
- 🐛 Issues: [GitHub Issues]

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Built with ❤️ by the TaskPulse AI team**
