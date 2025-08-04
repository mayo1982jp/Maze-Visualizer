# Maze Generator & Algorithm Visualizer

ブラウザで動く迷路生成＆経路探索アルゴリズムの可視化デモです。左サイドで設定・操作し、右側のキャンバスに迷路と探索の様子が描画されます。

## デモ概要
- 迷路生成アルゴリズム
  - Recursive Backtracker
  - Prim's
  - Kruskal's
- 経路探索アルゴリズム
  - A*（マンハッタン距離）
  - BFS
  - Dijkstra
- スピード調整（10〜120 Hz）
- ライブ統計（Visited / Path Length / Heuristic）

## 使い方
1. 左側「Grid size」でグリッドサイズを調整（20〜100）。
2. 「Generator」を選択して「Generate」を押すと生成が開始されます。
3. 「Play」で生成の一時停止/再開ができます。
4. 生成が完了すると、Solver の選択・操作が有効になります。
5. 「Solver」を選択し、「Play」で探索を開始/一時停止します。
6. 「Clear」で探索の状態をリセットできます（迷路はそのまま）。

ヒント: 生成は最大120FPSで進み、探索は「Speed (Hz)」で再生速度を制御できます。

## 動作環境
- 追加セットアップ不要。`index.html` をブラウザで開くだけで動作します。
- 依存: Bootstrap 5（CDN）。描画は Canvas API。

## ファイル構成
- index.html: 画面・UI・ロジック（生成/探索/描画）を含む単一ファイル
- public/favicon.ico: ファビコン
- .gitignore: Git 管理除外設定

## 技術メモ
- Canvas は DPI に応じて内部解像度をスケールし、シャープに描画します。
- 生成アルゴリズム
  - Recursive Backtracker: 深さ優先探索のバックトラック
  - Prim: 境界の辺からランダムに取り込み
  - Kruskal: ランダムエッジと Union-Find による森の結合
- 探索アルゴリズム
  - BFS/Dijkstra/A*: open set と visited を追跡、A* はマンハッタン距離でヒューリスティック評価

## 制作・クレジット
- 本プロジェクトはオープンソースAIコーディングエディタ「Dyad」を使って作成しました。  
  - Dyad: https://www.dyad.sh/
- 使用AIモデル: OpenAI Horizon-Beta

## ライセンス
MIT