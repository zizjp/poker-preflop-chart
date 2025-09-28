/* ============================================================
 * レンジ可視化：8-max / BBアンティ / 単純状態管理（バニラJS）
 * - モード: open / vs3bet / overview
 * - JSONは ranges.json があれば fetch し、なければ埋め込み defaultRanges を使用
 * ============================================================ */

/* ---------- 埋め込み初期データ（保守的） ---------- */
const defaultRanges = {
  meta: { version: 1, game: "8max_BB_ante", lastUpdated: new Date().toISOString().slice(0,10) },
  stacks: ["20","30","40"],
  positions: ["UTG","UTG+1","MP","HJ","CO","BTN","SB","BB"],
  actions: ["open","vs3bet_fold","vs3bet_call","vs3bet_jam"],
  legend: {
    open:"2BBでオープン推奨",
    vs3bet_fold:"3bet来たら降り",
    vs3bet_call:"3bet来たらコール",
    vs3bet_jam:"3bet来たら4bet jam"
  },
  notes: {},
  grid: {
    /* —— 20:UTG（KJsはopenなし） —— */
    "20:UTG": { "AA":{open:1},"KK":{open:1},"QQ":{open:1},"JJ":{open:1},"TT":{open:1},
      "AKs":{open:1},"AQs":{open:1},"AJs":{open:1},"KQs":{open:1},"AKo":{open:1},"AQo":{open:1} },
    "20:UTG:SB":{ "AA":{"vs3bet_jam":1},"KK":{"vs3bet_jam":1},"QQ":{"vs3bet_jam":1},"JJ":{"vs3bet_jam":1},
      "AKs":{"vs3bet_jam":1},"AKo":{"vs3bet_jam":1},"AQs":{"vs3bet_fold":1},"KQs":{"vs3bet_fold":1},"AQo":{"vs3bet_fold":1} },
    "20:UTG:BB":{ "AA":{"vs3bet_jam":1},"KK":{"vs3bet_jam":1},"QQ":{"vs3bet_jam":1},"JJ":{"vs3bet_jam":1},
      "AKs":{"vs3bet_jam":1},"AKo":{"vs3bet_jam":1},"AQs":{"vs3bet_fold":1},"KQs":{"vs3bet_fold":1},"AQo":{"vs3bet_fold":1} },

    /* —— 30:UTG（KJsは境界→デフォfold） —— */
    "30:UTG": { "AA":{open:1},"KK":{open:1},"QQ":{open:1},"JJ":{open:1},"TT":{open:1},
      "AKs":{open:1},"AQs":{open:1},"AJs":{open:1},"KQs":{open:1},"AKo":{open:1},"AQo":{open:1} },
    "30:UTG:SB":{ "AA":{"vs3bet_jam":1},"KK":{"vs3bet_jam":1},"QQ":{"vs3bet_jam":1},"JJ":{"vs3bet_jam":1},
      "AKs":{"vs3bet_jam":1},"AKo":{"vs3bet_jam":1},"AQs":{"vs3bet_fold":1},"KQs":{"vs3bet_fold":1} },
    "30:UTG:BB":{ "AA":{"vs3bet_jam":1},"KK":{"vs3bet_jam":1},"QQ":{"vs3bet_jam":1},"JJ":{"vs3bet_jam":1},
      "AKs":{"vs3bet_jam":1},"AKo":{"vs3bet_jam":1},"AQs":{"vs3bet_fold":1},"KQs":{"vs3bet_fold":1} },

    /* —— 40:UTG（KJsはopen=1だがvs3betはfold） —— */
    "40:UTG": { "AA":{open:1},"KK":{open:1},"QQ":{open:1},"JJ":{open:1},"TT":{open:1},
      "AKs":{open:1},"AQs":{open:1},"AJs":{open:1},"KQs":{open:1},"KJs":{open:1},"AKo":{open:1},"AQo":{open:1} },
    "40:UTG:SB":{ "AA":{"vs3bet_jam":1},"KK":{"vs3bet_jam":1},"QQ":{"vs3bet_jam":1},"JJ":{"vs3bet_jam":1},
      "AKs":{"vs3bet_jam":1},"AKo":{"vs3bet_jam":1},"KJs":{"vs3bet_fold":1},"KQs":{"vs3bet_fold":1},"AQs":{"vs3bet_fold":1} },
    "40:UTG:BB":{ "AA":{"vs3bet_jam":1},"KK":{"vs3bet_jam":1},"QQ":{"vs3bet_jam":1},"JJ":{"vs3bet_jam":1},
      "AKs":{"vs3bet_jam":1},"AKo":{"vs3bet_jam":1},"KJs":{"vs3bet_fold":1},"KQs":{"vs3bet_fold":1},"AQs":{"vs3bet_fold":1} },

    /* —— 20:BTN（保守的だけど20BBはそこそこ広め） —— */
    "20:BTN": {
    "55":{open:1},"66":{open:1},"77":{open:1},"88":{open:1},"99":{open:1},"TT":{open:1},"JJ":{open:1},"QQ":{open:1},"KK":{open:1},"AA":{open:1},
    "A9o":{open:1},"ATo":{open:1},"AJo":{open:1},"AQo":{open:1},"AKo":{open:1},
    "KTo":{open:1},"QTo":{open:1},"JTo":{open:1},"KJo":{open:1},"KQo":{open:1},"QJo":{open:1},
    "A2s":{open:1},"A3s":{open:1},"A4s":{open:1},"A5s":{open:1},"A6s":{open:1},"A7s":{open:1},"A8s":{open:1},"A9s":{open:1},"ATs":{open:1},"AJs":{open:1},"AQs":{open:1},"AKs":{open:1},
    "K9s":{open:1},"KTs":{open:1},"KJs":{open:1},"Q9s":{open:1},"QTs":{open:1},"QJs":{open:1},
    "J9s":{open:1},"JTs":{open:1},"T9s":{open:1},"98s":{open:1},"87s":{open:1} },

    /* —— 例：CO/BTN/SB はややルースのサンプル（最小限） —— */
    "30:CO": { "AA":{open:1},"KK":{open:1},"QQ":{open:1},"JJ":{open:1},"TT":{open:1},"99":{open:1},"88":{open:1},
      "AKs":{open:1},"AQs":{open:1},"AJs":{open:1},"ATs":{open:1},"KQs":{open:1},"KJs":{open:1},"QJs":{open:1},"JTs":{open:1},"T9s":{open:1},
      "AKo":{open:1},"AQo":{open:1},"AJo":{open:1},"KQo":{open:1},"ATo":{open:1} },
    "40:CO": { "77":{open:1},"66":{open:1},"A9s":{open:1},"KTs":{open:1},"QTs":{open:1},"J9s":{open:1},"98s":{open:1},"87s":{open:1},"ATo":{open:1} },
    "30:BTN": { "55":{open:1},"44":{open:1},"33":{open:1},"22":{open:1},
      "A8s":{open:1},"A5s":{open:1},"KTs":{open:1},"K9s":{open:1},"QTs":{open:1},"JTs":{open:1},"T9s":{open:1},"97s":{open:1},
      "A9o":{open:1},"KJo":{open:1},"QJo":{open:1},"T8s":{open:1} },
    "20:SB": { "AA":{open:1},"KK":{open:1},"QQ":{open:1},"JJ":{open:1},"TT":{open:1},"99":{open:1},
      "AKs":{open:1},"AQs":{open:1},"AJs":{open:1},"KQs":{open:1},"AKo":{open:1},"AQo":{open:1} }
  }
};

