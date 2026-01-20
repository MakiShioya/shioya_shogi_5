// ex_ai_komiya.js
// Hybrid AI: "komiya" (Early Game) + "Strong" (Late Game)
// Features: LMR (Late Move Reduction) + Snapshot/Restore Fix

// ==========================================
// 1. 評価関数データの定義
// ==========================================

// --- [A] こみや流（序盤: 1〜20手目用） ---
const pieceValues_Shioya = {
  "P": 50, "L": 200, "N": 250, "S": 300,
  "G": 350, "B": 600, "R": 650, "K": 99999,
  "+P": 350, "+L": 300, "+N": 300, "+S": 350,
  "+B": 650, "+R": 750
};
const handValues_Shioya = {
  "P": 55, "L": 210, "N": 260, "S": 310,
  "G": 360, "B": 620, "R": 670
};
const positionBonus_Shioya = {
  // 玉：端（特に下段）にいるほど安全（囲いボーナス）
  "K": [
    [-50, -50, -50, -50, -50, -50, -50, -50, -50], // 敵陣深くは危険
    [-50, -50, -50, -50, -50, -50, -50, -50, -50],
    [-50, -50, -50, -50, -50, -50, -50, -50, -50],
    [-20, -20, -20, -20, -20, -20, -20, -20, -20],
    [-10, -10, -10, -10, -10, -10, -10, -10, -10],
    [  0,   0,   0,   0,   0,   0,   0,   0,   0],
    [ 10,  10,  10,  10,  10,  10,  10,  10,  10],
    [ 20,  70,  40,  10,  10,  10,  10,  10,  10],
    [ 50,  50,  50,  40,   0,  10,  10,  10,  10]  // 自陣奥底が良い
  ],
  // 金・銀：王を守るため下段中央付近が良い
  "G": [
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0, 10,  0,  0,  0,  0,  0],
    [ 0,  0, 20,  0,  5,  0,  0,  0,  0],
    [ 0,  0,  0, -5,  0, -5,  0,  0,  0]
  ],
  "S": [
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,500,  0,  0, 20,  0,  0,  0],
    [ 0, 25, 20, 25,  5, 10,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0]
  ],
  "L": [
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [10,  0,  0,  0,  0,  0,  0,  0, 10]
  ],
  "P": [
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0, 40,  0],
    [ 1,  0,  1,  1,  0,  1,  5, 30,  1],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0]
  ],
  "B": [
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,-50,  0,  0,  0,  0],
    [ 0,  0,  0,-50,  0, 50,  0,  0,  0],
    [ 0,  0,  0,  0, 50,  0,  0,  0,  0],
    [ 0,  0,  0, 70,  0,  0,  0,  0,  0],
    [ 0,  0, 30,  0,  0,  0,  0,  0,  0]
  ]
  // ※他の駒も好みで定義可能ですが、まずは玉と金だけで十分効果があります
};

