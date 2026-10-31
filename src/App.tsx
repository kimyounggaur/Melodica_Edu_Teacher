import {useEffect,useRef,useState} from 'react';
import {BookOpen, ChevronLeft, ChevronRight, Play, Pause, Square, Repeat2, Volume2, VolumeX, Settings2, Maximize2, X, Keyboard as KeyboardIcon, Hand, Music2, Wind, Check, Download, Upload, WifiOff, HelpCircle, Eye, EyeOff, ArrowRight, Sparkles, Layers, RotateCcw, PanelTop, CheckCircle2} from 'lucide-react';
import {Keyboard,Staff} from './Stage';
import {fingerFor,pitchName,solfege,safeRestartTick,positionAt, type Position,type Piece} from './domain';
import {MusicEngine,type Frame} from './audio';
import {units,pieces,quizzes} from './content';
import {defaultSettings,loadSettings,saveSettings,readLocal,writeLocal,exportSettings,importSettings,type Settings} from './storage';
import {registerOffline,prepareOffline,checkOffline} from './offline';

type Mode='observe'|'silent'|'demo'|'follow'|'check';
const modes:[Mode,string,typeof Eye][]=[['observe','보기',Eye],['silent','손연습',Hand],['demo','시범 듣기',Volume2],['follow','함께 연주',Music2],['check','확인',CheckCircle2]];
const lessonList=units.flatMap((u:any)=>u.lessons.map((l:any)=>({...l,unit:u})));
const outline=[60,62,64,65,67,69,71,72];
const restoreLesson=()=>{const s=readLocal<any>('melodica.session.v1',{});return s&&typeof s.lessonId==='string'&&lessonList.some((l:any)=>l.id===s.lessonId)?s.lessonId:'L01';};
const restoreObservations=()=>{const data=readLocal<any>('melodica.observations.v1',{});if(!data||typeof data!=='object'||Array.isArray(data))return {};return Object.fromEntries(Object.entries(data).filter(([k,v])=>/^L\d{2}:/.test(k)&&['미확인','혼자 가능','힌트로 가능','다시 연습'].includes(v as string))) as Record<string,string>;};
const positionLabel=(p:Position)=>p==='c-position'?'도 자리':'파 자리';