/* ---------- 便利関数/状態 ---------- */
const RANKS = ["A","K","Q","J","T","9","8","7","6","5","4","3","2"];
const $ = sel => document.querySelector(sel);
const el = (tag, props={}, ...children) => { const n=document.createElement(tag); Object.assign(n, props); children.forEach(c=>n.append(c)); return n; };

const state = {
  stack: "20",
  pos: "UTG",
  mode: "open",      // open | vs3bet | overview
  opponent: "SB",
  focusIndex: 0
};

let ranges = structuredClone(defaultRanges);

/* ---------- 起動時：ranges.json を試し読み（失敗したら内蔵データ） ---------- */
(async function bootstrap(){
  try{
    const res = await fetch("./ranges.json",{cache:"no-store"});
    if(res.ok){
      const data = await res.json();
      const err = validateSchema(data);
      if(!err.length){ ranges = data; }
      else notify("内蔵データで起動（ranges.json検証エラー: "+err.join("; ")+")");
    }else{
      // 404等は内蔵
    }
  }catch(_){}
  initUI();
  render();
})();

/* ---------- UI構築 ---------- */
const matrix = $("#matrix");
function buildMatrix(){
  matrix.append(el("div",{className:"corner","aria-hidden":"true"},""));
  for(let c=0;c<13;c++) matrix.append(el("div",{className:"hdr",role:"columnheader","aria-colindex":(c+2)}, RANKS[c]));
  for(let r=0;r<13;r++){
    matrix.append(el("div",{className:"hdr",role:"rowheader","aria-rowindex":(r+2)}, RANKS[r]));
    for(let c=0;c<13;c++){
      const hand = handAt(r,c);
      const cell = el("div",{className:"cell",tabIndex:0,role:"gridcell","data-hand":hand,"data-idx":(r*13+c),"aria-label":`${hand}（タップで詳細）`}, hand);
      cell.addEventListener("click",(e)=>openPopover(cell, hand, e));
      cell.addEventListener("keydown",(e)=>{
        const idx = +cell.dataset.idx;
        if(e.key==="Enter"||e.key===" "){ e.preventDefault(); openPopover(cell, hand, e); }
        else if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key)){ e.preventDefault(); moveFocus(idx,e.key); }
      });
      matrix.append(cell);
    }
  }
}
function initSelectors(){
  const stackSel = $("#stackSel"), posSel=$("#posSel"), oppSel=$("#oppSel");
  ranges.stacks.forEach(s=>stackSel.append(el("option",{value:s}, `${s}BB`)));
  ranges.positions.forEach(p=>posSel.append(el("option",{value:p}, p)));
  ranges.positions.forEach(p=>oppSel.append(el("option",{value:p}, p)));
  stackSel.addEventListener("change", e=>{ state.stack=e.target.value; render(); });
  posSel.addEventListener("change", e=>{ state.pos=e.target.value; render(); });
  oppSel.addEventListener("change", e=>{ state.opponent=e.target.value; render(); });

  $("#tabOpen").addEventListener("click", ()=>{
    state.mode="open";
    setTabs("tabOpen");
    $("#oppWrap").style.display="none";
    render();
  });
  $("#tabVs3").addEventListener("click", ()=>{
    state.mode="vs3bet";
    setTabs("tabVs3");
    $("#oppWrap").style.display="";
    render();
  });
  $("#tabOverview").addEventListener("click", ()=>{
    state.mode="overview";
    setTabs("tabOverview");
    $("#oppWrap").style.display="none";
    render();
  });

  $("#fsBtn").addEventListener("click", ()=>{
    const elw=$("#gridWrap");
    if(!document.fullscreenElement){ (elw.requestFullscreen?.bind(elw)||(()=>{}))(); $("#fsBtn").textContent="縮小"; }
    else { (document.exitFullscreen?.bind(document)||(()=>{}))(); $("#fsBtn").textContent="拡大"; }
  });

  $("#importBtn").addEventListener("click", ()=>$("#importFile").click());
  $("#importFile").addEventListener("change", onImport);
  $("#exportBtn").addEventListener("click", onExport);
  $("#saveNoteBtn").addEventListener("click", onSaveNote);

  // ヘルプ開閉記憶
  const d = document.getElementById('helpDetails'); const key='help.open';
  try{ d.open = localStorage.getItem(key)==='1'; }catch(_){}
  d.addEventListener('toggle',()=>{ try{ localStorage.setItem(key,d.open?'1':'0'); }catch(_){}});

  document.addEventListener("keydown",(e)=>{ if(e.key==="Escape") $("#popover").style.display="none"; });
}
function setTabs(activeId){
  for(const id of ["tabOpen","tabVs3","tabOverview"]){
    document.getElementById(id).setAttribute("aria-pressed", id===activeId ? "true":"false");
  }
}

