/* app.js — レンジ可視化（いまのUIを崩さない安定版）
   - 13×13=169セル＋ヘッダーを安定描画（data-hand を必ず付与）
   - open / vs3（fold/call/jam）に対応
   - 総覧（ポジ別）: 最前ポジで open 可の色を付与（data-overview / --ov-color）
   - フルスクリーン関係のコードは一切ナシ
*/

(() => {
  const RANKS = ["A","K","Q","J","T","9","8","7","6","5","4","3","2"];

  // ---- 要素参照（存在しない場合は null で耐える）
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
  let MODE = "open";   // "open" | "vs3" | "overview"
  let RANGES = null;   // ranges.json の中身（{ stacks?, positions?, grid: {...} }）

  // ---- 起動
  document.addEventListener("DOMContentLoaded", init);

  async function init(){
    buildMatrix();               // 先に盤面を確実に作る
    RANGES = await loadRanges(); // ranges.json → window.RANGES の順で拾う

    // 既存UIに合わせて、タブのクリックで MODE をセット
    if (tabOpen) tabOpen.addEventListener("click", () => setMode("open"));
    if (tabVs3)  tabVs3 .addEventListener("click", () => setMode("vs3"));
    if (tabOverview) tabOverview.addEventListener("click", () => setMode("overview"));

    // セレクタ変更で再描画
    [stackSel, posSel, oppSel].forEach(el => el && el.addEventListener("change", render));

    // 初回描画
    render();

    // デバッグユーティリティを公開（任意）
    window.__rangeDebug = {
      count: () => matrixEl ? matrixEl.querySelectorAll(".cell").length : 0,
      cell: (hand) => document.querySelector(`.cell[data-hand="${hand}"]`),
      state: (hand) => {
        const c = document.querySelector(`.cell[data-hand="${hand}"]`);
        return c ? c.dataset.state : null;
      },
      dumpNonFold: () => {
        const arr = [];
        document.querySelectorAll("#matrix .cell").forEach(c => {
          if (c.dataset.state !== "fold") arr.push([c.dataset.hand, c.dataset.state]);
        });
        return arr;
      }
    };
  }

  function setMode(next){
    MODE = next;
    // 既存の aria-pressed を使っているUIでも崩れないよう、あれば同期
    [tabOpen, tabVs3, tabOverview].forEach(b => b && b.setAttribute("aria-pressed", "false"));
    if (next === "open" && tabOpen) tabOpen.setAttribute("aria-pressed", "true");
    if (next === "vs3"  && tabVs3)  tabVs3 .setAttribute("aria-pressed", "true");
    if (next === "overview" && tabOverview) tabOverview.setAttribute("aria-pressed", "true");

    if (oppWrap)        oppWrap.style.display        = (next === "vs3") ? "" : "none";
    if (legendAction)   legendAction.style.display   = (next === "overview") ? "none" : "";
    if (legendOverview) legendOverview.style.display = (next === "overview") ? "" : "none";

    render();
  }

  // ---- ranges 読み込み（fetch → window.RANGES フォールバック）
  async function loadRanges(){
    // fetch優先（GitHub Pages/ローカルでキャッシュを避ける）
    try {
      const res = await fetch("./ranges.json", { cache: "no-store" });
      if (res.ok) return await res.json();
    } catch (_e) { /* noop */ }
    // window.RANGES があればそれを使う
    if (window.RANGES) return window.RANGES;
    // 最低限の空データ
    return { stacks: [], positions: [], grid: {} };
  }

  // ---- 14×14（角＋列ヘッダー＋行ヘッダー＋169セル）を構築
  function buildMatrix(){
    if (!matrixEl) { console.warn("[#matrix] が見つかりません"); return; }
    matrixEl.innerHTML = "";
    matrixEl.setAttribute("role", "grid");
    matrixEl.setAttribute("aria-label", "ハンドレンジ 13x13 グリッド");

    // 左上コーナー
    const corner = document.createElement("div");
    corner.className = "corner";
    matrixEl.appendChild(corner);

    // 上ヘッダー（列名）
    for (let j=0; j<13; j++){
      const hdr = document.createElement("div");
      hdr.className = "hdr";
      hdr.textContent = RANKS[j];
      hdr.setAttribute("aria-hidden", "true");
      matrixEl.appendChild(hdr);
    }

    // 各行：行ヘッダー＋13セル
    for (let i=0; i<13; i++){
      const lh = document.createElement("div");
      lh.className = "hdr";
      lh.textContent = RANKS[i];
      lh.setAttribute("aria-hidden", "true");
      matrixEl.appendChild(lh);

      for (let j=0; j<13; j++){
        const cell = document.createElement("div");
        cell.className = "cell";
        const hand = handAt(i, j);      // AA / AKs / AKo
        cell.dataset.hand = hand;       // ★ 必ず付与（レンジ参照のキー）
        cell.dataset.row  = String(i);
        cell.dataset.col  = String(j);
        cell.dataset.state = "fold";    // 既定: 未定義は fold
        cell.setAttribute("role", "gridcell");
        cell.setAttribute("tabindex", "-1");
        cell.title = hand;
        // ラベルを表示したいなら以下を残す（不要なら消してOK）
        cell.textContent = hand;

        matrixEl.appendChild(cell);
      }
    }
  }

  // ---- hand 正規表記（上三角=suited）
  function handAt(i, j){
    const r1 = RANKS[i], r2 = RANKS[j];
    if (i === j) return r1 + r2;         // AA, KK, ...
    const hi = i < j ? r1 : r2;
    const lo = i < j ? r2 : r1;
    const suited = i < j;                // 対角線より上を suited とする慣習
    return hi + lo + (suited ? "s" : "o");
  }

  // ---- 位置配列（データに無ければ grid のキーから推定）
  function positionsOrder(){
    if (RANGES && Array.isArray(RANGES.positions) && RANGES.positions.length) return RANGES.positions;
    const set = new Set();
    const g = (RANGES && RANGES.grid) || {};
    Object.keys(g).forEach(k => {
      const parts = k.split(":"); // "20:UTG" / "20:UTG:BTN"
      if (parts[1]) set.add(parts[1]);
      if (parts[2]) set.add(parts[2]);
    });
    const std = ["UTG","UTG+1","MP","HJ","CO","BTN","SB","BB"];
    return [...set].sort((a,b) => std.indexOf(a) - std.indexOf(b));
  }

  // ---- 描画
  function render(){
    if (!matrixEl) return;

    // 既存UIの「ラジオ/セレクト」モードにも一応対応（互換）
    const radioMode = document.querySelector('input[name="mode"]:checked')?.value;
    if (radioMode) {
      MODE = (radioMode === "open" ? "open" :
             (radioMode.startsWith("vs3") ? "vs3" :
              (radioMode === "overview" ? "overview" : MODE)));
    }
    // タブの aria-pressed が使われている場合も拾っておく
    if (tabOpen?.getAttribute("aria-pressed") === "true") MODE = "open";
    if (tabVs3 ?.getAttribute("aria-pressed") === "true") MODE = "vs3";
    if (tabOverview?.getAttribute("aria-pressed") === "true") MODE = "overview";

    const stack = (stackSel && stackSel.value) || "20";
    const pos   = (posSel   && posSel.value)   || "UTG";
    const opp   = (oppSel   && oppSel.value)   || "BTN";
    const grid  = (RANGES && RANGES.grid) || {};

    // リセット
    matrixEl.querySelectorAll(".cell").forEach(c => {
    if (MODE === "overview") {
        // 総覧では fold を付けない（!important の衝突回避）
        c.removeAttribute("data-state");
    } else {
        c.dataset.state = "fold";
    }
    c.removeAttribute("data-overview");
    c.style.removeProperty("--ov-color");
    });
    matrixEl.classList.toggle("is-overview", MODE === "overview");

    // ---- 総覧（ポジ別）
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
      return;
    }

    // ---- vs3（対3bet：fold/call/jam）
    const keyVs = `${stack}:${pos}:${opp}`;
    const tableVs = grid[keyVs] || {};
    matrixEl.querySelectorAll(".cell").forEach(c => {
      const h = c.dataset.hand;
      const row = tableVs[h];
      if (!row) return;            // 未定義は fold のまま
      if (row.vs3bet_jam)  c.dataset.state = "vs3bet_jam";
      else if (row.vs3bet_call) c.dataset.state = "vs3bet_call";
      else if (row.vs3bet_fold) c.dataset.state = "vs3bet_fold";
    });
    if (rangeList) {
      const jam = [], call = [], fold = [];
      for (const [h, a] of Object.entries(tableVs)) {
        if (a.vs3bet_jam)  jam.push(h);
        else if (a.vs3bet_call) call.push(h);
        else if (a.vs3bet_fold) fold.push(h);
      }
      rangeList.textContent = [
        jam.length  ? `jam:  ${jam.sort().join(" ")}`  : "",
        call.length ? `call: ${call.sort().join(" ")}` : "",
        fold.length ? `fold: ${fold.sort().join(" ")}` : ""
      ].filter(Boolean).join("\n");
    }
  }
})();