// --- [B] 強AI流（中盤以降: 21手目〜用） ---
const pieceValues_Strong = {
  "P": 100, "L": 230, "N": 260, "S": 380,
  "G": 430, "B": 650, "R": 750, "K": 15000,
  "+P": 420, "+L": 400, "+N": 400, "+S": 420,
  "+B": 850, "+R": 950
};
const handValues_Strong = {
  "P": 110, "L": 240, "N": 270, "S": 400,
  "G": 450, "B": 680, "R": 780
};
const positionBonus_Strong = {
  "K": [
    [-50,-50,-50,-50,-50,-50,-50,-50,-50],
    [-50,-50,-50,-50,-50,-50,-50,-50,-50],
    [-50,-50,-50,-50,-50,-50,-50,-50,-50],
    [-30,-30,-30,-30,-30,-30,-30,-30,-30],
    [-20,-20,-20,-20,-20,-20,-20,-20,-20],
    [-10,-10,-10,-10,-10,-10,-10,-10,-10],
    [  0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 10,100, 20, 10, 10, 10, 20, 50, 10],
    [ 30, 60, 70, 20, 10, 20, 40, 30, 30]
  ],
  "R": [
    [ 10, 10, 10, 10, 10, 10, 10, 10, 10],
    [ 20, 20, 20, 20, 20, 20, 20, 20, 20],
    [  0, 10, 10, 10, 10, 10, 10, 10,  0],
    [  0,  0,  0, 10, 10, 10,  0,  0,  0],
    [  0,  0,  0, 10, 20, 10,  0,  0,  0],
    [  0,  0,  0, 10, 10, 10,  0,  0,  0],
    [  0,  0,  0,  0,  0,  0,  0,  0,  0],
    [  0,  5,  0, 20,  0, 20,  0,  5,  0],
    [  0,  5,  0, 10,  0, 10,  0,  5,  0]
  ],
  "L": [
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [-5,  0,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0,  0, -5],
    [10,  0,  0,  0,  0,  0,  0,  0, 10]
  ],
  "B": [
    [ 10,  0,  0,  0,  0,  0,  0,  0, 10],
    [  0, 10,  0,  0,  0,  0,  0, 10,  0],
    [  0,  0, 10,  0, 10,  0, 10,  0,  0],
    [  0,  0,  0, 10, 10, 10,  0,  0,  0],
    [  0,  0,  5, 10, 10, 10,  5,  0,  0],
    [  0,  0,  0,  0,  0,  0,  0,  0,  0],
    [  0,  0,  0,  0,  0,  0,  0,  0,  0],
    [  0,  0,  0,  0,  0,  0,  0,  0,  0],
    [  0,  0,  0,  0,  0,  0,  0,  0,  0]
  ],
  "S": [
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0, 30,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0]
  ],
  "G": [
    [  0,  0,  0,  0,  0,  0,  0,  0,  0],
    [  0,  0,  0,  0,  0,  0,  0,  0,  0],
    [  0,  0,  0,  0,  0,  0,  0,  0,  0],
    [  0,  0,  0,  0,  0,  0,  0,  0,  0],
    [  0,  0,  0, 10, 10, 10,  0,  0,  0],
    [  0, 10, 10, 15, 15, 15, 10, 10,  0],
    [ 10, 15, 20, 30, 20, 20, 20, 15, 10],
    [ 10, 15, 30, 20, 30, 20, 20, 15, 10],
    [ 10, 15, 15, 15, 15, 30, 15, 15, 10]
  ]
};

// ==========================================
// 2. 探索用グローバル変数
// ==========================================

let searchStartTime = 0;
let timeLimit = 0;
let stopSearch = false;
let nodesCount = 0;
let isThinking = false; // ★追加：思考中フラグ

// ==========================================
// 3. メインAI関数
// ==========================================

function cpuMove() {
  if (gameOver) return;
  // ★追加：思考中または手番違いなら即リターン（多重実行防止）
  if (isThinking || turn !== cpuSide) return;

  isThinking = true;

  // 描画更新の待機時間を持たせる（UIブロック回避のためsetTimeout使用）
  setTimeout(() => {
    executeCpuMove();
  }, 100);
}

function executeCpuMove() {
  // ★重要：思考開始時の盤面状態を完全にバックアップ（Snapshot）
  // JSON.stringify/parseでディープコピーすることで、参照関係を切って値を保存
  const backupBoard = JSON.stringify(boardState);
  const backupHands = JSON.stringify(hands);
  const backupTurn = turn;

  let bestMove = null;

  try {
    // ---------------- 定跡チェック ----------------
    // 定跡判定を関数化して呼び出す
    let bookMove = getOpeningBookMove();
    
    if (bookMove) {
      bestMove = bookMove;
    } else {
      // ---------------- 思考探索 ----------------
      let thinkingTime = 3000; // 基本3秒
      if (moveCount > 20) thinkingTime = 5000;
      if (moveCount > 30) thinkingTime = 6000;
      if (moveCount > 40) thinkingTime = 7000;
      if (moveCount > 50) thinkingTime = 8000;
      
      bestMove = iterativeDeepening(thinkingTime);
      
      if (!bestMove) {
        // 万策尽きたらランダム
        const moves = getAllLegalMoves(cpuSide);
        if (moves.length > 0) {
          bestMove = moves[Math.floor(Math.random() * moves.length)];
        }
      }
    }
  } catch (error) {
    console.error("CPU Error:", error);
  } finally {
    // ★重要：思考終了後、強制的に盤面を思考開始前の状態に戻す (Restore)
    // これにより、AIの思考中に盤面が書き換えられてしまってもリセットされる
    const restoredBoard = JSON.parse(backupBoard);
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        boardState[y][x] = restoredBoard[y][x];
      }
    }
    const restoredHands = JSON.parse(backupHands);
    hands.black = restoredHands.black;
    hands.white = restoredHands.white;
    turn = backupTurn;
    
    // 思考フラグ解除
    isThinking = false;
    
    // 決定した指し手を実行（本番の盤面に適用）
    if (bestMove) {
      applyMove(bestMove);
    } else {
      // 手がない場合（投了相当だが、UIリセット）
      render();
    }
  }
}

