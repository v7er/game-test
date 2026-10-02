#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const arcadeRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cli = resolve(arcadeRoot, '../gamehub/packages/fzgame-cli/dist/cli.cjs')

if (!existsSync(cli)) {
  console.error(`Missing GameHub CLI at ${cli}`)
  console.error('From the sibling gamehub repo run: pnpm --filter @fzgames/kit build && pnpm --filter @fzgame/cli build')
  process.exit(1)
}

const child = spawn(process.execPath, [cli, ...process.argv.slice(2)], {
  stdio: 'inherit',
  cwd: process.cwd(),
})
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exit(code ?? 1)
})
