// Set to the publicly deployed multiplayer server's wss://.../ws endpoint.
// Empty: standalone server uses its own /ws; other deployments hide multiplayer.
export const MULTIPLAYER_CONFIG={endpoint:''};
export function multiplayerEndpoint(location){
 if(MULTIPLAYER_CONFIG.endpoint)return MULTIPLAYER_CONFIG.endpoint;
 if(location.port==='8082')return `${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/ws`;
 return '';
}
