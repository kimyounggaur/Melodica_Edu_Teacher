/* No install-time skipWaiting or forced update: current lessons remain running. */
const META='melodica-offline-meta-v1';
const META_KEY='/__melodica_active_bundle__';
const PREFIX='melodica-bundle-';
self.addEventListener('install',()=>{});
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
async function activeManifest(){const meta=await caches.open(META);const response=await meta.match(META_KEY);return response?response.json():null;}
async function digest(response){const bytes=await response.arrayBuffer();const hash=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('');}
async function inspect(){
  const manifest=await activeManifest();if(!manifest)return {ready:false,count:0,total:0};
  const cache=await caches.open(PREFIX+manifest.version);let count=0;
  for(const file of manifest.files){const r=await cache.match(file.path);if(r&&await digest(r)===file.sha256)count++;}
  return {ready:count===manifest.files.length,count,total:manifest.files.length};
}
let preparing=null;
async function prepare(port){
  const response=await fetch('/offline-manifest.json',{cache:'no-store'});if(!response.ok)throw new Error('배포된 수업 자료를 찾을 수 없어요.');
  const manifest=await response.json();
  if(!manifest.version||!Array.isArray(manifest.files)||!manifest.files.length)throw new Error('자료 목록을 확인할 수 없어요.');
  if(manifest.files.some(f=>typeof f.path!=='string'||!f.path.startsWith('/')||f.path.startsWith('//')||typeof f.sha256!=='string'))throw new Error('올바른 자료 목록이 아니에요.');
  const name=PREFIX+manifest.version;const cache=await caches.open(name);let count=0;
  for(const file of manifest.files){
    let stored=await cache.match(file.path);
    if(!stored||await digest(stored.clone())!==file.sha256){
      const resource=await fetch(file.path,{cache:'reload'});
      if(!resource.ok||resource.type==='opaque'||await digest(resource.clone())!==file.sha256)throw new Error(`${file.path} 자료를 끝까지 준비하지 못했어요.`);
      await cache.put(file.path,resource);
    }
    count++;port.postMessage({type:'PROGRESS',count,total:manifest.files.length});
  }
  /* The active pointer is committed only after every resource passed its hash. */
  const meta=await caches.open(META);await meta.put(META_KEY,new Response(JSON.stringify(manifest),{headers:{'Content-Type':'application/json'}}));
  const all=await caches.keys();const older=all.filter(k=>k.startsWith(PREFIX)&&k!==name);
  // Retain one prior verified bundle for rollback and in-flight hashed asset requests.
  for(const old of older.slice(0,-1))await caches.delete(old);
  return inspect();
}
self.addEventListener('message',event=>{
  const port=event.ports[0];if(!port)return;
  event.waitUntil((async()=>{try{
    let state;if(event.data?.kind==='PREPARE'){
      if(preparing)throw new Error('이미 수업 자료를 준비하고 있어요. 잠시 후 확인해 주세요.');
      preparing=prepare(port);try{state=await preparing;}finally{preparing=null;}
    }else state=await inspect();
    port.postMessage({type:'DONE',state});
  }catch(error){port.postMessage({type:'ERROR',message:error instanceof Error?error.message:'준비를 완료하지 못했어요.'});}})());
});
self.addEventListener('fetch',event=>{
  const req=event.request;const url=new URL(req.url);if(req.method!=='GET'||url.origin!==self.location.origin)return;
  if(url.pathname==='/offline-manifest.json'||url.pathname==='/sw.js')return;
  event.respondWith((async()=>{
    // Online navigations update normally. Offline navigations use only a complete bundle.
    if(req.mode==='navigate'){
      try{return await fetch(req);}catch{
        const manifest=await activeManifest();if(manifest){const cache=await caches.open(PREFIX+manifest.version);const page=await cache.match('/index.html');if(page)return page;}
        return new Response('수업 자료가 아직 준비되지 않았습니다. 인터넷 연결 후 오프라인 준비를 실행해 주세요.',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}});
      }
    }
    const manifest=await activeManifest();if(manifest){const cache=await caches.open(PREFIX+manifest.version);const cached=await cache.match(req);if(cached)return cached;}
    const all=await caches.keys();for(const name of all.filter(k=>k.startsWith(PREFIX))){const old=await (await caches.open(name)).match(req);if(old)return old;}
    return fetch(req);
  })());
});
