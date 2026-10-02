# fzgame-arcade

GameHub game packs. Every game is one folder under `games/` — nothing mixed at the repo root.

| Game | Folder | Dev |
| --- | --- | --- |
| [Tentris](./games/tentris) | `games/tentris` | `pnpm --filter @fzgame-arcade/tentris dev` |
| [Arc Dash](./games/arc-dash) | `games/arc-dash` | `pnpm --filter @fzgame-arcade/arc-dash dev` |

## Setup

Needs the sibling GameHub repo at `../gamehub` (CLI + kit). Build those once:

```bash
cd ../gamehub
pnpm --filter @fzgames/kit build
pnpm --filter @fzgame/cli build
```

Then here:

```bash
pnpm install
```

## Commands

```bash
pnpm --filter @fzgame-arcade/tentris dev      # http://127.0.0.1:3400
pnpm --filter @fzgame-arcade/arc-dash dev     # http://127.0.0.1:3401
pnpm --filter @fzgame-arcade/arc-dash build
pnpm build                                    # zip every game
```

`fzgame` is `bin/fzgame.mjs`, which runs `../gamehub/packages/fzgame-cli/dist/cli.cjs`.

## Add a game

Copy an existing folder under `games/`. Change `package.json` `name`, `fzgame.json` (`name`, `slug`), and give `dev` its own `--port`.
