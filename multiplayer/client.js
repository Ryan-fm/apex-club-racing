export class RoomClient{
 constructor(endpoint,{onRoom=()=>{},onStatus=()=>{},WebSocketImpl=globalThis.WebSocket}={}){this.endpoint=endpoint;this.onRoom=onRoom;this.onStatus=onStatus;this.WebSocketImpl=WebSocketImpl;this.pending=new Map();this.nextRequest=0;this.room=null;this.playerId=null;this.resumeToken=null;this.closed=false;this.joined=false;this.retries=0;}
 connect(){
  if(this.socket?.readyState===1)return Promise.resolve();if(this.connecting)return this.connecting;this.closed=false;
  this.connecting=new Promise((resolve,reject)=>{
   this.joined=false;const socket=new this.WebSocketImpl(this.endpoint);this.socket=socket;const timeout=setTimeout(()=>{socket.close();reject(Error('连接超时，请稍后再试。'));},8000);
   socket.onopen=()=>{clearTimeout(timeout);if(!this.resumeToken)this.onStatus('connected');resolve();};
   socket.onerror=()=>{clearTimeout(timeout);reject(Error('无法连接多人服务，请稍后重试。'));};
   socket.onmessage=event=>{let message;try{message=JSON.parse(event.data);}catch{return;}
    if(message.requestId&&this.pending.has(message.requestId)){const task=this.pending.get(message.requestId);clearTimeout(task.timer);this.pending.delete(message.requestId);message.type==='error'?task.reject(Error(message.message)):task.resolve(message.data);}
    else if(message.type==='snapshot'){this.room=message.room;if(this.joined)this.onRoom(message.room);}
    else if(message.type==='error')this.onStatus(message.message);
   };
   socket.onclose=event=>{if(event.code===4001){this.closed=true;this.resumeToken=null;this.onStatus('disconnected');}this.joined=false;clearTimeout(timeout);reject(Error('连接已关闭。'));for(const task of this.pending.values()){clearTimeout(task.timer);task.reject(Error('连接中断。'));}this.pending.clear();this.onStatus(this.closed?'closed':'disconnected');if(!this.closed&&this.resumeToken)this.reconnect();};
  }).finally(()=>{this.connecting=null;});return this.connecting;
 }
 async reconnect(){
  if(this.retries>=5){this.onStatus('重连失败，请退出房间后重新加入。');return;}
  const wait=Math.min(8000,1000*2**this.retries++);clearTimeout(this.reconnectTimer);this.reconnectTimer=setTimeout(async()=>{
   this.reconnectTimer=null;if(this.closed)return;
   try{await this.connect();const result=await this.request('resume',{code:this.room.code,resumeToken:this.resumeToken});this.playerId=result.playerId;this.room=result.room;this.joined=true;this.retries=0;this.onRoom(result.room);this.onStatus('reconnected');}
   catch(error){if(this.socket?.readyState===1){this.resumeToken=null;this.onStatus(error.message);}else if(!this.reconnectTimer&&!this.closed)this.reconnect();}
  },wait);
 }
 request(type,data={}){
  if(this.socket?.readyState!==1)return Promise.reject(Error('多人服务尚未连接。'));
  if(!this.joined&&!['create','join','resume'].includes(type))return Promise.reject(Error('房间身份正在恢复，请稍后重试。'));
  const requestId=++this.nextRequest;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(requestId);reject(Error('请求超时，请稍后重试。'));},10000);this.pending.set(requestId,{resolve,reject,timer});this.socket.send(JSON.stringify({type,...data,requestId}));});
 }
 async enter(type,data){await this.connect();const result=await this.request(type,data);this.playerId=result.playerId;this.resumeToken=result.resumeToken;this.room=result.room;this.joined=true;this.retries=0;this.onRoom(result.room);return result;}
 async restoreSession(saved){
  if(saved?.endpoint!==this.endpoint||typeof saved.code!=='string'||typeof saved.resumeToken!=='string')throw Error('恢复信息无效。');
  this.resumeToken=saved.resumeToken;this.room={code:saved.code};
  try{await this.connect();const result=await this.request('resume',{code:saved.code,resumeToken:saved.resumeToken});this.playerId=result.playerId;this.room=result.room;this.joined=true;this.retries=0;this.onRoom(result.room);this.onStatus('reconnected');return result;}
  catch(error){this.resumeToken=null;this.room=null;this.closed=true;this.socket?.close();throw error;}
 }
 input(seq,input){if(this.joined&&this.socket?.readyState===1&&this.socket.bufferedAmount<65536)this.socket.send(JSON.stringify({type:'input',seq,input}));}
 async leave(){this.resumeToken=null;this.closed=true;clearTimeout(this.reconnectTimer);try{if(this.socket?.readyState===1)await this.request('leave');}finally{this.room=null;this.playerId=null;this.socket?.close();}}
}
