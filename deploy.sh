#!/bin/bash

# KALE Pool Mining - Quick Deploy Script
# Usage: ./deploy.sh [environment]
# Example: ./deploy.sh production

set -e

ENVIRONMENT=${1:-production}
PROJECT_NAME="kale-pool-mining"

echo "🥬 KALE Pool Mining Deployment Script"
echo "Environment: $ENVIRONMENT"
echo "=================================="

# Check if required files exist
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ docker-compose.yml not found"
    exit 1
fi

if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Creating from template..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "📝 Please edit .env file with your configuration"
        echo "Required variables:"
        echo "  - JWT_SECRET (generate a strong random key)"
        echo "  - DB_PASSWORD (secure database password)"
        echo "  - KALE_CONTRACT_ADDRESS"
        echo "  - STELLAR_HORIZON_URL"
        echo ""
        read -p "Press Enter after editing .env file..."
    else
        echo "❌ .env.example not found"
        exit 1
    fi
fi

# Function to check if service is healthy
check_service_health() {
    local service_name=$1
    local max_attempts=30
    local attempt=1
    
    echo "🔍 Checking $service_name health..."
    
    while [ $attempt -le $max_attempts ]; do
        if docker-compose ps $service_name | grep -q "Up"; then
            health_status=$(docker-compose ps --format "table {{.Service}}\t{{.Status}}" | grep $service_name | grep -o "healthy\|unhealthy\|starting" || echo "unknown")
            
            if [ "$health_status" = "healthy" ]; then
                echo "✅ $service_name is healthy"
                return 0
            elif [ "$health_status" = "unhealthy" ]; then
                echo "❌ $service_name is unhealthy"
                return 1
            else
                echo "⏳ $service_name health check attempt $attempt/$max_attempts..."
                sleep 5
                ((attempt++))
            fi
        else
            echo "⏳ $service_name starting attempt $attempt/$max_attempts..."
            sleep 5
            ((attempt++))
        fi
    done
    
    echo "❌ $service_name health check timed out"
    return 1
}

# Pre-deployment checks
echo "🔍 Pre-deployment checks..."

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed"
    exit 1
fi

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed"
    exit 1
fi

# Check if ports are available
if netstat -tuln | grep -q ":8080 "; then
    echo "⚠️  Port 8080 is already in use"
    read -p "Continue anyway? (y/N): " continue_deploy
    if [[ ! $continue_deploy =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "✅ Pre-deployment checks passed"

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose down --remove-orphans

# Pull latest images (if using external images)
echo "📥 Pulling latest images..."
docker-compose pull --ignore-pull-failures

# Build images
echo "🔨 Building application images..."
docker-compose build --no-cache

# Start services
echo "🚀 Starting services..."
docker-compose up -d

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
check_service_health "postgres"

# Wait for API to be ready
echo "⏳ Waiting for API to be ready..."
check_service_health "kale-pool-api"

# Run health checks
echo "🏥 Running health checks..."

# Check API endpoint
API_PORT=$(grep "API_PORT" .env | cut -d '=' -f2 || echo "8080")
API_URL="http://localhost:${API_PORT}/health"

echo "🔍 Checking API health endpoint: $API_URL"
max_attempts=10
attempt=1

while [ $attempt -le $max_attempts ]; do
    if curl -s -f "$API_URL" > /dev/null; then
        echo "✅ API health check passed"
        break
    else
        if [ $attempt -eq $max_attempts ]; then
            echo "❌ API health check failed after $max_attempts attempts"
            echo "📋 Recent API logs:"
            docker-compose logs --tail=20 kale-pool-api
            exit 1
        else
            echo "⏳ API health check attempt $attempt/$max_attempts..."
            sleep 5
            ((attempt++))
        fi
    fi
done

# Display deployment status
echo ""
echo "🎉 Deployment completed successfully!"
echo "=================================="
echo "📊 Service Status:"
docker-compose ps

echo ""
echo "🔗 Service URLs:"
echo "  API: http://localhost:${API_PORT}"
echo "  Health: http://localhost:${API_PORT}/health"

echo ""
echo "📋 Useful Commands:"
echo "  View logs: docker-compose logs -f"
echo "  Stop: docker-compose down"
echo "  Restart: docker-compose restart"
echo "  Scale API: docker-compose up -d --scale kale-pool-api=3"

echo ""
echo "🔍 Quick Status Check:"
echo "  Database: $(docker-compose ps postgres | grep -q "Up" && echo "✅ Running" || echo "❌ Not running")"
echo "  API: $(docker-compose ps kale-pool-api | grep -q "Up" && echo "✅ Running" || echo "❌ Not running")"
echo "  Redis: $(docker-compose ps redis | grep -q "Up" && echo "✅ Running" || echo "❌ Not running")"

echo ""
echo "📝 Next Steps:"
echo "  1. Configure your domain/SSL if deploying to production"
echo "  2. Set up monitoring and alerts"  
echo "  3. Schedule database backups"
echo "  4. Review logs: docker-compose logs -f"

# Optional: Open API documentation
if command -v open &> /dev/null || command -v xdg-open &> /dev/null; then
    read -p "🌐 Open API in browser? (y/N): " open_browser
    if [[ $open_browser =~ ^[Yy]$ ]]; then
        if command -v open &> /dev/null; then
            open "$API_URL"
        elif command -v xdg-open &> /dev/null; then
            xdg-open "$API_URL"
        fi
    fi
fi

echo ""
echo "🥬 KALE Pool Mining is now running!"
echo "Happy mining! 🚀"