/* ---------- 共通ユーティリティ ---------- */
function handAt(ri,ci){ const r=RANKS[ri], c=RANKS[ci]; if(ri===ci) return r+r; return (ri<ci)?(r+c+"o"):(c+r+"s"); }
function getKey(){ return state.mode==="open" ? `${state.stack}:${state.pos}` : `${state.stack}:${state.pos}:${state.opponent}`; }
function getMemoKey(){ return state.mode==="open" ? `${state.stack}:${state.pos}` : `${state.stack}:${state.pos}:${state.opponent}`; }

function getCellState(hand){ // 未定義=empty → UIではfold扱い
  const key=getKey(); const obj=ranges.grid[key]||{};
  if(state.mode==="open"){ return obj[hand]?.open ? "open":"empty"; }
  else{
    if(obj[hand]?.vs3bet_jam) return "jam";
    if(obj[hand]?.vs3bet_call) return "call";
    if(obj[hand]?.vs3bet_fold) return "fold";
    return "empty";
  }
}
function listCurrentRange(){
  const key=getKey(), obj=ranges.grid[key]||{}, picks=[];
  if(state.mode==="open"){ for(const [h,a] of Object.entries(obj)) if(a.open) picks.push(h); }
  else{
    const map={vs3bet_jam:"[jam]",vs3bet_call:"[call]",vs3bet_fold:"[fold]"};
    for(const [h,a] of Object.entries(obj)){
      for(const k of ["vs3bet_jam","vs3bet_call","vs3bet_fold"]) if(a[k]){ picks.push(`${h}${map[k]}`); break; }
    }
  }
  return picks.sort().join(", ");
}

