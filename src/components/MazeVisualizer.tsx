import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";

type Point = { r: number; c: number };

// Grid cell stores walls for maze carving
type Cell = {
  walls: { top: boolean; right: boolean; bottom: boolean; left: boolean };
};

// Algorithms
type GeneratorType = "recursive-backtracker" | "prims" | "kruskals";
type SolverType = "a-star" | "bfs" | "dijkstra";

type GenState =
  | {
      type: "recursive-backtracker";
      stack: Point[];
      visited: boolean[]; // size N*N
    }
  | {
      type: "prims";
      inMaze: boolean[]; // N*N
      edges: { from: Point; to: Point }[];
    }
  | {
    type: "kruskals";
    edges: { a: Point; b: Point }[];
    parent: number[];
    rank: number[];
    edgeIndex: number;
  }
  | null;

type SolveState = {
  type: SolverType | null;
  open: Point[]; // queue for BFS/Dijkstra, binary heap avoided for simplicity since we step
  openSet: Set<number>;
  cameFrom: Map<number, number>;
  gScore: Map<number, number>; // distance
  visited: Set<number>;
  // for A*: f = g + h, for Dijkstra: f=g, for BFS: implicit g in visited layers
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const idx = (r: number, c: number, n: number) => r * n + c;
const inBounds = (r: number, c: number, n: number) => r >= 0 && r < n && c >= 0 && c < n;

function shuffleInPlace<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function manhattan(a: Point, b: Point) {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c);
}

function neighbors4(n: number, p: Point): Point[] {
  return [
    { r: p.r - 1, c: p.c },
    { r: p.r, c: p.c + 1 },
    { r: p.r + 1, c: p.c },
    { r: p.r, c: p.c - 1 },
  ].filter((q) => inBounds(q.r, q.c, n));
}

function removeWall(grid: Cell[][], a: Point, b: Point) {
  if (a.r === b.r) {
    if (a.c + 1 === b.c) {
      grid[a.r][a.c].walls.right = false;
      grid[b.r][b.c].walls.left = false;
    } else if (a.c - 1 === b.c) {
      grid[a.r][a.c].walls.left = false;
      grid[b.r][b.c].walls.right = false;
    }
  } else if (a.c === b.c) {
    if (a.r + 1 === b.r) {
      grid[a.r][a.c].walls.bottom = false;
      grid[b.r][b.c].walls.top = false;
    } else if (a.r - 1 === b.r) {
      grid[a.r][a.c].walls.top = false;
      grid[b.r][b.c].walls.bottom = false;
    }
  }
}

function wallBetween(grid: Cell[][], a: Point, b: Point): boolean {
  if (a.r === b.r) {
    if (a.c + 1 === b.c) return grid[a.r][a.c].walls.right || grid[b.r][b.c].walls.left;
    if (a.c - 1 === b.c) return grid[a.r][a.c].walls.left || grid[b.r][b.c].walls.right;
  } else if (a.c === b.c) {
    if (a.r + 1 === b.r) return grid[a.r][a.c].walls.bottom || grid[b.r][b.c].walls.top;
    if (a.r - 1 === b.r) return grid[a.r][a.c].walls.top || grid[b.r][b.c].walls.bottom;
  }
  return true;
}

function makeGrid(n: number): Cell[][] {
  return Array.from({ length: n }, () =>
    Array.from({ length: n }, () => ({
      walls: { top: true, right: true, bottom: true, left: true },
    })),
  );
}

function initRecursiveBacktracker(n: number): GenState {
  const visited = Array(n * n).fill(false);
  const start = { r: 0, c: 0 };
  visited[idx(start.r, start.c, n)] = true;
  return { type: "recursive-backtracker", stack: [start], visited };
}

function stepRecursiveBacktracker(state: Extract<GenState, { type: "recursive-backtracker" }>, grid: Cell[][], n: number): boolean {
  const stack = state.stack;
  if (stack.length === 0) return true;
  const current = stack[stack.length - 1];
  const candidates = neighbors4(n, current).filter((p) => !state.visited[idx(p.r, p.c, n)]);
  if (candidates.length === 0) {
    stack.pop();
    return false;
  }
  const next = candidates[(Math.random() * candidates.length) | 0];
  removeWall(grid, current, next);
  state.visited[idx(next.r, next.c, n)] = true;
  stack.push(next);
  return stack.length === 0;
}

