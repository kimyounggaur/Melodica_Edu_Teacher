export interface Settings {bpm:number;volume:number;showNames:boolean;showFingers:boolean;showHand:boolean;reducedMotion:boolean;ctrlEnabled:boolean;instrumentLow:number|null;instrumentHigh:number|null}
const KEY='melodica.settings.v1';
const APP='1.0.0';
const prefersReduced=()=>typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const defaultSettings:Settings={bpm:60,volume:0.25,showNames:true,showFingers:true,showHand:true,reducedMotion:prefersReduced(),ctrlEnabled:false,instrumentLow:null,instrumentHigh:null};
type Envelope<T>={schemaVersion:1;appVersion:string;contentVersion:string;updatedAt:string;data:T};
const wrap=<T,>(data:T):Envelope<T>=>({schemaVersion:1,appVersion:APP,contentVersion:APP,updatedAt:new Date().toISOString(),data});
export function readLocal<T>(key:string,fallback:T):T {
  try {const raw=localStorage.getItem(key);if(!raw)return fallback;const value=JSON.parse(raw);return value?.schemaVersion===1&&value.data!==undefined?value.data as T:fallback;}catch{return fallback;}
}
export function writeLocal(key:string,value:unknown):boolean {try{localStorage.setItem(key,JSON.stringify(wrap(value)));return true;}catch{return false;}}
function parseSettings(value:unknown,strict=false):Settings {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('설정 형식을 확인해 주세요.');
  const obj=value as Record<string,unknown>;
  const result={...defaultSettings};
  const invalid=(key:string)=>{if(strict)throw new Error(`${key} 설정값을 확인해 주세요.`);};
  for(const key of ['showNames','showFingers','showHand','reducedMotion','ctrlEnabled'] as const){if(key in obj){if(typeof obj[key]==='boolean')result[key]=obj[key] as boolean;else invalid(key);}}
  if('bpm' in obj){if(typeof obj.bpm==='number'&&Number.isFinite(obj.bpm)&&obj.bpm>=40&&obj.bpm<=120&&obj.bpm%5===0)result.bpm=obj.bpm;else invalid('속도');}
  if('volume' in obj){if(typeof obj.volume==='number'&&Number.isFinite(obj.volume)&&obj.volume>=0&&obj.volume<=1)result.volume=obj.volume;else invalid('음량');}
  for(const key of ['instrumentLow','instrumentHigh'] as const){if(key in obj){const n=obj[key];if(n===null||(typeof n==='number'&&Number.isInteger(n)&&n>=0&&n<=127))result[key]=n;else invalid('악기 음역');}}
  if((result.instrumentLow===null)!==(result.instrumentHigh===null)||(result.instrumentLow!==null&&result.instrumentHigh!==null&&result.instrumentLow>result.instrumentHigh)){
    if(strict)throw new Error('악기 최저음과 최고음을 함께 올바르게 입력해 주세요.');result.instrumentLow=null;result.instrumentHigh=null;
  }
  if(strict&&Object.keys(obj).some(k=>!(k in result)))throw new Error('알 수 없는 설정 항목이 포함되어 있어요.');
  return result;
}
export function loadSettings():Settings {try{return parseSettings(readLocal<unknown>(KEY,defaultSettings));}catch{return {...defaultSettings};}}
export function saveSettings(settings:Settings):boolean {return writeLocal(KEY,parseSettings(settings));}
export function exportSettings(settings:Settings):void {
  const blob=new Blob([JSON.stringify(wrap(parseSettings(settings)),null,2)],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='melodica-settings.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export async function importSettings(file:File):Promise<Settings>{
  if(file.size>100*1024)throw new Error('설정 파일은 100KB 이하만 가져올 수 있어요.');
  let parsed:unknown;try{parsed=JSON.parse(await file.text());}catch{throw new Error('올바른 JSON 설정 파일이 아니에요.');}
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error('설정 파일 형식을 확인해 주세요.');
  const env=parsed as Record<string,unknown>;
  if(env.schemaVersion!==1)throw new Error('지원하지 않는 설정 버전이에요. 기존 설정은 유지됩니다.');
  return parseSettings(env.data,true);
}
