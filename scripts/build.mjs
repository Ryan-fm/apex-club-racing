import {mkdir,copyFile,cp,readFile,writeFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname} from 'node:path';
const files=['ui-polish.css','track-routes.js','track-route-view.js','multiplayer/showroom.js','multiplayer/config.js','multiplayer/ui.js','multiplayer/client.js','multiplayer/simulation.js','multiplayer/prediction.js','multiplayer/rooms.css','online-config.js','online-club.js','online-club.css','harbor-scene.js','language.css','kart-model.js','kart-customization.js','garage-config.js','vehicle-finish.js','keyboard-controls.js','keyboard-settings.js','showroom-design.js','lobby.css','race-refresh.css','race-experience.js','track-layout.js','localization.js','pickup-design.js','citadel-gate.js','stunt-model.js','scene-design.js','index.html','race.html','leaderboard.html','account.html','site.css','site.js','style.css','bootstrap.js','game.js','driver-studio.js','kart-catalog.js','race-rules.js','driving-model.js','race-effects.js','race-audio.js','armored-kart.js','garage.html','garage.js','garage.css','mobile-controls.js','runtime/input-frame.js','runtime/performance.js','runtime/race-ui.js','runtime/player-simulation.js','runtime/gate-sprint.js','runtime/race-presenter.js','diagnostics/gate-replay.js'];
const assets=['assets/home-hero.jpg','assets/home-promo.mp4','assets/home-promo-vertical.mp4'];
await rm('dist',{recursive:true,force:true});
await mkdir('dist',{recursive:true});
for(const file of files){await mkdir(dirname(`dist/${file}`),{recursive:true});await copyFile(file,`dist/${file}`);}
for(const file of assets){await mkdir(dirname(`dist/${file}`),{recursive:true});await copyFile(file,`dist/${file}`);}
await cp('vendor','dist/vendor',{recursive:true});
if(process.env.MULTIPLAYER_WS_URL){const endpoint=new URL(process.env.MULTIPLAYER_WS_URL);if(endpoint.protocol!=='wss:')throw Error('MULTIPLAYER_WS_URL must use wss://');await writeFile('dist/multiplayer/config.js',`export const MULTIPLAYER_CONFIG={endpoint:${JSON.stringify(endpoint.href)}};\nexport function multiplayerEndpoint(){return MULTIPLAYER_CONFIG.endpoint;}\n`);}
// Content-based release revision invalidates every local module after deployment.
const hash=createHash('sha256');hash.update(await readFile('scripts/build.mjs'));for(const file of [...files,...assets])hash.update(await readFile(`dist/${file}`));const version=hash.digest('hex').slice(0,12);
for(const file of files){let s=await readFile(`dist/${file}`,'utf8');s=s.replace(/(['"])((?:\.\/|\.\.\/)[^'"?]+\.(?:js|css))(?:\?v=[^'"]*)?\1/g,(_,q,p)=>`${q}${p}?v=${version}${q}`);await writeFile(`dist/${file}`,s);}
await writeFile('dist/_headers','/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Cache-Control: no-cache\n');
console.log(`Static release ${version} built in dist/. No runtime CDN or build dependencies.`);