function initPrims(n: number): GenState {
  const inMaze = Array(n * n).fill(false);
  const start = { r: 0, c: 0 };
  inMaze[idx(start.r, start.c, n)] = true;
  const edges: { from: Point; to: Point }[] = [];
  neighbors4(n, start).forEach((to) => edges.push({ from: start, to }));
  return { type: "prims", inMaze, edges };
}

function stepPrims(state: Extract<GenState, { type: "prims" }>, grid: Cell[][], n: number): boolean {
  if (state.edges.length === 0) {
    // Check if all inMaze true
    return state.inMaze.every(Boolean);
  }
  // choose random edge
  const i = (Math.random() * state.edges.length) | 0;
  const { from, to } = state.edges.splice(i, 1)[0];
  const toIdx = idx(to.r, to.c, n);
  if (!state.inMaze[toIdx] && state.inMaze[idx(from.r, from.c, n)]) {
    removeWall(grid, from, to);
    state.inMaze[toIdx] = true;
    neighbors4(n, to).forEach((nxt) => {
      if (!state.inMaze[idx(nxt.r, nxt.c, n)]) state.edges.push({ from: to, to: nxt });
    });
  }
  return false;
}

function initKruskals(n: number): GenState {
  // Build all possible edges between adjacent cells
  const edges: { a: Point; b: Point }[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (r + 1 < n) edges.push({ a: { r, c }, b: { r: r + 1, c } });
      if (c + 1 < n) edges.push({ a: { r, c }, b: { r, c: c + 1 } });
    }
  }
  shuffleInPlace(edges);
  const parent = Array(n * n)
    .fill(0)
    .map((_, i) => i);
  const rank = Array(n * n).fill(0);
  return { type: "kruskals", edges, parent, rank, edgeIndex: 0 };
}

function findSet(parent: number[], x: number): number {
  while (x !== parent[x]) {
    parent[x] = parent[parent[x]];
    x = parent[x];
  }
  return x;
}
function unionSet(parent: number[], rank: number[], x: number, y: number): boolean {
  const rx = findSet(parent, x);
  const ry = findSet(parent, y);
  if (rx === ry) return false;
  if (rank[rx] < rank[ry]) parent[rx] = ry;
  else if (rank[rx] > rank[ry]) parent[ry] = rx;
  else {
    parent[ry] = rx;
    rank[rx]++;
  }
  return true;
}

function stepKruskals(state: Extract<GenState, { type: "kruskals" }>, grid: Cell[][], n: number): boolean {
  if (state.edgeIndex >= state.edges.length) return true;
  const { a, b } = state.edges[state.edgeIndex++];
  const ia = idx(a.r, a.c, n);
  const ib = idx(b.r, b.c, n);
  if (unionSet(state.parent, state.rank, ia, ib)) {
    removeWall(grid, a, b);
  }
  return state.edgeIndex >= state.edges.length;
}

function reconstructPath(cameFrom: Map<number, number>, current: number): number[] {
  const path = [current];
  while (cameFrom.has(current)) {
    current = cameFrom.get(current)!;
    path.push(current);
  }
  path.reverse();
  return path;
}

