# 🔥 RabbitMQ Firehose Visualizer

A real-time web-based visualizer for monitoring RabbitMQ message flows using the firehose tracing feature. Built with SvelteKit, Hono, Socket.IO, and TypeScript.

![Dark Theme Interface](https://img.shields.io/badge/theme-dark-000000) ![Real-time](https://img.shields.io/badge/monitoring-realtime-brightgreen) ![Docker](https://img.shields.io/badge/docker-ready-blue)

## ✨ Features

- 🔥 **Real-time Monitoring**: Live visualization of all RabbitMQ message flows
- 🎯 **Message Filtering**: Filter by action type (publish/deliver) and exchange
- 🌙 **Dark Theme**: Modern, easy-on-the-eyes dark interface
- 📱 **Responsive Design**: Works on desktop and mobile devices
- 🔄 **Auto-reconnect**: Survives page refreshes and network interruptions
- ⏸️ **Pause/Resume**: Control message flow display
- 📊 **Rich Message Details**: View headers, body, routing keys, and metadata
- 🎨 **JSON Visualization**: Beautiful syntax-highlighted JSON display
- 🐳 **Docker Ready**: Easy deployment with Docker and Docker Compose

<img width="960" alt="image" src="https://github.com/user-attachments/assets/ca6dab47-fcbf-4976-bea6-907f4abb1a48" />


## 🚀 Quick Start with Docker

### Quick Deployment

```bash
# if your rabbitmq is on localhost, you may need to use --network=host for the container to access your localhost
docker run --rm -e RABBITMQ_URL=amqp://admin:admin@localhost:5672/ --network=host docker.io/huakunshen/rabbitmq-firehose-monitor

# if rabbitmq is running on another ip
docker run --rm -p 3000:3000 -e RABBITMQ_URL=<RABBITMQ_URL> docker.io/huakunshen/rabbitmq-firehose-monitor
```

### Development Prerequisites

- Docker and Docker Compose installed
- Port 3000 and 5672/15672 available

### 1. Using Docker Compose (Recommended)

```bash
# Clone the repository
git clone <your-repo-url>
cd rabbitmq-monitor

# Start demo with one command
docker-compose up

# View logs
docker-compose logs -f rabbitmq-monitor


# open http://localhost:3000
export RABBITMQ_URL=amqp://admin:admin@localhost:5672/
bun run src/cli/test-publisher.ts -c 5 # send messages to the rabbitmq, and watch messages show up in web app
```

This will start:

- **RabbitMQ Server** on ports 5672 (AMQP) and 15672 (Management UI)
- **Firehose Visualizer** on port 3000

### 2. Using Docker Image Only

```bash
# Pull and run the pre-built image
docker run -d \
  --name rabbitmq-firehose-monitor \
  -p 3000:3000 \
  -e RABBITMQ_URL=amqp://admin:admin@your-rabbitmq-host:5672/ \
  your-registry/rabbitmq-firehose-visualizer:latest
```

### 3. Building from Source

```bash
# Build the Docker image
docker build -t rabbitmq-firehose-visualizer .

# Run the container
docker run -d \
  --name rabbitmq-monitor \
  -p 3000:3000 \
  -e RABBITMQ_URL=amqp://admin:admin@rabbitmq:5672/ \
  rabbitmq-firehose-visualizer
```

## 💻 Local Development

### Prerequisites

- [Bun](https://bun.sh) runtime
- RabbitMQ server running locally or accessible remotely

### Installation

```bash
# Clone and install dependencies
git clone <your-repo-url>
cd rabbitmq-monitor
bun install

# Start development server
bun run dev
```

### Available Scripts

```bash
# Development
bun run dev          # Start dev server with hot reload
bun run build        # Build for production
bun run preview      # Preview production build

# RabbitMQ Tools
bun run src/cli/monitor.ts                    # Monitor all messages
bun run src/cli/monitor.ts --publish-only     # Monitor publish only
bun run src/cli/monitor.ts --deliver-only     # Monitor deliver only
bun run src/cli/test-publisher.ts --count 10  # Send test messages

# Code Quality
bun run check        # Type checking
bun run lint         # Code formatting check
bun run format       # Format code
```

## ⚙️ Configuration

### Environment Variables

| Variable       | Default                              | Description                |
| -------------- | ------------------------------------ | -------------------------- |
| `PORT`         | `3000`                               | Port for the web server    |
| `RABBITMQ_URL` | `amqp://admin:admin@localhost:5672/` | RabbitMQ connection string |
| `NODE_ENV`     | `development`                        | Environment mode           |

### RabbitMQ Setup

The visualizer requires RabbitMQ firehose tracing to be enabled:

```bash
# Enable firehose tracing (run on RabbitMQ server)
rabbitmqctl trace_on

# Or via management UI: Admin → Tracing → Add trace
```

## 🎯 Usage

1. **Access the Interface**: Open http://localhost:3000 in your browser
2. **Start Monitoring**: Click the "▶️ Start Monitoring" button
3. **Generate Traffic**: Use the test publisher or your own applications
4. **Filter Messages**: Use the controls to filter by action type or exchange
5. **Inspect Details**: Click on messages to see full headers and body content

### Message Types

- **📤 PUBLISH**: Messages being published to exchanges
- **📥 DELIVER**: Messages being delivered to consumers

### Controls

- **▶️/⏹️ Toggle Monitoring**: Start/stop message capture
- **⏸️ Pause/Resume**: Pause display without stopping capture
- **🗑️ Clear**: Clear all displayed messages
- **🔍 Filters**: Filter by action type and exchange name
- **📊 Message Limit**: Control max messages displayed (10-1000)
- **📜 Auto-scroll**: Automatically scroll to newest messages

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│   Web Browser   │◄──►│ Hono Server  │◄──►│   RabbitMQ      │
│  (SvelteKit)    │    │ (Socket.IO)  │    │  (Firehose)     │
└─────────────────┘    └──────────────┘    └─────────────────┘
        │                       │                     │
        │                       │                     │
    Socket.IO              WebSocket               AMQP Protocol
   (Real-time)            (Live Updates)         (Message Tracing)
```

### Technology Stack

- **Frontend**: SvelteKit 2, TailwindCSS 4, Socket.IO Client
- **Backend**: Hono, Socket.IO Server, Node.js
- **Message Broker**: RabbitMQ with Firehose Tracing
- **Runtime**: Bun (fast JavaScript runtime)
- **Deployment**: Docker, Docker Compose

## 🐛 Troubleshooting

### Common Issues

**"Disconnected from server"**

- Check if the server is running on the correct port
- Verify firewall settings allow connections to port 3000

**"No messages appearing"**

- Ensure RabbitMQ firehose tracing is enabled: `rabbitmqctl trace_on`
- Verify RABBITMQ_URL environment variable is correct
- Check RabbitMQ server logs for connection issues

**"Start Monitoring button disabled"**

- Check browser console for connection errors
- Verify RabbitMQ server is accessible from the application
- Ensure proper credentials in RABBITMQ_URL

### Docker Issues

```bash
# Check container logs
docker-compose logs rabbitmq-monitor
docker-compose logs rabbitmq

# Restart services
docker-compose restart

# Rebuild and restart
docker-compose up --build -d
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [SvelteKit](https://kit.svelte.dev)
- Powered by [Bun](https://bun.sh) runtime
- Uses [RabbitMQ](https://rabbitmq.com) firehose tracing
- UI components styled with [TailwindCSS](https://tailwindcss.com)