export default function App(){
 const [settings,setSettings]=useState<Settings>(loadSettings);
 const [lessonId,setLessonId]=useState(restoreLesson);
 const lesson=lessonList.find((l:any)=>l.id===lessonId)||lessonList[0];
 const [position,setPosition]=useState<Position>(lesson.position);
 const [mode,setMode]=useState<Mode>('observe');
 const [selected,setSelected]=useState<number>(lesson.notes[0]||60);
 const [pressed,setPressed]=useState<number|null>(null);
 const [frame,setFrame]=useState<Frame|null>(null);
 const [status,setStatus]=useState<'READY'|'COUNT_IN'|'PLAYING'|'PAUSED'>('READY');
 const [audioReady,setAudioReady]=useState(false);
 const [repeat,setRepeat]=useState(false);
 const [countIn,setCountIn]=useState(true);
 const [guideVoice,setGuideVoice]=useState(true);
 const [metronome,setMetronome]=useState(true);
 const [pieceId,setPieceId]=useState(lesson.pieceId||'wb-exercise-steps-01');
 const [pairIndex,setPairIndex]=useState(0);
 const [shiftStep,setShiftStep]=useState<number|null>(null);
 const [range,setRange]=useState<[number,number]>([60,72]);
 const [octave,setOctave]=useState(0);
 const [modal,setModal]=useState<'contents'|'settings'|'guide'|null>(null);
 const [teacher,setTeacher]=useState(false);
 const [revealed,setRevealed]=useState(false);
 const [quizIndex,setQuizIndex]=useState(0);
 const [quizChoices,setQuizChoices]=useState<number[]>([]);
 const [loopRange,setLoopRange]=useState<'all'|'first'|'second'>('all');
 const [toast,setToast]=useState('');
 const [offline,setOffline]=useState({ready:false,count:0,total:0});
 const [preparing,setPreparing]=useState(false);
 const [offlineProgress,setOfflineProgress]=useState('');
 const [observations,setObservations]=useState<Record<string,string>>(restoreObservations);
 const [scale,setScale]=useState(1);
 const container=useRef<HTMLDivElement>(null);
 const engineRef=useRef<MusicEngine|null>(null);
 const engine=()=>engineRef.current||(engineRef.current=new MusicEngine());
 const held=useRef(new Map<string,number>());
 const owner=useRef<string|null>(null);
 const resumeTick=useRef(0);
 const eventsRef=useRef<any>({});
 const toastTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const notice=(text:string)=>{setToast(text);if(toastTimer.current)clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(''),4200);};
 const updateSettings=(patch:Partial<Settings>)=>setSettings(s=>({...s,...patch}));
 const stop=(message?:string)=>{setShiftStep(null);engineRef.current?.stop();held.current.clear();owner.current=null;setPressed(null);setFrame(null);setStatus('READY');resumeTick.current=0;if(message)notice(message);};
 const interrupt=()=>{if(status==='PLAYING'||status==='COUNT_IN'){const tick=engine().pause();resumeTick.current=tick;setStatus('PAUSED');setFrame(null);setPressed(null);held.current.clear();owner.current=null;}else{engineRef.current?.stop();setPressed(null);held.current.clear();owner.current=null;}};
 const prepare=async()=>{try{await engine().prepare();setAudioReady(true);engine().setVolume(settings.volume);return true;}catch{notice('소리를 준비하지 못했습니다. 무음 손연습은 계속 사용할 수 있어요.');return false;}};
 const activePiece=():Piece=>{
  if(lesson.kind==='pairs'){
   const pairs=[[60,62],[62,64],[64,65],[65,67],[67,69],[69,71],[71,72]];
   const ns=pairs[pairIndex];return{id:'pair',title:'두 음 연결',meter:4,initialPositionId:pairIndex<4?'c-position':'f-position',totalTicks:7680,events:[...Array.from({length:4},(_,i)=>({id:'n'+i,kind:'note' as const,startTick:i*960,durationTick:960,midi:ns[i%2]})),{id:'r',kind:'rest',startTick:3840,durationTick:3840}]};
  }
  if(lesson.kind==='breath'||lesson.kind==='shift'||lesson.kind==='piece')return pieces[pieceId]||pieces[lesson.pieceId]||Object.values(pieces)[0];
  return{id:'explore',title:'한 음 불고 쉬기',meter:4,initialPositionId:position,totalTicks:3840,events:[{id:'one',kind:'note',startTick:0,durationTick:1920,midi:selected,positionId:position,finger:fingerFor(selected,position)},{id:'rest',kind:'rest',startTick:1920,durationTick:1920}]};
 };
 const piece=activePiece();
 const pieceOptions=({L03:['long2','long4'],L04:['tongue4','rest4','long4','tie-demo'],L09:['shift-demo'],L10:['wb-exercise-steps-01','rhythm-a','rhythm-b','rhythm-c'],L11:['wb-exercise-high-02','tie-demo']} as Record<string,string[]>)[lesson.id]||Object.keys(pieces);
 const exerciseInstruction=pieceId==='wb-exercise-high-02'?'파에 엄지를 준비하세요. 마지막 라 다음은 파이며, 사이의 솔은 누르지 않아요.':pieceId.startsWith('rhythm-')?'한 칸은 한 박이에요. 계속은 앞의 음을 이어가고, 쉼에서도 박은 흘러요.':pieceId==='tie-demo'?'같은 높이의 붙임줄에서는 소리를 다시 시작하지 않고 길이를 이어요.':lesson.instruction;

 const moveCue=frame&&piece.cues?.find(c=>frame.tick>=c.startTick&&frame.tick<c.startTick+c.durationTick);
 const movement=moveCue?{from:moveCue.from,to:moveCue.to,progress:(frame!.tick-moveCue.startTick)/moveCue.durationTick}:shiftStep!==null&&shiftStep<4?{from:'c-position' as Position,to:'f-position' as Position,progress:[0,.22,.6,.93][shiftStep]}:undefined;
 const quiz=quizzes[quizIndex];
 const quizMode=lesson.kind==='quiz'||mode==='check';
 const play=async()=>{
  if(status==='PLAYING'||status==='COUNT_IN'){interrupt();return;}
  if(quizMode){setRevealed(v=>!v);return;}
  const nextMode=mode==='observe'?'demo':mode;
  const sound=nextMode==='demo'||nextMode==='follow'&&guideVoice;
  if((sound||nextMode==='follow'&&metronome)&&!audioReady&&!await prepare())return;
  if(settings.instrumentLow!==null&&settings.instrumentHigh!==null&&piece.events.some(e=>e.midi!==undefined&&(e.midi<settings.instrumentLow!||e.midi>settings.instrumentHigh!))){notice('이 연습의 음이 설정한 악기 음역 밖에 있습니다. 악기 음역을 확인해 주세요.');return;}
  setMode(nextMode);
  let from=loopRange==='second'?piece.meter*960:0;
  let to=loopRange==='first'?Math.min(piece.totalTicks,piece.meter*960):piece.totalTicks;
  if(status==='PAUSED')from=safeRestartTick(piece,resumeTick.current);
  if(from>=to)from=0;
  const initial=positionAt(piece,from);setPosition(initial);setPressed(null);held.current.clear();owner.current=null;
  try{engine().start(piece,{bpm:settings.bpm,mode:nextMode==='silent'?'silent':nextMode==='follow'?'follow':'demo',sound,metronome:nextMode!=='silent'&&metronome,countIn:status==='PAUSED'||countIn,repeat,fromTick:from,toTick:to,onFrame:f=>{setFrame(f);setStatus(f.phase);setPosition(f.position);setPressed(f.activeMidi);if(f.activeMidi!==null){setSelected(f.activeMidi);setRange(prev=>{if(f.activeMidi!>=prev[0]&&f.activeMidi!<=prev[1])return prev;const low=Math.floor((f.activeMidi!-60)/12)*12+60;return [low,low+12];});}},onEnd:()=>{setStatus('READY');setPressed(null);setFrame(null);resumeTick.current=0;}});}catch{stop();notice('재생 데이터를 확인하지 못했습니다. 다른 활동을 선택해 주세요.');}
 };
 const down=(midi:number,source:string)=>{
  if(status==='PLAYING'||status==='COUNT_IN'){notice('일시정지 후 직접 눌러 보세요.');return;}
  if(quizMode){setQuizChoices(xs=>xs.includes(midi)?xs.filter(x=>x!==midi):[...xs,midi]);return;}
  setSelected(midi);
  if(midi<range[0]||midi>range[1]){const low=Math.floor((midi-60)/12)*12+60;setRange([low,low+12]);}
  if(settings.instrumentLow!==null&&settings.instrumentHigh!==null&&(midi<settings.instrumentLow||midi>settings.instrumentHigh)){notice('현재 악기 음역 밖의 음입니다.');return;}
  held.current.set(source,midi);owner.current=source;setPressed(midi);
  if((mode==='demo'||mode==='follow'&&guideVoice)&&audioReady)engine().audition(midi,source);
 };
 const up=(source:string)=>{engineRef.current?.release(source);held.current.delete(source);if(owner.current===source){setPressed(null);owner.current=null;}};
 const switchLesson=(id:string)=>{
  stop();const l=lessonList.find((x:any)=>x.id===id)||lessonList[0];setLessonId(l.id);setPosition(l.position);setSelected(l.notes[0]||60);setPieceId(l.pieceId||'wb-exercise-steps-01');setMode('observe');setRange([60,72]);setOctave(0);setPairIndex(0);setLoopRange('all');setRevealed(false);setQuizChoices([]);setQuizIndex(0);setModal(null);
 };
 const changeMode=(m:Mode)=>{stop();setMode(m);setRevealed(false);setQuizChoices([]);};
 const selectPosition=(p:Position)=>{stop();setPosition(p);};
 const choosePiece=(id:string)=>{stop();setPieceId(id);setLoopRange('all');if(pieces[id])setPosition(pieces[id].initialPositionId);};
 const openModal=(m:typeof modal)=>{interrupt();setModal(m);};
 const full=()=>{if(document.fullscreenElement)document.exitFullscreen?.().catch(()=>{});else document.documentElement.requestFullscreen?.().catch(()=>notice('브라우저의 전체화면 기능을 이용해 주세요.'));};
 eventsRef.current={down,up,stop,play,interrupt,settings,octave,status,modal,teacher};
 useEffect(()=>{
  const resize=()=>{if(container.current){const r=container.current.getBoundingClientRect();setScale(Math.min(r.width/1920,r.height/1080));}};resize();const obs=new ResizeObserver(resize);if(container.current)obs.observe(container.current);
  const keyDown=(e:KeyboardEvent)=>{const t=e.target as HTMLElement;if(e.isComposing||t.closest('input,textarea,select,[contenteditable=true]'))return;if(e.key==='Escape'){eventsRef.current.stop();setModal(null);setTeacher(false);return;}if(eventsRef.current.modal||eventsRef.current.teacher)return;if(e.metaKey||e.altKey)return;if(e.code==='Space'&&t.tagName!=='BUTTON'){e.preventDefault();if(!e.repeat)eventsRef.current.play();return;}if(e.code==='Digit0'&&!e.ctrlKey&&!e.shiftKey){e.preventDefault();eventsRef.current.stop();return;}const match=e.code.match(/^(?:Digit|Numpad)([1-8])$/);if(!match||e.repeat)return;if(e.shiftKey&&e.ctrlKey)return;const latest=eventsRef.current;if(e.ctrlKey&&!latest.settings.ctrlEnabled)return;e.preventDefault();const off=e.shiftKey?1:e.ctrlKey?-1:latest.octave;const midi=outline[Number(match[1])-1]+off*12;if(midi<0||midi>127)return;latest.down(midi,'keyboard:'+e.code);};
  const keyUp=(e:KeyboardEvent)=>eventsRef.current.up('keyboard:'+e.code);
  const blur=()=>eventsRef.current.interrupt();const hidden=()=>{if(document.hidden)eventsRef.current.interrupt();};
  window.addEventListener('keydown',keyDown);window.addEventListener('keyup',keyUp);window.addEventListener('blur',blur);document.addEventListener('visibilitychange',hidden);
  registerOffline().then(()=>checkOffline()).then(setOffline).catch(()=>{});
  return()=>{obs.disconnect();window.removeEventListener('keydown',keyDown);window.removeEventListener('keyup',keyUp);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',hidden);engineRef.current?.dispose();engineRef.current=null;};
 },[]);
 useEffect(()=>{engineRef.current?.setVolume(settings.volume);if(!saveSettings(settings))notice('이 브라우저에는 설정이 저장되지 않았습니다.');},[settings]);
 useEffect(()=>{writeLocal('melodica.session.v1',{lessonId,position});},[lessonId,position]);
 useEffect(()=>{
  if(!modal&&!teacher)return;const previous=document.activeElement as HTMLElement|null;
  const dialog=document.querySelector<HTMLElement>(modal?'.modal':'.teacher-overlay');
  const focusable=()=>Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,[tabindex="0"]')||[]);
  focusable()[0]?.focus();
  const trap=(e:KeyboardEvent)=>{if(e.key!=='Tab')return;const list=focusable();const first=list[0],last=list[list.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}};
  document.addEventListener('keydown',trap);return()=>{document.removeEventListener('keydown',trap);if(previous?.isConnected)previous.focus();};
 },[modal,teacher]);
 const currentIndex=lessonList.findIndex((l:any)=>l.id===lessonId);
 const playing=status==='PLAYING'||status==='COUNT_IN';
 const finger=fingerFor(selected,position);
 const playingPiece=lesson.kind==='piece'||lesson.kind==='breath'||lesson.kind==='pairs'||lesson.kind==='shift';
 const visibleMidi=quizMode&&!revealed?null:selected;
 const beat=frame?.beat||0;
 const buttonClass=(active:boolean)=>active?' active':'';
 const offlinePrepare=async()=>{setPreparing(true);try{await prepareOffline((n,total)=>setOfflineProgress(`${n} / ${total}`));setOffline(await checkOffline());notice('오프라인 수업 자료를 준비했습니다.');}catch(err){notice(err instanceof Error?err.message:'일부 자료를 준비하지 못했습니다. 다시 시도해 주세요.');}finally{setPreparing(false);}};
 return <div className="workspace" ref={container}>
  <div className="classroom" style={{width:1920,height:1080,transform:`scale(${scale})`}}>
   <header className="topbar">
    <button className="brand" onClick={()=>openModal('contents')} aria-label="멜로디카 클래스 목차"><span className="brand-icon"><Music2 size={28}/></span><span>멜로디카 <b>클래스</b><small>TEACHER STUDIO</small></span></button>
    <div className="top-divider"/><button className="unit-breadcrumb" onClick={()=>openModal('contents')}><span>{lesson.unit.id.replace('U','UNIT 0')}</span>{lesson.unit.title}<ChevronRight size={18}/><b>{lesson.title}</b></button>
    <div className="top-actions"><span className="teacher-badge">교사용</span><button className="icon-button" onClick={()=>openModal('guide')} aria-label="사용 안내"><HelpCircle/></button><button className="icon-button" onClick={()=>openModal('settings')} aria-label="수업 설정"><Settings2/></button><button className="icon-button" onClick={full} aria-label="전체화면"><Maximize2/></button></div>
   </header>
   <main className="main-stage">
    <section className="score-panel">
     <div className="panel-topline"><span className="eyebrow"><Music2 size={18}/>{quizMode?'그림으로 확인해요':playingPiece?'악보를 따라 연주해요':'악보와 건반을 연결해요'}</span><div className="panel-tools"><button onClick={()=>updateSettings({showNames:!settings.showNames})} className={buttonClass(settings.showNames)}>{settings.showNames?<Eye size={18}/>:<EyeOff size={18}/>}계이름</button><button onClick={()=>updateSettings({showFingers:!settings.showFingers})} className={buttonClass(settings.showFingers)}><Hand size={18}/>손 번호</button></div></div>
     {quizMode?<div className="quiz-heading"><span>QUESTION {String(quizIndex+1).padStart(2,'0')}</span><h2>{quiz.prompt}</h2></div>:<Staff midi={visibleMidi} events={playingPiece?piece.events:undefined} meter={piece.meter} tick={frame?.tick} showNames={settings.showNames} conceal={quizMode&&!revealed}/>}
     {!playingPiece&&!quizMode&&<span className="staff-hint">오선을 보고, 같은 음의 건반을 찾아보세요.</span>}
    </section>
    <section className="instrument-panel">
     <div className="panel-topline"><span className="eyebrow"><KeyboardIcon size={18}/>{quizMode?'직접 가리켜 보세요':'멜로디카 · 확대 보기'}</span><div className="position-control"><button onClick={()=>selectPosition('c-position')} className={buttonClass(position==='c-position')}>도 자리</button><button onClick={()=>selectPosition('f-position')} className={buttonClass(position==='f-position')}>파 자리</button></div></div>
     {quizMode&&(quiz.type==='text'||quiz.type==='finger')?<div className="quiz-options">{quiz.choices?.map((c,i)=><button key={c} className={quizChoices.includes(i)?'chosen':''} onClick={()=>setQuizChoices([i])}><span>{i+1}</span>{c}</button>)}{!quiz.choices&&<div className="oral-question"><HelpCircle size={64}/><h3>생각을 말로 설명해 보세요.</h3><p>교사가 응답을 들은 뒤 정답을 공개합니다.</p></div>}</div>:quizMode&&quiz.type==='staff'?<div className="quiz-staff"><Staff midi={null} events={[60,64,67,72].map((m,i)=>({id:`q${i}`,kind:'note',midi:m,startTick:i*960,durationTick:960}))} showNames={revealed} conceal={!revealed}/></div>:<Keyboard low={quizMode&&quiz.id==='Q01'?60:range[0]} high={quizMode&&quiz.id==='Q01'?84:range[1]} selected={quizMode?(revealed&&quiz.id==='Q01'?60:quizChoices[0]??null):selected} pressed={quizMode?null:pressed} position={position} showNames={quizMode?revealed:settings.showNames} showFingers={!quizMode&&settings.showFingers} showHand={!quizMode&&settings.showHand} reducedMotion={settings.reducedMotion} movement={movement} showGroups={lesson.id==='L01'} conceal={quizMode&&!revealed} onDown={down} onUp={up}/>} 
     <div className="instrument-caption"><span>{quizMode?'응답을 듣고 정답을 공개하세요.':`확대 보기 · ${pitchName(range[0])}–${pitchName(range[1])}`}</span>{!quizMode&&<><div className="octave"><button onClick={()=>{stop();setOctave(-1);setRange([48,60]);}} className={buttonClass(octave===-1)}>낮게</button><button onClick={()=>{stop();setOctave(0);setRange([60,72]);}} className={buttonClass(octave===0)}>기본</button><button onClick={()=>{stop();setOctave(1);setRange([72,84]);}} className={buttonClass(octave===1)}>높게</button></div><span className="caption-dot"/>실제 악기는 모델별 음역을 확인하세요.</>}</div>
     {!quizMode&&<div className="keyboard-tip"><KeyboardIcon size={20}/><span>숫자키</span>{outline.slice(0,7).map((m,i)=><span className="key-tip" key={m}><kbd>{i+1}</kbd>{solfege(m)}</span>)}<span className="shortcut-note">Shift 높은 음 · 0 정지</span></div>}
     {quizMode&&quizChoices.length>0&&<div className="quiz-selection">{quiz.type==='keyboard'?`선택한 건반 ${quizChoices.length}개`:'응답을 선택했습니다.'}<button onClick={()=>setQuizChoices([])}>선택 지우기</button></div>}
    </section>
    <aside className="support-panel">
     <div className="lesson-kicker"><span>{lesson.id.replace('L','LESSON ')}</span><span>{currentIndex+1} / {lessonList.length}</span></div><h1>{quizMode?'배운 것을\n확인해요':lesson.title}</h1>
     <p className="objective">{lesson.objective}</p>
     {quizMode?<div className={'answer-card'+(revealed?' revealed':'')}><span className="eyebrow">{revealed?'정답과 설명':'먼저 생각해 보세요'}</span>{revealed?<><h3>{quiz.answer}</h3><p>{quiz.explanation}</p></>:<><HelpCircle size={56}/><p>정답은 교사가 공개할 때까지<br/>표시하지 않습니다.</p></>}</div>:lesson.kind==='breath'||lesson.kind==='shift'?<div className="breath-card"><Wind size={42}/><h3>{lesson.kind==='shift'?(movement?movement.progress<.15?'건반을 떼어요':movement.progress<.3?'손을 살짝 들어요':movement.progress<.8?'손 전체를 옮겨요':'새 손자리를 준비해요':'떼기 → 이동 → 준비'):frame?.activeMidi!==null&&frame?'편안하게 내쉬어요':'준비하고, 편히 쉬어요'}</h3><div className="beat-cells">{[1,2,3,4].map(n=><span key={n} className={beat===n?'now':''}>{n}</span>)}</div><div className={'articulation'+(frame?.attack?' attack':'')}><span/>{frame?.attack?'부드럽게 시작':frame?.activeMidi!==null&&frame?'소리를 이어가요':'소리 없이 준비'}</div><p>{lesson.kind==='shift'?'쉬는 박에 손 전체를 옮겨요.':'호흡은 지도용 안내입니다.'}</p></div>:<div className="note-card"><span className="eyebrow">지금 배울 음</span><div className="note-name">{solfege(selected)}</div><span className="pitch-label">{pitchName(selected)}</span><div className="note-tags"><span><Hand size={18}/>{finger?`손 ${finger}`:'손번호 미지정'}</span><span>{positionLabel(position)}</span></div></div>}
     <div className="instruction"><span className="instruction-icon"><Sparkles size={20}/></span><p>{quizMode?'서로의 생각을 듣고, 이유도 함께 말해 보세요.':exerciseInstruction}</p></div>
     {(lesson.kind==='piece'||lesson.kind==='breath'||lesson.kind==='shift')&&!quizMode&&<label className="exercise-picker">연습 선택<select value={pieceId} onChange={e=>choosePiece(e.target.value)}>{pieceOptions.map(id=>pieces[id]).filter(Boolean).map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></label>}
     {lesson.kind==='pairs'&&!quizMode&&<label className="exercise-picker">연결할 두 음<select value={pairIndex} onChange={e=>{stop();const n=Number(e.target.value);setPairIndex(n);setPosition(n<4?'c-position':'f-position');}}>{['도 ↔ 레','레 ↔ 미','미 ↔ 파','파 ↔ 솔','솔 ↔ 라','라 ↔ 시','시 ↔ 높은 도'].map((x,i)=><option key={x} value={i}>{x}</option>)}</select></label>}
     {lesson.kind==='shift'&&!quizMode&&<div className="shift-steps">{['떼기','들기','이동','준비','완료'].map((x,i)=><button className={shiftStep===i?'active':''} key={x} onClick={()=>{stop();setShiftStep(i);setPosition(i===4?'f-position':'c-position');}}>{i+1}<span>{x}</span></button>)}</div>}<div className="support-bottom"><button className="teacher-toggle" onClick={()=>{interrupt();setTeacher(v=>!v);}}><BookOpen size={19}/>교사 지도 메모<ChevronRight size={18}/></button><button className={'sound-state'+(audioReady?' ready':'')} onClick={prepare}><span/>{audioReady?'소리 준비됨 · 학습용 합성음':'소리 준비하기'}<Volume2 size={18}/></button></div>
    </aside>
   </main>
   <footer className="transport">
    <div className="lesson-nav"><button onClick={()=>switchLesson(lessonList[(currentIndex-1+lessonList.length)%lessonList.length].id)} aria-label="이전 차시"><ChevronLeft size={24}/></button><button className="contents-button" onClick={()=>openModal('contents')}><Layers size={22}/>수업 목차</button><button onClick={()=>switchLesson(lessonList[(currentIndex+1)%lessonList.length].id)} aria-label="다음 차시"><ChevronRight size={24}/></button></div>
    <div className="learning-modes">{modes.map(([m,label,Icon])=><button key={m} onClick={()=>changeMode(m)} className={buttonClass(mode===m)}><Icon size={20}/><span>{label}</span></button>)}</div>
    <div className="transport-actions"><button className={'repeat-button'+buttonClass(repeat)} onClick={()=>{if(playing)interrupt();setRepeat(v=>!v);}} aria-label="구간 반복" aria-pressed={repeat}><Repeat2 size={23}/></button><button className="stop-button" onClick={()=>stop()} aria-label="모든 소리 정지"><Square size={22}/></button><button className="play-button" onClick={play}>{quizMode?(revealed?<EyeOff size={23}/>:<Eye size={23}/>):playing?<Pause size={25}/>:<Play size={25}/>}<span>{quizMode?(revealed?'정답 가리기':'정답 보기'):playing?'일시정지':status==='PAUSED'?'이 마디 다시 시작':'시범 재생'}</span></button></div>
    <label className="tempo"><span>속도 <b>{settings.bpm}</b><small>BPM</small></span><input type="range" min="40" max="120" step="5" value={settings.bpm} aria-label="연습 속도" onChange={e=>{if(playing)interrupt();updateSettings({bpm:Number(e.target.value)});}}/></label>
   </footer>
   {teacher&&<div className="teacher-overlay" role="dialog" aria-label="교사 지도 메모"><button className="close" onClick={()=>setTeacher(false)} aria-label="지도 메모 닫기"><X/></button><span className="eyebrow">교사 지도 메모 · 현재 화면에도 보입니다</span><h2>{lesson.title}</h2><p><b>쉽게 시작하기</b>{lesson.easy}</p><p><b>한 걸음 더</b>{lesson.extension}</p><p className="source-line">그림 교재 {lesson.sourcePages.join(', ')}쪽 기반 · 실제 자세와 소리는 교사가 확인합니다.</p><h3>오늘의 관찰 · 학급 단위</h3>{['음 위치','손자리','박과 쉼','소리 시작','편안한 자세'].map(label=><label className="observation" key={label}>{label}<select value={observations[`${lessonId}:${label}`]||'미확인'} onChange={e=>{const next={...observations,[`${lessonId}:${label}`]:e.target.value};setObservations(next);writeLocal('melodica.observations.v1',next);}}>{['미확인','혼자 가능','힌트로 가능','다시 연습'].map(x=><option key={x}>{x}</option>)}</select></label>)}</div>}
   {quizMode&&<div className="quiz-navigation"><button onClick={()=>{setQuizIndex(i=>(i-1+quizzes.length)%quizzes.length);setRevealed(false);setQuizChoices([]);}}><ChevronLeft size={20}/>이전 문제</button><span>{quizIndex+1} / {quizzes.length}</span><button onClick={()=>{setQuizIndex(i=>(i+1)%quizzes.length);setRevealed(false);setQuizChoices([]);}}>다음 문제<ChevronRight size={20}/></button></div>}
   {status==='COUNT_IN'&&<div className="count-in" aria-live="polite"><span>준비</span><b>{beat}</b></div>}
   {toast&&<div className="toast" role="status">{toast}</div>}
   {modal&&<div className="modal-backdrop" onClick={()=>setModal(null)}><section className={'modal '+modal} role="dialog" aria-modal="true" aria-label={modal==='contents'?'수업 목차':modal==='settings'?'수업 설정':'사용 안내'} onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setModal(null)} aria-label="닫기"><X/></button>
    {modal==='contents'?<><span className="eyebrow">LESSON LIBRARY</span><h2>오늘은 어떤 수업을 할까요?</h2><p className="modal-intro">천천히 보고, 손으로 익히고, 함께 연주해요.</p><div className="unit-grid">{units.map((u:any,i:number)=><section key={u.id} className="unit-card"><span className="unit-number">0{i+1}</span><h3>{u.title}</h3><p>{u.description}</p>{u.lessons.map((l:any)=><button key={l.id} onClick={()=>switchLesson(l.id)} className={l.id===lessonId?'selected':''}><span>{l.id.replace('L','')}</span>{l.title}<ArrowRight size={18}/></button>)}</section>)}</div><div className="library-note"><BookOpen size={18}/>제공된 그림 교재를 바탕으로 구성한 6단원 · 12차시</div></>:modal==='settings'?<><span className="eyebrow">TEACHER SETTINGS</span><h2>수업에 맞게 준비하세요.</h2><div className="settings-grid"><section><h3>화면과 조작</h3>{([['showNames','계이름 보이기'],['showFingers','손가락 번호 보이기'],['showHand','오른손 그림 보이기'],['reducedMotion','움직임 줄이기'],['ctrlEnabled','Ctrl + 숫자키로 낮은 음 선택']] as const).map(([key,label])=><label className="toggle-row" key={key}>{label}<input type="checkbox" checked={settings[key]} onChange={e=>updateSettings({[key]:e.target.checked})}/></label>)}<p className="small-note">Ctrl 단축키는 브라우저와 충돌할 수 있습니다. 화면의 낮게·기본·높게 버튼도 사용할 수 있어요.</p><h3>실제 악기 음역</h3><p className="small-note">모델을 확인한 경우만 설정하세요. 학습용 확대 범위와 다릅니다.</p><div className="range-select"><label>낮은 음<select value={settings.instrumentLow??''} onChange={e=>{stop();updateSettings({instrumentLow:e.target.value?Number(e.target.value):null});}}><option value="">미설정</option>{Array.from({length:49},(_,i)=>i+48).map(n=><option key={n} value={n}>{pitchName(n)}</option>)}</select></label><label>높은 음<select value={settings.instrumentHigh??''} onChange={e=>{stop();updateSettings({instrumentHigh:e.target.value?Number(e.target.value):null});}}><option value="">미설정</option>{Array.from({length:49},(_,i)=>i+48).map(n=><option key={n} value={n}>{pitchName(n)}</option>)}</select></label></div></section><section><h3>소리와 시범</h3><button className="wide-action" onClick={prepare}><Volume2 size={20}/>{audioReady?'소리 다시 준비':'소리 준비하기'}</button><label className="volume-label">시범 음량 <input type="range" aria-label="시범 음량" min="0" max="0.6" step="0.01" value={settings.volume} onChange={e=>updateSettings({volume:Number(e.target.value)})}/></label><label className="toggle-row">예비박 한 마디<input type="checkbox" checked={countIn} onChange={e=>setCountIn(e.target.checked)}/></label><label className="toggle-row">함께 연주할 때 시범음<input type="checkbox" checked={guideVoice} onChange={e=>setGuideVoice(e.target.checked)}/></label><label className="toggle-row">박자 소리<input type="checkbox" checked={metronome} onChange={e=>setMetronome(e.target.checked)}/></label><label className="volume-label">반복 구간<select value={loopRange} onChange={e=>{stop();setLoopRange(e.target.value as any);}}><option value="all">전체</option><option value="first">첫째 마디</option><option value="second">둘째 마디</option></select></label><h3><WifiOff size={19}/>오프라인 수업 준비</h3><p className="small-note">{offline.ready?`자료 ${offline.count}개 준비됨. 수업 전에 상태를 확인하세요.`:'연결된 상태에서 수업 자료를 미리 준비해 주세요.'}</p><button className="wide-action" onClick={offlinePrepare} disabled={preparing}>{preparing?`준비 중 ${offlineProgress}`:<><Download size={20}/>수업 자료 준비</>}</button></section></div><div className="settings-bottom"><button onClick={()=>exportSettings(settings)}><Download size={18}/>설정 내보내기</button><label className="import-button"><Upload size={18}/>설정 가져오기<input type="file" accept=".json,application/json" onChange={async e=>{if(e.target.files?.[0])try{setSettings(await importSettings(e.target.files[0]));notice('검증된 설정을 가져왔습니다.');}catch(err){notice(err instanceof Error?err.message:'설정 파일을 확인해 주세요.');}e.target.value='';}}/></label><button onClick={()=>{stop();setSettings({...defaultSettings});notice('기본 설정으로 돌아왔습니다.');}}><RotateCcw size={18}/>기본값 복원</button></div></>:<><span className="eyebrow">QUICK START</span><h2>교사 한 사람의 손끝에서,<br/>함께 배우는 음악 수업.</h2><div className="guide-steps">{[['01','수업을 고르세요','목차에서 단원을 선택합니다. 진도에 관계없이 원하는 활동을 바로 열 수 있어요.'],['02','눈으로 보고, 손으로 익혀요','보기 → 무음 손연습 → 시범 듣기 → 함께 연주 → 확인 순서로 진행합니다.'],['03','숫자키로 시범을 보여주세요','키보드 1=도, 2=레… 8=높은 도. 손가락 번호와는 다른 의미입니다.'],['04','쉬고, 반복하고, 천천히','0 또는 정지 버튼은 모든 소리를 멈춥니다. 일시정지 후에는 마디 처음부터 다시 시작해요.']].map(([n,t,p])=><div key={n}><b>{n}</b><section><h3>{t}</h3><p>{p}</p></section></div>)}</div><div className="guide-illustrations"><img src="/illustrations/04_fingers.svg" alt="오른손 엄지부터 새끼손가락까지 손 1~5"/><img src="/illustrations/05_posture.svg" alt="편안한 손모양 참고 도식"/></div><p className="small-note">오른손 기준 · 고정도법 · 학습용 합성음. 호흡이 불편하면 연주를 멈추고 편히 쉬세요.</p></>}
   </section></div>}
  </div>
  {scale<.46&&<div className="small-screen"><Music2 size={28}/><b>교사용 가로 화면</b><p>큰 화면에서 수업하고,<br/>여기서는 차시를 살펴보세요.</p><button onClick={()=>openModal('contents')}>수업 목차 열기</button><button onClick={()=>openModal('settings')}>수업 설정</button><button onClick={full}>가로 전체화면 보기</button></div>}
 </div>;
}