// 定跡手を取得する関数（盤面操作は行わず、指し手オブジェクトを返す）
function getOpeningBookMove() {
// ★ ③ 20手目以内 & 直前が「２五歩」なら ３二金 or ３三角
  if (
    moveCount < 20 &&
    lastPlayerMove &&
    lastPlayerMove.piece === "P" &&
    lastPlayerMove.toX === 7 && // ２筋
    lastPlayerMove.toY === 4    // ５段目
  ) {
    // ① まず３二金(6,1)を探す
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        const p = boardState[y][x];
        // 後手番(white)の金(g)を探す
        if (cpuSide === "white" && p === "g") {
          const moves = getLegalMoves(x, y);
          // ３二(x=6, y=1)に行けるかチェック
          if (moves.some(m => m.x === 6 && m.y === 1)) {
            // ★修正：動かさずに、データを返す
            return { fromHand: false, x0: x, y0: y, x1: 6, y1: 1 };
          }
        }
      }
    }

    // ② ３二金が無理なら３三角(6,2)
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        const p = boardState[y][x];
        // 後手番(white)の角(b)を探す
        if (cpuSide === "white" && p === "b") {
          const moves = getLegalMoves(x, y);
          // ３三(x=6, y=2)に行けるかチェック
          if (moves.some(m => m.x === 6 && m.y === 2)) {
            // ★修正：動かさずに、データを返す
            return { fromHand: false, x0: x, y0: y, x1: 6, y1: 2 };
          }
        }
      }
    }
  }


  // 5手目
  if (moveCount === 5 && cpuSide === "white") {
    if (lastPlayerMove && lastPlayerMove.piece === "P" && 
        lastPlayerMove.toX === 7 && lastPlayerMove.toY === 3) {
      const fromX = 7; const fromY = 2; // 23
      const toX = 7; const toY = 3;     // 24
      if (boardState[fromY][fromX] === "p") {
        return { fromHand: false, x0: fromX, y0: fromY, x1: toX, y1: toY };
      }
    }
  }

  // 1手目
  if (moveCount === 1 && cpuSide === "white") {
    return { fromHand: false, x0: 6, y0: 2, x1: 6, y1: 3 };
  }

  // 3手目
  if (moveCount === 3 && cpuSide === "white") {
    if (lastPlayerMove && lastPlayerMove.piece === "B" && 
        lastPlayerMove.toX === 7 && lastPlayerMove.toY === 1) {
      const fromX = 6; const fromY = 0;
      const toX = 7; const toY = 1;
      if (boardState[fromY][fromX] === "s") {
        return { fromHand: false, x0: fromX, y0: fromY, x1: toX, y1: toY };
      }
    }
  }

  // 3-4手目
  if (moveCount >= 3 && moveCount <= 4 && cpuSide === "white") {
    const fromX = 5; const fromY = 2;
    const toX = 5; const toY = 3;
    if (boardState[fromY][fromX] === "p" && boardState[toY][toX] === "") {
      return { fromHand: false, x0: fromX, y0: fromY, x1: toX, y1: toY };
    }
  }
  
  return null;
}

function applyMove(move) {
  if (move.fromHand) {
    selected = { fromHand: true, player: cpuSide, index: move.index };
    movePieceWithSelected(selected, move.x1, move.y1);
  } else {
    selected = { x: move.x0, y: move.y0, fromHand: false };
    movePieceWithSelected(selected, move.x1, move.y1);
  }
  selected = null;
  legalMoves = [];
  render();
}

// ==========================================
// 4. 指し手生成
// ==========================================

