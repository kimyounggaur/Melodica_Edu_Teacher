import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash, webcrypto} from 'node:crypto';
import vm from 'node:vm';

test('offline preparation commits only a complete hash-verified bundle and detects eviction',async()=>{
  const stores=new Map();
  const keyOf=k=>typeof k==='string'?k:new URL(k.url).pathname;
  const caches={
    async open(name){if(!stores.has(name))stores.set(name,new Map());const m=stores.get(name);return {
      async put(key,value){m.set(keyOf(key),value.clone());},
      async match(key){return m.get(keyOf(key))?.clone();},
    };},
    async keys(){return [...stores.keys()];},
    async delete(name){return stores.delete(name);},
  };
  const contents={'/index.html':'<main>수업</main>','/assets/app.js':'app();'};
  const manifest={version:'test-complete-bundle',files:Object.entries(contents).map(([path,body])=>({path,sha256:createHash('sha256').update(body).digest('hex')}))};
  let failAsset=true;
  const handlers=new Map();
  const self={location:{origin:'https://class.example'},clients:{claim:async()=>{}},addEventListener(type,fn){handlers.set(type,fn);}};
  const fetch=async path=>{
    if(path==='/offline-manifest.json')return new Response(JSON.stringify(manifest));
    if(path==='/assets/app.js'&&failAsset)return new Response('failed',{status:500});
    return new Response(contents[path]??'',{status:path in contents?200:404});
  };
  const context=vm.createContext({self,caches,crypto:webcrypto,fetch,Response,URL,console,setTimeout,clearTimeout});
  vm.runInContext(await readFile(new URL('../public/sw.js',import.meta.url),'utf8'),context);
  async function message(kind){const messages=[];let promise;handlers.get('message')({data:{kind},ports:[{postMessage(data){messages.push(data);}}],waitUntil(p){promise=p;}});await promise;return messages;}
  let replies=await message('PREPARE');
  assert.equal(replies.at(-1).type,'ERROR');
  replies=await message('CHECK');
  assert.equal(replies.at(-1).state.ready,false);
  assert.equal(replies.at(-1).state.count,0);
  failAsset=false;
  replies=await message('PREPARE');
  assert.equal(replies.at(-1).type,'DONE');
  assert.equal(replies.at(-1).state.ready,true);
  assert.equal(replies.at(-1).state.count,2);
  stores.get('melodica-bundle-test-complete-bundle').delete('/assets/app.js');
  replies=await message('CHECK');
  assert.equal(replies.at(-1).state.ready,false);
  assert.equal(replies.at(-1).state.count,1);
});
