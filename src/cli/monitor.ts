#!/usr/bin/env bun

/**
 * RabbitMQ Firehose Monitor Script
 *
 * This script monitors all messages flowing through RabbitMQ in real-time
 * using the firehose tracing feature.
 *
 * Usage:
 *   bun run scripts/monitor.ts                    # Monitor all messages
 *   bun run scripts/monitor.ts --publish-only     # Monitor only published messages
 *   bun run scripts/monitor.ts --deliver-only     # Monitor only delivered messages
 *   bun run scripts/monitor.ts --exchange myex    # Monitor specific exchange
 *   bun run scripts/monitor.ts --queue myqueue    # Monitor specific queue
 */

import { defineCommand, runMain } from 'citty';
import { RabbitMQFirehoseMonitor } from '../lib/firehose';

const main = defineCommand({
	meta: {
		name: 'rabbitmq-monitor',
		version: '1.0.0',
		description:
			'🔥 RabbitMQ Firehose Monitor - Monitor all messages flowing through RabbitMQ in real-time'
	},
	args: {
		publishOnly: {
			type: 'boolean',
			description: 'Monitor only published messages (publish.*)',
			alias: 'p'
		},
		deliverOnly: {
			type: 'boolean',
			description: 'Monitor only delivered messages (deliver.*)',
			alias: 'd'
		},
		exchange: {
			type: 'string',
			description: 'Monitor specific exchange',
			alias: 'e'
		},
		queue: {
			type: 'string',
			description: 'Monitor specific queue',
			alias: 'q'
		},
		url: {
			type: 'string',
			description: 'RabbitMQ connection URL',
			default: 'amqp://admin:admin@localhost:5672/',
			alias: 'u'
		}
	},
	async run({ args }) {
		const connectionUrl = process.env.RABBITMQ_URL || args.url;
		const monitor = new RabbitMQFirehoseMonitor(connectionUrl);

		try {
			console.log('🔥 RabbitMQ Firehose Monitor');
			console.log('============================');
			console.log(`Connection: ${connectionUrl}`);
			console.log('');

			// Set up graceful shutdown handlers for CLI
			process.on('SIGINT', async () => {
				console.log('\n🛑 Shutting down monitor...');
				await monitor.stopAndExit();
			});

			process.on('SIGTERM', async () => {
				console.log('\n🛑 Shutting down monitor...');
				await monitor.stopAndExit();
			});

			await monitor.connect();

			// Determine what to monitor based on arguments
			if (args.publishOnly) {
				console.log('📤 Monitoring: Published messages only');
				await monitor.monitorPublishOnly();
			} else if (args.deliverOnly) {
				console.log('📥 Monitoring: Delivered messages only');
				await monitor.monitorDeliverOnly();
			} else if (args.exchange) {
				console.log(`🔀 Monitoring: Exchange "${args.exchange}"`);
				await monitor.monitorExchange(args.exchange);
			} else if (args.queue) {
				console.log(`📮 Monitoring: Queue "${args.queue}"`);
				await monitor.monitorQueue(args.queue);
			} else {
				console.log('📡 Monitoring: All messages (publish + deliver)');
				await monitor.startMonitoring();
			}
		} catch (error) {
			console.error('❌ Error:', error);
			process.exit(1);
		}
	}
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
	console.error('❌ Unhandled Promise Rejection:', reason);
	process.exit(1);
});

// Run the monitor
runMain(main);
