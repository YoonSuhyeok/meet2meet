#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { spawn, spawnSync } from 'node:child_process';

const PREVIEW_HOST = '127.0.0.1';
const PREVIEW_PORT = 4173;
const PREVIEW_ORIGIN = `http://${PREVIEW_HOST}:${PREVIEW_PORT}`;

const args = new Set(process.argv.slice(2));
if (args.has('--help') || args.has('-h')) {
  printHelp();
  process.exit(0);
}

const verbose = args.has('--verbose');
const keepProcesses = args.has('--keep');

const rootDir = process.cwd();
const devVarsPath = path.join(rootDir, '.dev.vars');

const processes = [];
const startedAt = Date.now();

async function main() {
  const env = loadMergedEnv(devVarsPath);

  logStep('1/8', 'Validating required environment');
  const tunnelBaseUrl = requiredEnv(env, 'TUNNEL_BASE_URL');
  const tunnelName = requiredEnv(env, 'TUNNEL_NAME');

  const coreApiUrl = env.CORE_API_URL || 'http://localhost:8080';
  const backendHealthUrl = env.BACKEND_HEALTH_URL || `${coreApiUrl.replace(/\/$/, '')}/healthz`;

  const credentialsPath = resolveCredentialsPath(env);
  if (!fs.existsSync(credentialsPath)) {
    throw new Error(
      [
        `Tunnel credentials file not found: ${credentialsPath}`,
        'Set TUNNEL_CREDENTIALS_FILE in .dev.vars or environment.',
      ].join('\n')
    );
  }

  ensureHttpsUrl(tunnelBaseUrl, 'TUNNEL_BASE_URL');
  ensureCloudflaredInstalled();

  logStep('2/8', `Checking backend health: ${backendHealthUrl}`);
  await assertHttpOk(backendHealthUrl, 'Backend health check failed');

  logStep('3/8', 'Building frontend (fresh dist required)');
  await runCommand('pnpm', ['build'], { stdio: verbose ? 'inherit' : 'pipe' });

  logStep('4/8', `Starting preview server on ${PREVIEW_ORIGIN}`);
  const previewProcess = startProcess(
    'pnpm',
    ['exec', 'vike', 'preview', '--host', PREVIEW_HOST, '--port', String(PREVIEW_PORT), '--strictPort'],
    'preview'
  );
  processes.push(previewProcess);

  await waitForHttpOk(`${PREVIEW_ORIGIN}/`, 45_000, 'Preview server failed to become ready');

  logStep('5/8', `Starting named tunnel: ${tunnelName}`);
  const cloudflaredArgs = [
    'tunnel',
    '--no-autoupdate',
    '--url',
    PREVIEW_ORIGIN,
    '--credentials-file',
    credentialsPath,
    'run',
    tunnelName,
  ];
  const tunnelProcess = startProcess('cloudflared', cloudflaredArgs, 'cloudflared');
  processes.push(tunnelProcess);

  logStep('6/8', `Checking tunnel URL: ${tunnelBaseUrl}`);
  await waitForHttpOk(tunnelBaseUrl, 60_000, 'Tunnel URL did not become reachable');

  logStep('7/8', 'Running manual real-device checklist');
  const manualPass = await runManualChecklist(tunnelBaseUrl);
  if (!manualPass) {
    throw new Error('Manual device verification marked as failed.');
  }

  logStep('8/8', 'Verification complete');
  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`PASS verify:mobile-pwa (${elapsedSec}s)`);
}

main()
  .catch(async (error) => {
    console.error(`FAIL verify:mobile-pwa: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (keepProcesses) {
      console.log('Leaving preview/cloudflared running because --keep was provided.');
      return;
    }
    await shutdownProcesses();
  });

function printHelp() {
  console.log('Usage: pnpm verify:mobile-pwa [--verbose] [--keep]');
  console.log('');
  console.log('Options:');
  console.log('  --verbose   Stream child process output.');
  console.log('  --keep      Keep preview and cloudflared processes alive after run.');
}

function loadMergedEnv(dotEnvPath) {
  const fromFile = fs.existsSync(dotEnvPath) ? parseSimpleEnv(fs.readFileSync(dotEnvPath, 'utf8')) : {};
  return {
    ...fromFile,
    ...process.env,
  };
}

function parseSimpleEnv(content) {
  const result = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    result[key] = unquote(value);
  }
  return result;
}

function unquote(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function requiredEnv(env, key) {
  const value = env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function resolveCredentialsPath(env) {
  const explicit = env.TUNNEL_CREDENTIALS_FILE;
  if (explicit) {
    return path.resolve(explicit);
  }

  const cloudflaredDir = getCloudflaredConfigDir();
  const tunnelId = env.TUNNEL_ID;
  const tunnelName = env.TUNNEL_NAME;

  const candidates = [];
  if (tunnelId) candidates.push(path.join(cloudflaredDir, `${tunnelId}.json`));
  if (tunnelName) candidates.push(path.join(cloudflaredDir, `${tunnelName}.json`));

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  const suggested = candidates[0] || path.join(cloudflaredDir, 'YOUR_TUNNEL_ID.json');
  return suggested;
}

function getCloudflaredConfigDir() {
  const home = os.homedir();
  if (!home) {
    throw new Error('Cannot resolve home directory for cloudflared defaults.');
  }
  return path.join(home, '.cloudflared');
}

function ensureHttpsUrl(value, key) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${key} is not a valid URL: ${value}`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`${key} must use https:// (received: ${value})`);
  }
}

