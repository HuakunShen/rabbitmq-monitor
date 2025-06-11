#!/bin/bash

# Test script for RabbitMQ Firehose Visualizer Docker deployment
set -e

echo "🐳 Testing RabbitMQ Firehose Visualizer Docker Setup"
echo "=================================================="

# Check if Docker and Docker Compose are installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

echo "✅ Docker and Docker Compose are installed"

# Build and start services
echo "🔨 Building and starting services..."
docker-compose up -d --build

# Wait for services to be healthy
echo "⏳ Waiting for services to start..."
sleep 30

# Check if services are running
echo "🔍 Checking service status..."
docker-compose ps

# Test RabbitMQ Management UI
echo "🐰 Testing RabbitMQ Management UI..."
if curl -f http://localhost:15672 &> /dev/null; then
    echo "✅ RabbitMQ Management UI is accessible at http://localhost:15672"
else
    echo "❌ RabbitMQ Management UI is not accessible"
fi

# Test Firehose Visualizer
echo "wait 20s for rabbitmq to start..."
sleep 20
echo "🔥 Testing Firehose Visualizer..."
if curl -f http://localhost:3000 &> /dev/null; then
    echo "✅ Firehose Visualizer is accessible at http://localhost:3000"
else
    echo "❌ Firehose Visualizer is not accessible"
fi

# Enable RabbitMQ tracing
echo "📡 Enabling RabbitMQ tracing..."
docker-compose exec rabbitmq rabbitmqctl trace_on

echo ""
echo "🎉 Setup complete! You can now:"
echo "   - Access Firehose Visualizer: http://localhost:3000"
echo "   - Access RabbitMQ Management: http://localhost:15672 (admin/admin)"
echo "   - Send test messages: bun run src/cli/test-publisher.ts (from host)"
echo ""
echo "To stop: docker-compose down"
echo "To view logs: docker-compose logs -f" 