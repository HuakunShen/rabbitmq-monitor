import { Hono } from 'hono';
import boxen from 'boxen';
import { serve } from '@hono/node-server';
import { Server } from 'socket.io';
import { serveStatic } from '@hono/node-server/serve-static';

const app = new Hono();

app.use('/*', serveStatic({ root: './build' }));
const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const httpServer = serve({
	fetch: app.fetch,
	port: port
});

const io = new Server(httpServer, {
	/* options */
});

io.on('connection', (socket) => {
	console.log('a user connected to the server');
});
console.log(
	boxen(`Server is running on port ${port}`, {
		padding: 1,
		borderStyle: 'double',
		width: process.stdout.columns,
		textAlignment: 'center'
	})
);
