import type { NoteEvent, Piece, Position } from './domain';

export interface LessonContent {
  id: string; title: string; objective: string;
  kind: 'explore' | 'breath' | 'pairs' | 'shift' | 'piece' | 'quiz';
  position: Position; notes: number[]; pieceId?: string;
  instruction: string; easy: string; extension: string; sourcePages: number[];
}
export interface UnitContent { id: string; title: string; description: string; icon: string; lessons: LessonContent[] }

const C: Position = 'c-position';
const F: Position = 'f-position';
const mappings: Record<Position, Record<number, number>> = {
  [C]: {60:1,62:2,64:3,65:4,67:5}, [F]: {65:1,67:2,69:3,71:4,72:5},
};
function sequence(id:string,title:string, pitches:Array<number|null>, position:Position=C, durations:number[]=[], options:Partial<Piece>={}): Piece {
  let tick=0;
  const events: NoteEvent[]=pitches.map((midi,i)=>{
    const durationTick=(durations[i]??1)*960;
    const base={id:`${id}-${i+1}`,startTick:tick,durationTick}; tick+=durationTick;
    return midi===null ? {...base,kind:'rest' as const} : {...base,kind:'note' as const,midi,finger:mappings[position][midi]??null,positionId:position};
  });
  return {id,title,events,totalTicks:tick,initialPositionId:position,meter:4,...options};
}

export const pieces: Record<string,Piece> = {
  'wb-exercise-steps-01': sequence('wb-exercise-steps-01','작은 계단 연습곡',[60,62,64,65,67,65,64,62]),
  'wb-exercise-high-02': sequence('wb-exercise-high-02','높은 자리 산책',[65,67,69,71,72,71,69,65],F),
  long2: sequence('long2','편안한 두 박',[60,null],C,[2,2]),
  long4: sequence('long4','한 음을 네 박',[60,null],C,[4,4]),
  tongue4: sequence('tongue4','같은 숨으로 네 번',[60,60,60,60]),
  rest4: sequence('rest4','소리 둘, 쉼 둘',[60,60,null,null]),
  'rhythm-a': sequence('rhythm-a','도 · 도 · 미 · 쉼',[60,60,64,null]),
  'rhythm-b': sequence('rhythm-b','솔 · 미 · 도 · 쉼',[67,64,60,null]),
  'rhythm-c': sequence('rhythm-c','도— · 레 · 미',[60,62,64],C,[2,1,1]),
  'tie-demo': sequence('tie-demo','같은 솔을 이어서',[67,67,null],C,[1,1,2]),
  'shift-demo': sequence('shift-demo','쉬는 동안 손자리 이동',[60,null,72,null],C,[2,2,2,2],{
    cues:[{startTick:1920,durationTick:1920,from:C,to:F}],
  }),
};
pieces.tongue4.events.forEach(e=>{e.keyHoldGroupId='held-c4';});
pieces['tie-demo'].events.slice(0,2).forEach(e=>{e.tieGroupId='tied-g4';});
const high=pieces['shift-demo'].events[2]; high.positionId=F;high.finger=5;

export const pairChoices = [
  {id:'pair-cd',title:'도 ↔ 레',notes:[60,62],position:C},
  {id:'pair-de',title:'레 ↔ 미',notes:[62,64],position:C},
  {id:'pair-ef',title:'미 ↔ 파',notes:[64,65],position:C},
  {id:'pair-fg',title:'파 ↔ 솔',notes:[65,67],position:C},
  {id:'pair-ga',title:'솔 ↔ 라',notes:[67,69],position:F},
  {id:'pair-ab',title:'라 ↔ 시',notes:[69,71],position:F},
  {id:'pair-bc',title:'시 ↔ 높은 도',notes:[71,72],position:F},
];
for(const pair of pairChoices) {
  pieces[pair.id]=sequence(pair.id,pair.title,[...pair.notes,...pair.notes,null],pair.position,[1,1,1,1,4]);
}

