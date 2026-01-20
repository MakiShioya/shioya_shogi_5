// main.js

// DOM要素の参照
const board = document.getElementById("board");
const blackHandDiv = document.getElementById("blackHand");
const whiteHandDiv = document.getElementById("whiteHand");
const statusDiv = document.getElementById("status");
const checkStatusDiv = document.getElementById("checkStatus");
const resignBtn = document.getElementById("resignBtn");

// 初期化処理（重複を排除して統合）
window.addEventListener("load", () => {
  // グローバル変数のオーディオ要素を取得
  bgm = document.getElementById("bgm");
  moveSound = document.getElementById("moveSound");
  promoteSound = document.getElementById("promoteSound");

  // イベントリスナー設定
  if (resignBtn) {
    resignBtn.addEventListener("click", resignGame);
  }

  // ゲーム開始処理
  playBGM();
  startTimer();
  
  // 初期盤面の描画と棋譜表示
  render();
  if (typeof showKifu === "function") {
    showKifu();
  }

  // 初期局面を千日手履歴に登録
  const key = getPositionKey();
  positionHistory[key] = 1;
});

// BGM再生
function playBGM() {
  if (!bgm) return;
  bgm.volume = 0.3;
  bgm.play().catch(() => {
    // 自動再生ブロック対策：一度クリックされたら再生
    document.addEventListener("click", () => {
      bgm.play().catch(e => console.log(e));
    }, { once: true });
  });
}

// BGM停止
function stopBGM() {
  if (!bgm) return;
  bgm.pause();
  bgm.currentTime = 0;
}

// 待った機能
function undoMove() {
  // 履歴が2手分（自分+相手）ないと戻れない、またはゲーム終了後は戻れない
  if (history.length < 2 || gameOver) return;
  
  // 2手前の状態を取得
  const prev = history[history.length - 2];
  history.length -= 2; // 履歴から削除

  // 状態を復元 (rules.jsの関数を使用)
  restoreState(prev);

  // ゲーム終了フラグ等をリセット
  gameOver = false;
  winner = null;
  statusDiv.textContent = "";
  checkStatusDiv.textContent = "";

  // 再描画
  render();
  if (typeof showKifu === "function") {
    showKifu();
  }
  startTimer();
}

// タイマー関連
let timerInterval = null;
let currentSeconds = 0;