/* 総覧：このスタックで“最も前のポジション”がopenしている色を返す */
function overviewPosForHand(stack, hand){
  for(const p of ranges.positions){
    const k=`${stack}:${p}`; if(ranges.grid[k]?.[hand]?.open) return p;
  }
  return "empty";
}
function overviewListByPos(){
  const res={}; for(const p of ranges.positions) res[p]=[];
  for(let r=0;r<13;r++) for(let c=0;c<13;c++){
    const h=handAt(r,c); const pos=overviewPosForHand(state.stack,h);
    if(pos!=="empty") res[pos].push(h);
  }
  const lines=[]; for(const p of ranges.positions){ if(res[p].length) lines.push(`${p}: ${res[p].sort().join(", ")}`); }
  return lines.join("\n");
}

/* ---------- DOM構築/初期化 ---------- */
function initUI(){ buildMatrix(); initSelectors(); document.querySelector('.cell[data-idx="0"]').focus(); }
buildMatrix = buildMatrix; // keep ref

/* ---------- レンダリング ---------- */
function render(){
  $("#stackSel").value=state.stack; $("#posSel").value=state.pos; $("#oppSel").value=state.opponent;

  const legendAction = $("#legendAction"), legendOverview=$("#legendOverview");
  const isOverview = state.mode==="overview";
  legendAction.style.display = isOverview ? "none" : "";
  legendOverview.style.display = isOverview ? "" : "none";

  document.querySelectorAll(".cell").forEach(cell=>{
    const h = cell.dataset.hand;
    cell.removeAttribute("data-state"); cell.removeAttribute("data-overview");
    if(state.mode==="open"){
      const st=getCellState(h); if(st==="open") cell.setAttribute("data-state","open");
    }else if(state.mode==="vs3bet"){
      const st=getCellState(h); if(st!=="empty") cell.setAttribute("data-state",st);
    }else{ // overview
      const pos=overviewPosForHand(state.stack,h); cell.setAttribute("data-overview", pos);
    }
  });

  $("#rangeList").textContent = isOverview ? overviewListByPos() : listCurrentRange();

  const mk=getMemoKey(); $("#noteBox").value = ranges.notes?.[mk] || "";
}