export const units: UnitContent[] = [
  {id:'U1',title:'악기와 친해지기',description:'검은건반 묶음과 편안한 오른손',icon:'piano',lessons:[
    {id:'L01',title:'검은건반 묶음에서 도 찾기',objective:'2개·3개 묶음을 구별하고 도를 두 곳 찾아요.',kind:'explore',position:C,notes:[60,72],instruction:'검은건반 두 개 묶음의 바로 왼쪽 흰건반을 찾아보세요.',easy:'완전한 두 개 묶음 하나를 먼저 가리켜요.',extension:'계이름을 가리고 두 옥타브의 도를 모두 찾아요.',sourcePages:[2,3,34]},
    {id:'L02',title:'오른손 번호와 편안한 손모양',objective:'엄지부터 손 1·2·3·4·5를 연결해요.',kind:'explore',position:C,notes:[60,62,64,65,67],instruction:'어깨와 손목의 힘을 빼고, 손끝을 건반 가까이에 준비하세요.',easy:'손 1~3만 찾아 소리 없이 움직여요.',extension:'선생님이 부른 손번호의 음을 가리켜요.',sourcePages:[4,5,32,33]},
  ]},
  {id:'U2',title:'숨으로 소리 만들기',description:'편안한 숨, 부드러운 시작, 흐르는 박',icon:'wind',lessons:[
    {id:'L03',title:'짧고 편안한 소리와 긴 소리',objective:'편안하게 시작하고 두 박 또는 네 박 뒤 멈춰요.',kind:'breath',position:C,notes:[60],pieceId:'long2',instruction:'가볍게 준비한 뒤 일정한 숨을 보내세요. 불편하면 멈추고 쉬어요.',easy:'더 짧은 한 음만 불고 충분히 쉬어요.',extension:'두 박과 네 박의 길이를 비교해요. 오래 불기 경쟁은 하지 않아요.',sourcePages:[6,9]},
    {id:'L04',title:'텅잉과 쉼에도 이어지는 박',objective:'같은 숨에서 시작을 나누고, 쉬는 박도 세어요.',kind:'breath',position:C,notes:[60],pieceId:'tongue4',instruction:'도 건반을 유지한 채 부드러운 혀의 움직임으로 네 번 시작해요.',easy:'두 번만 시작하고 충분히 쉬어요.',extension:'긴 음과 반복음을 듣고 무엇이 달라졌는지 말해요.',sourcePages:[7,8]},
  ]},
  {id:'U3',title:'계이름과 건반 배우기',description:'오선·건반·손가락을 한눈에',icon:'music',lessons:[
    {id:'L05',title:'도·레·미의 악보와 건반',objective:'도 자리에서 도·레·미를 손 1·2·3과 연결해요.',kind:'explore',position:C,notes:[60,62,64],instruction:'오선의 음 이름을 말하고 해당 건반을 찾아 누르세요.',easy:'도와 레 두 음부터 확인해요.',extension:'계이름을 가리고 오선만 보고 찾아요.',sourcePages:[9,10,11]},
    {id:'L06',title:'파·솔과 도 자리의 다섯 음',objective:'도 자리에서 파는 손 4, 솔은 손 5예요.',kind:'explore',position:C,notes:[60,62,64,65,67],instruction:'파와 솔을 작게 누르고 떼세요. 손목을 꺾지 않아요.',easy:'소리 없이 위치부터 찾고 선생님 시범을 들어요.',extension:'도·미·솔 중 들려주는 음을 찾아요.',sourcePages:[12,13]},
    {id:'L07',title:'파 자리에서 라·시·높은 도',objective:'파에 엄지를 놓고 라·시·높은 도를 연결해요.',kind:'explore',position:F,notes:[65,67,69,71,72],instruction:'현재 손자리는 파 자리예요. 높은 도는 이 연습에서 손 5로 눌러요.',easy:'라와 높은 도 두 음을 먼저 확인해요.',extension:'파를 도 자리와 파 자리에서 각각 손 몇 번으로 누르는지 말해요.',sourcePages:[14,15,16]},
  ]},
  {id:'U4',title:'연결과 손자리 이동',description:'두 음을 잇고 쉬는 동안 자리를 옮겨요',icon:'hand',lessons:[
    {id:'L08',title:'두 음을 번갈아 연결하기',objective:'두 음을 한 박씩 네 번 연주한 뒤 쉬어요.',kind:'pairs',position:C,notes:[60,62],pieceId:'pair-cd',instruction:'앞 음을 떼며 다음 음을 눌러요. 두 음이 함께 울리지 않게 들어보세요.',easy:'두 음만 연주한 뒤 충분히 쉬어요.',extension:'다른 음 쌍을 골라 시작 손자리를 먼저 준비해요.',sourcePages:[17,18,19,20,21,22,23]},
    {id:'L09',title:'쉬는 박에 손자리 옮기기',objective:'건반을 떼고 손 전체를 도 자리에서 파 자리로 옮겨요.',kind:'shift',position:C,notes:[60,72],pieceId:'shift-demo',instruction:'떼기 → 들기 → 이동 → 준비. 이동하는 동안에는 소리를 쉬어요.',easy:'박자 제한 없이 준비 신호를 기다려요.',extension:'넉넉한 쉼 안에서 이동한 뒤 높은 도를 손 5로 눌러요.',sourcePages:[24]},
  ]},
  {id:'U5',title:'리듬과 짧은 연습곡',description:'두 마디 연주와 네 칸 리듬',icon:'sparkles',lessons:[
    {id:'L10',title:'작은 계단 연습곡과 네 칸 리듬',objective:'도 자리의 두 마디를 고른 박으로 연주해요.',kind:'piece',position:C,notes:[60,62,64,65,67],pieceId:'wb-exercise-steps-01',instruction:'도 레 미 파 | 솔 파 미 레. 마지막 레의 한 박이 끝나면 멈춰요.',easy:'첫 마디만 연주하고 충분히 쉬어요.',extension:'네 칸 리듬의 쉼에서도 박을 고르게 세어요.',sourcePages:[25,27]},
    {id:'L11',title:'높은 자리 산책과 이어지는 소리',objective:'파 자리에서 연주하고 마지막 라에서 파로 건너뛰어요.',kind:'piece',position:F,notes:[65,67,69,71,72],pieceId:'wb-exercise-high-02',instruction:'파 솔 라 시 | 높은 도 시 라 파. 마지막 라와 파 사이에 솔을 넣지 않아요.',easy:'첫 마디와 라→파 연결을 무음으로 먼저 연습해요.',extension:'붙임줄의 솔을 두 박 이어 보고, 파♯ 건반도 찾아요.',sourcePages:[26,27,30,31]},
  ]},
  {id:'U6',title:'확인과 응용 준비',description:'그림으로 확인하고 작은 발표를 해요',icon:'circle-help',lessons:[
    {id:'L12',title:'그림 퀴즈와 작은 발표',objective:'배운 개념을 설명하고 다음 연습 하나를 골라요.',kind:'quiz',position:C,notes:[60,64,67,72],instruction:'문제를 함께 보고 답을 말해 보세요. 정답은 선생님이 공개해요.',easy:'계이름과 손번호를 보며 한 마디만 발표해요.',extension:'파♯·붙임줄·쉼을 찾아 어떻게 연주하는지 설명해요.',sourcePages:[28,29,35,36,37,38]},
  ]},
];

