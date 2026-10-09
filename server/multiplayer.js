import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {WebSocketServer} from 'ws';
import {RoomService} from './rooms.js';
import {PHYSICS_DT} from '../multiplayer/simulation.js';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.mp4':'video/mp4','.svg':'image/svg+xml'};
export function createMultiplayerServer({staticRoot=resolve('dist'),allowedOrigins=[],rooms=new RoomService()}={}){
 const root=resolve(staticRoot);
 const server=createServer(async(req,res)=>{
  if(req.url==='/health'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true,rooms:rooms.rooms.size}));return;}
  try{
   const url=new URL(req.url,'http://localhost');let path=resolve(root,'.'+decodeURIComponent(url.pathname));if(path===root)path=resolve(root,'index.html');
   if(!path.startsWith(root+sep)||!mime[extname(path)]){res.writeHead(404);res.end();return;}const info=await stat(path);if(!info.isFile())throw Error('not a file');
   res.writeHead(200,{'Content-Type':mime[extname(path)],'Content-Length':info.size,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});createReadStream(path).pipe(res);
  }catch{res.writeHead(404);res.end('Not found');}
 });
 const wss=new WebSocketServer({noServer:true,maxPayload:4096,perMessageDeflate:false});
 server.on('upgrade',(req,socket,head)=>{
  if(new URL(req.url,'http://localhost').pathname!=='/ws'||wss.clients.size>=200||(allowedOrigins.length&&!allowedOrigins.includes(req.headers.origin))){socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');socket.destroy();return;}
  wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws));
 });
 wss.on('connection',ws=>{
  const connection={send:message=>{if(ws.readyState===1&&ws.bufferedAmount<256*1024)ws.send(JSON.stringify(message));}};rooms.attach(connection);let count=0,lastWindow=Date.now();ws.alive=true;
  ws.on('pong',()=>ws.alive=true);
  ws.on('message',raw=>{
   if(Date.now()-lastWindow>=1000){count=0;lastWindow=Date.now();}if(++count>150){ws.close(1008,'Too many messages');return;}
   let message;try{message=JSON.parse(raw);const data=rooms.handle(connection,message);if(message.requestId)connection.send({type:'response',requestId:message.requestId,data});}
   catch(error){connection.send({type:'error',requestId:message?.requestId,message:error.message});}
  });ws.on('error',()=>{});ws.on('close',()=>rooms.detach(connection));
 });
 let last=performance.now(),accumulator=0,ticks=0;
 const timer=setInterval(()=>{const now=performance.now();accumulator+=Math.min(.1,(now-last)/1000);last=now;while(accumulator>=PHYSICS_DT){rooms.tick();accumulator-=PHYSICS_DT;if(++ticks%3===0)for(const room of rooms.rooms.values())if(room.phase!=='lobby')rooms.broadcast(room);}},8);
 const heartbeat=setInterval(()=>{for(const ws of wss.clients){if(!ws.alive){ws.terminate();continue;}ws.alive=false;ws.ping();}},10000);
 const close=async()=>{clearInterval(timer);clearInterval(heartbeat);for(const ws of wss.clients)ws.terminate();await new Promise(resolve=>wss.close(resolve));await new Promise(resolve=>server.close(resolve));};
 return {server,wss,rooms,close};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const app=createMultiplayerServer({allowedOrigins:(process.env.MULTIPLAYER_ALLOWED_ORIGINS||'').split(',').filter(Boolean)});
 app.server.listen(Number(process.env.PORT||8082),'0.0.0.0',()=>console.log('APEX multiplayer server ready on port '+(process.env.PORT||8082)));
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>app.close().then(()=>process.exit()));
}