/* ---------- ポップオーバー ---------- */
const pop=$("#popover");
function openPopover(cell, hand){
  const rect=cell.getBoundingClientRect(), pad=8;
  pop.style.left = Math.min(window.innerWidth-320, Math.max(8, rect.right+pad))+"px";
  pop.style.top  = Math.min(window.innerHeight-220, rect.top)+"px";
  pop.innerHTML = buildPopoverHTML(hand);
  pop.style.display="block";
}
document.addEventListener("click",(e)=>{ if(!pop.contains(e.target) && !e.target.closest(".cell")) pop.style.display="none"; });
function buildPopoverHTML(hand){
  const openLines=[];
  for(const s of ranges.stacks) for(const p of ranges.positions){
    const k=`${s}:${p}`; if((ranges.grid[k]||{})[hand]?.open) openLines.push(`${s}BB ${p}`);
  }
  const vsLines=[];
  for(const opp of ranges.positions){
    if(opp===state.pos) continue;
    const k=`${state.stack}:${state.pos}:${opp}`; const o=(ranges.grid[k]||{})[hand]||{};
    const tag=o.vs3bet_jam?"jam":o.vs3bet_call?"call":o.vs3bet_fold?"fold":"-";
    if(tag!=="-") vsLines.push(`${opp}: ${tag}`);
  }
  const nowKey=getKey(); const nowObj=ranges.grid[nowKey]?.[hand]||{};
  const nowLabel=(state.mode==="open") ? (nowObj.open?"open":"未定義=fold") :
    (nowObj.vs3bet_jam?"jam":nowObj.vs3bet_call?"call":nowObj.vs3bet_fold?"fold":"未定義=fold");

  return `
    <h3>${hand}</h3>
    <div class="small">現在: ${state.stack}BB / ${state.mode==="overview"?"総覧":state.pos+(state.mode==="vs3bet"?" vs "+state.opponent:"")}</div>
    <div class="kv" style="margin-top:6px;"><b>この状況:</b> ${nowLabel}</div>
    <div class="kv" style="margin-top:6px;"><b>全open:</b> ${openLines.length?openLines.join(", "):"なし"}</div>
    <div class="kv" style="margin-top:6px;"><b>vs3bet:</b> ${vsLines.length?vsLines.join(", "):"なし"}</div>
    <div class="small" style="margin-top:8px;">未定義はUI上fold扱い。JSON更新で反映。</div>
  `;
}

/* ---------- キーボード移動 ---------- */
function moveFocus(idx,key){
  let r=Math.floor(idx/13), c=idx%13;
  if(key==="ArrowLeft") c=Math.max(0,c-1);
  if(key==="ArrowRight") c=Math.min(12,c+1);
  if(key==="ArrowUp") r=Math.max(0,r-1);
  if(key==="ArrowDown") r=Math.min(12,r+1);
  const next=r*13+c; const target=document.querySelector(`.cell[data-idx="${next}"]`);
  if(target){ target.focus(); state.focusIndex=next; }
}

/* ---------- Import/Export/Notes ---------- */
function onSaveNote(){
  const key = getMemoKey();
  if(!ranges.notes) ranges.notes = {};
  ranges.notes[key] = $("#noteBox").value || "";
  notify(`メモ保存: ${key}`);
}
async function onImport(e){
  const file = e.target.files[0]; if(!file) return;
  try{
    const text = await file.text(); const data=JSON.parse(text); const err=validateSchema(data);
    if(err.length) return notify("Import失敗: "+err.join("; "));
    ranges = data;
    state.stack=ranges.stacks?.[0]||"20"; state.pos=ranges.positions?.[0]||"UTG";
    state.mode="open"; state.opponent=(ranges.positions||[])[1]||"UTG+1";
    render(); notify(`Import成功: ${file.name}`);
  }catch(ex){ notify("Importエラー: "+ex.message); }
  finally{ e.target.value=""; }
}
function onExport(){
  if(ranges.meta) ranges.meta.lastUpdated = new Date().toISOString().slice(0,10);
  const blob = new Blob([JSON.stringify(ranges,null,2)],{type:"application/json"});
  const a=document.createElement("a"), d=new Date();
  const ymd=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  a.download=`ranges_${ymd}.json`; a.href=URL.createObjectURL(blob); a.click(); URL.revokeObjectURL(a.href);
  notify("Export完了");
}

/* ---------- バリデーション / メッセージ ---------- */
function validateSchema(obj){
  const errs=[]; for(const k of ["meta","stacks","positions","actions","legend","grid"]) if(!(k in obj)) errs.push(`必須キー欠落: ${k}`);
  if(!Array.isArray(obj.stacks)) errs.push("stacksは配列");
  if(!Array.isArray(obj.positions)) errs.push("positionsは配列");
  if(!Array.isArray(obj.actions)) errs.push("actionsは配列");
  if(typeof obj.grid!=="object") errs.push("gridはオブジェクト");
  for(const a of ["open","vs3bet_fold","vs3bet_call","vs3bet_jam"]) if(!(obj.actions||[]).includes(a)) errs.push(`actionsに不足: ${a}`);
  return errs;
}
function notify(text){
  const m=$("#msg"); m.textContent=text; setTimeout(()=>{ if(m.textContent===text) m.textContent=""; }, 4000);
}

/* ---------- 初期構築呼び出し ---------- */
function initUI(){ buildMatrix(); initSelectors(); document.querySelector('.cell[data-idx="0"]').focus(); }