function ensureCloudflaredInstalled() {
  const result = spawnSyncSafe('cloudflared', ['--version']);
  if (result.code !== 0) {
    throw new Error([
      'cloudflared is not installed or not on PATH.',
      'Install guide: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/',
    ].join('\n'));
  }
}

function spawnSyncSafe(command, commandArgs) {
  try {
    const result = spawnSync(command, commandArgs, {
      stdio: 'ignore',
      shell: process.platform === 'win32',
    });
    return { code: typeof result.status === 'number' ? result.status : 1 };
  } catch {
    return { code: 1 };
  }
}

function runCommand(command, commandArgs, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      stdio: options.stdio || 'inherit',
      shell: process.platform === 'win32',
    });

    let stderr = '';
    if (child.stderr) {
      child.stderr.on('data', (chunk) => {
        stderr += String(chunk);
      });
    }

    child.on('error', (err) => reject(err));
    child.on('close', (code) => {
      if (code === 0) return resolve();
      reject(new Error(`${command} ${commandArgs.join(' ')} failed with code ${code}${stderr ? `\n${stderr}` : ''}`));
    });
  });
}

function startProcess(command, commandArgs, label) {
  const child = spawn(command, commandArgs, {
    stdio: verbose ? 'inherit' : 'pipe',
    shell: process.platform === 'win32',
  });

  child.on('error', (err) => {
    console.error(`${label} process error: ${err.message}`);
  });

  child.on('close', (code) => {
    if (code !== null && code !== 0) {
      console.error(`${label} exited with code ${code}`);
    }
  });

  if (!verbose) {
    pipeSummaryOutput(child, label);
  }

  return child;
}

function pipeSummaryOutput(child, label) {
  if (!child.stdout) return;
  child.stdout.on('data', (chunk) => {
    const text = String(chunk).trim();
    if (!text) return;
    if (label === 'preview' && /Local|Network|ready|listening/i.test(text)) {
      console.log(`[preview] ${shorten(text)}`);
    }
    if (label === 'cloudflared' && /error|ERR|connected|Starting|Registered tunnel|Route propagating/i.test(text)) {
      console.log(`[cloudflared] ${shorten(text)}`);
    }
  });

  if (!child.stderr) return;
  child.stderr.on('data', (chunk) => {
    const text = String(chunk).trim();
    if (!text) return;
    console.log(`[${label}] ${shorten(text)}`);
  });
}

function shorten(text, limit = 180) {
  return text.length > limit ? `${text.slice(0, limit - 3)}...` : text;
}

async function waitForHttpOk(url, timeoutMs, failMessage) {
  const end = Date.now() + timeoutMs;
  let lastError = 'unknown error';

  while (Date.now() < end) {
    try {
      await assertHttpOk(url, failMessage);
      return;
    } catch (err) {
      lastError = err.message;
      await sleep(1000);
    }
  }

  throw new Error(`${failMessage}: ${lastError}`);
}

async function assertHttpOk(url, failMessage) {
  let response;
  try {
    response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
    });
  } catch (error) {
    throw new Error(`${failMessage}: ${error.message}`);
  }

  if (response.status >= 400) {
    throw new Error(`${failMessage}: HTTP ${response.status} (${url})`);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function logStep(step, message) {
  console.log(`[${step}] ${message}`);
}

async function runManualChecklist(tunnelBaseUrl) {
  console.log('');
  console.log('Manual checklist (real device):');
  console.log(`1) Open ${tunnelBaseUrl} on your phone.`);
  console.log('2) Confirm app loads over HTTPS without certificate warnings.');
  console.log('3) Install PWA from browser UI.');
  console.log('4) Re-open the installed app and verify main pages load.');
  console.log('5) (Optional) Validate push subscription path from app settings.');
  console.log('');

  if (!process.stdin.isTTY) {
    throw new Error('Interactive terminal required for manual checklist confirmation.');
  }

  const answer = await askQuestion('Did all checklist items pass? [y/N]: ');
  return answer.trim().toLowerCase() === 'y';
}

function askQuestion(prompt) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function shutdownProcesses() {
  for (const child of processes.reverse()) {
    await stopProcess(child);
  }
}

function stopProcess(child) {
  return new Promise((resolve) => {
    if (!child || child.killed || child.exitCode !== null) {
      resolve();
      return;
    }

    child.once('close', () => resolve());
    child.kill('SIGTERM');

    setTimeout(() => {
      if (child.exitCode === null) {
        child.kill('SIGKILL');
      }
    }, 1500);
  });
}
