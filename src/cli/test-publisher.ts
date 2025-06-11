#!/usr/bin/env bun

/**
 * RabbitMQ Test Publisher Script
 *
 * This script publishes various test messages to RabbitMQ exchanges and queues
 * to test the firehose monitoring functionality.
 *
 * Usage:
 *   bun run scripts/test-publisher.ts                # Send default test messages
 *   bun run scripts/test-publisher.ts --count 10     # Send 10 messages
 *   bun run scripts/test-publisher.ts --interval 2   # Send every 2 seconds
 *   bun run scripts/test-publisher.ts --exchange myex --routing-key test
 */

import { defineCommand, runMain } from 'citty';
import amqp from 'amqplib';
import { z } from 'zod/v4';

// Test message schemas
const TestEventSchema = z.object({
	id: z.string(),
	type: z.string(),
	timestamp: z.string(),
	data: z.record(z.string(), z.any())
});

const UserEventSchema = z.object({
	userId: z.string(),
	action: z.string(),
	metadata: z.object({
		ip: z.string(),
		userAgent: z.string()
	})
});

const TradingEventSchema = z.object({
	symbol: z.string(),
	price: z.number(),
	volume: z.number(),
	side: z.enum(['buy', 'sell'])
});

class TestPublisher {
	private connection: amqp.ChannelModel | null = null;
	private channel: amqp.Channel | null = null;
	private connectionUrl: string;

	constructor(connectionUrl: string = 'amqp://admin:admin@localhost:5672/') {
		this.connectionUrl = connectionUrl;
	}

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

	async publishTestMessage(
		exchange: string,
		routingKey: string,
		message: any,
		messageId?: string
	): Promise<void> {
		if (!this.channel) {
			throw new Error('Must connect before publishing');
		}

		// Ensure exchange exists
		await this.channel.assertExchange(exchange, 'topic', { durable: false });

		const options: amqp.Options.Publish = {
			messageId: messageId || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			timestamp: Date.now(),
			contentType: 'application/json',
			correlationId: `corr-${Date.now()}`,
			headers: {
				publisher: 'test-publisher',
				version: '1.0.0'
			}
		};

		const buffer = Buffer.from(JSON.stringify(message));

		console.log(`📤 Publishing to ${exchange}:${routingKey}`);
		console.log(`   Message ID: ${options.messageId}`);
		console.log(`   Content: ${JSON.stringify(message)}`);

		this.channel.publish(exchange, routingKey, buffer, options);
	}

	async publishToQueue(queueName: string, message: any): Promise<void> {
		if (!this.channel) {
			throw new Error('Must connect before publishing');
		}

		// Ensure queue exists
		await this.channel.assertQueue(queueName, { durable: false });

		const options: amqp.Options.Publish = {
			messageId: `queue-msg-${Date.now()}`,
			timestamp: Date.now(),
			contentType: 'application/json'
		};

		const buffer = Buffer.from(JSON.stringify(message));

		console.log(`📮 Publishing to queue ${queueName}`);
		console.log(`   Message: ${JSON.stringify(message)}`);

		this.channel.sendToQueue(queueName, buffer, options);
	}

	async close(): Promise<void> {
		if (this.channel) {
			await this.channel.close();
		}
		if (this.connection) {
			await this.connection.close();
		}
	}
}

function generateTestMessages(count: number) {
	const messages = [];

	for (let i = 0; i < count; i++) {
		// Mix different types of messages
		if (i % 3 === 0) {
			// User event
			messages.push({
				exchange: 'user.events',
				routingKey: 'user.login',
				message: {
					userId: `user-${i}`,
					action: 'login',
					metadata: {
						ip: '192.168.1.' + (100 + i),
						userAgent: 'Mozilla/5.0 Test Browser'
					}
				}
			});
		} else if (i % 3 === 1) {
			// Trading event
			messages.push({
				exchange: 'trading.events',
				routingKey: 'trade.executed',
				message: {
					symbol: ['BTCUSD', 'ETHUSD', 'ADAUSD'][i % 3],
					price: 50000 + Math.random() * 10000,
					volume: Math.random() * 100,
					side: Math.random() > 0.5 ? 'buy' : 'sell'
				}
			});
		} else {
			// Generic test event
			messages.push({
				exchange: 'test.events',
				routingKey: 'test.message',
				message: {
					id: `test-${i}`,
					type: 'test_event',
					timestamp: new Date().toISOString(),
					data: {
						counter: i,
						random: Math.random(),
						message: `This is test message #${i}`
					}
				}
			});
		}
	}

	return messages;
}