function getAllLegalMoves(player) {
  const allMoves = [];
  
  for (let y = 0; y < 9; y++) {
    for (let x = 0; x < 9; x++) {
      const p = boardState[y][x];
      if (!p) continue;
      
      const isWhite = p === p.toLowerCase();
      if ((player === "black" && !isWhite) || (player === "white" && isWhite)) {
        const moves = getLegalMoves(x, y);
        moves.forEach(m => {
          allMoves.push({ fromHand: false, x0: x, y0: y, x1: m.x, y1: m.y });
        });
      }
    }
  }

  const hand = hands[player];
  for (let i = 0; i < hand.length; i++) {
    const piece = hand[i];
    const drops = getLegalDrops(player, piece);
    drops.forEach(m => {
      allMoves.push({ fromHand: true, player, index: i, x1: m.x, y1: m.y });
    });
  }
  
  return allMoves;
}

// ==========================================
// 5. 反復深化探索
// ==========================================

function iterativeDeepening(allocatedTime) {
  searchStartTime = Date.now();
  timeLimit = allocatedTime;
  stopSearch = false;
  nodesCount = 0;

  const player = cpuSide;
  let bestMove = null;
  const maxDepth = 20;

  let rootMoves = getAllLegalMoves(player);
  if (rootMoves.length === 0) return null;
  if (rootMoves.length === 1) return rootMoves[0];

  sortMoves(rootMoves);

  try {
    for (let currentDepth = 1; currentDepth <= maxDepth; currentDepth++) {
      let alpha = -Infinity;
      let beta = Infinity;
      let bestMoveInThisDepth = null;
      let bestScoreInThisDepth = -Infinity;

      for (const move of rootMoves) {
        const record = makeSilentMove(move);
        let score;
        
        try {
          score = -alphaBeta(currentDepth - 1, -beta, -alpha, player === "black" ? "white" : "black");
        } finally {
          unmakeSilentMove(record);
        }

        if ((Date.now() - searchStartTime) > timeLimit) {
          stopSearch = true;
          throw "TIMEOUT";
        }

        if (score > bestScoreInThisDepth) {
          bestScoreInThisDepth = score;
          bestMoveInThisDepth = move;
          if (score > alpha) alpha = score;
        }
      }

      if (!stopSearch) {
        bestMove = bestMoveInThisDepth;
        if (bestScoreInThisDepth > 10000) break;
        
        const idx = rootMoves.indexOf(bestMove);
        if (idx > -1) {
          rootMoves.splice(idx, 1);
          rootMoves.unshift(bestMove);
        }
      } else {
        break; 
      }
    }
  } catch (e) {
    if (e !== "TIMEOUT") console.error(e);
  }

  return bestMove || rootMoves[0];
}

// ==========================================
// 6. Alpha-Beta & 静止探索 (LMR導入)
// ==========================================

