// Keep render preparation outside race time, and ignore stale completions after
// returning to the lobby. A failed warmup never poisons the retry cache.
export function createRacePreparation({prepare,setBusy=()=>{},onError=()=>{},now=()=>performance.now()}){
 const ready=new Set();let generation=0,pending=null,busy=false,last=null;
 function cancel(){generation++;pending=null;if(busy){busy=false;setBusy(false);}}
 function run(key){
  if(pending?.key===key)return pending.promise;
  const token=++generation,started=now(),cached=ready.has(key);
  busy=true;setBusy(true);
  const isCurrent=()=>token===generation;
  const promise=Promise.resolve().then(()=>prepare({cached,isCurrent})).then(()=>{
   if(!isCurrent())return false;
   ready.add(key);last={key,cached,success:true,durationMs:Math.round((now()-started)*10)/10};return true;
  },error=>{
   if(!isCurrent())return false;
   last={key,cached,success:false,durationMs:Math.round((now()-started)*10)/10};onError(error);return false;
  }).finally(()=>{if(isCurrent()){pending=null;busy=false;setBusy(false);}});
  pending={key,promise};return promise;
 }
 return {run,cancel,get busy(){return busy;},report:()=>last};
}
