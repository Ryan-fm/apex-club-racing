// Set to the publicly deployed multiplayer server's wss://.../ws endpoint.
// Empty: local standalone server uses /ws, Vercel uses shared /api/rooms.
export const MULTIPLAYER_CONFIG={endpoint:''};
export function multiplayerEndpoint(location){
 if(MULTIPLAYER_CONFIG.endpoint)return MULTIPLAYER_CONFIG.endpoint;
 if(location.port==='8082')return `${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/ws`;
 if(location.protocol==='https:'&&(location.hostname==='apex-club-racing.vercel.app'||/^apex-club-racing-[a-z0-9-]+-ryan-1d85\.vercel\.app$/.test(location.hostname)))return `wss://${location.host}/api/rooms`;
 return '';
}
