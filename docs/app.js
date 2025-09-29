/* app.js — レンジ可視化 修正完全版（Export/Import/メモ 安定）
   - 13×13=169セル＋ヘッダー生成（各セルに data-hand 付与）
   - モード: open / vs3 / overview（総覧は fold色と衝突しない描画）
   - BB専用: BTNオープンへのフラットコール（<stack>:BB:BTN_open の call_open=1 を合成表示）
   - 編集モード（Open）: #editOpenToggle がONのとき、セルクリックで open をトグル
   - Import/Export: #exportBtn/#btnExport / #importBtn/#btnImport / #importFile/#fileImport に自動配線
   - メモ: 文脈（open=stack:pos / vs3=stack:pos:opp / overview=stack:overview）ごとに RANGES.notes に保存
   - 重要: init() で window.RANGES に代入し、Export は RANGES を優先的に書き出す（undefined対策）
*/

(() => {
  const RANKS = ["A","K","Q","J","T","9","8","7","6","5","4","3","2"];

  // ---- 要素参照（複数IDに対応）
  const $ = sel => document.querySelector(sel);
  const matrixEl = $("#matrix");
  const stackSel = $("#stackSel");
  const posSel   = $("#posSel");
  const oppWrap  = $("#oppWrap");
  const oppSel   = $("#oppSel");
  const tabOpen      = $("#tabOpen");
  const tabVs3       = $("#tabVs3");
  const tabOverview  = $("#tabOverview");
  const legendAction   = $("#legendAction");
  const legendOverview = $("#legendOverview");
  const rangeList = $("#rangeList");

  const editOpenToggle = $("#editOpenToggle"); // 任意
  const exportBtn  = document.querySelector('#btnExport, #exportBtn');
  const importBtn  = document.querySelector('#btnImport, #importBtn');
  const importFile = document.querySelector('#fileImport, #importFile'); // <input type="file" accept="application/json">
  const memoEl     = document.querySelector('#noteBox, #memoText, #memo, #notes');
  const saveNoteBtn= document.querySelector('#saveNoteBtn, #btnSaveNote');
  const msgEl      = document.querySelector('#msg, #message');

  // ---- 状態
  let MODE = "open";      // "open" | "vs3" | "overview"
  let RANGES = null;      // { stacks?, positions?, grid: {...}, notes? }
  let EDIT_OPEN = false;  // 編集モード（Openのみ有効）
  // メモ管理
  let lastNoteKey = null;
  let isSettingNote = false;

  document.addEventListener("DOMContentLoaded", init);

  async function init(){
    buildMatrix();

    // ranges.json を読み込み → グローバルへも反映（Exportのundefined対策）
    RANGES = await loadRanges();
    window.RANGES = RANGES;
    ensureNotes();                 // notes を必ず用意（memosがあれば移行）
    initSelectorsIfEmpty(RANGES);  // セレクタが空なら推定で埋める

    // タブ
    if (tabOpen)     tabOpen.addEventListener("click", () => setMode("open"));
    if (tabVs3)      tabVs3 .addEventListener("click", () => setMode("vs3"));
    if (tabOverview) tabOverview.addEventListener("click", () => setMode("overview"));

    // セレクタ変更
    [stackSel, posSel, oppSel].forEach(el => el && el.addEventListener("change", render));

    // 編集モード（Open）
    if (editOpenToggle) {
      editOpenToggle.addEventListener("change", () => {
        EDIT_OPEN = !!editOpenToggle.checked;
        if (EDIT_OPEN && MODE !== "open") { EDIT_OPEN = false; editOpenToggle.checked = false; }
        document.body.classList.toggle("is-edit-open", EDIT_OPEN);
      });
    }
    // セルクリック（編集ON & Open時のみトグル）
    if (matrixEl) {
      matrixEl.addEventListener("click", (ev) => {
        const cell = ev.target.closest(".cell");
        if (!cell) return;
        if (!EDIT_OPEN || MODE !== "open") return;
        const hand  = cell.dataset.hand;
        const stack = (stackSel && stackSel.value) || "20";
        const pos   = (posSel   && posSel.value)   || "UTG";
        toggleOpen(stack, pos, hand);
        render();
      });
    }

    // メモ入力 → 即保存（ドラフト）
    if (memoEl) {
      memoEl.addEventListener("input", () => {
        if (isSettingNote) return;
        saveNote(currentNoteKey(), memoEl.value);
      });
    }
    // メモ保存ボタン（任意）
    if (saveNoteBtn && memoEl) {
      saveNoteBtn.addEventListener("click", () => {
        saveNote(currentNoteKey(), memoEl.value);
        showMsg("メモを保存しました");
      });
    }

    // Export/Import（要素があれば）
    if (exportBtn) exportBtn.addEventListener("click", doExportDownload);
    if (importBtn && importFile) {
      importBtn.addEventListener("click", () => importFile.click());
      importFile.addEventListener("change", handleImportFile);
    }

    render();
    if (memoEl) loadNoteIntoUI(currentNoteKey()); // 初期表示メモ
    exposeDebugAndIO();
  }

  // ---- ranges 読込
  async function loadRanges(){
    try {
      const res = await fetch("./ranges.json", { cache: "no-store" });
      if (res.ok) return await res.json();
    } catch (_) {}
    if (window.RANGES) return window.RANGES;
    return { stacks: [], positions: [], grid: {} };
  }

  // ---- セレクタ（空なら）初期化
  function initSelectorsIfEmpty(data){
    const stacks = (data.stacks && data.stacks.length) ? data.stacks : inferStacks(data.grid);
    const positions = (data.positions && data.positions.length) ? data.positions : inferPositions(data.grid);

    if (stackSel && stackSel.options.length === 0 && stacks.length){
      stackSel.innerHTML = stacks.map(v => `<option value="${v}">${v}BB</option>`).join("");
      if (!stackSel.value) stackSel.value = stacks[0];
    }
    if (posSel && posSel.options.length === 0 && positions.length){
      posSel.innerHTML = positions.map(v => `<option value="${v}">${v}</option>`).join("");
      if (!posSel.value) posSel.value = positions[0];
    }
    if (oppSel && oppSel.options.length === 0 && positions.length){
      oppSel.innerHTML = positions.map(v => `<option value="${v}">${v}</option>`).join("");
      if (!oppSel.value) oppSel.value = positions[1] || positions[0];
    }
  }
  function inferStacks(grid){
    const s = new Set();
    Object.keys(grid || {}).forEach(k => { const m = k.match(/^(\d+):/); if (m) s.add(m[1]); });
    return [...s].sort((a,b)=>Number(a)-Number(b));
  }
  function inferPositions(grid){
    const s = new Set();
    Object.keys(grid || {}).forEach(k => { const p = k.split(":"); if (p[1]) s.add(p[1]); if (p[2]) s.add(p[2]); });
    const std = ["UTG","UTG+1","MP","HJ","CO","BTN","SB","BB"];
    return [...s].sort((a,b)=> std.indexOf(a) - std.indexOf(b));
  }

  // ---- タブ切替
  function setMode(next){
    MODE = next;
    [tabOpen, tabVs3, tabOverview].forEach(b => b && b.setAttribute("aria-pressed","false"));
    if (next==="open"     && tabOpen)     tabOpen.setAttribute("aria-pressed","true");
    if (next==="vs3"      && tabVs3)      tabVs3.setAttribute("aria-pressed","true");
    if (next==="overview" && tabOverview) tabOverview.setAttribute("aria-pressed","true");

    if (oppWrap)        oppWrap.style.display        = (next === "vs3") ? "" : "none";
    if (legendAction)   legendAction.style.display   = (next === "overview") ? "none" : "";
    if (legendOverview) legendOverview.style.display = (next === "overview") ? "" : "none";

    // 編集モードは Open 以外では自動OFF
    if (next !== "open" && EDIT_OPEN && editOpenToggle){
      EDIT_OPEN = false; editOpenToggle.checked = false; document.body.classList.remove("is-edit-open");
    }
    render();
    if (memoEl) loadNoteIntoUI(currentNoteKey());
  }

  // ---- 14×14（角＋列ヘッダー＋行ヘッダー＋169セル）
  function buildMatrix(){
    if (!matrixEl) { console.warn("[#matrix] が見つかりません"); return; }
    matrixEl.innerHTML = "";
    matrixEl.setAttribute("role","grid");
    matrixEl.setAttribute("aria-label","ハンドレンジ 13x13 グリッド");

    // 左上コーナー
    const corner = document.createElement("div");
    corner.className = "corner";
    matrixEl.appendChild(corner);

    // 上ヘッダー
    for (let j=0;j<13;j++){
      const h = document.createElement("div");
      h.className = "hdr";
      h.textContent = RANKS[j];
      h.setAttribute("aria-hidden","true");
      matrixEl.appendChild(h);
    }

    // 行ヘッダー＋セル
    for (let i=0;i<13;i++){
      const lh = document.createElement("div");
      lh.className = "hdr";
      lh.textContent = RANKS[i];
      lh.setAttribute("aria-hidden","true");
      matrixEl.appendChild(lh);

      for (let j=0;j<13;j++){
        const cell = document.createElement("div");
        cell.className = "cell";
        const hand = handAt(i,j);          // AA / AKs / AKo
        cell.dataset.hand = hand;          // ★ キー
        cell.dataset.row  = String(i);
        cell.dataset.col  = String(j);
        cell.dataset.state = "fold";       // 既定：未定義は fold
        cell.setAttribute("role","gridcell");
        cell.setAttribute("tabindex","-1");
        cell.title = hand;
        cell.textContent = hand;           // ラベル表示（不要なら消してOK）
        matrixEl.appendChild(cell);
      }
    }
  }

  // ---- hand 正規表記（上三角=suited）
  function handAt(i,j){
    const r1=RANKS[i], r2=RANKS[j];
    if (i===j) return r1+r2;                // AA, KK...
    const hi = i<j ? r1 : r2;
    const lo = i<j ? r2 : r1;
    const suited = i<j;                      // 対角線より上が suited
    return hi+lo+(suited ? "s" : "o");
  }

  // ---- 描画
  function render(){
    if (!matrixEl) return;

    // ラジオにも互換対応＆タブ同期
    const radioMode = document.querySelector('input[name="mode"]:checked')?.value;
    if (radioMode) {
      MODE = (radioMode === "open" ? "open" :
             (radioMode.startsWith("vs3") ? "vs3" :
              (radioMode === "overview" ? "overview" : MODE)));
    }
    if (tabOpen?.getAttribute("aria-pressed")==="true") MODE = "open";
    if (tabVs3 ?.getAttribute("aria-pressed")==="true") MODE = "vs3";
    if (tabOverview?.getAttribute("aria-pressed")==="true") MODE = "overview";

    const stack = (stackSel && stackSel.value) || "20";
    const pos   = (posSel   && posSel.value)   || "UTG";
    const opp   = (oppSel   && oppSel.value)   || "BTN";
    const grid  = (RANGES && RANGES.grid) || {};

    // 直前文脈のメモを保存してからリセット
    flushPrevNoteIfNeeded();

    // リセット：総覧のときは data-state を外す（fold色との衝突回避）
    matrixEl.querySelectorAll(".cell").forEach(c => {
      if (MODE === "overview") {
        c.removeAttribute("data-state");
      } else {
        c.dataset.state = "fold";
      }
      c.removeAttribute("data-overview");
      c.style.removeProperty("--ov-color");
    });
    matrixEl.classList.toggle("is-overview", MODE === "overview");

    // ---- 総覧（ポジ別：最前ポジで open 可の色）
    if (MODE === "overview"){
      const order = positionsOrder();
      const colorMap = {
        "UTG":  "hsl(210 70% 40%)",
        "UTG+1":"hsl(220 70% 40%)",
        "MP":   "hsl(240 60% 44%)",
        "HJ":   "hsl(250 60% 44%)",
        "CO":   "hsl(300 60% 46%)",
        "BTN":  "hsl(320 60% 46%)",
        "SB":   "hsl( 30 70% 46%)",
        "BB":   "hsl( 45 70% 46%)"
      };
      matrixEl.querySelectorAll(".cell").forEach(c => {
        const h = c.dataset.hand;
        let earliest = null;
        for (const p of order){
          const key = `${stack}:${p}`;
          const row = grid[key] && grid[key][h];
          if (row && row.open) { earliest = p; break; }
        }
        c.dataset.overview = earliest || "empty";
        if (earliest) c.style.setProperty("--ov-color", colorMap[earliest] || "hsl(0 0% 50%)");
      });
      if (rangeList) rangeList.textContent = `スタック ${stack}BB：各ハンドの「最前ポジで open 可」を色分け表示`;
      if (memoEl) loadNoteIntoUI(currentNoteKey());
      return;
    }

    // ---- open（オープンレンジ）
    if (MODE === "open"){
      const key = `${stack}:${pos}`;
      const table = grid[key] || {};
      matrixEl.querySelectorAll(".cell").forEach(c => {
        const h = c.dataset.hand;
        const row = table[h];
        if (row && row.open) c.dataset.state = "open";
      });
      if (rangeList) {
        const list = Object.keys(table).filter(h => table[h]?.open).sort();
        rangeList.textContent = list.join(" ");
      }
      if (memoEl) loadNoteIntoUI(currentNoteKey());
      return;
    }

    // ---- vs3（対3bet）＋ BB専用「BTNオープンにコール可」を合成
    const keyVs = `${stack}:${pos}:${opp}`;
    const tableVs = grid[keyVs] || {};
    let tableOpenCall = null;
    if (pos === "BB" && opp === "BTN") {
      const keyOpen = `${stack}:BB:BTN_open`;
      tableOpenCall = grid[keyOpen] || null;
    }

    matrixEl.querySelectorAll(".cell").forEach(c => {
      const h = c.dataset.hand;
      const row = tableVs[h];
      if (row) {
        if (row.vs3bet_jam)  { c.dataset.state = "vs3bet_jam";  return; }
        if (row.vs3bet_call) { c.dataset.state = "vs3bet_call"; return; }
        if (row.vs3bet_fold) { c.dataset.state = "vs3bet_fold"; return; }
      }
      // open-call 合成（jam/call/fold が未定義の手のみ）
      if (tableOpenCall && tableOpenCall[h] && tableOpenCall[h].call_open) {
        c.dataset.state = "vs3bet_call"; // 既存の「call」色を流用
      }
    });

    if (rangeList) {
      const jam = [], call = [], fold = [], ocall = [];
      for (const [h,a] of Object.entries(tableVs)) {
        if (a.vs3bet_jam) { jam.push(h); continue; }
        if (a.vs3bet_call){ call.push(h); continue; }
        if (a.vs3bet_fold){ fold.push(h); continue; }
      }
      if (pos === "BB" && opp === "BTN" && tableOpenCall) {
        for (const [h,a] of Object.entries(tableOpenCall)) {
          if (!a.call_open) continue;
          if (jam.includes(h) || call.includes(h) || fold.includes(h)) continue;
          ocall.push(h);
        }
      }
      rangeList.textContent = [
        jam.length  ? `jam:       ${jam.sort().join(" ")}`  : "",
        call.length ? `call:      ${call.sort().join(" ")}` : "",
        fold.length ? `fold:      ${fold.sort().join(" ")}` : "",
        ocall.length? `open-call: ${ocall.sort().join(" ")}`: ""
      ].filter(Boolean).join("\n");
    }
    if (memoEl) loadNoteIntoUI(currentNoteKey());
  }

  // ---- positions の順序（データ無ければ推定）
  function positionsOrder(){
    if (RANGES && Array.isArray(RANGES.positions) && RANGES.positions.length) return RANGES.positions;
    return inferPositions((RANGES && RANGES.grid) || {});
  }

  // ---- 編集：open トグル
  function toggleOpen(stack, pos, hand){
    if (!RANGES) RANGES = { grid: {} };
    if (!RANGES.grid) RANGES.grid = {};
    const key = `${stack}:${pos}`;
    const table = (RANGES.grid[key] || (RANGES.grid[key] = {}));
    const row = (table[hand] || (table[hand] = {}));
    row.open = row.open ? 0 : 1;
    // サイズを持たせたいなら: if (row.open) row.open_size = 2; else delete row.open_size;
    return { key, hand, value: row.open ? 1 : 0 };
  }

  // ---- メモ（notes）ユーティリティ
  function ensureNotes(){
    if (!RANGES) RANGES = {};
    // 互換：過去の memos を見かけたら notes に移行
    if (RANGES.memos && !RANGES.notes) RANGES.notes = RANGES.memos;
    if (!RANGES.notes) RANGES.notes = {};
    if (!RANGES.notes_meta) RANGES.notes_meta = {}; // 予備
    return RANGES.notes;
  }
  function currentNoteKey(){
    const stack = (stackSel && stackSel.value) || "20";
    const pos   = (posSel   && posSel.value)   || "UTG";
    const opp   = (oppSel   && oppSel.value)   || "BTN";
    if (MODE === "open") return `${stack}:${pos}`;
    if (MODE === "vs3")  return `${stack}:${pos}:${opp}`;
    return `${stack}:overview`;
  }
  function saveNote(key, text){
    const notes = ensureNotes();
    notes[key] = text || "";
  }
  function loadNoteIntoUI(key){
    if (!memoEl) return;
    const notes = ensureNotes();
    isSettingNote = true;
    memoEl.value = notes[key] || "";
    isSettingNote = false;
    lastNoteKey = key;
  }
  function flushPrevNoteIfNeeded(){
    if (!memoEl || lastNoteKey == null) return;
    saveNote(lastNoteKey, memoEl.value);
  }
  function showMsg(t){
    if (!msgEl) return;
    msgEl.textContent = t;
    setTimeout(()=>{ if (msgEl.textContent === t) msgEl.textContent = ""; }, 2000);
  }

  // ---- Export（ダウンロード） / Import（ファイル）
  function doExportDownload(){
    try {
      // RANGES を優先。fallbackで window.RANGES。最悪でも空ひな形で undefined を回避
      const data = RANGES ?? window.RANGES ?? { stacks:[], positions:[], grid:{}, notes:{} };
      const text = JSON.stringify(data, null, 2);
      const blob = new Blob([text], {type:"application/json"});
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "ranges.export.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(()=>URL.revokeObjectURL(a.href), 1500);
      showMsg("JSONを書き出しました");
    } catch (e) { console.error(e); showMsg("Exportに失敗しました"); }
  }
  async function handleImportFile(ev){
    const f = ev.target.files && ev.target.files[0];
    if (!f) return;
    try {
      const text = await f.text();
      const json = JSON.parse(text);
      window.RANGES = RANGES = json;
      ensureNotes(); // 互換吸収（memos→notes）
      initSelectorsIfEmpty(RANGES);
      render();
      if (memoEl) loadNoteIntoUI(currentNoteKey());
      showMsg("JSONを読み込みました");
    } catch (e) {
      console.error("インポート失敗:", e);
      showMsg("Importに失敗しました（JSONを確認）");
    } finally {
      ev.target.value = ""; // 同じファイルを再選択可に
    }
  }

  // ---- Console ユーティリティ公開
  function exposeDebugAndIO(){
    // デバッグ
    window.__rangeDebug = {
      count: () => matrixEl ? matrixEl.querySelectorAll(".cell").length : 0,
      cell: (hand) => document.querySelector(`.cell[data-hand="${hand}"]`),
      state: (hand) => document.querySelector(`.cell[data-hand="${hand}"]`)?.dataset.state ?? null,
      dumpNonFold: () => {
        const arr = [];
        document.querySelectorAll("#matrix .cell").forEach(c => {
          if (c.dataset.state && c.dataset.state !== "fold") arr.push([c.dataset.hand, c.dataset.state]);
        });
        return arr;
      }
    };
    // IO（DOMボタンが無い場合にどうぞ）
    window.RangeIO = {
      export: (pretty=true) => {
        const data = RANGES ?? window.RANGES ?? {};
        return JSON.stringify(data, null, pretty ? 2 : 0);
      },
      import: (jsonObj) => {
        window.RANGES = RANGES = jsonObj;
        ensureNotes();
        initSelectorsIfEmpty(RANGES);
        render();
        if (memoEl) loadNoteIntoUI(currentNoteKey());
      }
    };
  }
})();
