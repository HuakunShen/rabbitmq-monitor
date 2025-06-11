import amqp from 'amqplib';

export interface FirehoseTraceMessage {
	timestamp: string;
	action: 'publish' | 'deliver';
	target: string;
	routingKey: string;
	exchange: string;
	contentType?: string;
	messageId?: string;
	correlationId?: string;
	headers?: Record<string, any>;
	bodyLength: number;
	body: unknown;
}

export class RabbitMQFirehoseMonitor {
	private connection: amqp.ChannelModel | null = null;
	private channel: amqp.Channel | null = null;
	private connectionUrl: string;
	private isMonitoring = false;

	constructor(connectionUrl: string = 'amqp://admin:admin@localhost:5672/') {
		this.connectionUrl = connectionUrl;
	}

	/**
	 * Connect to RabbitMQ
	 */
	async connect(): Promise<void> {
		try {
			console.log('🔌 Connecting to RabbitMQ...');
			this.connection = await amqp.connect(this.connectionUrl);
			this.channel = await this.connection.createChannel();
			console.log('✅ Connected successfully!');
		} catch (error) {
			throw new Error(`Failed to connect to RabbitMQ: ${error}`);
		}
	}

	/**
	 * Start monitoring all firehose messages
	 */
	async startMonitoring(
		options: {
			routingKey?: string;
			onMessage?: (message: FirehoseTraceMessage) => void;
		} = {}
	): Promise<void> {
		if (!this.channel) {
			throw new Error('Must connect before starting monitoring');
		}

		if (this.isMonitoring) {
			throw new Error('Already monitoring');
		}

		const { routingKey = '#', onMessage } = options;

		try {
			// Declare a temporary queue for monitoring
			const queueResult = await this.channel.assertQueue('', {
				exclusive: true,
				autoDelete: true
			});
			const queueName = queueResult.queue;

			// Bind to the firehose exchange
			await this.channel.bindQueue(queueName, 'amq.rabbitmq.trace', routingKey);

			console.log(`📡 Monitoring queue: ${queueName}`);
			console.log('🔥 Listening for firehose messages... (Press CTRL+C to exit)');
			console.log('\n📋 Message Types:');
			console.log('  - publish.* : Messages being published to exchanges');
			console.log('  - deliver.* : Messages being delivered to consumers');
			console.log('');

			// Set up consumer
			await this.channel.prefetch(1);
			await this.channel.consume(queueName, (message) => {
				if (message) {
					try {
						const traceMessage = this.parseFirehoseMessage(message);

						if (onMessage) {
							onMessage(traceMessage);
						} else {
							this.displayMessage(traceMessage);
						}

						if (this.channel) {
							this.channel.ack(message);
						}
					} catch (error) {
						console.error('❌ Error processing message:', error);
						if (this.channel) {
							this.channel.nack(message, false, false);
						}
					}
				}
			});

			this.isMonitoring = true;

			// Set up graceful shutdown
			process.on('SIGINT', () => {
				console.log('\n🛑 Shutting down monitor...');
				this.stop();
			});

			process.on('SIGTERM', () => {
				console.log('\n🛑 Shutting down monitor...');
				this.stop();
			});
		} catch (error) {
			throw new Error(`Failed to start monitoring: ${error}`);
		}
	}

	/**
	 * Parse a firehose message from RabbitMQ
	 */
	private parseFirehoseMessage(message: amqp.ConsumeMessage): FirehoseTraceMessage {
		const timestamp = new Date().toISOString();

		// Extract routing key information
		const routingKeyParts = message.fields.routingKey.split('.', 2);
		const action = routingKeyParts[0] as 'publish' | 'deliver';
		const target = routingKeyParts[1] || 'unknown';

		// Get headers for additional metadata
		const headers = message.properties.headers || {};

		// Parse message body
		let body: unknown;
		try {
			body = JSON.parse(message.content.toString());
		} catch {
			// If not JSON, treat as string
			body = message.content.toString();
		}

		return {
			timestamp,
			action,
			target,
			routingKey: message.fields.routingKey,
			exchange: message.fields.exchange,
			contentType: message.properties.contentType,
			messageId: message.properties.messageId,
			correlationId: message.properties.correlationId,
			headers,
			bodyLength: message.content.length,
			body
		};
	}

	/**
	 * Display a formatted message to console
	 */
	private displayMessage(message: FirehoseTraceMessage): void {
		console.log('\n' + '='.repeat(80));
		console.log(`[${message.timestamp}] ${message.action.toUpperCase()} - ${message.target}`);
		console.log('='.repeat(80));

		if (Object.keys(message.headers || {}).length > 0) {
			console.log('Headers:');
			for (const [key, value] of Object.entries(message.headers!)) {
				console.log(`  ${key}: ${value}`);
			}
		}

		console.log(`Routing Key: ${message.routingKey}`);
		console.log(`Exchange: ${message.exchange}`);
		console.log(`Content Type: ${message.contentType || 'text/plain'}`);

		if (message.messageId) {
			console.log(`Message ID: ${message.messageId}`);
		}

		if (message.correlationId) {
			console.log(`Correlation ID: ${message.correlationId}`);
		}

		console.log(`Body Length: ${message.bodyLength} bytes`);
		console.log('Body:');

		if (typeof message.body === 'string') {
			console.log(`  ${message.body}`);
		} else {
			console.log(`  ${JSON.stringify(message.body, null, 2)}`);
		}
	}

	/**
	 * Stop monitoring and close connections
	 */
	async stop(): Promise<void> {
		this.isMonitoring = false;

		if (this.channel) {
			try {
				await this.channel.close();
			} catch (error) {
				console.error('Error closing channel:', error);
			}
			this.channel = null;
		}

		if (this.connection) {
			try {
				await this.connection.close();
			} catch (error) {
				console.error('Error closing connection:', error);
			}
			this.connection = null;
		}

		console.log('✅ Monitor stopped.');
		process.exit(0);
	}

	/**
	 * Monitor specific routing patterns
	 */
	async monitorPublishOnly(): Promise<void> {
		return this.startMonitoring({ routingKey: 'publish.#' });
	}

	async monitorDeliverOnly(): Promise<void> {
		return this.startMonitoring({ routingKey: 'deliver.#' });
	}

	async monitorExchange(exchangeName: string): Promise<void> {
		return this.startMonitoring({ routingKey: `publish.${exchangeName}` });
	}

	async monitorQueue(queueName: string): Promise<void> {
		return this.startMonitoring({ routingKey: `deliver.${queueName}` });
	}
}

// Export for use in scripts
export default RabbitMQFirehoseMonitor;