function alphaBeta(depth, alpha, beta, turnPlayer) {
  nodesCount++;

  if (nodesCount % 2000 === 0) {
    if ((Date.now() - searchStartTime) > timeLimit) {
      stopSearch = true;
      throw "TIMEOUT";
    }
  }

  if (depth <= 0) {
    return quiescenceSearch(alpha, beta, turnPlayer);
  }

  let moves = getAllLegalMoves(turnPlayer);
  
  if (moves.length === 0) {
    return isKingInCheck(turnPlayer) ? -20000 : 0;
  }

  sortMoves(moves);

  // ループをインデックス付きに変更してLMRを実装
  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    const record = makeSilentMove(move);
    let score;
    const nextPlayer = turnPlayer === "black" ? "white" : "black";
    
    // --- LMR (Late Move Reduction) ---
    // 条件: 深さが3以上、候補手が4番目以降、駒を取らない、成らない
    let doFullSearch = true;

    if (depth >= 3 && i >= 3 && !record.capturedPiece && !record.wasPromoted) {
       try {
         // 深さを減らして探索 (depth - 2)
         score = -alphaBeta(depth - 2, -beta, -alpha, nextPlayer);
       } catch (e) {
         unmakeSilentMove(record);
         throw e;
       }
       // 削減探索の結果がalpha以下なら、良い手ではない可能性が高いので本探索をスキップ
       if (score <= alpha) {
         doFullSearch = false;
       }
    }

    if (doFullSearch) {
      try {
        score = -alphaBeta(depth - 1, -beta, -alpha, nextPlayer);
      } catch (e) {
        unmakeSilentMove(record);
        throw e;
      }
    }
    // ---------------------------------

    unmakeSilentMove(record);

    if (stopSearch) return alpha;

    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

function quiescenceSearch(alpha, beta, turnPlayer) {
  nodesCount++;
  
  if (nodesCount % 2000 === 0) {
    if ((Date.now() - searchStartTime) > timeLimit) {
      stopSearch = true;
      throw "TIMEOUT";
    }
  }

  let standPat = evaluateBoard(turnPlayer);
  if (standPat >= beta) return beta;
  if (standPat > alpha) alpha = standPat;

  let moves = getAllLegalMoves(turnPlayer).filter(m => {
    if (m.fromHand) return false;
    const target = boardState[m.y1][m.x1];
    if (target) return true;

    const mover = boardState[m.y0][m.x0];
    const base = mover.replace("+","").toUpperCase();
    if (!mover.includes("+") && ["P","L","N","S","B","R"].includes(base)) {
      if (isInPromotionZone(m.y1, turnPlayer) || isInPromotionZone(m.y0, turnPlayer)) {
        return true;
      }
    }
    return false;
  });

  sortMoves(moves);

  for (const move of moves) {
    const record = makeSilentMove(move);
    let score;
    const nextPlayer = turnPlayer === "black" ? "white" : "black";
    
    try {
      score = -quiescenceSearch(-beta, -alpha, nextPlayer);
    } catch (e) {
      unmakeSilentMove(record);
      throw e;
    }
    unmakeSilentMove(record);

    if (stopSearch) return alpha;

    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }

  return alpha;
}

// ==========================================
// 7. 評価関数（手番に応じてテーブル切り替え）
// ==========================================

function evaluateBoard(player) {
  const useShioya = (moveCount <= 20);
  const currentPieceValues = useShioya ? pieceValues_Shioya : pieceValues_Strong;
  const currentHandValues = useShioya ? handValues_Shioya : handValues_Strong;
  const currentPositionBonus = useShioya ? positionBonus_Shioya : positionBonus_Strong;

  let blackScore = 0;
  let whiteScore = 0;

  for (let y = 0; y < 9; y++) {
    for (let x = 0; x < 9; x++) {
      const p = boardState[y][x];
      if (!p) continue;

      const isWhite = p === p.toLowerCase();
      const baseKey = p.replace("+", "").toUpperCase();
      const key = p.startsWith("+") ? "+" + baseKey : baseKey;
      
      let val = currentPieceValues[key] || 0;

      if (currentPositionBonus[baseKey]) {
        const tableY = isWhite ? (8 - y) : y;
        const tableX = isWhite ? (8 - x) : x;
        val += currentPositionBonus[baseKey][tableY][tableX] || 0;
      }

      if (isWhite) whiteScore += val;
      else blackScore += val;
    }
  }

  hands.black.forEach(p => blackScore += (currentHandValues[p] || 0));
  hands.white.forEach(p => whiteScore += (currentHandValues[p] || 0));

  const blackKing = findKing("black");
  const whiteKing = findKing("white");

  if (blackKing) blackScore += evaluateKingSafety(blackKing, "black");
  if (whiteKing) whiteScore += evaluateKingSafety(whiteKing, "white");

  return player === "black" ? (blackScore - whiteScore) : (whiteScore - blackScore);
}

function evaluateKingSafety(pos, player) {
  let score = 0;
  const isWhite = player === "white";
  const friendGold = isWhite ? "g" : "G";
  const friendSilver = isWhite ? "s" : "S";
  
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = pos.x + dx;
      const ny = pos.y + dy;
      if (nx >= 0 && nx < 9 && ny >= 0 && ny < 9) {
        const p = boardState[ny][nx];
        if (!p) continue;
        if (p === friendGold) score += 40;
        if (p === friendSilver) score += 30;
      }
    }
  }

  if (isKingInCheck(player)) {
    score -= 200;
  }
  return score;
}

// ==========================================
// 8. ユーティリティ
// ==========================================

