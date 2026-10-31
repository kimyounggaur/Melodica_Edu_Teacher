type OfflineState={ready:boolean;count:number;total:number};
let registration:Promise<ServiceWorkerRegistration>|null=null;
export async function registerOffline():Promise<void>{
  if(!('serviceWorker' in navigator))throw new Error('이 브라우저는 오프라인 준비를 지원하지 않아요.');
  registration??=navigator.serviceWorker.register('/sw.js',{scope:'/'});
  await registration;
}
async function worker():Promise<ServiceWorker>{
  await registerOffline();const reg=await registration!;
  if(reg.active)return reg.active;
  const current=reg.installing??reg.waiting;
  if(!current)throw new Error('오프라인 준비를 다시 눌러 주세요.');
  await new Promise<void>((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('오프라인 준비 시간이 초과됐어요.')),15000);current.addEventListener('statechange',()=>{if(current.state==='activated'){clearTimeout(timeout);resolve();}else if(current.state==='redundant'){clearTimeout(timeout);reject(new Error('서비스 작업자를 다시 준비해 주세요.'));}});});
  if(!reg.active)throw new Error('오프라인 준비를 다시 눌러 주세요.');return reg.active;
}
async function send(kind:'CHECK'|'PREPARE',onProgress?:(n:number,total:number)=>void):Promise<OfflineState>{
  const sw=await worker();return new Promise((resolve,reject)=>{const channel=new MessageChannel();const timeout=setTimeout(()=>{channel.port1.close();reject(new Error('준비를 완료하지 못했어요. 연결 상태를 확인하고 다시 시도해 주세요.'));},90000);
    channel.port1.onmessage=({data})=>{if(data.type==='PROGRESS'){onProgress?.(data.count,data.total);return;}clearTimeout(timeout);channel.port1.close();if(data.type==='ERROR')reject(new Error(data.message));else resolve(data.state);};sw.postMessage({kind},[channel.port2]);
  });
}
export async function prepareOffline(onProgress:(n:number,total:number)=>void):Promise<void>{const result=await send('PREPARE',onProgress);if(!result.ready)throw new Error('필수 자료 준비가 끝나지 않았어요.');}
export async function checkOffline():Promise<OfflineState>{try{return await send('CHECK');}catch{return {ready:false,count:0,total:0};}}
