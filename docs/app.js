/* app.js — 8-max / BBアンティ向けレンジ可視化（安定版）
   ・ヘッダー行/列つき 14×14 を構築（うち 13×13=169 がセル）
   ・各セルに data-hand（AA, AKs, AKo ...）を必ず付与
   ・モードはタブ（#tabOpen / #tabVs3 / #tabOverview）で管理
   ・ranges.json の "20:UTG" / "20:UTG:BTN" 形式に合わせて着色
   ・未定義は fold（灰）
*/

(() => {
  const RANKS = ["A","K","Q","J","T","9","8","7","6","5","4","3","2"];

  // ---- 要素参照
  const $ = (s) => document.querySelector(s);
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

  // ---- 状態
  let MODE = "open"; // "open" | "vs3" | "overview"
  let RANGES = null; // ranges.json を読み込んで格納

  // ---- 起動
  document.addEventListener("DOMContentLoaded", init);

  async function init(){
    // グリッド構築（常に 169 セル＋ヘッダーを生成）
    buildMatrix();

    // データ読み込み
    RANGES = await loadRanges("./ranges.json");

    // セレクト初期化
    initSelectors(RANGES);

    // タブイベント
    [tabOpen, tabVs3, tabOverview].forEach(btn => {
      btn.addEventListener("click", () => {
        [tabOpen, tabVs3, tabOverview].forEach(b => b.setAttribute("aria-pressed","false"));
        btn.setAttribute("aria-pressed","true");
        MODE = (btn === tabOpen) ? "open" : (btn === tabVs3 ? "vs3" : "overview");
        oppWrap.style.display = MODE === "vs3" ? "" : "none";
        // 凡例の切替
        legendAction.style.display   = (MODE === "overview") ? "none" : "";
        legendOverview.style.display = (MODE === "overview") ? "" : "none";
        render();
      });
    });

    // セレクト変更
    [stackSel, posSel, oppSel].forEach(sel => sel.addEventListener("change", render));

    // 初期描画
    render();

    // フォーカス移動やポップアップ等は既存の実装があればそこへ接続してOK
  }

  // ---- ranges.json 読込
  async function loadRanges(path){
    const res = await fetch(path);
    if(!res.ok) throw new Error("ranges.json 読み込みに失敗");
    const data = await res.json();
    // そのまま返す。参照は data.grid[key] とする
    return data;
  }

  // ---- セレクト初期化
  function initSelectors(data){
    const stacks = data.stacks || ["20","30","40"];
    const positions = data.positions || ["UTG","UTG+1","MP","HJ","CO","BTN","SB","BB"];
    // スタック
    stackSel.innerHTML = stacks.map(v => `<option value="${v}">${v}BB</option>`).join("");
    // ポジション
    posSel.innerHTML = positions.map(v => `<option value="${v}">${v}</option>`).join("");
    // 3bet元
    oppSel.innerHTML = positions.map(v => `<option value="${v}">${v}</option>`).join("");

    // 既定値
    stackSel.value = stacks[0];
    posSel.value   = positions[0];
    oppSel.value   = positions[1] || positions[0]; // とりあえず前方の誰か
  }

  // ---- 14×14（角＋ヘッダー＋169セル）を構築
  function buildMatrix(){
    if(!matrixEl){ console.warn("[#matrix] が見つかりません"); return; }

    matrixEl.setAttribute("role","grid");
    matrixEl.setAttribute("aria-label","ハンドレンジ 13x13 グリッド");
    matrixEl.style.display = "grid";
    // 先頭列はヘッダー用に auto、残り13列がセル
    matrixEl.style.gridTemplateColumns = "auto repeat(13, var(--cell-size))";
    matrixEl.style.gridAutoRows = "var(--cell-size)";
    matrixEl.innerHTML = "";

    // 左上コーナー
    const corner = document.createElement("div");
    corner.className = "corner";
    matrixEl.appendChild(corner);

    // 上ヘッダー（列名）
    for(let j=0;j<13;j++){
      const hdr = document.createElement("div");
      hdr.className = "hdr";
      hdr.textContent = RANKS[j];
      hdr.setAttribute("aria-hidden","true");
      matrixEl.appendChild(hdr);
    }

    // 各行：行ヘッダー + 13セル
    for(let i=0;i<13;i++){
      // 行ヘッダー
      const h = document.createElement("div");
      h.className = "hdr";
      h.textContent = RANKS[i];
      h.setAttribute("aria-hidden","true");
      matrixEl.appendChild(h);

      // 13セル
      for(let j=0;j<13;j++){
        const cell = document.createElement("div");
        cell.className = "cell";
        const hand = handAt(i,j); // AA, AKs, AKo...
        cell.dataset.hand = hand;       // ★ 必ず付与
        cell.dataset.row  = String(i);
        cell.dataset.col  = String(j);
        cell.dataset.state = "fold";    // 既定 fold（灰）
        cell.setAttribute("role","gridcell");
        cell.setAttribute("tabindex","-1");
        cell.title = hand;              // ホバー確認

        // ラベルを中に見せたいなら↓（不要なら削ってOK）
        cell.textContent = hand;

        matrixEl.appendChild(cell);
      }
    }

    // 確認ログ（必要ならON）
    // console.debug("cells(含ヘッダー)=", matrixEl.children.length, "hands=", matrixEl.querySelectorAll('.cell').length);
  }

  // ---- i<j 側を suited とする慣習での表記
  function handAt(i,j){
    const r1 = RANKS[i];
    const r2 = RANKS[j];
    if(i === j) return r1 + r2;              // AA, KK...
    const hi = i < j ? r1 : r2;              // 行が上ほど強い
    const lo = i < j ? r2 : r1;
    const suited = i < j;                    // 対角線より上が suited
    return hi + lo + (suited ? "s" : "o");
  }

  // ---- 描画
  function render(){
    if(!matrixEl || !RANGES) return;
    const stack = stackSel.value;    // "20" | "30" | "40"
    const pos   = posSel.value;      // "UTG" など
    const opp   = oppSel.value;      // "MP" など
    const grid  = RANGES.grid || {};

    // まず全セルを fold/初期化
    matrixEl.querySelectorAll(".cell").forEach(c => {
      c.dataset.state = "fold";
      c.removeAttribute("data-overview");
    });

    if(MODE === "overview"){
      // 各ハンドについて「このスタックで最も前のポジから open できるポジ」を塗る
      const order = RANGES.positions || ["UTG","UTG+1","MP","HJ","CO","BTN","SB","BB"];
      matrixEl.querySelectorAll(".cell").forEach(c => {
        const h = c.dataset.hand;
        let earliest = null;
        for(const p of order){
          const key = `${stack}:${p}`;
          if(grid[key] && grid[key][h] && grid[key][h].open){
            earliest = p; break;
          }
        }
        c.dataset.overview = earliest || "empty";
      });
      // リスト更新
      updateRangeListOverview(stack);
      return;
    }

    if(MODE === "open"){
      const key = `${stack}:${pos}`;
      const table = grid[key] || {};
      matrixEl.querySelectorAll(".cell").forEach(c => {
        const h = c.dataset.hand;
        if(table[h] && table[h].open){
          c.dataset.state = "open";
        }
      });
      updateRangeListOpen(stack, pos);
      return;
    }

    // MODE === "vs3"（3bet対応）
    const keyVs = `${stack}:${pos}:${opp}`;
    const tableVs = grid[keyVs] || {};
    matrixEl.querySelectorAll(".cell").forEach(c => {
      const h = c.dataset.hand;
      const row = tableVs[h];
      if(!row) return; // 未定義は fold
      // 優先順位: jam > call > fold（どれか一個しか立ってない前提）
      if(row.vs3bet_jam)  c.dataset.state = "vs3bet_jam";
      else if(row.vs3bet_call) c.dataset.state = "vs3bet_call";
      else if(row.vs3bet_fold) c.dataset.state = "vs3bet_fold";
    });
    updateRangeListVs3(stack, pos, opp);
  }

  // ---- 右側のレンジ一覧（軽量版）
  function updateRangeListOpen(stack, pos){
    const key = `${stack}:${pos}`;
    const table = (RANGES.grid && RANGES.grid[key]) || {};
    const list = Object.keys(table).filter(h => table[h].open).sort();
    rangeList.textContent = list.join(" ");
  }
  function updateRangeListVs3(stack, pos, opp){
    const key = `${stack}:${pos}:${opp}`;
    const t = (RANGES.grid && RANGES.grid[key]) || {};
    const jam  = [], call = [], fold = [];
    for(const [h, act] of Object.entries(t)){
      if(act.vs3bet_jam)  jam.push(h);
      else if(act.vs3bet_call) call.push(h);
      else if(act.vs3bet_fold) fold.push(h);
    }
    rangeList.textContent = [
      jam.length ? `jam: ${jam.sort().join(" ")}` : "",
      call.length ? `call: ${call.sort().join(" ")}` : "",
      fold.length ? `fold: ${fold.sort().join(" ")}` : ""
    ].filter(Boolean).join("\n");
  }
  function updateRangeListOverview(stack){
    rangeList.textContent = `スタック ${stack}BB の「最前ポジからオープン可」を色分け表示中。`;
  }

})();
