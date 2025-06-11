import { Hono } from 'hono';
import boxen from 'boxen';
import { serve } from '@hono/node-server';
import { Server } from 'socket.io';
import { serveStatic } from '@hono/node-server/serve-static';
import { RabbitMQFirehoseMonitor, type FirehoseTraceMessage } from '../lib/firehose';

const app = new Hono();

app.use('/*', serveStatic({ root: './build' }));
const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const httpServer = serve({
	fetch: app.fetch,
	port: port
});

const io = new Server(httpServer, {
	cors: {
		origin: "*",
		methods: ["GET", "POST"]
	}
});

// Initialize RabbitMQ monitor
const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://admin:admin@localhost:5672/';
const monitor = new RabbitMQFirehoseMonitor(rabbitmqUrl);

let connectedClients = 0;
let isMonitoringStarted = false;
let manuallyStoppedMonitoring = false;
let disconnectTimeout: NodeJS.Timeout | null = null;

io.on('connection', (socket) => {
	connectedClients++;
	console.log(`📱 Client connected (${connectedClients} total)`);
	
	// Clear any pending disconnect timeout
	if (disconnectTimeout) {
		clearTimeout(disconnectTimeout);
		disconnectTimeout = null;
		console.log('🔄 Cancelled monitoring shutdown due to new connection');
	}
	
	// Send connection status
	socket.emit('connection-status', {
		connected: true,
		clientCount: connectedClients,
		monitoringActive: isMonitoringStarted
	});

	// Send current monitoring status
	socket.emit('monitoring-status', { 
		active: isMonitoringStarted, 
		message: isMonitoringStarted ? 'RabbitMQ monitoring active' : 
				 manuallyStoppedMonitoring ? 'RabbitMQ monitoring manually stopped' : 
				 'RabbitMQ monitoring stopped'
	});

	// Start monitoring when first client connects (unless manually stopped)
	if (!isMonitoringStarted && !manuallyStoppedMonitoring) {
		startRabbitMQMonitoring();
	}

	socket.on('disconnect', () => {
		connectedClients--;
		console.log(`📱 Client disconnected (${connectedClients} total)`);
		
		// Use a delay before stopping monitoring to handle page refreshes
		// This prevents unnecessary stop/start cycles during rapid reconnections
		if (connectedClients === 0 && isMonitoringStarted) {
			console.log('⏳ Scheduling monitoring shutdown in 5 seconds...');
			disconnectTimeout = setTimeout(() => {
				if (connectedClients === 0 && isMonitoringStarted) {
					console.log('🛑 No clients connected for 5 seconds, stopping monitoring');
					manuallyStoppedMonitoring = false; // Reset manual flag on automatic stop
					stopRabbitMQMonitoring();
				}
				disconnectTimeout = null;
			}, 5000); // 5 second delay
		}
	});

	// Handle client requests to start/stop monitoring
	socket.on('start-monitoring', () => {
		console.log('🎯 Manual start monitoring requested');
		manuallyStoppedMonitoring = false;
		if (!isMonitoringStarted) {
			startRabbitMQMonitoring();
		} else {
			// If already started, just notify client
			socket.emit('monitoring-status', { 
				active: true, 
				message: 'RabbitMQ monitoring already active' 
			});
		}
	});

	socket.on('stop-monitoring', () => {
		console.log('🛑 Manual stop monitoring requested');
		manuallyStoppedMonitoring = true;
		if (isMonitoringStarted) {
			stopRabbitMQMonitoring();
		} else {
			// If already stopped, just notify client
			socket.emit('monitoring-status', { 
				active: false, 
				message: 'RabbitMQ monitoring already stopped' 
			});
		}
	});
});

async function startRabbitMQMonitoring() {
	if (isMonitoringStarted) return;
	
	try {
		console.log('🔥 Starting RabbitMQ firehose monitoring...');
		await monitor.connect();
		
		await monitor.startMonitoring({
			onMessage: (message: FirehoseTraceMessage) => {
				// Emit message to all connected clients
				io.emit('firehose-message', {
					...message,
					// Add some additional metadata for the UI
					id: `${message.timestamp}-${Math.random().toString(36).substr(2, 9)}`,
					displayTime: new Date(message.timestamp).toLocaleTimeString()
				});
			}
		});
		
		isMonitoringStarted = true;
		
		// Notify all clients that monitoring started
		io.emit('monitoring-status', { 
			active: true, 
			message: 'RabbitMQ monitoring started' 
		});
		
		console.log('✅ RabbitMQ monitoring started successfully');
	} catch (error) {
		console.error('❌ Failed to start RabbitMQ monitoring:', error);
		io.emit('monitoring-error', { 
			error: error instanceof Error ? error.message : 'Unknown error',
			timestamp: new Date().toISOString()
		});
	}
}

async function stopRabbitMQMonitoring() {
	if (!isMonitoringStarted) return;
	
	try {
		console.log('🛑 Stopping RabbitMQ firehose monitoring...');
		await monitor.stop();
		isMonitoringStarted = false;
		
		// Notify all clients that monitoring stopped
		io.emit('monitoring-status', { 
			active: false, 
			message: 'RabbitMQ monitoring stopped' 
		});
		
		console.log('✅ RabbitMQ monitoring stopped');
	} catch (error) {
		console.error('❌ Error stopping RabbitMQ monitoring:', error);
		io.emit('monitoring-error', { 
			error: error instanceof Error ? error.message : 'Unknown error',
			timestamp: new Date().toISOString()
		});
	}
}

// Graceful shutdown
process.on('SIGINT', async () => {
	console.log('\n🛑 Shutting down server...');
	if (disconnectTimeout) {
		clearTimeout(disconnectTimeout);
		disconnectTimeout = null;
	}
	if (isMonitoringStarted) {
		await stopRabbitMQMonitoring();
	}
	process.exit(0);
});

process.on('SIGTERM', async () => {
	console.log('\n🛑 Shutting down server...');
	if (disconnectTimeout) {
		clearTimeout(disconnectTimeout);
		disconnectTimeout = null;
	}
	if (isMonitoringStarted) {
		await stopRabbitMQMonitoring();
	}
	process.exit(0);
});

console.log(
	boxen(`🔥 RabbitMQ Firehose Visualizer Server\nRunning on port ${port}`, {
		padding: 1,
		borderStyle: 'double',
		width: Math.min(process.stdout.columns || 80, 80),
		textAlignment: 'center'
	})
);