export default function MazeVisualizer() {
  const [size, setSize] = useState<number>(30); // 20–100
  const [generator, setGenerator] = useState<GeneratorType>("recursive-backtracker");
  const [solver, setSolver] = useState<SolverType>("a-star");
  const [grid, setGrid] = useState<Cell[][]>(() => makeGrid(30));
  const [genState, setGenState] = useState<GenState>(null);
  const [generated, setGenerated] = useState<boolean>(false);

  const [solveState, setSolveState] = useState<SolveState>({
    type: null,
    open: [],
    openSet: new Set(),
    cameFrom: new Map(),
    gScore: new Map(),
    visited: new Set(),
  });

  const [playingGen, setPlayingGen] = useState<boolean>(false);
  const [playingSolve, setPlayingSolve] = useState<boolean>(false);

  const [pathNodes, setPathNodes] = useState<number[]>([]);
  const [stats, setStats] = useState<{ visited: number; pathLen: number; heuristic: number }>({
    visited: 0,
    pathLen: 0,
    heuristic: 0,
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const requestRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number>(0);
  const lastSolveTickRef = useRef<number>(0);

  const n = size;
  const start: Point = useMemo(() => ({ r: 0, c: 0 }), []);
  const goal: Point = useMemo(() => ({ r: n - 1, c: n - 1 }), [n]);

  // Reset grid when size changes
  useEffect(() => {
    setGrid(makeGrid(n));
    setGenState(null);
    setGenerated(false);
    setPlayingGen(false);
    resetSolver();
  }, [n]);

  function startGeneration() {
    const g = makeGrid(n);
    setGrid(g);
    let s: GenState;
    if (generator === "recursive-backtracker") s = initRecursiveBacktracker(n);
    else if (generator === "prims") s = initPrims(n);
    else s = initKruskals(n);
    setGenState(s);
    setGenerated(false);
    setPlayingGen(true);
    resetSolver();
  }

  function stepGenerationOnce(): boolean {
    if (!genState) return true;
    let done = false;
    if (genState.type === "recursive-backtracker") {
      done = stepRecursiveBacktracker(genState, grid, n);
    } else if (genState.type === "prims") {
      done = stepPrims(genState, grid, n);
    } else if (genState.type === "kruskals") {
      done = stepKruskals(genState, grid, n);
    }
    if (done || (genState.type === "recursive-backtracker" && genState.stack.length === 0)) {
      setGenerated(true);
      setPlayingGen(false);
      setGenState(null);
    }
    return done;
  }

  function initSolver(type: SolverType) {
    if (!generated) return;
    const open: Point[] = [];
    const openSet = new Set<number>();
    const cameFrom = new Map<number, number>();
    const gScore = new Map<number, number>();
    const visited = new Set<number>();

    const sIdx = idx(start.r, start.c, n);
    open.push(start);
    openSet.add(sIdx);
    gScore.set(sIdx, 0);

    setSolveState({ type, open, openSet, cameFrom, gScore, visited });
    setPathNodes([]);
    setStats({ visited: 0, pathLen: 0, heuristic: manhattan(start, goal) });
  }

  function resetSolver() {
    setSolveState({
      type: null,
      open: [],
      openSet: new Set(),
      cameFrom: new Map(),
      gScore: new Map(),
      visited: new Set(),
    });
    setPathNodes([]);
    setStats({ visited: 0, pathLen: 0, heuristic: 0 });
    setPlayingSolve(false);
  }

  function traverseNeighbors(p: Point): Point[] {
    const list: Point[] = [];
    const neigh = neighbors4(n, p);
    for (const q of neigh) {
      if (!wallBetween(grid, p, q)) list.push(q);
    }
    return list;
  }

  function pickNextOpenForSolver(): number {
    // Returns index in open array to pop; selection depends on solver type
    if (!solveState.type) return 0;
    if (solveState.type === "bfs") {
      return 0; // queue (FIFO)
    }
    if (solveState.type === "dijkstra" || solveState.type === "a-star") {
      // choose lowest f = g + h (for dijkstra, h=0)
      let best = 0;
      let bestScore = Infinity;
      for (let i = 0; i < solveState.open.length; i++) {
        const p = solveState.open[i];
        const id = idx(p.r, p.c, n);
        const g = solveState.gScore.get(id) ?? Infinity;
        const h = solveState.type === "a-star" ? manhattan(p, goal) : 0;
        const f = g + h;
        if (f < bestScore) {
          bestScore = f;
          best = i;
        }
      }
      return best;
    }
    return 0;
  }

  function stepSolverOnce(): boolean {
    if (!solveState.type) return true;
    if (solveState.open.length === 0) return true;

    const i = pickNextOpenForSolver();
    const current = solveState.open.splice(i, 1)[0];
    const currentId = idx(current.r, current.c, n);
    solveState.openSet.delete(currentId);

    if (!solveState.visited.has(currentId)) {
      solveState.visited.add(currentId);
    }

    if (current.r === goal.r && current.c === goal.c) {
      const path = reconstructPath(solveState.cameFrom, currentId);
      setPathNodes(path);
      setStats((s) => ({ ...s, pathLen: path.length }));
      return true;
    }

    const gCurrent = solveState.gScore.get(currentId) ?? Infinity;
    for (const nb of traverseNeighbors(current)) {
      const nbId = idx(nb.r, nb.c, n);
      if (solveState.visited.has(nbId)) continue;

      const tentativeG = gCurrent + 1; // uniform cost
      if (tentativeG < (solveState.gScore.get(nbId) ?? Infinity)) {
        solveState.cameFrom.set(nbId, currentId);
        solveState.gScore.set(nbId, tentativeG);
        if (!solveState.openSet.has(nbId)) {
          solveState.open.push(nb);
          solveState.openSet.add(nbId);
        }
      }
    }

    setStats({
      visited: solveState.visited.size,
      pathLen: pathNodes.length,
      heuristic: manhattan(current, goal),
    });

    return false;
  }

  // Animation loop
  useEffect(() => {
    function loop(t: number) {
      // Cap generation at 120 FPS
      const dt = t - lastFrameRef.current;
      const genReady = dt >= 1000 / 120;

      if (playingGen && genReady) {
        lastFrameRef.current = t;
        if (stepGenerationOnce()) {
          setPlayingGen(false);
        }
      }

      // Solver at 10 Hz when playing
      const sd = t - lastSolveTickRef.current;
      const solveReady = sd >= 100; // 10 Hz
      if (playingSolve && solveReady) {
        lastSolveTickRef.current = t;
        const finished = stepSolverOnce();
        if (finished) setPlayingSolve(false);
      }

      draw();
      requestRef.current = requestAnimationFrame(loop);
    }

    requestRef.current = requestAnimationFrame(loop);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playingGen, playingSolve, genState, solver, generator, grid, n]);

  function draw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const padding = 16;
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    // resize canvas backing store to device pixels
    const dpr = window.devicePixelRatio || 1;
    const bw = Math.floor(W * dpr);
    const bh = Math.floor(H * dpr);
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    // square fit
    const sizePx = Math.min(W, H) - padding * 2;
    const cell = sizePx / n;
    const offsetX = (W - sizePx) / 2;
    const offsetY = (H - sizePx) / 2;

    // Background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    // Fill visited cells (gray)
    ctx.fillStyle = "#d1d5db"; // gray-300
    for (const v of solveState.visited) {
      const r = Math.floor(v / n);
      const c = v % n;
      ctx.fillRect(offsetX + c * cell, offsetY + r * cell, cell, cell);
    }

    // Frontier (cyan)
    ctx.fillStyle = "#06b6d4"; // cyan-500
    for (const p of solveState.open) {
      ctx.fillRect(offsetX + p.c * cell, offsetY + p.r * cell, cell, cell);
    }

    // Path (yellow)
    if (pathNodes.length > 0) {
      ctx.fillStyle = "#facc15"; // yellow-400
      for (const v of pathNodes) {
        const r = Math.floor(v / n);
        const c = v % n;
        ctx.fillRect(offsetX + c * cell, offsetY + r * cell, cell, cell);
      }
    }

    // Start and Goal overlay
    ctx.fillStyle = "#86efac"; // green-300
    ctx.fillRect(offsetX + start.c * cell, offsetY + start.r * cell, cell, cell);
    ctx.fillStyle = "#fda4af"; // rose-300
    ctx.fillRect(offsetX + goal.c * cell, offsetY + goal.r * cell, cell, cell);

    // Draw walls
    ctx.strokeStyle = "#111827"; // gray-900
    ctx.lineWidth = Math.max(1, cell * 0.08);
    ctx.beginPath();
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const x = offsetX + c * cell;
        const y = offsetY + r * cell;
        const w = grid[r][c].walls;
        if (w.top) {
          ctx.moveTo(x, y);
          ctx.lineTo(x + cell, y);
        }
        if (w.right) {
          ctx.moveTo(x + cell, y);
          ctx.lineTo(x + cell, y + cell);
        }
        if (w.bottom) {
          ctx.moveTo(x, y + cell);
          ctx.lineTo(x + cell, y + cell);
        }
        if (w.left) {
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + cell);
        }
      }
    }
    ctx.stroke();

    // Reset transform scaling for next pass
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function onGenerateClick() {
    startGeneration();
  }

  function onGenStep() {
    stepGenerationOnce();
  }

  function onSolveStep() {
    if (!solveState.type) initSolver(solver);
    else stepSolverOnce();
  }

  function onSolvePlayToggle() {
    if (!solveState.type) initSolver(solver);
    setPlayingSolve((p) => !p);
  }

  function onClearPath() {
    resetSolver();
  }

  function onChangeGenerator(value: string) {
    setGenerator(value as GeneratorType);
    setGenerated(false);
    setGenState(null);
  }

  function onChangeSolver(value: string) {
    setSolver(value as SolverType);
    if (solveState.type) {
      // re-init to switch algorithm
      initSolver(value as SolverType);
    }
  }

  // Controls disabled states
  const canGenerate = !playingGen;
  const canSolve = generated && !playingGen;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Maze Generator & Algorithm Visualizer</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Grid size: {size} x {size}</Label>
              <Slider
                value={[size]}
                min={20}
                max={100}
                step={1}
                onValueChange={(v) => setSize(clamp(v[0], 20, 100))}
              />
            </div>
            <div className="space-y-2">
              <Label>Generator</Label>
              <Select value={generator} onValueChange={onChangeGenerator}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick generator" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recursive-backtracker">Recursive Backtracker</SelectItem>
                  <SelectItem value="prims">Prim&apos;s</SelectItem>
                  <SelectItem value="kruskals">Kruskal&apos;s</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={onGenerateClick} disabled={!canGenerate}>
                Generate
              </Button>
              <Button variant="secondary" onClick={onGenStep} disabled={!genState}>
                Step
              </Button>
              <Button
                variant={playingGen ? "destructive" : "default"}
                onClick={() => setPlayingGen((p) => !p)}
                disabled={!genState}
              >
                {playingGen ? "Pause" : "Play"}
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Solver</Label>
              <Select value={solver} onValueChange={onChangeSolver} disabled={!canSolve}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick solver" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a-star">A* (Manhattan)</SelectItem>
                  <SelectItem value="bfs">BFS</SelectItem>
                  <SelectItem value="dijkstra">Dijkstra</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={onSolveStep} disabled={!canSolve}>
                Step
              </Button>
              <Button
                onClick={onSolvePlayToggle}
                variant={playingSolve ? "destructive" : "default"}
                disabled={!canSolve}
              >
                {playingSolve ? "Pause" : "Play"}
              </Button>
              <Button variant="outline" onClick={onClearPath} disabled={!generated}>
                Clear
              </Button>
            </div>
            <div className="text-sm text-muted-foreground">
              Start: top-left, Goal: bottom-right. Play = 10 Hz; generation capped at 120 FPS.
            </div>
          </div>

          <div className="space-y-2">
            <Label>Live Stats</Label>
            <div className="rounded-md border p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span>Visited</span>
                <span>{stats.visited}</span>
              </div>
              <div className="flex justify-between">
                <span>Current Path Length</span>
                <span>{stats.pathLen}</span>
              </div>
              <div className="flex justify-between">
                <span>Heuristic (Manhattan)</span>
                <span>{stats.heuristic}</span>
              </div>
              <Separator className="my-1" />
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: "#06b6d4" }} />
                <span className="text-xs">Frontier</span>
                <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: "#d1d5db" }} />
                <span className="text-xs">Visited</span>
                <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: "#facc15" }} />
                <span className="text-xs">Path</span>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full h-[480px] md:h-[640px] border rounded-md overflow-hidden bg-white">
          <canvas ref={canvasRef} className="w-full h-full block" />
        </div>
      </CardContent>
    </Card>
  );
}