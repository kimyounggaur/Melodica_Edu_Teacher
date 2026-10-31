import {readFile,readdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
const root=new URL('../dist/',import.meta.url);
const {version:appVersion}=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
const contentVersion='1.0.0';
const files=[];
async function visit(dir=''){
  for(const entry of await readdir(new URL(dir,root),{withFileTypes:true})){
    const rel=join(dir,entry.name).replaceAll('\\','/');
    if(entry.isDirectory())await visit(rel+'/');
    else if(!['offline-manifest.json','sw.js'].includes(rel)&&!rel.endsWith('.map')){
      const bytes=await readFile(new URL(rel,root));files.push({path:'/'+rel,sha256:createHash('sha256').update(bytes).digest('hex'),size:bytes.length});
    }
  }
}
await visit();files.sort((a,b)=>a.path.localeCompare(b.path));
const version=createHash('sha256').update(JSON.stringify({appVersion,contentVersion,files})).digest('hex').slice(0,20);
await writeFile(new URL('offline-manifest.json',root),JSON.stringify({schemaVersion:1,appVersion,contentVersion,version,files},null,2));
console.log(`Offline manifest: ${files.length} verified resources, bundle ${version}`);