async function sleep(seconds: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

const main = defineCommand({
	meta: {
		name: 'rabbitmq-publisher',
		version: '1.0.0',
		description:
			'📤 RabbitMQ Test Publisher - Publishes various test messages to RabbitMQ for testing firehose monitoring'
	},
	args: {
		count: {
			type: 'string',
			description: 'Number of messages to send',
			default: '5',
			alias: 'c'
		},
		interval: {
			type: 'string',
			description: 'Interval between messages in seconds',
			default: '1',
			alias: 'i'
		},
		exchange: {
			type: 'string',
			description: 'Target exchange (when used with routing-key)',
			alias: 'e'
		},
		routingKey: {
			type: 'string',
			description: 'Routing key (when used with exchange)',
			alias: 'r'
		},
		url: {
			type: 'string',
			description: 'RabbitMQ connection URL',
			default: 'amqp://admin:admin@localhost:5672/',
			alias: 'u'
		}
	},
	async run({ args }) {
		const count = parseInt(args.count);
		const interval = parseFloat(args.interval);
		const connectionUrl = process.env.RABBITMQ_URL || args.url;

		// Validate arguments
		if (isNaN(count) || count <= 0) {
			console.error('❌ Count must be a positive number');
			process.exit(1);
		}

		if (isNaN(interval) || interval < 0) {
			console.error('❌ Interval must be a non-negative number');
			process.exit(1);
		}

		if ((args.exchange && !args.routingKey) || (!args.exchange && args.routingKey)) {
			console.error('❌ Both --exchange and --routing-key must be provided together');
			process.exit(1);
		}

		const publisher = new TestPublisher(connectionUrl);

		try {
			console.log('📤 RabbitMQ Test Publisher');
			console.log('==========================');
			console.log(`Connection: ${connectionUrl}`);
			console.log(`Sending ${count} messages with ${interval}s interval...`);
			console.log('');

			await publisher.connect();

			if (args.exchange && args.routingKey) {
				// Custom exchange and routing key
				console.log(`🎯 Publishing to custom exchange: ${args.exchange}:${args.routingKey}`);
				console.log('');

				for (let i = 0; i < count; i++) {
					const message = {
						id: `custom-${i}`,
						timestamp: new Date().toISOString(),
						data: { counter: i }
					};

					await publisher.publishTestMessage(args.exchange, args.routingKey, message);

					if (i < count - 1) {
						await sleep(interval);
					}
				}
			} else {
				// Generate various test messages
				console.log('🎲 Publishing mixed test messages (user, trading, generic events)');
				console.log('');

				const messages = generateTestMessages(count);

				for (let i = 0; i < messages.length; i++) {
					const messageConfig = messages[i]!;
					const { exchange, routingKey, message } = messageConfig;

					await publisher.publishTestMessage(exchange, routingKey, message);

					// Also publish some direct queue messages
					if (i % 4 === 0) {
						await publisher.publishToQueue('test-queue', {
							queueMessage: true,
							counter: i,
							timestamp: new Date().toISOString()
						});
					}

					if (i < messages.length - 1) {
						console.log(`⏳ Waiting ${interval}s before next message...`);
						console.log('');
						await sleep(interval);
					}
				}
			}

			console.log('✅ All messages published successfully!');
		} catch (error) {
			console.error('❌ Error:', error);
			process.exit(1);
		} finally {
			await publisher.close();
			console.log('🔌 Connection closed.');
		}
	}
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
	console.error('❌ Unhandled Promise Rejection:', reason);
	process.exit(1);
});

// Run the publisher
runMain(main);