function startTimer() {
  stopTimer();
  currentSeconds = 0;
  updateTimerDisplay();

  timerInterval = setInterval(() => {
    currentSeconds++;
    updateTimerDisplay();
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function updateTimerDisplay() {
  const timerBox = document.getElementById("timerBox");
  if (timerBox) {
    timerBox.textContent = "考慮時間: " + currentSeconds + "秒";
  }
}

// 描画関数
function render() {
  if (gameOver) {
    if (winner === "black") {
      statusDiv.textContent = "先手の勝ちです！";
    } else if (winner === "white") {
      statusDiv.textContent = "後手の勝ちです！";
    } else {
      statusDiv.textContent = "千日手です。引き分け。";
    }
    checkStatusDiv.textContent = "";
  } else {
    statusDiv.textContent =
      "現在の手番：" + (turn === "black" ? "先手" : "後手") +
      " / 手数：" + moveCount +
      (isKingInCheck(turn) ? "　王手！" : "");

    checkStatusDiv.textContent = "";
  }

  board.innerHTML = "";
  for (let y = 0; y < 9; y++) {
    const tr = document.createElement("tr");
    for (let x = 0; x < 9; x++) {
      const td = document.createElement("td");
      const piece = boardState[y][x];
      if (piece) {
        const isWhite = piece === piece.toLowerCase();
        const key = piece.startsWith("+") ? "+" + piece.replace("+","").toUpperCase() : piece.toUpperCase();
        td.textContent = pieceName[key];
        if (isWhite) td.style.transform = "rotate(180deg)";

        // 直前の指し手の強調
        if (lastMoveTo && lastMoveTo.x === x && lastMoveTo.y === y) {
          td.classList.add("moved");
        }
      }
      // 選択中のマス強調
      if (selected && !selected.fromHand && selected.x === x && selected.y === y) td.classList.add("selected");
      // 移動可能マスの強調
      if (legalMoves.some(m => m.x === x && m.y === y)) td.classList.add("move");
      
      td.onclick = () => onCellClick(x, y);
      tr.appendChild(td);
    }
    board.appendChild(tr);
  }
  renderHands();

  const blackBox = document.getElementById("blackHandBox");
  const whiteBox = document.getElementById("whiteHandBox");

  if (blackBox) blackBox.classList.remove("active");
  if (whiteBox) whiteBox.classList.remove("active");

  if (!gameOver) {
    if (turn === "black" && blackBox) {
      blackBox.classList.add("active");
    } else if (turn === "white" && whiteBox) {
      whiteBox.classList.add("active");
    }
  }
}

// 持ち駒の描画
function renderHands() {
  const order = ["P", "L", "N", "S", "G", "B", "R"];
  hands.black.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  hands.white.sort((a, b) => order.indexOf(a) - order.indexOf(b));

  blackHandDiv.innerHTML = "";
  whiteHandDiv.innerHTML = "";

  hands.black.forEach((p, i) => {
    const span = document.createElement("span");
    span.textContent = pieceName[p];
    if (selected && selected.fromHand && selected.player === "black" && selected.index === i) span.classList.add("selected");
    span.onclick = () => selectFromHand("black", i);
    blackHandDiv.appendChild(span);
  });

  hands.white.forEach((p, i) => {
    const span = document.createElement("span");
    span.textContent = pieceName[p];
    if (selected && selected.fromHand && selected.player === "white" && selected.index === i) span.classList.add("selected");
    span.onclick = () => selectFromHand("white", i);
    whiteHandDiv.appendChild(span);
  });
}

// 盤面クリック時の処理
function onCellClick(x, y) {
  if (gameOver) return;

  // CPU手番中は操作不可
  if (cpuEnabled && turn === cpuSide) {
    return;
  }

  // 駒未選択時：自分の駒を選択
  if (!selected) {
    const piece = boardState[y][x];
    if (!piece) return;

    const isWhite = piece === piece.toLowerCase();
    if ((turn === "black" && isWhite) || (turn === "white" && !isWhite)) return;

    selected = { x, y, fromHand: false };
    legalMoves = getLegalMoves(x, y);
    render();
    return;
  }

  // 駒選択時：移動可能なら移動、そうでなければ選択解除または再選択
  const sel = selected;

  if (legalMoves.some(m => m.x === x && m.y === y)) {
    movePieceWithSelected(sel, x, y);
  }

  // いずれにせよ選択状態はリセット
  selected = null;
  legalMoves = [];
  render();
}

// 持ち駒クリック時の処理
function selectFromHand(player, index) {
  if (gameOver) return;
  if (turn !== player) return;
  selected = { fromHand: true, player, index };
  legalMoves = getLegalDrops(player, hands[player][index]);
  render();
}

// 駒を動かす（着手実行）
function movePieceWithSelected(sel, x, y) {
  // 現在の状態を履歴に保存
  history.push(deepCopyState());

  const pieceBefore = sel.fromHand
    ? hands[sel.player][sel.index]
    : boardState[sel.y][sel.x];

  const boardBefore = boardState.map(r => r.slice());
  const moveNumber = kifu.length + 1;
  kifu.push("");  

  // 着手音
  if (moveSound) {
    moveSound.currentTime = 0;
    moveSound.volume = 0.3;
    moveSound.play().catch(() => {});
  }

  if (sel.fromHand) {
    // 持ち駒を打つ
    const piece = hands[sel.player][sel.index];
    boardState[y][x] = sel.player === "black" ? piece : piece.toLowerCase();
    hands[sel.player].splice(sel.index, 1);
  } else {
    // 盤上の駒を動かす
    let piece = boardState[sel.y][sel.x];
    const target = boardState[y][x];

    // 駒取り
    if (target) {
      hands[turn].push(target.replace("+","").toUpperCase());
    }

    const isWhite = piece === piece.toLowerCase();
    const player = isWhite ? "white" : "black";
    const isPromoted = piece.includes("+");
    const base = piece.replace("+","").toUpperCase();

    // 成り判定
    if (!isPromoted && canPromote(base) &&
       (isInPromotionZone(sel.y, player) || isInPromotionZone(y, player))) {

      if (cpuEnabled && turn === cpuSide) {
        // CPUは条件を満たせば必ず成る（AIロジックによる）
        piece = promote(piece.toUpperCase());
        if (player === "white") piece = piece.toLowerCase();
        sel.promoted = true;
      } else {
        // 人間の場合はダイアログ確認
        const mustPromote =
          (base === "P" || base === "L") && (y === (player === "black" ? 0 : 8)) ||
          (base === "N") && (y === (player === "black" ? 0 : 8) || y === (player === "black" ? 1 : 7));
        
        if (mustPromote || confirm("成りますか？")) {
          piece = promote(piece.toUpperCase());
          if (player === "white") piece = piece.toLowerCase();
          sel.promoted = true;
          
          if (promoteSound) {
            promoteSound.currentTime = 0;
            promoteSound.volume = 0.8;
            promoteSound.play().catch(() => {});
          }
        } else {
          sel.unpromoted = true;
        }
      }
    }

    boardState[sel.y][sel.x] = "";
    boardState[y][x] = piece;
  }

  // 棋譜記録
  kifu[kifu.length - 1] = formatMove(sel, x, y, pieceBefore, boardBefore, moveNumber);
  lastMoveTo = { x, y };

  // 人間の指し手を記録（AIの特定の定跡外し判定用）
  if (!isSimulating && turn !== cpuSide) {
    lastPlayerMove = {
      piece: pieceBefore.replace("+","").toUpperCase(),
      toX: x,
      toY: y
    };
  }

  // 手番交代
  turn = turn === "black" ? "white" : "black";
  if (typeof showKifu === "function") showKifu();

  // タイマー管理
  if (!gameOver) {
    startTimer();
  } else {
    stopTimer();
  }

  // CPU思考開始（遅延実行）
  if (!isSimulating && cpuEnabled && turn === cpuSide && !gameOver) {
    setTimeout(() => cpuMove(), 1000);
  }

  moveCount++;

  // 1. 500手ルール
  if (moveCount >= 500) {
    gameOver = true;
    winner = null;
    statusDiv.textContent = "500手に達したため、引き分けです。";
    if (typeof showKifu === "function") showKifu();
    return;
  }

  // 2. 詰み判定
  if (isKingInCheck(turn) && !hasAnyLegalMove(turn)) {
    gameOver = true;
    winner = turn === "black" ? "white" : "black";
    if (typeof showKifu === "function") showKifu();
    // ここでreturnしないのは千日手判定も一応通すためだが、詰みが確定すれば終了
    return;
  }

  // 3. 千日手判定
  const key = getPositionKey();
  positionHistory[key] = (positionHistory[key] || 0) + 1;
  recordRepetition();

  if (positionHistory[key] >= 4) {
    const records = repetitionHistory[key].slice(-4);
    const allCheck = records.every(r => r.isCheck);
    const sameSide = records.every(r => r.checkingSide === records[0].checkingSide);

    gameOver = true;
    if (allCheck && sameSide && records[0].checkingSide !== null) {
      // 連続王手の千日手は、王手をかけている側の負け
      winner = records[0].checkingSide === "black" ? "white" : "black";
      statusDiv.textContent = "連続王手の千日手です。王手をかけ続けた側の負けです。";
    } else {
      winner = null;
      statusDiv.textContent = "千日手です。引き分け。";
      if (typeof showKifu === "function") showKifu();
    }
  }
}

// 投了処理
function resignGame() {
  if (gameOver) return;
  if (!confirm("投了しますか？")) return;

  gameOver = true;
  stopTimer();
  winner = turn === "black" ? "white" : "black";
  statusDiv.textContent = "投了により、" + (winner === "black" ? "先手" : "後手") + "の勝ちです。";
  checkStatusDiv.textContent = "";
  if (typeof showKifu === "function") showKifu();
}