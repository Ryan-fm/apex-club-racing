import {createDistributedServer} from '../server/vercel-multiplayer.js';
// Vercel accepts an exported Node HTTP server and handles WebSocket upgrades.
// Redis is shared by all instances and by replacement connections/deployments.
export default createDistributedServer().server;