function makeSilentMove(move) {
  const player = turn;
  const pieceBefore = move.fromHand 
    ? hands[player][move.index] 
    : boardState[move.y0][move.x0];

  const record = {
    fromHand: move.fromHand,
    fromX: move.x0,
    fromY: move.y0,
    toX: move.x1,
    toY: move.y1,
    pieceMoved: pieceBefore,
    capturedPiece: boardState[move.y1][move.x1],
    index: move.index,
    wasPromoted: false
  };

  if (move.fromHand) {
    const piece = hands[player].splice(move.index, 1)[0];
    boardState[move.y1][move.x1] = (player === "white") ? piece.toLowerCase() : piece;
  } else {
    let piece = boardState[move.y0][move.x0];
    if (record.capturedPiece) {
      const cap = record.capturedPiece.replace("+","").toUpperCase();
      hands[player].push(cap);
    }
    
    const base = piece.replace("+","").toUpperCase();
    if (!piece.includes("+") && ["P","L","N","S","B","R"].includes(base)) {
      if (isInPromotionZone(move.y1, player) || isInPromotionZone(move.y0, player)) {
        piece = (player === "white") ? ("+" + base).toLowerCase() : ("+" + base);
        record.wasPromoted = true;
      }
    }
    boardState[move.y0][move.x0] = "";
    boardState[move.y1][move.x1] = piece;
  }
  turn = (turn === "black" ? "white" : "black");
  return record;
}

function unmakeSilentMove(record) {
  turn = (turn === "black" ? "white" : "black");
  const player = turn;
  
  if (record.fromHand) {
    boardState[record.toY][record.toX] = "";
    hands[player].splice(record.index, 0, record.pieceMoved);
  } else {
    let movedPiece = record.pieceMoved;
    if (player === "white") movedPiece = movedPiece.toLowerCase();

    boardState[record.fromY][record.fromX] = movedPiece;
    boardState[record.toY][record.toX] = record.capturedPiece;
    
    if (record.capturedPiece) {
      hands[player].pop();
    }
  }
}

function sortMoves(moves) {
  const useShioya = (moveCount <= 20);
  const pVal = useShioya ? pieceValues_Shioya : pieceValues_Strong;

  moves.sort((a, b) => {
    let scoreA = 0;
    let scoreB = 0;

    if (!a.fromHand && boardState[a.y1][a.x1]) {
      const victim = boardState[a.y1][a.x1];
      const attacker = boardState[a.y0][a.x0];
      const valV = pVal[victim.startsWith("+") ? "+" + victim.replace("+","").toUpperCase() : victim.toUpperCase()] || 0;
      const valA = pVal[attacker.startsWith("+") ? "+" + attacker.replace("+","").toUpperCase() : attacker.toUpperCase()] || 0;
      scoreA = valV * 10 - valA;
    } else if (a.fromHand) {
      scoreA = -50; 
    }
    if (!a.fromHand) {
      const p = boardState[a.y0][a.x0];
      const base = p.replace("+","").toUpperCase();
      const player = p === p.toLowerCase() ? "white" : "black";
      if (!p.includes("+") && ["P","L","N","S","B","R"].includes(base)) {
         if (isInPromotionZone(a.y1, player) || isInPromotionZone(a.y0, player)) {
           scoreA += 300;
         }
      }
    }

    if (!b.fromHand && boardState[b.y1][b.x1]) {
      const victim = boardState[b.y1][b.x1];
      const attacker = boardState[b.y0][b.x0];
      const valV = pVal[victim.startsWith("+") ? "+" + victim.replace("+","").toUpperCase() : victim.toUpperCase()] || 0;
      const valA = pVal[attacker.startsWith("+") ? "+" + attacker.replace("+","").toUpperCase() : attacker.toUpperCase()] || 0;
      scoreB = valV * 10 - valA;
    } else if (b.fromHand) {
      scoreB = -50;
    }
    if (!b.fromHand) {
      const p = boardState[b.y0][b.x0];
      const base = p.replace("+","").toUpperCase();
      const player = p === p.toLowerCase() ? "white" : "black";
      if (!p.includes("+") && ["P","L","N","S","B","R"].includes(base)) {
         if (isInPromotionZone(b.y1, player) || isInPromotionZone(b.y0, player)) {
           scoreB += 300;
         }
      }
    }

    return scoreB - scoreA;
  });
}