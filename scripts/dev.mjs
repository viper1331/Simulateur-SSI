#!/usr/bin/env node
import { spawn } from 'node:child_process';
import readline from 'node:readline';

const npmExecPath = process.env.npm_execpath;
const npmArgsBase = npmExecPath
  ? [npmExecPath, 'run']
  : ['npm', 'run'];
const nodeExecutable = npmExecPath ? process.execPath : undefined;

const commands = [
  { label: 'server', workspace: 'apps/server', script: 'dev' },
  { label: 'trainee', workspace: 'apps/trainee-station', script: 'dev' },
  { label: 'central', workspace: 'apps/central-panel', script: 'dev' },
  { label: 'trainer', workspace: 'apps/trainer-console', script: 'dev' }
];

const labelWidth = Math.max(...commands.map(({ label }) => label.length));

const children = new Map();
let shuttingDown = false;
let exitCode = 0;

for (const command of commands) {
  startCommand(command);
}

process.on('SIGINT', () => {
  exitCode = exitCode || 130;
  shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  exitCode = exitCode || 143;
  shutdown('SIGTERM');
});

function startCommand({ label, workspace, script }) {
  const args = [...npmArgsBase, script, '-w', workspace];
  const child = nodeExecutable
    ? spawn(nodeExecutable, args, { stdio: ['inherit', 'pipe', 'pipe'], env: process.env })
    : spawn(args[0], args.slice(1), {
        stdio: ['inherit', 'pipe', 'pipe'],
        env: process.env,
        shell: process.platform === 'win32'
      });

  children.set(child.pid, { child, label });

  pipeStream(child.stdout, process.stdout, label);
  pipeStream(child.stderr, process.stderr, label);

  child.once('exit', (code, signal) => {
    children.delete(child.pid);

    if (!shuttingDown) {
      if (signal) {
        console.warn(formatLabel(label) + `exited due to signal ${signal}`);
        exitCode = exitCode || 1;
      } else if (code && code !== 0) {
        console.error(formatLabel(label) + `exited with code ${code}`);
        exitCode = exitCode || code;
      } else {
        console.log(formatLabel(label) + 'completed');
      }
      shutdown('SIGTERM', child.pid);
    }

    if (children.size === 0) {
      process.exit(exitCode);
    }
  });
}

function pipeStream(stream, destination, label) {
  if (!stream) {
    return;
  }
  const rl = readline.createInterface({ input: stream });
  rl.on('line', (line) => {
    destination.write(formatLabel(label) + line + '\n');
  });
  rl.on('close', () => {
    if (!shuttingDown) {
      destination.write(formatLabel(label) + '(stream closed)\n');
    }
  });
}

function formatLabel(label) {
  return `[${label.padEnd(labelWidth)}] `;
}

function shutdown(signal, ignorePid) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  for (const { child, label } of children.values()) {
    if (ignorePid && child.pid === ignorePid) {
      continue;
    }
    if (child.killed) {
      continue;
    }
    if (!child.kill(signal)) {
      // Fallback to SIGKILL if the initial signal failed.
      if (!child.kill('SIGKILL')) {
        console.warn(formatLabel(label) + 'unable to terminate process');
      }
    }
  }
}
