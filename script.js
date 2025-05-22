// テキサスホールデムに基づいた13x13ハンドレンジマトリクス表示（完成形）

const positionData = {
    UTG: {
      open: ["AA", "KK", "QQ", "AKs", "AKo"],
      call: ["AQs"],
      raise: ["JJ"],
      allin: ["AA"],
      fold: []
    },
    CO: {
      open: ["AA", "KK", "QQ", "AKs", "AQs", "KQs"],
      call: ["AJ"],
      raise: ["JJ", "TT"],
      allin: ["AA"],
      fold: []
    },
    BTN: {
      open: ["AA", "KK", "QQ", "JJ", "TT", "99", "AKs", "AQs", "KQs", "QJs"],
      call: ["A9s", "KTs", "JTs"],
      raise: ["88", "77"],
      allin: ["AA"],
      fold: []
    },
    SB: {
      open: ["AA", "KK", "QQ", "JJ", "TT", "99"],
      call: ["AKs", "AQs"],
      raise: ["JJ"],
      allin: ["AA"],
      fold: []
    },
    BB: {
      open: ["AA", "KK", "QQ"],
      call: ["AKo", "AQo", "KQo"],
      raise: ["JJ"],
      allin: ["AA"],
      fold: []
    }
  };
  
  const handDetails = {
    AA: { winrate: "85%", ev: "+2.4BB" },
    KK: { winrate: "82%", ev: "+2.0BB" },
    QQ: { winrate: "80%", ev: "+1.8BB" },
    JJ: { winrate: "78%", ev: "+1.5BB" },
    TT: { winrate: "75%", ev: "+1.2BB" },
    "AKs": { winrate: "70%", ev: "+1.1BB" },
    "AKo": { winrate: "68%", ev: "+1.0BB" },
    "AQs": { winrate: "66%", ev: "+0.9BB" },
    "KQs": { winrate: "63%", ev: "+0.7BB" },
    "QJs": { winrate: "60%", ev: "+0.6BB" }
  };
  
  const currentPosition = { index: 0 };
  const positions = ["UTG", "CO", "BTN", "SB", "BB"];
  
  function updateMatrix() {
    const matrix = document.getElementById("hand-matrix");
    matrix.innerHTML = "";
    const pos = positions[currentPosition.index];
    const range = positionData[pos];
  
    const ranks = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];
    for (let i = 0; i < 13; i++) {
      for (let j = 0; j < 13; j++) {
        let hand = "";
        if (i === j) hand = ranks[i] + ranks[j];
        else if (i < j) hand = ranks[i] + ranks[j] + "s";
        else hand = ranks[j] + ranks[i] + "o";
  
        let action = "";
        if (range.open.includes(hand)) action = "open";
        else if (range.call.includes(hand)) action = "call";
        else if (range.raise.includes(hand)) action = "raise";
        else if (range.allin.includes(hand)) action = "allin";
        else action = "fold";
  
        const cell = document.createElement("div");
        cell.className = `range-cell ${action}`;
        cell.textContent = hand;
        cell.onclick = () => showHandDetail(hand);
        matrix.appendChild(cell);
      }
    }
  
    document.getElementById("position-name").textContent = `${pos} のレンジ`;
  }
  
  function showHandDetail(hand) {
    const detail = handDetails[hand];
    const win = document.getElementById("hand-winrate");
    const ev = document.getElementById("hand-ev");
    if (detail) {
      win.textContent = `勝率: ${detail.winrate}`;
      ev.textContent = `EV: ${detail.ev}`;
    } else {
      win.textContent = "データなし";
      ev.textContent = "";
    }
    document.getElementById("hand-details").style.display = "block";
  }
  
  document.getElementById("prev-btn").onclick = () => {
    currentPosition.index = (currentPosition.index + positions.length - 1) % positions.length;
    updateMatrix();
  };
  document.getElementById("next-btn").onclick = () => {
    currentPosition.index = (currentPosition.index + 1) % positions.length;
    updateMatrix();
  };
  
  updateMatrix();