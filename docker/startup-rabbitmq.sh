#!/bin/bash
set -e

# Fix permissions for RabbitMQ data directory
echo "Setting up RabbitMQ permissions..."
mkdir -p /var/lib/rabbitmq
chown -R rabbitmq:rabbitmq /var/lib/rabbitmq
chmod 755 /var/lib/rabbitmq

# Set erlang cookie if provided via environment
if [ -n "$RABBITMQ_ERLANG_COOKIE" ]; then
    echo "Setting erlang cookie..."
    echo "$RABBITMQ_ERLANG_COOKIE" > /var/lib/rabbitmq/.erlang.cookie
    chown rabbitmq:rabbitmq /var/lib/rabbitmq/.erlang.cookie
    chmod 400 /var/lib/rabbitmq/.erlang.cookie
fi

# Start RabbitMQ in the background
docker-entrypoint.sh rabbitmq-server &

# Store the PID so we can wait for it later
RABBITMQ_PID=$!

# Function to check if RabbitMQ is ready
wait_for_rabbitmq() {
    echo "Waiting for RabbitMQ to be ready..."
    until rabbitmqctl status > /dev/null 2>&1; do
        echo "RabbitMQ is not ready yet, waiting..."
        sleep 2
    done
    echo "RabbitMQ is ready!"
}

# Function to enable firehose tracing
enable_firehose() {
    echo "Enabling firehose tracing..."
    rabbitmqctl trace_on
    echo "Firehose tracing enabled!"
}

# Wait for RabbitMQ to be ready
wait_for_rabbitmq

# Enable firehose tracing
enable_firehose

# Wait for the RabbitMQ process to finish
wait $RABBITMQ_PID 