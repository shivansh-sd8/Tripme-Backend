# TripMe Backend - Production Deployment Guide

## 🚀 Overview Testing

This guide covers the complete deployment process for the TripMe backend API in a production environment.

## 📋 Prerequisites

- Node.js 18+ 
- MongoDB 6.0+
- Redis 7+ (optional, for caching)
- Docker & Docker Compose (optional)
- SSL Certificate (for HTTPS)

## 🔧 Environment Setup

### 1. Environment Variables

Copy the production environment template:
```bash
cp env.production.example .env.production
```

Update `.env.production` with your production values:
- Database credentials
- JWT secrets
- Payment gateway keys
- Email configuration
- Admin credentials

### 2. Database Setup

#### MongoDB
```bash
# Create production database
mongosh
use tripme_production

# Create admin user
db.createUser({
  user: "tripme_admin",
  pwd: "secure_password",
  roles: ["readWrite"]
})
```

#### Redis (Optional)
```bash
# Install Redis
sudo apt-get install redis-server

# Configure Redis
sudo nano /etc/redis/redis.conf
# Set: requirepass your_redis_password
```

## 🐳 Docker Deployment (Recommended)

### 1. Using Docker Compose

```bash
# Start all services
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Stop services
docker-compose -f docker-compose.prod.yml down
```

### 2. Manual Docker Build

```bash
# Build image
docker build -t tripme-backend .

# Run container
docker run -d \
  --name tripme-backend \
  -p 5001:5001 \
  --env-file .env.production \
  tripme-backend
```

## 🖥️ Manual Deployment

### 1. Install Dependencies

```bash
# Install production dependencies
npm ci --only=production

# Install PM2 for process management
npm install -g pm2
```

### 2. Start Application

```bash
# Using PM2 (recommended)
pm2 start server.js --name "tripme-backend" --env production

# Or using Node directly
NODE_ENV=production node server.js
```

### 3. PM2 Configuration

Create `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'tripme-backend',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5001
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
```

## 🔒 Security Configuration

### 1. Firewall Setup

```bash
# Allow only necessary ports
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw allow 5001  # API (if not behind reverse proxy)
sudo ufw enable
```

### 2. SSL Certificate

```bash
# Using Let's Encrypt
sudo apt install certbot
sudo certbot certonly --standalone -d yourdomain.com
```

### 3. Nginx Reverse Proxy

Create `/etc/nginx/sites-available/tripme`:
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location /api/ {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 📊 Monitoring & Logging

### 1. Health Checks

The API provides a health check endpoint:
```bash
curl https://yourdomain.com/api/health
```

### 2. Log Management

```bash
# View PM2 logs
pm2 logs tripme-backend

# Rotate logs
pm2 reloadLogs

# Monitor resources
pm2 monit
```

### 3. Database Monitoring

```bash
# MongoDB monitoring
mongosh --eval "db.serverStatus()"

# Check connections
mongosh --eval "db.serverStatus().connections"
```

## 🔄 Backup & Recovery

### 1. Database Backup

```bash
# Create backup
mongodump --db tripme_production --out /backup/$(date +%Y%m%d)

# Restore backup
mongorestore --db tripme_production /backup/20240101/tripme_production
```

### 2. Application Backup

```bash
# Backup application files
tar -czf tripme-backup-$(date +%Y%m%d).tar.gz /path/to/tripme-backend

# Backup environment
cp .env.production /backup/env.production.$(date +%Y%m%d)
```

## 🚨 Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   sudo lsof -i :5001
   sudo kill -9 <PID>
   ```

2. **Database Connection Failed**
   - Check MongoDB status: `sudo systemctl status mongod`
   - Verify connection string in `.env.production`

3. **Memory Issues**
   - Monitor with: `pm2 monit`
   - Restart if needed: `pm2 restart tripme-backend`

### Log Locations

- Application logs: `./logs/`
- PM2 logs: `~/.pm2/logs/`
- Nginx logs: `/var/log/nginx/`
- System logs: `/var/log/syslog`

## 📈 Performance Optimization

### 1. Database Indexing

```javascript
// Create indexes for better performance
db.bookings.createIndex({ "user": 1, "createdAt": -1 })
db.payments.createIndex({ "status": 1, "createdAt": -1 })
db.properties.createIndex({ "location.city": 1, "pricing.basePrice": 1 })
```

### 2. Caching

Enable Redis caching for frequently accessed data:
- User sessions
- Property listings
- Platform fee rates

### 3. Load Balancing

For high traffic, use multiple instances behind a load balancer:
```bash
# Start multiple instances
pm2 start ecosystem.config.js --instances 4
```

## 🔐 Security Checklist

- [ ] Environment variables secured
- [ ] Database access restricted
- [ ] SSL certificate installed
- [ ] Firewall configured
- [ ] Rate limiting enabled
- [ ] Input validation enabled
- [ ] Error messages sanitized
- [ ] Logs don't contain sensitive data
- [ ] Regular security updates
- [ ] Backup strategy implemented

## 📞 Support

For production issues:
1. Check health endpoint: `/api/health`
2. Review logs: `pm2 logs tripme-backend`
3. Monitor resources: `pm2 monit`
4. Check database connectivity
5. Verify environment variables

---

**Last Updated:** January 2024
**Version:** 1.0.0




