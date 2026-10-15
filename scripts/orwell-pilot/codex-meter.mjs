import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {codexSnapshot, subscriptionEnvironment} from './budget.mjs';

/** Read-only protocol calls. This module never starts a model thread or reads credentials. */
export async function readCodexMeter({command = 'codex', cwd, timeoutMs = 12_000, processOptions = {}} = {}) {
  const child = spawn(command, ['app-server', '--stdio'], {cwd, env: subscriptionEnvironment(), ...processOptions, stdio: ['pipe','pipe','pipe']});
  const lines = createInterface({input: child.stdout});
  const pending = new Map();
  let nextId = 0;
  const fail = error => {
    for (const {reject, timer} of pending.values()) {clearTimeout(timer); reject(error);}
    pending.clear();
  };
  child.stderr.resume();
  child.on('error', fail);
  child.on('exit', () => fail(new Error('Codex meter process exited')));
  child.stdin.on('error', fail);
  lines.on('line', line => {
    let message; try {message = JSON.parse(line);} catch {return;}
    const request = pending.get(message.id);
    if (!request) return;
    clearTimeout(request.timer); pending.delete(message.id);
    if (message.error) request.reject(new Error(`Codex meter ${message.error.code ?? 'request'} failed`));
    else request.resolve(message.result);
  });
  const request = (method, params) => new Promise((resolveRequest, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => {pending.delete(id); reject(new Error(`Codex meter timed out: ${method}`));}, timeoutMs);
    pending.set(id, {resolve: resolveRequest, reject, timer});
    child.stdin.write(JSON.stringify({id, method, ...(params ? {params} : {})}) + '\n');
  });
  try {
    await request('initialize', {clientInfo: {name: 'orwell_subscription_meter', version: '0.1.0'}});
    child.stdin.write(JSON.stringify({method:'initialized', params:{}}) + '\n');
    const account = await request('account/read', {refreshToken: false});
    if (account?.account?.type !== 'chatgpt') throw new Error('Codex must be signed in with ChatGPT; API billing is disallowed');
    const meter = await request('account/rateLimits/read');
    return {...codexSnapshot(meter), authType: 'chatgpt', planType: account.account.planType};
  } finally {
    fail(new Error('Codex meter closed')); lines.close(); child.kill('SIGTERM');
    const kill = setTimeout(() => child.kill('SIGKILL'), 1_000); kill.unref();
    child.once('exit', () => clearTimeout(kill));
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {console.log(JSON.stringify(await readCodexMeter(), null, 2));}
  catch (error) {console.error(JSON.stringify({state:'held', reason:error.message})); process.exitCode = 1;}
}
