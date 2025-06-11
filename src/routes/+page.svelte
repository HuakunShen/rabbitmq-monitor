<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { io, type Socket } from 'socket.io-client';
	import { Inspect } from 'svelte-inspect-value';
	import { dev } from '$app/environment';

	interface FirehoseMessage {
		id: string;
		timestamp: string;
		displayTime: string;
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

	interface ConnectionStatus {
		connected: boolean;
		clientCount: number;
		monitoringActive: boolean;
	}

	interface MonitoringStatus {
		active: boolean;
		message: string;
	}

	interface MonitoringError {
		error: string;
		timestamp: string;
	}

	let socket: Socket | null = null;
	let messages: FirehoseMessage[] = [];
	let connectionStatus: ConnectionStatus = {
		connected: false,
		clientCount: 0,
		monitoringActive: false
	};
	let monitoringStatus: MonitoringStatus = {
		active: false,
		message: 'Not connected'
	};
	let lastError: MonitoringError | null = null;
	let maxMessages = 100;
	let autoScroll = true;
	let messagesContainer: HTMLDivElement;

	// Filter states
	let actionFilter: 'all' | 'publish' | 'deliver' = 'all';
	let exchangeFilter = '';
	let isPaused = false;

	$: filteredMessages = messages.filter((msg) => {
		if (actionFilter !== 'all' && msg.action !== actionFilter) return false;
		if (exchangeFilter && !msg.exchange.toLowerCase().includes(exchangeFilter.toLowerCase()))
			return false;
		return true;
	});

	// Debug button states
	$: monitorToggleDisabled = !connectionStatus.connected;
	$: console.log('🔘 Button State:', {
		toggleDisabled: monitorToggleDisabled,
		connected: connectionStatus.connected,
		monitoringActive: monitoringStatus.active,
		monitoringMessage: monitoringStatus.message
	});

	onMount(() => {
		connectToServer();

		return () => {
			if (socket) {
				socket.disconnect();
			}
		};
	});

	onDestroy(() => {
		if (socket) {
			socket.disconnect();
		}
	});

	function connectToServer() {
		socket = io(dev ? 'http://localhost:3000' : undefined);

		socket.on('connect', () => {
			console.log('Connected to server');
		});

		socket.on('connection-status', (status: ConnectionStatus) => {
			connectionStatus = status;
			// Don't override monitoring status here - let monitoring-status event handle it
		});

		socket.on('firehose-message', (message: FirehoseMessage) => {
			if (!isPaused) {
				addMessage(message);
			}
		});

		socket.on('monitoring-status', (status: MonitoringStatus) => {
			console.log('📊 Monitoring status update:', status);
			monitoringStatus = status;
			lastError = null;
		});

		socket.on('monitoring-error', (error: MonitoringError) => {
			lastError = error;
			monitoringStatus = { active: false, message: `Error: ${error.error}` };
		});

		socket.on('disconnect', () => {
			connectionStatus = { connected: false, clientCount: 0, monitoringActive: false };
			monitoringStatus = { active: false, message: 'Disconnected from server' };
		});
	}

	function addMessage(message: FirehoseMessage) {
		messages = [message, ...messages.slice(0, maxMessages - 1)];

		if (autoScroll && messagesContainer) {
			setTimeout(() => {
				messagesContainer.scrollTop = 0;
			}, 10);
		}
	}

	function startMonitoring() {
		console.log('🚀 Starting monitoring...');
		if (socket) {
			socket.emit('start-monitoring');
		}
	}

	function stopMonitoring() {
		console.log('🛑 Stopping monitoring...');
		if (socket) {
			socket.emit('stop-monitoring');
		}
	}

	function toggleMonitoring() {
		if (monitoringStatus.active) {
			stopMonitoring();
		} else {
			startMonitoring();
		}
	}

	function clearMessages() {
		messages = [];
	}

	function togglePause() {
		isPaused = !isPaused;
	}

	function getActionColor(action: string): string {
		return action === 'publish' ? 'text-blue-400' : 'text-green-400';
	}

	function getActionIcon(action: string): string {
		return action === 'publish' ? '📤' : '📥';
	}
</script>

<div class="min-h-screen bg-gray-900 text-gray-100 p-4 flex flex-col">
	<div class="max-w-7xl mx-auto w-full flex flex-col flex-grow">
		<!-- Header -->
		<div class="bg-gray-800 border border-gray-700 rounded-lg shadow-sm p-6 mb-6">
			<div class="flex items-center justify-between">
				<div>
					<h1 class="text-3xl font-bold text-gray-100 flex items-center gap-2">
						🔥 RabbitMQ Firehose Visualizer
					</h1>
					<p class="text-gray-400 mt-2">Real-time monitoring of RabbitMQ message flows</p>
				</div>

				<!-- Connection Status -->
				<div class="text-right">
					<div class="flex items-center gap-2 mb-2">
						<div
							class="w-3 h-3 rounded-full {connectionStatus.connected
								? 'bg-green-500'
								: 'bg-red-500'}"
						></div>
						<span class="text-sm font-medium text-gray-300">
							{connectionStatus.connected ? 'Connected' : 'Disconnected'}
						</span>
					</div>
					<div class="text-xs text-gray-500">
						{connectionStatus.clientCount} client{connectionStatus.clientCount !== 1 ? 's' : ''}
					</div>
				</div>
			</div>
		</div>

		<!-- Controls -->
		<div class="bg-gray-800 border border-gray-700 rounded-lg shadow-sm p-6 mb-6">
			<div class="flex flex-wrap gap-4 items-center justify-between">
				<!-- Monitoring Controls -->
				<div class="flex items-center gap-4">
					<button
						on:click={toggleMonitoring}
						disabled={monitorToggleDisabled}
						class="{monitoringStatus.active
							? 'bg-red-600 hover:bg-red-700'
							: 'bg-green-600 hover:bg-green-700'} disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 min-w-[160px]"
					>
						{monitoringStatus.active ? '⏹️ Stop Monitoring' : '▶️ Start Monitoring'}
					</button>

					<button
						on:click={togglePause}
						class="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2"
					>
						{isPaused ? '▶️ Resume' : '⏸️ Pause'}
					</button>

					<button
						on:click={clearMessages}
						class="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2"
					>
						🗑️ Clear
					</button>
				</div>

				<!-- Status -->
				<div class="flex items-center gap-4">
					<div class="text-sm">
						<span class="font-medium text-gray-300">Status:</span>
						<span class="ml-2 {monitoringStatus.active ? 'text-green-400' : 'text-gray-400'}">
							{monitoringStatus.message}
						</span>
					</div>
					<div class="text-sm text-gray-400">
						{messages.length} messages
					</div>
				</div>
			</div>

			<!-- Filters -->
			<div class="mt-4 pt-4 border-t border-gray-600">
				<div class="flex flex-wrap gap-4 items-center">
					<div class="flex items-center gap-2">
						<label class="text-sm font-medium text-gray-300">Action:</label>
						<select
							bind:value={actionFilter}
							class="bg-gray-700 border border-gray-600 text-gray-200 rounded px-2 py-1 text-sm"
						>
							<option value="all">All</option>
							<option value="publish">Publish Only</option>
							<option value="deliver">Deliver Only</option>
						</select>
					</div>

					<div class="flex items-center gap-2">
						<label class="text-sm font-medium text-gray-300">Exchange:</label>
						<input
							type="text"
							bind:value={exchangeFilter}
							placeholder="Filter by exchange..."
							class="bg-gray-700 border border-gray-600 text-gray-200 placeholder-gray-500 rounded px-2 py-1 text-sm w-40"
						/>
					</div>

					<div class="flex items-center gap-2">
						<label class="text-sm font-medium text-gray-300">Max messages:</label>
						<input
							type="number"
							bind:value={maxMessages}
							min="10"
							max="1000"
							class="bg-gray-700 border border-gray-600 text-gray-200 rounded px-2 py-1 text-sm w-20"
						/>
					</div>

					<label class="flex items-center gap-2 text-sm text-gray-300">
						<input type="checkbox" bind:checked={autoScroll} class="text-blue-500" />
						Auto-scroll
					</label>
				</div>
			</div>

			<!-- Error Display -->
			{#if lastError}
				<div class="mt-4 p-3 bg-red-900/20 border border-red-700 rounded-lg">
					<div class="flex items-center gap-2 text-red-300">
						<span>❌</span>
						<span class="font-medium">Error:</span>
						<span>{lastError.error}</span>
						<span class="text-xs text-red-400 ml-auto"
							>{new Date(lastError.timestamp).toLocaleTimeString()}</span
						>
					</div>
				</div>
			{/if}
		</div>

		<!-- Messages List -->
		<div class="bg-gray-800 border border-gray-700 rounded-lg shadow-sm flex flex-col flex-grow">
			<div class="p-4 border-b border-gray-600">
				<h2 class="text-lg font-semibold text-gray-200">
					Live Messages ({filteredMessages.length})
				</h2>
			</div>

			<div bind:this={messagesContainer} class="flex-grow overflow-y-auto">
				{#if filteredMessages.length === 0}
					<div class="p-8 text-center text-gray-400">
						{#if isPaused}
							⏸️ Messages paused. Click Resume to continue.
						{:else if !monitoringStatus.active}
							📡 No messages yet. Start monitoring to see live data.
						{:else}
							⏳ Waiting for messages...
						{/if}
					</div>
				{:else}
					{#each filteredMessages as message (message.id)}
						<div class="border-b border-gray-700 p-4 hover:bg-gray-750">
							<div class="flex items-start justify-between mb-2">
								<div class="flex items-center gap-2">
									<span class="text-lg">{getActionIcon(message.action)}</span>
									<span class="font-medium {getActionColor(message.action)}">
										{message.action.toUpperCase()}
									</span>
									<span class="text-gray-400">→</span>
									<span class="font-mono text-sm bg-gray-700 text-gray-200 px-2 py-1 rounded">
										{message.target}
									</span>
								</div>
								<span class="text-xs text-gray-500">{message.displayTime}</span>
							</div>

							<div class="grid grid-cols-2 gap-4 mb-3 text-sm">
								<div>
									<span class="font-medium text-gray-300">Exchange:</span>
									<span class="ml-2 font-mono text-gray-200">{message.exchange}</span>
								</div>
								<div>
									<span class="font-medium text-gray-300">Routing Key:</span>
									<span class="ml-2 font-mono text-gray-200">{message.routingKey}</span>
								</div>
								{#if message.messageId}
									<div>
										<span class="font-medium text-gray-300">Message ID:</span>
										<span class="ml-2 font-mono text-xs text-gray-200">{message.messageId}</span>
									</div>
								{/if}
								<div>
									<span class="font-medium text-gray-300">Size:</span>
									<span class="ml-2 text-gray-200">{message.bodyLength} bytes</span>
								</div>
							</div>

							{#if message.headers && Object.keys(message.headers).length > 0}
								<div class="mb-3">
									<span class="font-medium text-gray-300 text-sm">Headers:</span>
									<div
										class="mt-1 bg-gray-900 border border-gray-600 p-2 rounded text-xs max-h-32 overflow-y-auto"
									>
										<Inspect value={message.headers} />
									</div>
								</div>
							{/if}

							<div>
								<span class="font-medium text-gray-300 text-sm">Body:</span>
								<div
									class="mt-1 bg-gray-900 border border-gray-600 p-2 rounded text-xs max-h-32 overflow-y-auto"
								>
									<Inspect value={message.body} />
								</div>
							</div>
						</div>
					{/each}
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	/* Custom scrollbar styling */
	:global(.overflow-y-auto::-webkit-scrollbar) {
		width: 8px;
	}

	:global(.overflow-y-auto::-webkit-scrollbar-track) {
		background: #374151;
		border-radius: 4px;
	}

	:global(.overflow-y-auto::-webkit-scrollbar-thumb) {
		background: #6b7280;
		border-radius: 4px;
	}

	:global(.overflow-y-auto::-webkit-scrollbar-thumb:hover) {
		background: #9ca3af;
	}
</style>
