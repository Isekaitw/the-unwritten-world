const $ = (s) => document.querySelector(s);
const worldEl = $("#world");
const playerEl = $("#player");
const viewport = $("#viewport");
const dialogue = $("#dialogue");
const dialogueTitle = $("#dialogue-title");
const dialogueBody = $("#dialogue-body");
const choiceRow = $("#choices");
const status = $("#status");
const sceneTitle = $("#scene-title");
const sceneIndex = $("#scene-index");
const questList = $("#quest-list");
const clueList = $("#clue-list");
const SAVE_KEY = "unwritten-world-chapter-one-v1";
const W = 1200, H = 760;
const player = { x: 130, y: 150, w: 28, h: 38, speed: 230 };
const keys = new Set();
let active = false, last = 0, raf = 0, target = null;
const state = {
  scene: 0, marker: false, metHeTing: false, bell: false, record: false,
  secret: false, choice: "", chapterComplete: false, clues: [],
};
const scenes = [
 { id:"ch01_tide_mark", name:"潮痕灘", desc:"潮水退去後，沙面留下不屬於海浪的規律痕跡。",
   objects:[
    {id:"tide",x:330,y:300,title:"潮痕標記",kind:"clue"},
    {id:"echo",x:920,y:170,title:"微弱回聲",kind:"secret"},
    {id:"path",x:1090,y:600,title:"通往灰鐘台的石徑",kind:"exit"}
   ]},
 { id:"ch01_grey_bell", name:"灰鐘台", desc:"風穿過空鐘，發出像有人在遠處記錄的低鳴。",
   objects:[
    {id:"heting",x:330,y:280,title:"禾汀",kind:"character"},
    {id:"bell",x:820,y:350,title:"灰鐘",kind:"clue"},
    {id:"path",x:1090,y:600,title:"通往下層記錄室的階梯",kind:"exit"}
   ]},
 { id:"ch01_record_room", name:"下層記錄室", desc:"石壁上的記錄彼此矛盾，像是同一件事被改寫過數次。",
   objects:[
    {id:"record",x:350,y:260,title:"異常記錄",kind:"clue"},
    {id:"console",x:770,y:360,title:"資料處理台",kind:"choice"}
   ]}
];
const obstacles = [
 [{x:460,y:140,w:90,h:240},{x:620,y:440,w:210,h:55}],
 [{x:500,y:150,w:180,h:60},{x:650,y:440,w:65,h:150}],
 [{x:180,y:430,w:260,h:60},{x:600,y:150,w:80,h:240}]
];
function save() {
 try { localStorage.setItem(SAVE_KEY, JSON.stringify({...state, x:player.x, y:player.y})); return true; }
 catch { setStatus("無法寫入本機存檔。請確認瀏覽器儲存空間與隱私設定；目前進度仍留在本次頁面。"); return false; }
}
function load() {
 try {
  const raw = localStorage.getItem(SAVE_KEY); if (!raw) return;
  const s = JSON.parse(raw);
  if (!s || !Number.isInteger(s.scene) || s.scene < 0 || s.scene >= scenes.length) throw new Error("invalid save");
  Object.assign(state, s);
  player.x = Number.isFinite(s.x) ? s.x : 130; player.y = Number.isFinite(s.y) ? s.y : 150;
  if (!Array.isArray(state.clues)) state.clues = [];
 } catch { setStatus("讀取到無效或損壞的存檔，已使用新進度開始。"); state.scene=0; }
}
function setStatus(t) { status.textContent = t; }
function openDialogue(title, text, choices=[]) {
 active = false; dialogueTitle.textContent=title; dialogueBody.textContent=text;
 choiceRow.replaceChildren();
 choices.forEach(c => { const b=document.createElement("button"); b.textContent=c.label; b.addEventListener("click",()=>{ c.run(); closeDialogue(); render(); save(); }); choiceRow.append(b); });
 dialogue.hidden=false; if (!choices.length) { const b=document.createElement("button"); b.textContent="繼續（Enter）"; b.addEventListener("click",closeDialogue); choiceRow.append(b); }
}
function closeDialogue() { dialogue.hidden=true; active=true; last=0; viewport.focus(); }
function addClue(id, title, text) {
 if (!state.clues.some(c=>c.id===id)) state.clues.push({id,title,text});
}
function interact(o) {
 if (o.id==="tide") {
  state.marker=true; addClue("CL-05","CL-05｜反覆的潮痕","潮痕不是自然沖刷形成；間距像某種測量刻度。");
  openDialogue("潮痕標記","你沿著規律的刻痕摸索，發現每隔一段距離便有相同的缺口。這不是海浪留下的痕跡，而像一份被刻在地上的測量記錄。");
 } else if(o.id==="echo") {
  state.secret=true; addClue("SECRET-01","隱藏線索｜微弱回聲","石縫裡傳來斷續的報數聲，與潮痕的間距相互呼應。");
  openDialogue("微弱回聲","你在石縫裡聽見一段幾乎被風抹去的報數聲。它與潮痕的節奏相同。這段發現已記入線索簿。");
 } else if(o.id==="path" && state.scene===0) {
  if(!state.marker) { openDialogue("石徑","石徑通往灰鐘台，但潮痕標記似乎是理解這裡的關鍵。"); return; }
  state.scene=1; player.x=120; player.y=590; setStatus("已抵達灰鐘台。"); render(); save(); return;
 } else if(o.id==="heting") {
  state.metHeTing=true;
  openDialogue("禾汀","「你也看見那些不合常理的刻痕了？」禾汀把一張磨損的記錄紙遞給你。「別急著相信上面寫的結論，先看看它漏掉了什麼。」");
 } else if(o.id==="bell") {
  state.bell=true; addClue("CL-06","CL-06｜灰鐘的空鳴","灰鐘內部沒有鐘舌，卻在特定風向發出規律低鳴。");
  openDialogue("灰鐘","鐘體內沒有鐘舌，卻在風穿過時發出規律的低鳴。禾汀認為，這聲音可能是某種訊號，而非鐘聲。");
 } else if(o.id==="path" && state.scene===1) {
  if(!state.metHeTing || !state.bell) { openDialogue("下層階梯","階梯通往記錄室。先和禾汀談談，並調查灰鐘，確認兩條線索是否互相呼應。"); return; }
  state.scene=2; player.x=120; player.y=590; setStatus("已進入下層記錄室。"); render(); save(); return;
 } else if(o.id==="record") {
  state.record=true; addClue("CL-07","CL-07｜互相矛盾的記錄","兩份檔案描述同一事件，時間與責任歸屬卻互相衝突。");
  openDialogue("異常記錄","你找到兩份描述同一事件的檔案。一份將事件標記為意外，另一份卻記載了事前批准的程序。時間戳記被改動過。");
 } else if(o.id==="console") {
  if(!state.record) { openDialogue("資料處理台","介面要求先輸入記錄編號。也許應先檢查牆上的異常記錄。"); return; }
  openDialogue("資料處理選擇","你可以保留原始資料，或先整理出一份便於閱讀的摘要。兩種做法都會影響後續調查的依據。",[
   {label:"保留原始記錄",run:()=>{state.choice="original";state.chapterComplete=true;addClue("CHOICE","處理決定｜保留原始記錄","原始資料未被覆寫，矛盾仍完整保留以供追查。");}},
   {label:"整理成摘要副本",run:()=>{state.choice="summary";state.chapterComplete=true;addClue("CHOICE","處理決定｜摘要副本","建立了方便閱讀的摘要副本，原始資料仍保留但不置於首頁。");}}
  ]);
 }
 render(); save();
}
function render() {
 const s=scenes[state.scene]; sceneTitle.textContent=s.name; sceneIndex.textContent=s.id;
 worldEl.className="world scene-"+state.scene;
 worldEl.replaceChildren();
 const ground=document.createElement("div"); ground.className="ground"; worldEl.append(ground);
 const water=document.createElement("div"); water.className="water"; if(state.scene!==0) water.hidden=true; worldEl.append(water);
 for(const [i,r] of obstacles[state.scene].entries()){const e=document.createElement("div");e.className="obstacle";Object.assign(e.style,{left:r.x+"px",top:r.y+"px",width:r.w+"px",height:r.h+"px"});worldEl.append(e);}
 s.objects.forEach(o=>{const b=document.createElement("button");b.className="object "+(o.kind==="secret"&&state.secret?"found":"");b.style.left=o.x+"px";b.style.top=o.y+"px";b.dataset.id=o.id;b.innerHTML='<span class="glyph">◇</span><span class="object-name"></span>';b.querySelector(".object-name").textContent=o.title;b.addEventListener("click",()=>{if(distance(o)<95) interact(o);else setStatus("走近「"+o.title+"」後再互動。");});worldEl.append(b);});
 playerEl.style.left=player.x+"px"; playerEl.style.top=player.y+"px";
 updatePanels(); updateCamera(); updateTarget();
 if(state.chapterComplete) setStatus("第一章流程已完成。你可以查看線索簿，或重新開始體驗另一種資料處理選擇。");
}
function updatePanels() {
 const qs=[["調查潮痕標記",state.marker],["與禾汀交談",state.metHeTing],["調查灰鐘",state.bell],["檢查異常記錄",state.record],["完成資料處理決定",state.chapterComplete]];
 questList.replaceChildren(); qs.forEach(([t,d])=>{const li=document.createElement("li");li.textContent=(d?"✓ ":"○ ")+t;li.className=d?"done":"";questList.append(li);});
 clueList.replaceChildren(); state.clues.forEach(c=>{const li=document.createElement("li");li.innerHTML='<strong></strong><p></p>';li.querySelector("strong").textContent=c.title;li.querySelector("p").textContent=c.text;clueList.append(li);});
 $("#clue-count").textContent=state.clues.length+" 條";
 $("#secret-status").textContent=state.secret?"已發現":"尚未發現";
 $("#chapter-status").textContent=state.chapterComplete?(state.choice==="original"?"結尾：保留原始記錄":"結尾：建立摘要副本"):"調查進行中";
}
function distance(o){return Math.hypot((player.x+player.w/2)-o.x,(player.y+player.h/2)-o.y);}
function updateTarget(){
 const s=scenes[state.scene]; target=s.objects.map(o=>({o,d:distance(o)})).sort((a,b)=>a.d-b.d)[0];
 document.querySelectorAll(".object").forEach(el=>el.classList.toggle("near",target&&el.dataset.id===target.o.id&&target.d<100));
 $("#interact").disabled=!target||target.d>100||dialogue.hidden===false;
 $("#target-label").textContent=target&&target.d<100?"互動："+target.o.title:"探索環境";
}
function updateCamera(){
 const vw=viewport.clientWidth, vh=viewport.clientHeight;
 const x=Math.max(0,Math.min(W-vw,player.x+player.w/2-vw/2));
 const y=Math.max(0,Math.min(H-vh,player.y+player.h/2-vh/2));
 worldEl.style.transform=`translate(${-x}px,${-y}px)`;
}
function blocked(x,y){
 const rect={x:x+3,y:y+player.h-13,w:player.w-6,h:12};
 return obstacles[state.scene].some(o=>rect.x<o.x+o.w&&rect.x+rect.w>o.x&&rect.y<o.y+o.h&&rect.y+rect.h>o.y);
}
function tick(time){
 if(!active)return;
 const dt=Math.min((time-last)/1000||0,0.04);last=time;
 let dx=0,dy=0;
 if(keys.has("w")||keys.has("ArrowUp"))dy--;if(keys.has("s")||keys.has("ArrowDown"))dy++;
 if(keys.has("a")||keys.has("ArrowLeft"))dx--;if(keys.has("d")||keys.has("ArrowRight"))dx++;
 if(dx&&dy){dx*=Math.SQRT1_2;dy*=Math.SQRT1_2;}
 const nx=Math.max(0,Math.min(W-player.w,player.x+dx*player.speed*dt));
 const ny=Math.max(0,Math.min(H-player.h,player.y+dy*player.speed*dt));
 if(!blocked(nx,player.y))player.x=nx;if(!blocked(player.x,ny))player.y=ny;
 playerEl.style.left=player.x+"px";playerEl.style.top=player.y+"px";updateCamera();updateTarget();
 raf=requestAnimationFrame(tick);
}
function start(){load();$("#title").hidden=true;$("#game").hidden=false;active=true;last=0;render();viewport.focus();raf=requestAnimationFrame(tick);setStatus("使用 WASD／方向鍵移動，靠近物件後按 E 或 Enter 調查。");}
$("#start").addEventListener("click",start);
$("#interact").addEventListener("click",()=>{if(target&&target.d<100)interact(target.o);});
$("#save").addEventListener("click",()=>{if(save())setStatus("進度已儲存於此瀏覽器。");});
$("#reset").addEventListener("click",()=>{if(confirm("確定清除第一章本機進度？此操作無法復原。")){try{localStorage.removeItem(SAVE_KEY);}catch{} location.reload();}});
$("#quest-toggle").addEventListener("click",()=>$("#quest-panel").hidden=!$("#quest-panel").hidden);
$("#clues-toggle").addEventListener("click",()=>$("#clues-panel").hidden=!$("#clues-panel").hidden);
document.addEventListener("keydown",e=>{
 if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].includes(e.key))e.preventDefault();
 if(!dialogue.hidden){if(e.key==="Escape"||e.key==="Enter"){closeDialogue();}return;}
 if(e.key==="e"||e.key==="E"||e.key==="Enter"||e.key==="f"||e.key==="F"){if(target&&target.d<100)interact(target.o);return;}
 keys.add(e.key);
});
document.addEventListener("keyup",e=>keys.delete(e.key));
window.addEventListener("blur",()=>keys.clear());
window.addEventListener("resize",updateCamera);
$("#close-dialogue").addEventListener("click",closeDialogue);
