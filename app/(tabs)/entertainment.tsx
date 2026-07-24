import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Header } from '../../components/Header';
import { useApp } from '../../context/AppContext';
import { api } from '../../lib/api';
import { fontFamily, radius, shadow } from '../../lib/styles';

/* -------------------------------------------------------------------------- */
/* Shared game picker                                                          */
/* -------------------------------------------------------------------------- */

type EntertainmentGame = 'caro' | 'sudoku' | 'runner' | 'trumua';

const GAME_CARDS: Array<{ id: EntertainmentGame; title: string; desc: string; icon: keyof typeof Feather.glyphMap }> = [
  { id: 'caro', title: 'Caro AI', desc: '15x15, AI từ dễ đến cực khó', icon: 'grid' },
  { id: 'sudoku', title: 'Sudoku AI', desc: '20 màn, AI gợi ý và điền ô', icon: 'hash' },
  { id: 'runner', title: 'Né quái vật', desc: 'Chạy ngang, né bẫy, UFO và quái', icon: 'zap' },
  { id: 'trumua', title: 'Trú mưa', desc: 'Né người đi đường, trú mái hiên khi mưa', icon: 'cloud-rain' },
];

function GamePicker({ selectedGame, setSelectedGame, theme }: { selectedGame: EntertainmentGame; setSelectedGame: (game: EntertainmentGame) => void; theme: any }) {
  return (
    <View style={[styles.gamePicker, { backgroundColor: theme.card, borderColor: theme.border }, shadow(theme)]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gamePickerRow}>
        {GAME_CARDS.map((item) => {
          const active = selectedGame === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => setSelectedGame(item.id)}
              style={[
                styles.gameCard,
                {
                  backgroundColor: active ? theme.primary : theme.background,
                  borderColor: active ? theme.primary : theme.border,
                },
              ]}
            >
              <Feather name={item.icon} size={22} color={active ? theme.background : theme.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.gameTitle, { color: active ? theme.background : theme.heading }]}>{item.title}</Text>
                <Text style={[styles.gameDesc, { color: active ? theme.background : theme.muted }]}>{item.desc}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Caro AI 15x15                                                               */
/* -------------------------------------------------------------------------- */

const CARO_BOARD_SIZE = 15;
const CARO_WIN_LENGTH = 5;
const HUMAN = 'X';
const AI = 'O';

type CaroCell = typeof HUMAN | typeof AI | null;
type CaroBoard = CaroCell[];

type Difficulty = {
  id: string;
  label: string;
  description: string;
  depth: number;
  candidateLimit: number;
};

const CARO_DIFFICULTIES: Difficulty[] = [
  { id: 'easy', label: 'Dễ', description: 'AI đi ngẫu nhiên quanh khu vực đang chơi.', depth: 0, candidateLimit: 10 },
  { id: 'normal', label: 'Thường', description: 'AI biết chọn nước có điểm tốt và đôi lúc mắc lỗi.', depth: 0, candidateLimit: 14 },
  { id: 'hard', label: 'Khó', description: 'AI biết thắng ngay, chặn ngay và tính nước mạnh.', depth: 1, candidateLimit: 12 },
  { id: 'expert', label: 'Rất khó', description: 'AI dùng minimax + alpha-beta ở độ sâu vừa phải.', depth: 2, candidateLimit: 10 },
  { id: 'extreme', label: 'Cực khó', description: 'AI ưu tiên thế cờ nguy hiểm và tìm nước phản công sâu hơn.', depth: 3, candidateLimit: 8 },
];

const CARO_DIRECTIONS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];

const CARO_SCORE_TABLE: Record<number, number> = { 0: 0, 1: 2, 2: 24, 3: 220, 4: 9000, 5: 1_000_000 };
const DEFENSE_MULTIPLIER = 1.15;

function caroIndex(row: number, col: number) {
  return row * CARO_BOARD_SIZE + col;
}
function caroRow(index: number) {
  return Math.floor(index / CARO_BOARD_SIZE);
}
function caroCol(index: number) {
  return index % CARO_BOARD_SIZE;
}
function caroInBoard(row: number, col: number) {
  return row >= 0 && row < CARO_BOARD_SIZE && col >= 0 && col < CARO_BOARD_SIZE;
}
function createEmptyCaroBoard(): CaroBoard {
  return Array.from({ length: CARO_BOARD_SIZE * CARO_BOARD_SIZE }, () => null);
}
function cloneCaroBoard(board: CaroBoard): CaroBoard {
  return board.slice();
}
function otherCaroPlayer(player: typeof HUMAN | typeof AI) {
  return player === HUMAN ? AI : HUMAN;
}
function getCaroGameResult(board: CaroBoard) {
  for (let row = 0; row < CARO_BOARD_SIZE; row += 1) {
    for (let col = 0; col < CARO_BOARD_SIZE; col += 1) {
      const player = board[caroIndex(row, col)];
      if (!player) continue;
      for (const [dr, dc] of CARO_DIRECTIONS) {
        const prevRow = row - dr;
        const prevCol = col - dc;
        if (caroInBoard(prevRow, prevCol) && board[caroIndex(prevRow, prevCol)] === player) continue;
        const line: number[] = [];
        let r = row;
        let c = col;
        while (caroInBoard(r, c) && board[caroIndex(r, c)] === player) {
          line.push(caroIndex(r, c));
          r += dr;
          c += dc;
        }
        if (line.length >= CARO_WIN_LENGTH) return { winner: player, line: line.slice(0, CARO_WIN_LENGTH), draw: false };
      }
    }
  }
  if (board.every(Boolean)) return { winner: null, line: [], draw: true };
  return { winner: null, line: [], draw: false };
}
function getCaroCandidateMoves(board: CaroBoard, radius = 2) {
  const occupied: number[] = [];
  for (let i = 0; i < board.length; i += 1) if (board[i]) occupied.push(i);
  if (occupied.length === 0) return [caroIndex(Math.floor(CARO_BOARD_SIZE / 2), Math.floor(CARO_BOARD_SIZE / 2))];
  const candidates = new Set<number>();
  for (const idx of occupied) {
    const row = caroRow(idx);
    const col = caroCol(idx);
    for (let dr = -radius; dr <= radius; dr += 1) {
      for (let dc = -radius; dc <= radius; dc += 1) {
        const nr = row + dr;
        const nc = col + dc;
        if (caroInBoard(nr, nc)) {
          const next = caroIndex(nr, nc);
          if (!board[next]) candidates.add(next);
        }
      }
    }
  }
  return Array.from(candidates);
}
function wouldCaroWin(board: CaroBoard, move: number, player: typeof HUMAN | typeof AI) {
  if (board[move]) return false;
  const testBoard = cloneCaroBoard(board);
  testBoard[move] = player;
  return getCaroGameResult(testBoard).winner === player;
}
function findImmediateCaroWinningMove(board: CaroBoard, player: typeof HUMAN | typeof AI) {
  const candidates = getCaroCandidateMoves(board, 2);
  for (const move of candidates) if (wouldCaroWin(board, move, player)) return move;
  return null;
}
function caroSegmentScore(aiCount: number, humanCount: number) {
  if (aiCount > 0 && humanCount > 0) return 0;
  if (aiCount === 0 && humanCount === 0) return 0;
  if (aiCount > 0) return CARO_SCORE_TABLE[aiCount] || CARO_SCORE_TABLE[5];
  return -Math.round((CARO_SCORE_TABLE[humanCount] || CARO_SCORE_TABLE[5]) * DEFENSE_MULTIPLIER);
}
function evaluateCaroBoard(board: CaroBoard) {
  const result = getCaroGameResult(board);
  if (result.winner === AI) return 10_000_000;
  if (result.winner === HUMAN) return -10_000_000;
  if (result.draw) return 0;
  let score = 0;
  for (let row = 0; row < CARO_BOARD_SIZE; row += 1) {
    for (let col = 0; col < CARO_BOARD_SIZE; col += 1) {
      for (const [dr, dc] of CARO_DIRECTIONS) {
        const endRow = row + dr * (CARO_WIN_LENGTH - 1);
        const endCol = col + dc * (CARO_WIN_LENGTH - 1);
        if (!caroInBoard(endRow, endCol)) continue;
        let aiCount = 0;
        let humanCount = 0;
        for (let step = 0; step < CARO_WIN_LENGTH; step += 1) {
          const cell = board[caroIndex(row + dr * step, col + dc * step)];
          if (cell === AI) aiCount += 1;
          if (cell === HUMAN) humanCount += 1;
        }
        score += caroSegmentScore(aiCount, humanCount);
      }
    }
  }
  return score;
}
function localCaroPotentialScore(board: CaroBoard, move: number, player: typeof HUMAN | typeof AI) {
  const opponent = otherCaroPlayer(player);
  const row = caroRow(move);
  const col = caroCol(move);
  let total = 0;
  for (const [dr, dc] of CARO_DIRECTIONS) {
    let own = 1;
    let enemyBlock = 0;
    let openEnds = 0;
    for (const sign of [-1, 1]) {
      let r = row + dr * sign;
      let c = col + dc * sign;
      let steps = 0;
      while (caroInBoard(r, c) && steps < 4) {
        const cell = board[caroIndex(r, c)];
        if (cell === player) own += 1;
        else {
          if (!cell) openEnds += 1;
          if (cell === opponent) enemyBlock += 1;
          break;
        }
        r += dr * sign;
        c += dc * sign;
        steps += 1;
      }
    }
    const base = CARO_SCORE_TABLE[Math.min(own, 5)] || 0;
    const openness = openEnds === 2 ? 1.65 : openEnds === 1 ? 1 : 0.35;
    const penalty = enemyBlock >= 2 ? 0.25 : 1;
    total += Math.round(base * openness * penalty);
  }
  return total;
}
function scoreCaroMove(board: CaroBoard, move: number, player: typeof HUMAN | typeof AI) {
  const testBoard = cloneCaroBoard(board);
  testBoard[move] = player;
  const result = getCaroGameResult(testBoard);
  if (result.winner === player) return 100_000_000;
  if (result.winner === otherCaroPlayer(player)) return -100_000_000;
  const boardScore = evaluateCaroBoard(testBoard);
  const attack = localCaroPotentialScore(board, move, player);
  const defense = localCaroPotentialScore(board, move, otherCaroPlayer(player)) * 1.2;
  const center = CARO_BOARD_SIZE - Math.abs(caroRow(move) - 7) - Math.abs(caroCol(move) - 7);
  return player === AI ? boardScore + attack + defense + center : -boardScore + attack + defense + center;
}
function getScoredCaroCandidates(board: CaroBoard, player: typeof HUMAN | typeof AI, limit: number) {
  return getCaroCandidateMoves(board, 2)
    .map((move) => ({ move, score: scoreCaroMove(board, move, player) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.move);
}
function minimaxCaro(board: CaroBoard, depth: number, alpha: number, beta: number, maximizing: boolean, candidateLimit: number): { score: number; move: number | null } {
  const result = getCaroGameResult(board);
  if (result.winner === AI) return { score: 10_000_000 + depth, move: null };
  if (result.winner === HUMAN) return { score: -10_000_000 - depth, move: null };
  if (result.draw || depth === 0) return { score: evaluateCaroBoard(board), move: null };
  const player = maximizing ? AI : HUMAN;
  const candidates = getScoredCaroCandidates(board, player, candidateLimit);
  let bestMove = candidates[0] ?? null;
  if (maximizing) {
    let bestScore = -Infinity;
    for (const move of candidates) {
      board[move] = AI;
      const value = minimaxCaro(board, depth - 1, alpha, beta, false, Math.max(5, candidateLimit - 2)).score;
      board[move] = null;
      if (value > bestScore) {
        bestScore = value;
        bestMove = move;
      }
      alpha = Math.max(alpha, value);
      if (beta <= alpha) break;
    }
    return { score: bestScore, move: bestMove };
  }
  let bestScore = Infinity;
  for (const move of candidates) {
    board[move] = HUMAN;
    const value = minimaxCaro(board, depth - 1, alpha, beta, true, Math.max(5, candidateLimit - 2)).score;
    board[move] = null;
    if (value < bestScore) {
      bestScore = value;
      bestMove = move;
    }
    beta = Math.min(beta, value);
    if (beta <= alpha) break;
  }
  return { score: bestScore, move: bestMove };
}
function randomCaroItem<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}
function chooseCaroAiMove(board: CaroBoard, difficulty: Difficulty) {
  const aiWin = findImmediateCaroWinningMove(board, AI);
  if (aiWin !== null) return aiWin;
  const humanWin = findImmediateCaroWinningMove(board, HUMAN);
  if (humanWin !== null && difficulty.id !== 'easy') return humanWin;
  const candidates = getCaroCandidateMoves(board, difficulty.id === 'easy' ? 1 : 2);
  if (candidates.length === 0) return null;
  if (difficulty.id === 'easy') return randomCaroItem(candidates);
  if (difficulty.id === 'normal') {
    const ranked = getScoredCaroCandidates(board, AI, difficulty.candidateLimit);
    if (Math.random() < 0.28) return randomCaroItem(candidates);
    return randomCaroItem(ranked.slice(0, Math.min(4, ranked.length)));
  }
  if (difficulty.id === 'hard') {
    const ranked = getScoredCaroCandidates(board, AI, difficulty.candidateLimit);
    return ranked[0] ?? randomCaroItem(candidates);
  }
  const result = minimaxCaro(cloneCaroBoard(board), difficulty.depth, -Infinity, Infinity, true, difficulty.candidateLimit);
  return result.move ?? getScoredCaroCandidates(board, AI, difficulty.candidateLimit)[0] ?? randomCaroItem(candidates);
}
function formatCaroPosition(index: number) {
  return `${String.fromCharCode(65 + caroCol(index))}${caroRow(index) + 1}`;
}

function CaroGame({ theme, user }: { theme: any; user: any }) {
  const [board, setBoard] = useState<CaroBoard>(() => createEmptyCaroBoard());
  const [difficultyId, setDifficultyId] = useState('normal');
  const [humanStarts, setHumanStarts] = useState(true);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [lastMove, setLastMove] = useState<number | null>(null);
  const [history, setHistory] = useState<Array<{ player: typeof HUMAN | typeof AI; move: number; difficulty: string }>>([]);
  const [stats, setStats] = useState({ human: 0, ai: 0, draw: 0 });

  const difficulty = useMemo(() => CARO_DIFFICULTIES.find((item) => item.id === difficultyId) ?? CARO_DIFFICULTIES[1], [difficultyId]);
  const result = useMemo(() => getCaroGameResult(board), [board]);
  const isGameOver = Boolean(result.winner || result.draw);
  const humanTurn = !isAiThinking && !isGameOver && history.length % 2 === (humanStarts ? 0 : 1);
  const winLineSet = useMemo(() => new Set(result.line), [result.line]);

  useEffect(() => {
    if (!isGameOver) return;
    setIsAiThinking(false);
    if (result.winner === HUMAN) setStats((prev) => ({ ...prev, human: prev.human + 1 }));
    if (result.winner === AI) setStats((prev) => ({ ...prev, ai: prev.ai + 1 }));
    if (result.draw) setStats((prev) => ({ ...prev, draw: prev.draw + 1 }));
    if (user?.id) {
      api.saveGameHistory({
        userId: user.id,
        game: 'caro-ai',
        score: result.winner === HUMAN ? 1 : 0,
        coins: result.winner === HUMAN ? 10 : 0,
        result: result.draw ? 'draw' : result.winner === HUMAN ? 'win' : 'lose',
        moves: history.length,
        difficulty: difficulty.label,
      }).catch(() => null);
    }
  }, [isGameOver, result.winner, result.draw]);

  useEffect(() => {
    const aiTurn = !isGameOver && history.length % 2 === (humanStarts ? 1 : 0);
    if (!aiTurn || isAiThinking) return;
    setIsAiThinking(true);
    const timer = setTimeout(() => {
      const move = chooseCaroAiMove(board, difficulty);
      if (move !== null) {
        setBoard((prev) => {
          if (prev[move]) return prev;
          const next = cloneCaroBoard(prev);
          next[move] = AI;
          return next;
        });
        setLastMove(move);
        setHistory((prev) => [...prev, { player: AI, move, difficulty: difficulty.label }]);
      }
      setIsAiThinking(false);
    }, difficulty.id === 'extreme' ? 420 : difficulty.id === 'expert' ? 300 : 180);
    return () => clearTimeout(timer);
  }, [board, difficulty, history.length, humanStarts, isAiThinking, isGameOver]);

  function resetGame(nextHumanStarts = humanStarts) {
    setBoard(createEmptyCaroBoard());
    setHumanStarts(nextHumanStarts);
    setIsAiThinking(false);
    setLastMove(null);
    setHistory([]);
  }
  function handleCellClick(index: number) {
    if (!humanTurn || board[index] || isGameOver) return;
    setBoard((prev) => {
      const next = cloneCaroBoard(prev);
      next[index] = HUMAN;
      return next;
    });
    setLastMove(index);
    setHistory((prev) => [...prev, { player: HUMAN, move: index, difficulty: difficulty.label }]);
  }
  function changeDifficulty(id: string) {
    setDifficultyId(id);
    resetGame(humanStarts);
  }
  const status = useMemo(() => {
    if (result.winner === HUMAN) return 'Bạn thắng!';
    if (result.winner === AI) return 'AI thắng!';
    if (result.draw) return 'Hòa cờ.';
    if (isAiThinking) return 'AI đang tính nước...';
    if (humanTurn) return 'Đến lượt bạn.';
    return 'Đến lượt AI.';
  }, [humanTurn, isAiThinking, result.draw, result.winner]);

  return (
    <>
      <View style={[styles.statusCard, { backgroundColor: theme.card, borderColor: theme.border }, shadow(theme)]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.kicker, { color: theme.primary }]}>CARO AI 15x15</Text>
          <Text style={[styles.mainTitle, { color: theme.heading, fontFamily: fontFamily(theme) }]}>Đấu Caro với AI</Text>
          <Text style={[styles.desc, { color: theme.text }]}>Bạn là X, AI là O. Ai có 5 quân liên tiếp theo ngang, dọc hoặc chéo sẽ thắng.</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: theme.background, borderColor: theme.border }]}> 
          <Text style={[styles.statusLabel, { color: theme.muted }]}>TRẠNG THÁI</Text>
          <Text style={[styles.statusText, { color: theme.primary }]}>{status}</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.boardOuter}>
        <View style={[styles.caroBoard, { backgroundColor: theme.card, borderColor: theme.border }, shadow(theme)]}>
          {board.map((cell, index) => {
            const isWinning = winLineSet.has(index);
            const isLast = lastMove === index;
            return (
              <Pressable
                key={`cell-${index}`}
                accessibilityLabel={`Ô ${formatCaroPosition(index)}`}
                disabled={!humanTurn || Boolean(cell) || isGameOver}
                onPress={() => handleCellClick(index)}
                style={[
                  styles.caroCell,
                  { borderColor: theme.border, backgroundColor: theme.background },
                  isWinning ? styles.winCell : null,
                  isLast ? { borderColor: theme.primary, borderWidth: 2 } : null,
                ]}
              >
                {cell ? <Text style={[styles.caroCellText, { color: cell === HUMAN ? '#14A46C' : '#D24A3A' }]}>{cell}</Text> : null}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.panel, { backgroundColor: theme.card, borderColor: theme.border }, shadow(theme)]}>
        <View style={styles.panelHeader}>
          <Feather name="cpu" size={21} color={theme.primary} />
          <Text style={[styles.panelTitle, { color: theme.heading }]}>Cấp độ AI</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.difficultyRow}>
          {CARO_DIFFICULTIES.map((item) => {
            const active = item.id === difficultyId;
            return (
              <Pressable key={item.id} onPress={() => changeDifficulty(item.id)} style={[styles.diffChip, { backgroundColor: active ? theme.primary : theme.background, borderColor: active ? theme.primary : theme.border }]}> 
                <Text style={[styles.diffText, { color: active ? theme.background : theme.heading }]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Text style={[styles.desc, { color: theme.text }]}>{difficulty.description}</Text>
      </View>

      <View style={styles.twoColumns}>
        <View style={[styles.panel, styles.halfPanel, { backgroundColor: theme.card, borderColor: theme.border }, shadow(theme)]}>
          <Text style={[styles.panelTitle, { color: theme.heading }]}>Điểm số</Text>
          <View style={styles.scoreRow}>
            <ScoreBox label="Bạn" value={stats.human} color="#14A46C" />
            <ScoreBox label="AI" value={stats.ai} color="#D24A3A" />
            <ScoreBox label="Hòa" value={stats.draw} color={theme.muted} />
          </View>
        </View>
        <View style={[styles.panel, styles.halfPanel, { backgroundColor: theme.card, borderColor: theme.border }, shadow(theme)]}>
          <Text style={[styles.panelTitle, { color: theme.heading }]}>Điều khiển</Text>
          <Pressable onPress={() => resetGame(true)} style={[styles.actionBtn, { backgroundColor: theme.primary }]}> 
            <Feather name="rotate-ccw" size={17} color={theme.background} />
            <Text style={[styles.actionText, { color: theme.background }]}>Bạn đi trước</Text>
          </Pressable>
          <Pressable onPress={() => resetGame(false)} style={[styles.actionBtn, { backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1 }]}> 
            <Feather name="zap" size={17} color={theme.primary} />
            <Text style={[styles.actionText, { color: theme.primary }]}>AI đi trước</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.panel, { backgroundColor: theme.card, borderColor: theme.border }, shadow(theme)]}>
        <Text style={[styles.panelTitle, { color: theme.heading }]}>Lịch sử nước đi</Text>
        {history.length === 0 ? (
          <Text style={[styles.desc, { color: theme.muted }]}>Chưa có nước đi nào.</Text>
        ) : (
          history.slice().reverse().slice(0, 28).map((item, reversedIndex) => {
            const moveNumber = history.length - reversedIndex;
            return (
              <View key={`${item.player}-${item.move}-${moveNumber}`} style={[styles.moveRow, { backgroundColor: theme.background, borderColor: theme.border }]}> 
                <Text style={[styles.moveNo, { color: theme.muted }]}>#{moveNumber}</Text>
                <Text style={[styles.movePlayer, { color: item.player === HUMAN ? '#14A46C' : '#D24A3A' }]}>{item.player === HUMAN ? 'Bạn' : 'AI'}</Text>
                <Text style={[styles.movePos, { color: theme.heading }]}>{formatCaroPosition(item.move)}</Text>
              </View>
            );
          })
        )}
      </View>
    </>
  );
}

function ScoreBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.scoreBox}>
      <Text style={[styles.scoreValue, { color }]}>{value}</Text>
      <Text style={[styles.scoreLabel, { color }]}>{label}</Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Sudoku AI Trainer                                                           */
/* -------------------------------------------------------------------------- */

const SUDOKU_SIZE = 9;
const SUDOKU_BOX = 3;
const SUDOKU_CELL_COUNT = SUDOKU_SIZE * SUDOKU_SIZE;
const EMPTY = 0;
const MAX_SUDOKU_LEVEL = 20;
const SUDOKU_DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

function numRange(count: number) {
  return Array.from({ length: count }, (_, index) => index);
}
function shuffleNums(items: number[]) {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function sudokuRow(index: number) {
  return Math.floor(index / SUDOKU_SIZE);
}
function sudokuCol(index: number) {
  return index % SUDOKU_SIZE;
}
function sudokuBoxStart(value: number) {
  return Math.floor(value / SUDOKU_BOX) * SUDOKU_BOX;
}
function cloneSudokuBoard(board: number[]) {
  return board.slice();
}
function isValidSudokuPlacement(board: number[], index: number, value: number) {
  if (!value) return true;
  const row = sudokuRow(index);
  const col = sudokuCol(index);
  for (let c = 0; c < SUDOKU_SIZE; c += 1) {
    const checkIndex = row * SUDOKU_SIZE + c;
    if (checkIndex !== index && board[checkIndex] === value) return false;
  }
  for (let r = 0; r < SUDOKU_SIZE; r += 1) {
    const checkIndex = r * SUDOKU_SIZE + col;
    if (checkIndex !== index && board[checkIndex] === value) return false;
  }
  const startRow = sudokuBoxStart(row);
  const startCol = sudokuBoxStart(col);
  for (let r = startRow; r < startRow + SUDOKU_BOX; r += 1) {
    for (let c = startCol; c < startCol + SUDOKU_BOX; c += 1) {
      const checkIndex = r * SUDOKU_SIZE + c;
      if (checkIndex !== index && board[checkIndex] === value) return false;
    }
  }
  return true;
}
function getSudokuCandidates(board: number[], index: number) {
  if (board[index] !== EMPTY) return [];
  return SUDOKU_DIGITS.filter((value) => isValidSudokuPlacement(board, index, value));
}
function findBestSudokuEmptyCell(board: number[]) {
  let bestIndex: number | null = null;
  let bestCandidates: number[] = [];
  for (let i = 0; i < SUDOKU_CELL_COUNT; i += 1) {
    if (board[i] !== EMPTY) continue;
    const candidates = getSudokuCandidates(board, i);
    if (bestIndex === null || candidates.length < bestCandidates.length) {
      bestIndex = i;
      bestCandidates = candidates;
      if (candidates.length <= 1) break;
    }
  }
  return { index: bestIndex, candidates: bestCandidates };
}
function countSudokuSolutions(board: number[], limit = 2) {
  const working = cloneSudokuBoard(board);
  let count = 0;
  function backtrack() {
    if (count >= limit) return;
    const { index, candidates } = findBestSudokuEmptyCell(working);
    if (index === null) {
      count += 1;
      return;
    }
    for (const value of candidates) {
      working[index] = value;
      backtrack();
      working[index] = EMPTY;
      if (count >= limit) return;
    }
  }
  backtrack();
  return count;
}
function generateSolvedSudokuBoard() {
  const board = Array(SUDOKU_CELL_COUNT).fill(EMPTY);
  function fillCell(index = 0): boolean {
    if (index >= SUDOKU_CELL_COUNT) return true;
    if (board[index] !== EMPTY) return fillCell(index + 1);
    for (const value of shuffleNums(SUDOKU_DIGITS)) {
      if (isValidSudokuPlacement(board, index, value)) {
        board[index] = value;
        if (fillCell(index + 1)) return true;
        board[index] = EMPTY;
      }
    }
    return false;
  }
  fillCell();
  return board;
}
function getSudokuEmptyTarget(level: number) {
  return Math.min(24 + level * 2, 64);
}
function getSudokuDifficultyName(level: number) {
  if (level <= 4) return 'Nhập môn';
  if (level <= 8) return 'Dễ';
  if (level <= 12) return 'Thường';
  if (level <= 16) return 'Khó';
  return 'Cực khó';
}
function generateSudokuPuzzle(level: number) {
  const solution = generateSolvedSudokuBoard();
  const puzzle = cloneSudokuBoard(solution);
  const order = shuffleNums(numRange(SUDOKU_CELL_COUNT));
  const targetEmpty = getSudokuEmptyTarget(level);
  let removed = 0;
  for (const index of order) {
    if (removed >= targetEmpty) break;
    const backup = puzzle[index];
    puzzle[index] = EMPTY;
    if (countSudokuSolutions(puzzle, 2) === 1) removed += 1;
    else puzzle[index] = backup;
  }
  return { puzzle, solution, fixed: puzzle.map((value) => value !== EMPTY), emptyCount: puzzle.filter((value) => value === EMPTY).length };
}
function isSudokuBoardComplete(board: number[]) {
  return board.every((value) => value !== EMPTY);
}
function getSudokuConflictCells(board: number[]) {
  const conflicts = new Set<number>();
  for (let i = 0; i < SUDOKU_CELL_COUNT; i += 1) {
    const value = board[i];
    if (!value) continue;
    if (!isValidSudokuPlacement(board, i, value)) conflicts.add(i);
  }
  return conflicts;
}
function getSudokuPeerCells(index: number) {
  const peers = new Set<number>();
  const row = sudokuRow(index);
  const col = sudokuCol(index);
  for (let c = 0; c < SUDOKU_SIZE; c += 1) peers.add(row * SUDOKU_SIZE + c);
  for (let r = 0; r < SUDOKU_SIZE; r += 1) peers.add(r * SUDOKU_SIZE + col);
  const startRow = sudokuBoxStart(row);
  const startCol = sudokuBoxStart(col);
  for (let r = startRow; r < startRow + SUDOKU_BOX; r += 1) {
    for (let c = startCol; c < startCol + SUDOKU_BOX; c += 1) peers.add(r * SUDOKU_SIZE + c);
  }
  peers.delete(index);
  return peers;
}
function formatSudokuCell(index: number) {
  return `Hàng ${sudokuRow(index) + 1}, cột ${sudokuCol(index) + 1}`;
}

function SudokuGame({ theme, user }: { theme: any; user: any }) {
  const [level, setLevel] = useState(1);
  const [game, setGame] = useState(() => generateSudokuPuzzle(1));
  const [board, setBoard] = useState(() => game.puzzle);
  const [selected, setSelected] = useState<number | null>(null);
  const [hintCell, setHintCell] = useState<number | null>(null);
  const [showCandidates, setShowCandidates] = useState(true);
  const [message, setMessage] = useState('Chọn một ô trống rồi nhập số từ 1 đến 9.');
  const [mistakes, setMistakes] = useState(0);
  const [aiUsed, setAiUsed] = useState(0);
  const [completedLevels, setCompletedLevels] = useState(0);

  const conflictCells = useMemo(() => getSudokuConflictCells(board), [board]);
  const isComplete = isSudokuBoardComplete(board) && conflictCells.size === 0;
  const selectedPeers = useMemo(() => (selected === null ? new Set<number>() : getSudokuPeerCells(selected)), [selected]);
  const selectedValue = selected === null ? EMPTY : board[selected];
  const emptyLeft = board.filter((value) => value === EMPTY).length;
  const difficultyName = getSudokuDifficultyName(level);

  useEffect(() => {
    if (!isComplete) return;
    setMessage('Hoàn thành màn chơi! Bạn có thể sang màn tiếp theo.');
    setCompletedLevels((prev) => Math.max(prev, level));
    if (user?.id) {
      api.saveGameHistory({ userId: user.id, game: 'sudoku-ai', score: level * 100 - mistakes * 5, coins: 15, result: 'win', level, mistakes, aiUsed }).catch(() => null);
    }
  }, [isComplete, level]);

  function startLevel(nextLevel: number) {
    const safeLevel = Math.max(1, Math.min(MAX_SUDOKU_LEVEL, nextLevel));
    const nextGame = generateSudokuPuzzle(safeLevel);
    setLevel(safeLevel);
    setGame(nextGame);
    setBoard(nextGame.puzzle);
    setSelected(null);
    setHintCell(null);
    setMistakes(0);
    setAiUsed(0);
    setMessage(`Màn ${safeLevel}: có ${nextGame.emptyCount} ô cần điền.`);
  }
  function restartCurrentLevel() {
    setBoard(game.puzzle);
    setSelected(null);
    setHintCell(null);
    setMistakes(0);
    setAiUsed(0);
    setMessage('Đã chơi lại màn hiện tại.');
  }
  function handleSelect(index: number) {
    setSelected(index);
    if (game.fixed[index]) {
      setMessage(`${formatSudokuCell(index)} là ô đề bài, không thể sửa.`);
      return;
    }
    const candidates = getSudokuCandidates(board, index);
    if (board[index]) setMessage(`${formatSudokuCell(index)} đang là số ${board[index]}.`);
    else if (candidates.length > 0) setMessage(`${formatSudokuCell(index)} có thể thử: ${candidates.join(', ')}.`);
    else setMessage(`${formatSudokuCell(index)} đang bị kẹt do có lỗi ở hàng/cột/ô 3x3.`);
  }
  function inputValue(value: number) {
    if (selected === null) {
      setMessage('Hãy chọn một ô trống trước.');
      return;
    }
    if (game.fixed[selected]) {
      setMessage('Ô này là số cố định của đề bài, không thể sửa.');
      return;
    }
    setBoard((prev) => {
      const next = cloneSudokuBoard(prev);
      next[selected] = value;
      return next;
    });
    setHintCell(null);
    if (game.solution[selected] !== value) {
      setMistakes((prev) => prev + 1);
      setMessage(`Sai rồi. ${formatSudokuCell(selected)} không phải số ${value}.`);
    } else setMessage(`Đúng. ${formatSudokuCell(selected)} là số ${value}.`);
  }
  function eraseSelected() {
    if (selected === null) {
      setMessage('Hãy chọn ô cần xóa.');
      return;
    }
    if (game.fixed[selected]) {
      setMessage('Không thể xóa ô cố định của đề bài.');
      return;
    }
    setBoard((prev) => {
      const next = cloneSudokuBoard(prev);
      next[selected] = EMPTY;
      return next;
    });
    setHintCell(null);
    setMessage(`Đã xóa ${formatSudokuCell(selected)}.`);
  }
  function findInputCell() {
    const openCells = numRange(SUDOKU_CELL_COUNT)
      .filter((index) => board[index] === EMPTY)
      .map((index) => ({ index, candidates: getSudokuCandidates(board, index) }))
      .filter((item) => item.candidates.length > 0)
      .sort((a, b) => a.candidates.length - b.candidates.length);
    if (openCells.length === 0) {
      setMessage('Không tìm thấy ô hợp lệ. Hãy kiểm tra lại các số đang nhập.');
      return;
    }
    const best = openCells[0];
    setSelected(best.index);
    setHintCell(best.index);
    setMessage(`AI đề xuất nhập ${formatSudokuCell(best.index)}. Ứng viên: ${best.candidates.join(', ')}.`);
  }
  function aiFillOneCell() {
    const openCells = numRange(SUDOKU_CELL_COUNT)
      .filter((index) => board[index] === EMPTY)
      .map((index) => ({ index, candidates: getSudokuCandidates(board, index) }))
      .filter((item) => item.candidates.length > 0)
      .sort((a, b) => a.candidates.length - b.candidates.length);
    if (openCells.length === 0) {
      setMessage('AI chưa tìm được nước đi vì bảng hiện tại có lỗi hoặc đã hoàn thành.');
      return;
    }
    const target = openCells[0].index;
    const value = game.solution[target];
    setBoard((prev) => {
      const next = cloneSudokuBoard(prev);
      next[target] = value;
      return next;
    });
    setSelected(target);
    setHintCell(target);
    setAiUsed((prev) => prev + 1);
    setMessage(`AI đã điền ${value} vào ${formatSudokuCell(target)}.`);
  }
  function checkMistakes() {
    const wrong = numRange(SUDOKU_CELL_COUNT).filter((index) => board[index] !== EMPTY && board[index] !== game.solution[index]);
    if (wrong.length === 0 && conflictCells.size === 0) {
      setMessage('Hiện tại chưa phát hiện lỗi. Tiếp tục điền các ô còn lại.');
      return;
    }
    setSelected(wrong[0] ?? Array.from(conflictCells)[0]);
    setMessage(`Có ${wrong.length || conflictCells.size} ô cần kiểm tra lại. AI đã chọn một ô lỗi cho bạn.`);
  }

  return (
    <>
      <View style={[styles.statusCard, { backgroundColor: theme.card, borderColor: theme.border }, shadow(theme)]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.kicker, { color: theme.primary }]}>SUDOKU AI TRAINER</Text>
          <Text style={[styles.mainTitle, { color: theme.heading, fontFamily: fontFamily(theme) }]}>Sudoku nhiều màn có AI hỗ trợ</Text>
          <Text style={[styles.desc, { color: theme.text }]}>Càng lên màn cao, số ô trống càng tăng. AI có thể tìm ô nên nhập, gợi ý ứng viên, kiểm tra lỗi và điền một ô chính xác.</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: theme.background, borderColor: theme.border }]}> 
          <Text style={[styles.statusLabel, { color: theme.muted }]}>MÀN HIỆN TẠI</Text>
          <Text style={[styles.statusText, { color: theme.primary }]}>{level}/{MAX_SUDOKU_LEVEL}</Text>
          <Text style={[styles.statusSmall, { color: theme.muted }]}>{difficultyName}</Text>
        </View>
      </View>

      <View style={styles.statGrid4}>
        <MiniStat label="Ô cần điền" value={emptyLeft} color={theme.primary} theme={theme} />
        <MiniStat label="Lỗi nhập" value={mistakes} color="#D24A3A" theme={theme} />
        <MiniStat label="AI đã dùng" value={aiUsed} color="#C9861A" theme={theme} />
        <MiniStat label="Đã qua" value={completedLevels} color="#14A46C" theme={theme} />
      </View>

      <View style={[styles.sudokuBoard, { backgroundColor: theme.card, borderColor: theme.border }, shadow(theme)]}>
        {board.map((value, index) => {
          const row = sudokuRow(index);
          const col = sudokuCol(index);
          const isSelected = selected === index;
          const isPeer = selectedPeers.has(index);
          const isFixed = game.fixed[index];
          const isWrong = value !== EMPTY && value !== game.solution[index];
          const isConflict = conflictCells.has(index);
          const isHint = hintCell === index;
          const candidates = showCandidates && value === EMPTY ? getSudokuCandidates(board, index) : [];
          return (
            <Pressable
              key={`sudoku-${index}`}
              onPress={() => handleSelect(index)}
              style={[
                styles.sudokuCell,
                { borderColor: theme.border, backgroundColor: theme.background },
                col === 2 || col === 5 ? styles.sudokuRightBorder : null,
                row === 2 || row === 5 ? styles.sudokuBottomBorder : null,
                isSelected ? { backgroundColor: `${theme.primary}33`, borderColor: theme.primary } : null,
                isHint ? { backgroundColor: '#FFE8A3', borderColor: '#C9861A' } : null,
                !isSelected && isPeer ? { backgroundColor: `${theme.primary}12` } : null,
              ]}
            >
              {value !== EMPTY ? (
                <Text style={[styles.sudokuValue, { color: isWrong || isConflict ? '#D24A3A' : isFixed ? theme.heading : theme.primary }]}>{value}</Text>
              ) : candidates.length > 0 ? (
                <Text style={[styles.sudokuCandidates, { color: theme.muted }]}>{candidates.join('')}</Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.panel, { backgroundColor: theme.card, borderColor: theme.border }, shadow(theme)]}>
        <Text style={[styles.desc, { color: theme.text }]}>{message}</Text>
        <View style={styles.numberPad}>
          {SUDOKU_DIGITS.map((value) => (
            <Pressable key={value} onPress={() => inputValue(value)} style={[styles.numBtn, { backgroundColor: selectedValue === value ? theme.primary : theme.background, borderColor: selectedValue === value ? theme.primary : theme.border }]}> 
              <Text style={[styles.numText, { color: selectedValue === value ? theme.background : theme.heading }]}>{value}</Text>
            </Pressable>
          ))}
          <Pressable onPress={eraseSelected} style={[styles.numBtn, styles.eraseBtn, { backgroundColor: '#D24A3A22', borderColor: '#D24A3A55' }]}> 
            <Text style={[styles.numText, { color: '#D24A3A' }]}>Xóa</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.panel, { backgroundColor: theme.card, borderColor: theme.border }, shadow(theme)]}>
        <Text style={[styles.panelTitle, { color: theme.heading }]}>AI hỗ trợ</Text>
        <View style={styles.actionGrid}>
          <Pressable onPress={findInputCell} style={[styles.actionBtn, { backgroundColor: theme.primary }]}> 
            <Feather name="search" size={17} color={theme.background} />
            <Text style={[styles.actionText, { color: theme.background }]}>Tìm ô</Text>
          </Pressable>
          <Pressable onPress={aiFillOneCell} style={[styles.actionBtn, { backgroundColor: '#F3C15D' }]}> 
            <Feather name="zap" size={17} color="#2B1C07" />
            <Text style={[styles.actionText, { color: '#2B1C07' }]}>AI điền 1 ô</Text>
          </Pressable>
          <Pressable onPress={checkMistakes} style={[styles.actionBtn, { backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1 }]}> 
            <Feather name="check-circle" size={17} color={theme.primary} />
            <Text style={[styles.actionText, { color: theme.primary }]}>Kiểm tra</Text>
          </Pressable>
          <Pressable onPress={() => setShowCandidates((prev) => !prev)} style={[styles.actionBtn, { backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1 }]}> 
            <Feather name={showCandidates ? 'eye-off' : 'eye'} size={17} color={theme.primary} />
            <Text style={[styles.actionText, { color: theme.primary }]}>{showCandidates ? 'Ẩn ứng viên' : 'Hiện ứng viên'}</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.panel, { backgroundColor: theme.card, borderColor: theme.border }, shadow(theme)]}>
        <Text style={[styles.panelTitle, { color: theme.heading }]}>Màn chơi</Text>
        <View style={styles.levelGrid}>
          {numRange(MAX_SUDOKU_LEVEL).map((item) => {
            const value = item + 1;
            const active = value === level;
            return (
              <Pressable key={value} onPress={() => startLevel(value)} style={[styles.levelBtn, { backgroundColor: active ? theme.primary : value <= completedLevels ? '#14A46C22' : theme.background, borderColor: active ? theme.primary : theme.border }]}> 
                <Text style={[styles.levelText, { color: active ? theme.background : value <= completedLevels ? '#14A46C' : theme.heading }]}>{value}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.actionGrid}>
          <Pressable onPress={restartCurrentLevel} style={[styles.actionBtn, { backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1 }]}> 
            <Feather name="rotate-ccw" size={17} color={theme.primary} />
            <Text style={[styles.actionText, { color: theme.primary }]}>Chơi lại</Text>
          </Pressable>
          <Pressable onPress={() => startLevel(level === MAX_SUDOKU_LEVEL ? 1 : level + 1)} style={[styles.actionBtn, { backgroundColor: '#14A46C' }]}> 
            <Feather name="award" size={17} color="#fff" />
            <Text style={[styles.actionText, { color: '#fff' }]}>Màn tiếp</Text>
          </Pressable>
        </View>
      </View>
    </>
  );
}

function MiniStat({ label, value, color, theme }: { label: string; value: number | string; color: string; theme: any }) {
  return (
    <View style={[styles.miniStat, { backgroundColor: theme.card, borderColor: theme.border }, shadow(theme)]}>
      <Text style={[styles.miniStatLabel, { color: theme.muted }]}>{label}</Text>
      <Text style={[styles.miniStatValue, { color }]}>{value}</Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Monster Dodge Runner                                                        */
/* -------------------------------------------------------------------------- */

const RUNNER_VIEW_W = 360;
const RUNNER_VIEW_H = 230;
const RUNNER_WORLD_LENGTH = 7600;
const RUNNER_LANES = [62, 122, 182];
const PLAYER_X_ON_SCREEN = 58;

type RunnerLevel = { id: number; name: string; speed: number; hazards: number; monsters: number; ufos: number };
const RUNNER_LEVELS: RunnerLevel[] = [
  { id: 1, name: 'Khởi động', speed: 3.2, hazards: 28, monsters: 6, ufos: 5 },
  { id: 2, name: 'Chảo lửa', speed: 3.7, hazards: 36, monsters: 9, ufos: 8 },
  { id: 3, name: 'Rừng quái', speed: 4.1, hazards: 44, monsters: 13, ufos: 11 },
  { id: 4, name: 'Vùng hỗn loạn', speed: 4.6, hazards: 54, monsters: 17, ufos: 15 },
  { id: 5, name: 'Cực khó', speed: 5.1, hazards: 66, monsters: 22, ufos: 20 },
];

type RunnerHazard = { type: 'spike' | 'fire' | 'rock'; x: number; laneIndex: number };
type RunnerMonster = { x: number; minX: number; maxX: number; dir: number; speed: number; laneIndex: number };
type RunnerUfo = { x: number; baseY: number; speed: number; phase: number; amp: number };
type RunnerCoin = { x: number; laneIndex: number; taken: boolean };

type RunnerState = {
  running: boolean;
  levelIndex: number;
  playerX: number;
  laneIndex: number;
  jump: number;
  jumpVel: number;
  invincible: number;
  hp: number;
  score: number;
  distance: number;
  coins: number;
  time: number;
  win: boolean;
  gameOver: boolean;
  hazards: RunnerHazard[];
  monsters: RunnerMonster[];
  ufos: RunnerUfo[];
  coinList: RunnerCoin[];
};

function runnerClamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
function seededRand(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}
function makeRunnerWorld(level: RunnerLevel) {
  const hazards: RunnerHazard[] = [];
  const monsters: RunnerMonster[] = [];
  const ufos: RunnerUfo[] = [];
  const coinList: RunnerCoin[] = [];
  let cursor = 520;
  for (let i = 0; i < level.hazards; i += 1) {
    cursor += 135 + Math.floor(seededRand(i * 17 + level.id * 91) * 155);
    const typeRoll = seededRand(i * 31 + level.id * 19);
    const laneIndex = Math.floor(seededRand(i * 41 + level.id * 7) * RUNNER_LANES.length);
    hazards.push({ type: typeRoll < 0.38 ? 'spike' : typeRoll < 0.7 ? 'fire' : 'rock', x: cursor, laneIndex });
    if (cursor < RUNNER_WORLD_LENGTH - 600 && i % 3 === 0) coinList.push({ x: cursor + 85, laneIndex, taken: false });
  }
  for (let i = 0; i < level.monsters; i += 1) {
    const base = 760 + i * Math.floor((RUNNER_WORLD_LENGTH - 1400) / Math.max(1, level.monsters));
    const x = base + Math.floor(seededRand(i * 67 + level.id * 23) * 170);
    monsters.push({
      x,
      minX: x - 90,
      maxX: x + 110,
      dir: seededRand(i + 999) > 0.5 ? 1 : -1,
      speed: 1.1 + seededRand(i * 8 + level.id) * 1.15,
      laneIndex: Math.floor(seededRand(i * 13 + level.id * 97) * RUNNER_LANES.length),
    });
  }
  for (let i = 0; i < level.ufos; i += 1) {
    ufos.push({
      x: 900 + i * Math.floor((RUNNER_WORLD_LENGTH - 1600) / Math.max(1, level.ufos)) + Math.floor(seededRand(i * 101 + level.id) * 130),
      baseY: 34 + Math.floor(seededRand(i * 29 + level.id * 11) * 70),
      speed: 1.4 + seededRand(i * 73 + level.id) * 1.2,
      phase: seededRand(i * 49 + level.id) * Math.PI * 2,
      amp: 18 + seededRand(i * 5 + level.id) * 25,
    });
  }
  return { hazards, monsters, ufos, coinList };
}
function getRunnerInitialState(levelIndex = 0): RunnerState {
  const world = makeRunnerWorld(RUNNER_LEVELS[levelIndex]);
  return {
    running: false,
    levelIndex,
    playerX: 80,
    laneIndex: 2,
    jump: 0,
    jumpVel: 0,
    invincible: 0,
    hp: 3,
    score: 0,
    distance: 0,
    coins: 0,
    time: 0,
    win: false,
    gameOver: false,
    ...world,
  };
}
function screenX(worldX: number, playerX: number) {
  const camera = runnerClamp(playerX - PLAYER_X_ON_SCREEN, 0, RUNNER_WORLD_LENGTH - RUNNER_VIEW_W);
  return worldX - camera;
}
function RunnerGame({ theme, user }: { theme: any; user: any }) {
  const [state, setState] = useState<RunnerState>(() => getRunnerInitialState(0));
  const inputRef = useRef({ left: false, right: false });
  const savedRef = useRef(false);

  const level = RUNNER_LEVELS[state.levelIndex];
  const statusText = state.win ? 'Vượt màn thành công' : state.gameOver ? 'Thua cuộc' : state.running ? 'Đang chạy' : 'Sẵn sàng';

  useEffect(() => {
    if (!(state.win || state.gameOver) || savedRef.current) return;
    savedRef.current = true;
    if (user?.id) {
      api.saveGameHistory({
        userId: user.id,
        game: 'monster-dodge-runner',
        score: state.score,
        coins: state.coins,
        result: state.win ? 'win' : 'lose',
        level: level.name,
      }).catch(() => null);
    }
  }, [state.win, state.gameOver]);

  useEffect(() => {
    const timer = setInterval(() => {
      setState((prev) => {
        if (!prev.running || prev.win || prev.gameOver) return { ...prev, time: prev.time + 1 };
        const currentLevel = RUNNER_LEVELS[prev.levelIndex];
        let next = { ...prev, time: prev.time + 1 };
        const manualX = (inputRef.current.right ? 2.35 : 0) - (inputRef.current.left ? 3.2 : 0);
        next.playerX = runnerClamp(next.playerX + currentLevel.speed + manualX, 30, RUNNER_WORLD_LENGTH + 20);
        if (next.jump > 0 || next.jumpVel > 0) {
          next.jump += next.jumpVel;
          next.jumpVel -= 0.86;
          if (next.jump < 0) {
            next.jump = 0;
            next.jumpVel = 0;
          }
        }
        if (next.invincible > 0) next.invincible -= 1;
        next.monsters = next.monsters.map((m) => {
          let x = m.x + m.dir * m.speed;
          let dir = m.dir;
          if (x < m.minX || x > m.maxX) dir *= -1;
          return { ...m, x, dir };
        });
        next.ufos = next.ufos.map((u) => {
          let x = u.x - u.speed;
          if (x < next.playerX - 500) x += 1600 + seededRand(u.x + next.time) * 1000;
          return { ...u, x };
        });
        let hit = false;
        for (const hazard of next.hazards) {
          const close = Math.abs(hazard.x - next.playerX) < 32;
          if (!close) continue;
          if (hazard.laneIndex === next.laneIndex && (hazard.type === 'rock' || next.jump < 22)) hit = true;
        }
        for (const monster of next.monsters) {
          if (monster.laneIndex === next.laneIndex && Math.abs(monster.x - next.playerX) < 34 && next.jump < 18) hit = true;
        }
        for (const ufo of next.ufos) {
          const close = Math.abs(ufo.x - next.playerX) < 34;
          const ufoLane = ufo.baseY > 90 ? 1 : 0;
          if (close && Math.abs(ufoLane - next.laneIndex) <= 1 && next.jump > 8) hit = true;
        }
        if (hit && next.invincible <= 0) {
          next.hp -= 1;
          next.invincible = 35;
          next.playerX = Math.max(60, next.playerX - 90);
          if (next.hp <= 0) {
            next.hp = 0;
            next.running = false;
            next.gameOver = true;
          }
        }
        next.coinList = next.coinList.map((coin) => {
          if (!coin.taken && coin.laneIndex === next.laneIndex && Math.abs(coin.x - next.playerX) < 35) {
            next.coins += 1;
            next.score += 150;
            return { ...coin, taken: true };
          }
          return coin;
        });
        next.distance = runnerClamp(Math.floor((next.playerX / RUNNER_WORLD_LENGTH) * 100), 0, 100);
        next.score += Math.max(0, Math.floor(currentLevel.speed + manualX));
        if (next.playerX >= RUNNER_WORLD_LENGTH) {
          next.running = false;
          next.win = true;
          next.score += 5000 + next.hp * 1000;
        }
        return next;
      });
    }, 50);
    return () => clearInterval(timer);
  }, []);

  function reset(levelIndex = state.levelIndex) {
    savedRef.current = false;
    setState(getRunnerInitialState(levelIndex));
  }
  function start() {
    if (state.gameOver || state.win) reset(state.levelIndex);
    setTimeout(() => setState((prev) => ({ ...prev, running: true })), 0);
  }
  function moveLane(delta: number) {
    setState((prev) => ({ ...prev, laneIndex: runnerClamp(prev.laneIndex + delta, 0, RUNNER_LANES.length - 1) }));
  }
  function jump() {
    setState((prev) => (prev.jump <= 1 ? { ...prev, jumpVel: 14.2 } : prev));
  }

  return (
    <>
      <View style={[styles.statusCard, { backgroundColor: theme.card, borderColor: theme.border }, shadow(theme)]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.kicker, { color: theme.primary }]}>MONSTER DODGE RUNNER</Text>
          <Text style={[styles.mainTitle, { color: theme.heading, fontFamily: fontFamily(theme) }]}>Di chuyển né quái vật</Text>
          <Text style={[styles.desc, { color: theme.text }]}>Nhân vật tự tiến về bên phải. Bạn đổi làn, lùi/tiến và nhảy để vượt gai, chảo lửa, quái vật và UFO.</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: theme.background, borderColor: theme.border }]}> 
          <Text style={[styles.statusLabel, { color: theme.muted }]}>TRẠNG THÁI</Text>
          <Text style={[styles.statusText, { color: theme.primary }]}>{statusText}</Text>
        </View>
      </View>

      <View style={styles.statGrid4}>
        <MiniStat label="Máu" value={state.hp} color="#D24A3A" theme={theme} />
        <MiniStat label="Điểm" value={state.score} color="#C9861A" theme={theme} />
        <MiniStat label="Tiến độ" value={`${state.distance}%`} color={theme.primary} theme={theme} />
        <MiniStat label="Sao" value={state.coins} color="#14A46C" theme={theme} />
      </View>

      <View style={[styles.runnerStage, { backgroundColor: '#07111f', borderColor: theme.border }, shadow(theme)]}>
        {[0, 1, 2].map((lane) => (
          <View key={lane} style={[styles.runnerLane, { top: RUNNER_LANES[lane] + 24 }]} />
        ))}
        {state.hazards.map((hazard, index) => {
          const x = screenX(hazard.x, state.playerX);
          if (x < -70 || x > RUNNER_VIEW_W + 70) return null;
          const y = RUNNER_LANES[hazard.laneIndex];
          return <Text key={`h-${index}`} style={[styles.runnerEntity, { left: x, top: y, fontSize: 25 }]}>{hazard.type === 'spike' ? '▲' : hazard.type === 'fire' ? '🔥' : '🪨'}</Text>;
        })}
        {state.coinList.map((coin, index) => {
          if (coin.taken) return null;
          const x = screenX(coin.x, state.playerX);
          if (x < -60 || x > RUNNER_VIEW_W + 60) return null;
          return <Text key={`c-${index}`} style={[styles.runnerEntity, { left: x, top: RUNNER_LANES[coin.laneIndex] - 24, fontSize: 19 }]}>⭐</Text>;
        })}
        {state.monsters.map((monster, index) => {
          const x = screenX(monster.x, state.playerX);
          if (x < -70 || x > RUNNER_VIEW_W + 70) return null;
          return <Text key={`m-${index}`} style={[styles.runnerEntity, { left: x, top: RUNNER_LANES[monster.laneIndex] - 8, fontSize: 28 }]}>👾</Text>;
        })}
        {state.ufos.map((ufo, index) => {
          const x = screenX(ufo.x, state.playerX);
          if (x < -80 || x > RUNNER_VIEW_W + 80) return null;
          const y = ufo.baseY + Math.sin(state.time * 0.035 + ufo.phase) * ufo.amp;
          return <Text key={`u-${index}`} style={[styles.runnerEntity, { left: x, top: y, fontSize: 25 }]}>🛸</Text>;
        })}
        <Text style={[styles.runnerEntity, { left: PLAYER_X_ON_SCREEN, top: RUNNER_LANES[state.laneIndex] - state.jump, fontSize: 30, opacity: state.invincible > 0 && state.time % 4 < 2 ? 0.35 : 1 }]}>🧍</Text>
        <Text style={[styles.runnerFinish, { left: screenX(RUNNER_WORLD_LENGTH, state.playerX) }]}>🏁</Text>
        {!state.running ? (
          <View style={styles.runnerOverlay}>
            <Text style={styles.runnerOverlayTitle}>{state.win ? 'VƯỢT MÀN!' : state.gameOver ? 'BẠN ĐÃ BỊ HẠ!' : 'SẴN SÀNG CHẠY'}</Text>
            <Text style={styles.runnerOverlayDesc}>Dùng nút điều khiển bên dưới để né bẫy và về đích.</Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.panel, { backgroundColor: theme.card, borderColor: theme.border }, shadow(theme)]}>
        <Text style={[styles.panelTitle, { color: theme.heading }]}>Điều khiển</Text>
        <View style={styles.actionGrid}>
          <Pressable onPress={start} style={[styles.actionBtn, { backgroundColor: '#14A46C' }]}> 
            <Feather name="play" size={17} color="#fff" />
            <Text style={[styles.actionText, { color: '#fff' }]}>Bắt đầu / tiếp tục</Text>
          </Pressable>
          <Pressable onPress={() => reset()} style={[styles.actionBtn, { backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1 }]}> 
            <Feather name="rotate-ccw" size={17} color={theme.primary} />
            <Text style={[styles.actionText, { color: theme.primary }]}>Chơi lại</Text>
          </Pressable>
        </View>
        <View style={styles.runnerControls}>
          <Pressable onPress={() => moveLane(-1)} style={[styles.runnerControlBtn, { borderColor: theme.border, backgroundColor: theme.background }]}><Text style={[styles.runnerControlText, { color: theme.heading }]}>↑</Text></Pressable>
          <View style={styles.runnerControlMiddle}>
            <Pressable onPressIn={() => { inputRef.current.left = true; }} onPressOut={() => { inputRef.current.left = false; }} style={[styles.runnerControlBtn, { borderColor: theme.border, backgroundColor: theme.background }]}><Text style={[styles.runnerControlText, { color: theme.heading }]}>←</Text></Pressable>
            <Pressable onPress={jump} style={[styles.runnerJumpBtn]}><Text style={[styles.runnerControlText, { color: '#2B1C07' }]}>NHẢY</Text></Pressable>
            <Pressable onPressIn={() => { inputRef.current.right = true; }} onPressOut={() => { inputRef.current.right = false; }} style={[styles.runnerControlBtn, { borderColor: theme.border, backgroundColor: theme.background }]}><Text style={[styles.runnerControlText, { color: theme.heading }]}>→</Text></Pressable>
          </View>
          <Pressable onPress={() => moveLane(1)} style={[styles.runnerControlBtn, { borderColor: theme.border, backgroundColor: theme.background }]}><Text style={[styles.runnerControlText, { color: theme.heading }]}>↓</Text></Pressable>
        </View>
      </View>

      <View style={[styles.panel, { backgroundColor: theme.card, borderColor: theme.border }, shadow(theme)]}>
        <Text style={[styles.panelTitle, { color: theme.heading }]}>Màn chơi</Text>
        {RUNNER_LEVELS.map((item, index) => {
          const active = state.levelIndex === index;
          return (
            <Pressable key={item.id} onPress={() => reset(index)} style={[styles.runnerLevelBtn, { backgroundColor: active ? theme.primary : theme.background, borderColor: active ? theme.primary : theme.border }]}> 
              <View style={{ flex: 1 }}>
                <Text style={[styles.runnerLevelTitle, { color: active ? theme.background : theme.heading }]}>Màn {item.id}: {item.name}</Text>
                <Text style={[styles.gameDesc, { color: active ? theme.background : theme.muted }]}>Bẫy {item.hazards} · Quái {item.monsters} · UFO {item.ufos}</Text>
              </View>
              <Text style={[styles.runnerLevelSpeed, { color: active ? theme.background : theme.primary }]}>x{item.speed.toFixed(1)}</Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}


/* -------------------------------------------------------------------------- */
/* Trú mưa - mobile native                                                     */
/* -------------------------------------------------------------------------- */

const RAIN_STAGE_H = 430;
const RAIN_PLAYER = 32;
const RAIN_GOAL = 100;
const RAIN_LEVELS = [
  { id: 1, name: 'Mưa nhẹ', rainGap: 210, pedestrianGap: 58, shelterGap: 92, speed: 1.4 },
  { id: 2, name: 'Phố đông', rainGap: 175, pedestrianGap: 45, shelterGap: 102, speed: 1.75 },
  { id: 3, name: 'Mưa lớn', rainGap: 145, pedestrianGap: 38, shelterGap: 112, speed: 2.05 },
  { id: 4, name: 'Bão đêm', rainGap: 118, pedestrianGap: 31, shelterGap: 126, speed: 2.35 },
];

type RainEntity = { id: number; x: number; y: number; w: number; h: number; dir: number; speed: number; emoji: string };
type RainShelter = { id: number; x: number; y: number; w: number; h: number; label: string };
type RainState = {
  running: boolean;
  win: boolean;
  gameOver: boolean;
  levelIndex: number;
  playerX: number;
  playerY: number;
  wetness: number;
  health: number;
  distance: number;
  score: number;
  raining: boolean;
  rainTimer: number;
  nextRain: number;
  invincible: number;
  safeTimer: number;
  tick: number;
  lastPedestrian: number;
  lastShelter: number;
  nextId: number;
  entities: RainEntity[];
  shelters: RainShelter[];
};

function rainClamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function rainRectHit(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function makeRainInitialState(stageW: number, levelIndex = 0): RainState {
  const roadLeft = Math.round(stageW * 0.14);
  const roadWidth = Math.round(stageW * 0.72);
  return {
    running: false,
    win: false,
    gameOver: false,
    levelIndex,
    playerX: roadLeft + roadWidth / 2 - RAIN_PLAYER / 2,
    playerY: RAIN_STAGE_H - 92,
    wetness: 0,
    health: 100,
    distance: 0,
    score: 0,
    raining: false,
    rainTimer: 0,
    nextRain: 80,
    invincible: 0,
    safeTimer: 0,
    tick: 0,
    lastPedestrian: 0,
    lastShelter: 0,
    nextId: 1,
    entities: [],
    shelters: [
      { id: 0, x: roadLeft + 10, y: 125, w: 92, h: 48, label: 'Mái hiên' },
    ],
  };
}

function RainShelterGame({ theme, user, onTouchActiveChange }: { theme: any; user: any; onTouchActiveChange?: (active: boolean) => void }) {
  const { width } = useWindowDimensions();
  const stageW = Math.min(370, Math.max(304, width - 32));
  const roadLeft = Math.round(stageW * 0.14);
  const roadWidth = Math.round(stageW * 0.72);
  const [state, setState] = useState<RainState>(() => makeRainInitialState(stageW, 0));
  const savedRef = useRef(false);

  const movePlayerByTouch = (event: any) => {
    const x = Number(event?.nativeEvent?.locationX ?? event?.nativeEvent?.pageX ?? 0);
    const y = Number(event?.nativeEvent?.locationY ?? event?.nativeEvent?.pageY ?? 0);

    setState((prev) => {
      const next = prev.win || prev.gameOver ? makeRainInitialState(stageW, prev.levelIndex) : prev;

      return {
        ...next,
        running: true,
        playerX: rainClamp(x - RAIN_PLAYER / 2, roadLeft + 4, roadLeft + roadWidth - RAIN_PLAYER - 4),
        playerY: rainClamp(y - RAIN_PLAYER / 2, 70, RAIN_STAGE_H - RAIN_PLAYER - 24),
      };
    });
  };

  const rainPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onShouldBlockNativeResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => {
          onTouchActiveChange?.(true);
          movePlayerByTouch(event);
        },
        onPanResponderMove: (event) => {
          movePlayerByTouch(event);
        },
        onPanResponderRelease: () => {
          onTouchActiveChange?.(false);
        },
        onPanResponderTerminate: () => {
          onTouchActiveChange?.(false);
        },
      }),
    [stageW, roadLeft, roadWidth, onTouchActiveChange],
  );

  const level = RAIN_LEVELS[state.levelIndex];
  const playerRect = { x: state.playerX, y: state.playerY, w: RAIN_PLAYER, h: RAIN_PLAYER };
  const underShelter = state.shelters.some((item) => rainRectHit(playerRect, item));
  const status = state.win ? 'Đã về nhà an toàn' : state.gameOver ? 'Ướt lạnh quá mức' : state.running ? (state.raining ? 'Đang mưa' : 'Đang di chuyển') : 'Sẵn sàng';

  useEffect(() => {
    setState((prev) => {
      const next = makeRainInitialState(stageW, prev.levelIndex);
      return { ...next, running: prev.running, levelIndex: prev.levelIndex };
    });
  }, [stageW]);

  useEffect(() => {
    if (!(state.win || state.gameOver) || savedRef.current) return;
    savedRef.current = true;
    if (user?.id) {
      api.saveGameHistory({
        userId: user.id,
        game: 'trumua-rain-shelter',
        score: state.score,
        coins: state.win ? 18 : Math.max(0, Math.floor(state.score / 500)),
        result: state.win ? 'win' : 'lose',
        level: level.name,
        wetness: Math.round(state.wetness),
        health: Math.round(state.health),
      }).catch(() => null);
    }
  }, [state.win, state.gameOver]);

  useEffect(() => {
    const timer = setInterval(() => {
      setState((prev) => {
        if (!prev.running || prev.win || prev.gameOver) return { ...prev, tick: prev.tick + 1 };

        const lv = RAIN_LEVELS[prev.levelIndex];
        let next: RainState = {
          ...prev,
          tick: prev.tick + 1,
          entities: prev.entities.map((item) => ({
            ...item,
            y: item.y + lv.speed + 1.35,
            x: item.x + item.dir * item.speed,
          })).filter((item) => item.y < RAIN_STAGE_H + 70),
          shelters: prev.shelters.map((item) => ({ ...item, y: item.y + lv.speed + 1.1 })).filter((item) => item.y < RAIN_STAGE_H + 70),
        };

        next.playerX = rainClamp(next.playerX, roadLeft + 4, roadLeft + roadWidth - RAIN_PLAYER - 4);
        next.playerY = rainClamp(next.playerY, 70, RAIN_STAGE_H - RAIN_PLAYER - 24);

        const progressBoost = next.playerY < RAIN_STAGE_H * 0.38 ? 0.62 : next.playerY < RAIN_STAGE_H * 0.62 ? 0.46 : 0.32;
        next.distance = rainClamp(next.distance + progressBoost + lv.speed * 0.08, 0, RAIN_GOAL);

        if (next.tick - next.lastPedestrian > lv.pedestrianGap) {
          const fromLeft = Math.random() > 0.5;
          const y = -40 - Math.random() * 80;
          next.entities = [
            ...next.entities,
            {
              id: next.nextId,
              x: fromLeft ? roadLeft + 8 : roadLeft + roadWidth - 42,
              y,
              w: 34,
              h: 34,
              dir: fromLeft ? 1 : -1,
              speed: 0.5 + Math.random() * 0.7,
              emoji: Math.random() > 0.5 ? '🚶' : '🏃',
            },
          ];
          next.nextId += 1;
          next.lastPedestrian = next.tick;
        }

        if (next.tick - next.lastShelter > lv.shelterGap) {
          const shelterW = 82 + Math.random() * 38;
          next.shelters = [
            ...next.shelters,
            {
              id: next.nextId,
              x: rainClamp(roadLeft + 6 + Math.random() * (roadWidth - shelterW - 12), roadLeft + 4, roadLeft + roadWidth - shelterW - 4),
              y: -70,
              w: shelterW,
              h: 48,
              label: Math.random() > 0.5 ? 'Mái hiên' : 'Trạm trú',
            },
          ];
          next.nextId += 1;
          next.lastShelter = next.tick;
        }

        if (next.raining) {
          next.rainTimer -= 1;
          if (next.rainTimer <= 0) {
            next.raining = false;
            next.nextRain = lv.rainGap + Math.round(Math.random() * 80);
          }
        } else {
          next.nextRain -= 1;
          if (next.nextRain <= 0) {
            next.raining = true;
            next.rainTimer = 135 + Math.round(Math.random() * 85);
          }
        }

        const currentPlayer = { x: next.playerX, y: next.playerY, w: RAIN_PLAYER, h: RAIN_PLAYER };
        const safe = next.shelters.some((item) => rainRectHit(currentPlayer, item));
        next.safeTimer = safe ? 18 : Math.max(0, next.safeTimer - 1);

        if (next.raining && !safe) next.wetness += 0.68 + prev.levelIndex * 0.08;
        if (safe) next.wetness -= 1.2;
        if (!next.raining && !safe) next.wetness -= 0.44;
        next.wetness = rainClamp(next.wetness, 0, 100);

        if (next.wetness >= 98) {
          next.health -= 0.8 + prev.levelIndex * 0.1;
          next.wetness = 91;
        }

        if (next.invincible > 0) next.invincible -= 1;
        const hitPedestrian = next.entities.some((item) => rainRectHit(currentPlayer, item));
        if (hitPedestrian && next.invincible <= 0) {
          next.health -= 9;
          next.invincible = 28;
          next.playerY = rainClamp(next.playerY + 18, 70, RAIN_STAGE_H - RAIN_PLAYER - 24);
        }

        next.health = rainClamp(next.health, 0, 100);
        next.score = Math.max(0, Math.floor(next.distance * 120 + next.health * 8 - next.wetness * 3));
        if (next.health <= 0) {
          next.running = false;
          next.gameOver = true;
        }
        if (next.distance >= RAIN_GOAL) {
          next.running = false;
          next.win = true;
          next.score += Math.round(next.health * 20);
        }
        return next;
      });
    }, 50);
    return () => clearInterval(timer);
  }, [stageW, roadLeft, roadWidth]);

  function reset(levelIndex = state.levelIndex) {
    savedRef.current = false;
    setState(makeRainInitialState(stageW, levelIndex));
  }

  function start() {
    if (state.win || state.gameOver) reset(state.levelIndex);
    setTimeout(() => setState((prev) => ({ ...prev, running: true })), 0);
  }

  return (
    <>
      <View style={[styles.statusCard, { backgroundColor: theme.card, borderColor: theme.border }, shadow(theme)]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.kicker, { color: theme.primary }]}>TRÚ MƯA MOBILE</Text>
          <Text style={[styles.mainTitle, { color: theme.heading, fontFamily: fontFamily(theme) }]}>Trú mưa</Text>
          <Text style={[styles.desc, { color: theme.text }]}>Đi qua phố, né người đi đường và đứng dưới mái hiên khi trời mưa. Kéo trực tiếp nhân vật bằng tay trên màn chơi, không dùng nút điều hướng.</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <Text style={[styles.statusLabel, { color: theme.muted }]}>TRẠNG THÁI</Text>
          <Text style={[styles.statusText, { color: theme.primary }]}>{status}</Text>
          <Text style={[styles.statusSmall, { color: theme.muted }]}>{level.name}</Text>
        </View>
      </View>

      <View style={styles.statGrid4}>
        <MiniStat label="Sức khỏe" value={Math.round(state.health)} color="#14A46C" theme={theme} />
        <MiniStat label="Độ ướt" value={`${Math.round(state.wetness)}%`} color="#2F80ED" theme={theme} />
        <MiniStat label="Quãng đường" value={`${Math.round(state.distance)}%`} color={theme.primary} theme={theme} />
        <MiniStat label="Điểm" value={state.score} color="#C9861A" theme={theme} />
      </View>

      <View
        {...rainPanResponder.panHandlers}
        style={[styles.rainStage, { width: stageW, backgroundColor: state.raining ? '#132238' : '#1E293B', borderColor: theme.border }, shadow(theme)]}
      >
        <View style={[styles.rainRoad, { left: roadLeft, width: roadWidth }]} />
        <View style={[styles.rainRoadLine, { left: stageW / 2 - 1 }]} />
        {state.raining ? Array.from({ length: 32 }).map((_, index) => (
          <View
            key={`rain-${index}`}
            style={[
              styles.rainDrop,
              {
                left: (index * 47 + state.tick * 5) % stageW,
                top: (index * 31 + state.tick * 10) % RAIN_STAGE_H,
              },
            ]}
          />
        )) : null}
        {state.shelters.map((item) => (
          <View key={`s-${item.id}`} style={[styles.rainShelter, { left: item.x, top: item.y, width: item.w, height: item.h }]}>
            <Text style={styles.rainShelterIcon}>🏠</Text>
            <Text style={styles.rainShelterText}>{item.label}</Text>
          </View>
        ))}
        {state.entities.map((item) => (
          <Text key={`e-${item.id}`} style={[styles.rainEntity, { left: item.x, top: item.y, transform: [{ scaleX: item.dir > 0 ? 1 : -1 }] }]}>{item.emoji}</Text>
        ))}
        <Text style={[styles.rainPlayer, { left: state.playerX, top: state.playerY, opacity: state.invincible > 0 && state.tick % 4 < 2 ? 0.35 : 1 }]}>🧍</Text>
        <View style={[styles.rainProgress, { borderColor: 'rgba(255,255,255,0.35)' }]}>
          <View style={[styles.rainProgressFill, { width: `${state.distance}%` }]} />
        </View>
        <View style={[styles.rainBadge, { backgroundColor: underShelter ? '#16A34A' : state.raining ? '#2563EB' : '#334155' }]}>
          <Text style={styles.rainBadgeText}>{underShelter ? 'ĐANG TRÚ' : state.raining ? 'MƯA' : 'KHÔ RÁO'}</Text>
        </View>
        {!state.running ? (
          <View style={[styles.runnerOverlay, { pointerEvents: 'none' }]}>
            <Text style={styles.runnerOverlayTitle}>{state.win ? 'VỀ NHÀ AN TOÀN!' : state.gameOver ? 'BẠN ĐÃ ƯỚT LẠNH!' : 'SẴN SÀNG TRÚ MƯA'}</Text>
            <Text style={styles.runnerOverlayDesc}>Bấm bắt đầu hoặc chạm vào màn chơi, rồi kéo nhân vật bằng tay để né người đi đường và trú dưới mái hiên.</Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.panel, { backgroundColor: theme.card, borderColor: theme.border }, shadow(theme)]}>
        <Text style={[styles.panelTitle, { color: theme.heading }]}>Điều khiển cảm ứng</Text>
        <View style={styles.actionGrid}>
          <Pressable onPress={start} style={[styles.actionBtn, { backgroundColor: '#14A46C' }]}>
            <Feather name="play" size={17} color="#fff" />
            <Text style={[styles.actionText, { color: '#fff' }]}>Bắt đầu / tiếp tục</Text>
          </Pressable>
          <Pressable onPress={() => reset()} style={[styles.actionBtn, { backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1 }]}>
            <Feather name="rotate-ccw" size={17} color={theme.primary} />
            <Text style={[styles.actionText, { color: theme.primary }]}>Chơi lại</Text>
          </Pressable>
        </View>
        <View style={[styles.rainTouchHelp, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <Feather name="move" size={18} color={theme.primary} />
          <Text style={[styles.rainTouchHelpText, { color: theme.text }]}>Chạm và kéo trực tiếp trên màn chơi để di chuyển nhân vật lên, xuống, trái, phải. Kéo vào mái hiên khi trời mưa để giảm độ ướt.</Text>
        </View>
      </View>

      <View style={[styles.panel, { backgroundColor: theme.card, borderColor: theme.border }, shadow(theme)]}>
        <Text style={[styles.panelTitle, { color: theme.heading }]}>Màn chơi</Text>
        {RAIN_LEVELS.map((item, index) => {
          const active = state.levelIndex === index;
          return (
            <Pressable key={item.id} onPress={() => reset(index)} style={[styles.runnerLevelBtn, { backgroundColor: active ? theme.primary : theme.background, borderColor: active ? theme.primary : theme.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.runnerLevelTitle, { color: active ? theme.background : theme.heading }]}>Màn {item.id}: {item.name}</Text>
                <Text style={[styles.gameDesc, { color: active ? theme.background : theme.muted }]}>Mưa {item.rainGap} · Người đi đường {item.pedestrianGap} · Mái trú {item.shelterGap}</Text>
              </View>
              <Text style={[styles.runnerLevelSpeed, { color: active ? theme.background : theme.primary }]}>x{item.speed.toFixed(1)}</Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}


/* -------------------------------------------------------------------------- */
/* Main screen                                                                 */
/* -------------------------------------------------------------------------- */

export default function EntertainmentScreen() {
  const { theme, user } = useApp();
  const [selectedGame, setSelectedGame] = useState<EntertainmentGame>('caro');
  const [rainTouchActive, setRainTouchActive] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Header title="Giải trí" subtitle="Khu trò chơi trong JAPANO: Caro AI, Sudoku AI, né quái vật và Trú mưa." />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
        scrollEnabled={selectedGame !== 'trumua' || !rainTouchActive}
      >
        <GamePicker selectedGame={selectedGame} setSelectedGame={setSelectedGame} theme={theme} />
        {selectedGame === 'caro' ? <CaroGame theme={theme} user={user} /> : null}
        {selectedGame === 'sudoku' ? <SudokuGame theme={theme} user={user} /> : null}
        {selectedGame === 'runner' ? <RunnerGame theme={theme} user={user} /> : null}
        {selectedGame === 'trumua' ? <RainShelterGame theme={theme} user={user} onTouchActiveChange={setRainTouchActive} /> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 120, gap: 14 },
  gamePicker: { borderWidth: 1, borderRadius: 0, padding: 12 },
  gamePickerRow: { gap: 10 },
  gameCard: { borderWidth: 1, borderRadius: 0, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'center', minWidth: 220 },
  gameTitle: { fontSize: 17, fontWeight: '900' },
  gameDesc: { fontSize: 12, marginTop: 3, fontWeight: '700' },
  statusCard: { borderWidth: 1, borderRadius: 0, padding: 16, gap: 14 },
  kicker: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginBottom: 6 },
  mainTitle: { fontSize: 29, fontWeight: '900' },
  desc: { fontSize: 13, lineHeight: 20, marginTop: 5 },
  statusPill: { borderWidth: 1, borderRadius: 0, padding: 12 },
  statusLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  statusText: { marginTop: 3, fontSize: 18, fontWeight: '900' },
  statusSmall: { marginTop: 2, fontSize: 12, fontWeight: '800' },
  boardOuter: { paddingVertical: 4 },
  caroBoard: { width: CARO_BOARD_SIZE * 34 + 18, borderWidth: 1, borderRadius: 0, padding: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  caroCell: { width: 32, height: 32, borderWidth: 1, borderRadius: 0, alignItems: 'center', justifyContent: 'center' },
  winCell: { backgroundColor: '#FFE8A3', borderColor: '#D89D19' },
  caroCellText: { fontSize: 18, fontWeight: '900' },
  panel: { borderWidth: 1, borderRadius: 0, padding: 14, gap: 11 },
  panelHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  panelTitle: { fontSize: 18, fontWeight: '900' },
  difficultyRow: { gap: 8 },
  diffChip: { borderWidth: 1, borderRadius: 0, paddingHorizontal: 14, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  diffText: { fontWeight: '900', fontSize: 13 },
  twoColumns: { flexDirection: 'row', gap: 12 },
  halfPanel: { flex: 1 },
  scoreRow: { flexDirection: 'row', gap: 7 },
  scoreBox: { flex: 1, minHeight: 66, borderRadius: 0, backgroundColor: '#ffffff22', alignItems: 'center', justifyContent: 'center' },
  scoreValue: { fontSize: 24, fontWeight: '900' },
  scoreLabel: { fontSize: 11, fontWeight: '900' },
  actionBtn: { minHeight: 44, borderRadius: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 10, flex: 1 },
  actionText: { fontWeight: '900', fontSize: 12 },
  moveRow: { borderWidth: 1, borderRadius: 0, minHeight: 42, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  moveNo: { fontSize: 12, fontWeight: '900' },
  movePlayer: { fontSize: 13, fontWeight: '900' },
  movePos: { fontSize: 13, fontWeight: '900' },
  statGrid4: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  miniStat: { borderWidth: 1, borderRadius: 0, padding: 12, minWidth: '47%', flex: 1 },
  miniStatLabel: { fontSize: 11, fontWeight: '800' },
  miniStatValue: { fontSize: 23, fontWeight: '900', marginTop: 3 },
  sudokuBoard: { borderWidth: 1, borderRadius: 0, padding: 6, flexDirection: 'row', flexWrap: 'wrap', alignSelf: 'center', width: 333 },
  sudokuCell: { width: 35, height: 35, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  sudokuRightBorder: { borderRightWidth: 3 },
  sudokuBottomBorder: { borderBottomWidth: 3 },
  sudokuValue: { fontSize: 18, fontWeight: '900' },
  sudokuCandidates: { fontSize: 8, fontWeight: '800', letterSpacing: -1 },
  numberPad: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  numBtn: { width: 44, height: 44, borderWidth: 1, borderRadius: 0, alignItems: 'center', justifyContent: 'center' },
  eraseBtn: { width: 70 },
  numText: { fontSize: 16, fontWeight: '900' },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  levelGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  levelBtn: { width: 46, height: 42, borderRadius: 0, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  levelText: { fontWeight: '900' },
  rainStage: { height: RAIN_STAGE_H, borderWidth: 1, borderRadius: 0, alignSelf: 'center', overflow: 'hidden' },
  rainRoad: { position: 'absolute', top: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.86)', borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  rainRoadLine: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: 'rgba(255,255,255,0.18)' },
  rainDrop: { position: 'absolute', width: 2, height: 18, borderRadius: 0, backgroundColor: 'rgba(147,197,253,0.72)', transform: [{ rotate: '12deg' }] },
  rainShelter: { position: 'absolute', borderRadius: 0, backgroundColor: 'rgba(250,204,21,0.94)', borderWidth: 1, borderColor: 'rgba(133,77,14,0.55)', alignItems: 'center', justifyContent: 'center' },
  rainShelterIcon: { fontSize: 18 },
  rainShelterText: { fontSize: 10, fontWeight: '900', color: '#422006' },
  rainEntity: { position: 'absolute', fontSize: 28 },
  rainPlayer: { position: 'absolute', fontSize: 30 },
  rainProgress: { position: 'absolute', left: 14, right: 14, bottom: 12, height: 10, borderRadius: 0, borderWidth: 1, overflow: 'hidden', backgroundColor: 'rgba(15,23,42,0.62)' },
  rainProgressFill: { height: '100%', borderRadius: 0, backgroundColor: '#22C55E' },
  rainBadge: { position: 'absolute', top: 12, right: 12, borderRadius: 0, paddingHorizontal: 10, paddingVertical: 7 },
  rainBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  rainTouchHelp: { borderWidth: 1, borderRadius: 0, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  rainTouchHelpText: { flex: 1, fontSize: 12, fontWeight: '800', lineHeight: 18 },
  runnerStage: { width: RUNNER_VIEW_W, height: RUNNER_VIEW_H, borderWidth: 1, borderRadius: 0, alignSelf: 'center', overflow: 'hidden' },
  runnerLane: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(148, 163, 184, 0.28)' },
  runnerEntity: { position: 'absolute' },
  runnerFinish: { position: 'absolute', top: 128, fontSize: 30 },
  runnerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(2,6,23,0.62)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  runnerOverlayTitle: { color: '#fff', fontSize: 24, fontWeight: '900', textAlign: 'center' },
  runnerOverlayDesc: { color: '#cbd5e1', fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 8 },
  runnerControls: { alignItems: 'center', gap: 8 },
  runnerControlMiddle: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  runnerControlBtn: { borderWidth: 1, borderRadius: 0, width: 76, height: 48, alignItems: 'center', justifyContent: 'center' },
  runnerJumpBtn: { borderRadius: 0, width: 96, height: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3C15D' },
  runnerControlText: { fontSize: 15, fontWeight: '900' },
  runnerLevelBtn: { borderWidth: 1, borderRadius: 0, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  runnerLevelTitle: { fontSize: 14, fontWeight: '900' },
  runnerLevelSpeed: { fontSize: 13, fontWeight: '900' },
});
