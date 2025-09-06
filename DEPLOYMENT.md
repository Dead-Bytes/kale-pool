# KALE Pool Mining - Deployment Guide

## Prerequisites

- Docker and Docker Compose installed
- SSL certificate for HTTPS (recommended for production)
- Domain name pointing to your server
- PostgreSQL database access
- KALE contract details

## Quick Start

1. **Clone and Setup**
```bash
cd /path/to/kale-pool
cp .env.example .env
# Edit .env with your configuration
```

2. **Configure Environment**
Edit `.env` file with your settings:
- Database credentials
- JWT secret (generate a strong random key)
- KALE contract address
- Stellar network configuration

3. **Deploy with Docker Compose**
```bash
# Start all services
docker-compose up -d

# Check logs
docker-compose logs -f kale-pool-api

# Check status
docker-compose ps
```

4. **Initialize Database**
```bash
# Database should auto-initialize, but if needed:
docker-compose exec postgres psql -U postgres -d kale_pool_mainnet -f /docker-entrypoint-initdb.d/01-schema.sql
```

## Production Deployment Options

### Option 1: VPS/Cloud Server (DigitalOcean, AWS, etc.)

1. **Server Requirements**
   - 2+ CPU cores
   - 4GB+ RAM  
   - 50GB+ SSD storage
   - Ubuntu 20.04+ or similar

2. **Setup Steps**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Clone your repository
git clone https://github.com/your-org/kale-pool-mining.git
cd kale-pool-mining

# Configure and deploy
cp .env.example .env
# Edit .env with your settings
docker-compose up -d
```

### Option 2: Kubernetes Deployment

Create `k8s-deployment.yaml`:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kale-pool-api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: kale-pool-api
  template:
    metadata:
      labels:
        app: kale-pool-api
    spec:
      containers:
      - name: kale-pool-api
        image: your-registry/kale-pool-api:latest
        ports:
        - containerPort: 8080
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: kale-pool-secrets
              key: database-url
```

### Option 3: Railway/Heroku/Similar PaaS

1. **Prepare for Platform**
```bash
# Add start script to package.json
{
  "scripts": {
    "start": "cd Backend && bun run src/server-phase2.ts"
  }
}
```

2. **Set Environment Variables**
Add all variables from `.env.example` to your platform's environment variables.

## SSL/HTTPS Configuration

### Option A: Reverse Proxy (Recommended)

Use nginx or Caddy as reverse proxy:

**nginx.conf**
```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Option B: Let's Encrypt with Certbot
```bash
sudo apt install certbot nginx
sudo certbot --nginx -d your-domain.com
```

## Database Management

### Backup
```bash
# Backup database
docker-compose exec postgres pg_dump -U postgres kale_pool_mainnet > backup.sql

# Restore database  
docker-compose exec -T postgres psql -U postgres kale_pool_mainnet < backup.sql
```

### Migrations
```bash
# Run migrations
docker-compose exec kale-pool-api bun run db:migrate
```

## Monitoring

### Health Checks
- API Health: `http://your-domain/health`
- Database: `docker-compose exec postgres pg_isready`

### Logs
```bash
# View logs
docker-compose logs -f kale-pool-api
docker-compose logs -f postgres

# Log rotation (add to crontab)
0 2 * * * docker system prune -f
```

### Resource Monitoring
```bash
# Container stats
docker stats

# Disk usage
docker system df
```

## Scaling

### Horizontal Scaling
```yaml
# In docker-compose.yml
kale-pool-api:
  scale: 3  # Run 3 instances
```

### Load Balancing
Add nginx or HAProxy for load balancing multiple instances.

## Security Checklist

- [ ] Strong JWT secret (256+ bits)
- [ ] Database password changed from default
- [ ] HTTPS enabled
- [ ] Firewall configured (only 80, 443, SSH)
- [ ] Regular backups scheduled
- [ ] Log monitoring setup
- [ ] Rate limiting configured
- [ ] CORS properly configured
- [ ] Environment variables secured

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
```bash
# Check database status
docker-compose logs postgres
# Verify connection string in .env
```

2. **API Not Starting**
```bash
# Check API logs
docker-compose logs kale-pool-api
# Verify all required env vars are set
```

3. **Out of Memory**
```bash
# Add memory limits to docker-compose.yml
mem_limit: 1g
```

4. **Disk Space Full**
```bash
# Clean up
docker system prune -a
# Rotate logs
sudo logrotate -f /etc/logrotate.conf
```

## Performance Optimization

### Database
- Enable connection pooling
- Add database indexes for queries
- Regular VACUUM ANALYZE

### Application  
- Enable Redis caching
- Set appropriate worker processes
- Configure rate limiting

### Infrastructure
- Use SSD storage
- Enable gzip compression
- CDN for static assets (if any)

## Support

For deployment issues:
1. Check logs: `docker-compose logs -f`
2. Verify environment variables
3. Check network connectivity
4. Review resource usage

## Updates

To update the application:
```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose build --no-cache
docker-compose up -d

# Check deployment
docker-compose ps
docker-compose logs -f kale-pool-api
```