export interface QuizContent { id:string;prompt:string;answer:string;explanation:string;type:'keyboard'|'staff'|'text'|'finger';choices?:string[];correctChoice?:number }
export const quizzes:QuizContent[]=[
  {id:'Q01',prompt:'그림에서 도를 모두 찾아보세요.',answer:'왼쪽부터 1·8·15번째 흰건반',explanation:'완전한 검은건반 두 개 묶음의 바로 왼쪽이 도예요. 같은 이름이 다른 높이에서 반복돼요.',type:'keyboard'},
  {id:'Q02',prompt:'오른손 중지는 손 몇 번일까요?',answer:'손 3',explanation:'오른손은 엄지부터 손 1·2·3·4·5예요.',type:'finger',choices:['손 1','손 2','손 3','손 4','손 5'],correctChoice:2},
  {id:'Q03',prompt:'다장조 숫자보에서 1=C일 때, 6은 무엇일까요?',answer:'라',explanation:'숫자보의 6은 라예요. 손가락 번호나 컴퓨터 조작키와는 다른 정보예요.',type:'text',choices:['손 6','파','솔','라'],correctChoice:3},
  {id:'Q04',prompt:'악기의 맨 왼쪽 흰건반은 언제나 도일까요?',answer:'아니요',explanation:'악기 모델과 음역에 따라 첫 건반이 달라요. 안쪽의 완전한 검은건반 묶음을 확인하세요.',type:'text',choices:['네','아니요'],correctChoice:1},
  {id:'Q05',prompt:'왼쪽부터 음 이름을 말해 보세요.',answer:'도 · 미 · 솔 · 높은 도',explanation:'그림은 C4·E4·G4·C5예요. 음마다 다른 오선 위치와 건반이 연결돼요.',type:'staff'},
  {id:'Q06',prompt:'파에 엄지를 놓은 파 자리에서 높은 도는 손 몇 번일까요?',answer:'손 5',explanation:'이 손자리에서는 높은 도가 손 5예요. 모든 곡에서 높은 도가 손 5인 것은 아니에요.',type:'finger',choices:['손 1','손 2','손 3','손 4','손 5'],correctChoice:4},
  {id:'Q07',prompt:'같은 음을 네 번 텅잉할 때 매번 새로 숨을 들이쉴까요?',answer:'아니요',explanation:'이 연습에서는 같은 숨의 흐름 안에서 혀로 소리의 시작을 부드럽게 나눠요.',type:'text',choices:['네','아니요'],correctChoice:1},
  {id:'Q08',prompt:'쉬는 박에 손자리를 옮길 때 건반을 누른 채 끌고 갈까요?',answer:'아니요',explanation:'건반을 떼고 손 전체를 옮긴 다음 새 손자리를 준비해요.',type:'text',choices:['네','아니요'],correctChoice:1},
  {id:'NQ01',prompt:'파를 도 자리와 파 자리에서 각각 손 몇 번으로 누를까요?',answer:'도 자리 손 4 · 파 자리 손 1',explanation:'손번호는 음에 고정되지 않고 현재 손자리에 따라 달라져요.',type:'text'},
  {id:'NQ02',prompt:'네 칸 리듬의 ‘계속’에서 소리를 새로 시작할까요?',answer:'아니요',explanation:'앞의 음을 그대로 이어 가요. 새 note-on이나 텅잉을 만들지 않아요.',type:'text',choices:['네','아니요'],correctChoice:1},
  {id:'NQ03',prompt:'높은 자리 산책의 마지막 라 다음 음은 무엇일까요?',answer:'파',explanation:'라 다음은 파예요. 중간의 솔을 누르지 않아요.',type:'text',choices:['도','미','파','솔'],correctChoice:2},
  {id:'NQ04',prompt:'쉼표에서 소리가 멈추면 박도 멈출까요?',answer:'아니요',explanation:'불지 않는 동안에도 박은 같은 간격으로 흘러가요.',type:'text',choices:['네','아니요'],correctChoice:1},
];

export const contentProvenance={
  version:'1.0.0',sourceId:'SRC-02',sourceDocument:'멜로디카_교사용_웹앱_상세설계서_v1.0.md',
  sourceKind:'adapted',reviewStatus:'content-reviewed',licenseStatus:'reference-only',
  derivation:'제공 교재를 확인한 상세설계서의 음·박·퀴즈 내용을 수업 데이터로 재구성. 화면 및 시범은 새 SVG·합성음.',
  fieldReview:'pending',applicationSongs:'미수록: 부분 원도해를 완곡으로 추정하지 않음',
};
