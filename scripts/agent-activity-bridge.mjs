#!/usr/bin/env node
/** Local, narrowly scoped Codex session metadata collector. No prompt or tool payload leaves this process. */
import { readdir, readFile, writeFile, mkdir, open } from 'node:fs/promises';
import { join, basename, dirname } from 'node:path';
import { homedir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);
const ROOT = '01a09321-0212-73f0-b32b-c3045945d6c6';
const args = new Set(process.argv.slice(2));
const option = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
if (args.has('--help')) { console.log('Usage: node scripts/agent-activity-bridge.mjs [--once|--watch] [--publish] [--config PATH] [--state PATH] [--sessions PATH]'); process.exit(0); }
const sessions = option('--sessions', join(homedir(), '.codex/sessions'));
const statePath = option('--state', join(homedir(), '.codex/orwell-agent-bridge-state.json'));
const configPath = option('--config', join(process.cwd(), 'scripts/agent-activity-config.json'));
const publish = args.has('--publish');
const watch = args.has('--watch');
const labels = {
 assigned: { en: 'Agent assigned', es: 'Agente asignado', pt: 'Agente designado' },
 progress: { en: 'Agent activity recorded', es: 'Actividad del agente registrada', pt: 'Atividade do agente registrada' },
 completed: { en: 'Agent turn completed', es: 'Turno del agente completado', pt: 'Turno do agente concluído' },
 error: { en: 'Agent turn stopped', es: 'Turno del agente detenido', pt: 'Turno do agente interrompido' },
 model_changed: { en: 'Agent model changed', es: 'Modelo del agente actualizado', pt: 'Modelo do agente atualizado' },
};
const categories = [
 [/web|search|browser|research/i, { en: 'Research activity', es: 'Actividad de investigación', pt: 'Atividade de pesquisa' }],
 [/exec|terminal|shell|patch|file|git/i, { en: 'Implementation activity', es: 'Actividad de implementación', pt: 'Atividade de implementação' }],
 [/test|review|lint/i, { en: 'Verification activity', es: 'Actividad de verificación', pt: 'Atividade de verificação' }],
];
const safeToolLabel = name => categories.find(([re]) => re.test(name))?.[1] || labels.progress;
const validTeam = new Set(['research', 'qa', 'implementation']);
async function filesUnder(dir, depth = 0) {
 if (depth > 6) return [];
 let entries; try { entries = await readdir(dir, { withFileTypes: true }); } catch { return []; }
 const out = [];
 for (const entry of entries) {
  const path = join(dir, entry.name);
  if (entry.isDirectory()) out.push(...await filesUnder(path, depth + 1));
  else if (entry.isFile() && entry.name.endsWith('.jsonl')) out.push(path);
 }
 return out;
}
async function readConfig() {
 try { const config = JSON.parse(await readFile(configPath, 'utf8')); return config && typeof config === 'object' ? config : {}; }
 catch (e) { if (e.code === 'ENOENT') return {}; throw e; }
}
async function readState() {
 try { return JSON.parse(await readFile(statePath, 'utf8')); }
 catch (e) { if (e.code === 'ENOENT') return { published: {} }; throw e; }
}
function details(meta, config) {
 const source = meta.source?.subagent?.thread_spawn;
 const key = meta.id || meta.session_id;
 if (!key) return null;
 if (key !== ROOT && source?.parent_thread_id !== ROOT) return null;
 const path = key === ROOT ? '/root' : source.agent_path;
 if (key !== ROOT && (typeof path !== 'string' || !path.startsWith('/root/'))) return null;
 const configured = config[path] || config[key] || {};
 const nickname = source?.agent_nickname || meta.agent_nickname;
 const name = configured.name || (key === ROOT ? 'Lead agent' : nickname || path.split('/').at(-1).replaceAll('_', ' '));
 const team = configured.team || (path.includes('qa') || path.includes('review') ? 'qa' : path.includes('research') || path.includes('identity') ? 'research' : 'implementation');
 if (!validTeam.has(team)) throw Error(`Invalid team in bridge config for ${path}`);
 const assignment = configured.assignment || { en: 'Assigned project work', es: 'Trabajo de proyecto asignado', pt: 'Trabalho de projeto atribuído' };
 if (typeof name !== 'string' || !['en','es','pt'].every(k => typeof assignment[k] === 'string')) throw Error(`Invalid bridge config for ${path}`);
 return { key, path, name, team, assignment };
}
function eventFrom(row, lineNo, file, agent, current) {
 const p = row.payload || {};
 let kind, status, summary;
 if (row.type === 'event_msg' && p.type === 'task_started') { kind = 'assigned'; status = 'running'; summary = labels.assigned; }
 else if (row.type === 'event_msg' && p.type === 'task_complete') { kind = 'completed'; status = 'completed'; summary = labels.completed; }
 else if (row.type === 'event_msg' && p.type === 'turn_aborted') { kind = 'error'; status = 'error'; summary = labels.error; }
 else if (row.type === 'response_item' && (p.type === 'custom_tool_call' || p.type === 'function_call')) { kind = 'progress'; status = 'running'; summary = safeToolLabel(String(p.name || '')); }
 else if (row.type === 'turn_context' && typeof p.model === 'string' && current.model && p.model !== current.model) { kind = 'model_changed'; status = current.status; summary = labels.model_changed; }
 else return null;
 const time = Date.parse(row.timestamp || p.started_at || '');
 if (!Number.isFinite(time) || time > Date.now() + 60_000) return null;
 return { ...agent, model: current.model || 'Unknown', reasoning: current.reasoning || 'Unknown', status, lastActivityAt: time, eventId: `${agent.key}:${basename(file)}:${lineNo}`, kind, summary };
}
async function readBounded(file, config) {
 const handle = await open(file, 'r');
 try {
  const { size } = await handle.stat();
  const head = Buffer.alloc(Math.min(size, 1024 * 1024));
  await handle.read(head, 0, head.length, 0);
  const firstEnd = head.indexOf(10);
  if (firstEnd < 0) return null;
  const header = JSON.parse(head.subarray(0, firstEnd).toString('utf8'));
  if (header.type !== 'session_meta') return null;
  const agent = details(header.payload, config);
  if (!agent) return null;
  const limit = 8 * 1024 * 1024;
  const start = Math.max(0, size - limit);
  const tail = Buffer.alloc(size - start);
  await handle.read(tail, 0, tail.length, start);
  const offset = start ? tail.indexOf(10) + 1 : 0;
  if (offset < 0) return null;
  return { agent, lines: tail.subarray(offset).toString('utf8').split('\n'), offset: start + offset };
 } finally { await handle.close(); }
}
async function scan(state) {
 const config = await readConfig();
 const latest = [];
 const selected = [];
 for (const file of await filesUnder(sessions)) {
  let bounded; try { bounded = await readBounded(file, config); } catch { continue; }
  if (!bounded) continue;
  const lines = bounded.lines;
  const agent = bounded.agent;
  const prior = state.agentMeta?.[agent.key] || {};
  const hasContext = lines.some(line => line.includes('\"type\":\"turn_context\"'));
  let current = { model: hasContext ? '' : prior.model || '', reasoning: hasContext ? '' : prior.reasoning || '', status: prior.status || 'idle' }, recent = null, changedModel = null, terminal = null;
  let byteOffset = bounded.offset;
  for (let i = 0; i < lines.length; i++) {
   const position = byteOffset;
   byteOffset += Buffer.byteLength(lines[i], 'utf8') + 1;
   let row; try { row = JSON.parse(lines[i]); } catch { continue; }
   if (row.type === 'turn_context') {
    const p = row.payload || {};
    const changed = eventFrom(row, position, file, agent, current);
    if (typeof p.model === 'string') current.model = p.model;
    if (typeof p.effort === 'string') current.reasoning = p.effort;
    if (changed) changedModel = { ...changed, model: current.model, reasoning: current.reasoning };
    continue;
   }
   const event = eventFrom(row, position, file, agent, current);
   if (event) { recent = event; current.status = event.status; if (event.kind === 'completed' || event.kind === 'error') terminal = event; }
  }
  if (recent) {
   latest.push(recent);
   for (const event of [changedModel, terminal, recent]) if (event && !selected.some(x => x.eventId === event.eventId)) selected.push(event);
   state.agentMeta ||= {};
   state.agentMeta[agent.key] = { model: current.model || prior.model, reasoning: current.reasoning || prior.reasoning, status: current.status };
  }
 }
 return { latest: latest.sort((a,b) => b.lastActivityAt - a.lastActivityAt), selected: selected.sort((a,b) => a.lastActivityAt - b.lastActivityAt) };
}
async function tick() {
 const state = await readState();
 const { latest: all, selected } = await scan(state);
 const changed = selected.filter(e => !(state.published[e.key] || []).includes(e.eventId));
 if (!publish) {
  console.log(JSON.stringify({ scope: ROOT, mode: 'dry-run', agents: all.map(({ key,path,name,team,model,reasoning,status,lastActivityAt,kind,summary }) => ({ key,path,name,team,model,reasoning,status,lastActivityAt,kind,summary })) }, null, 2));
  return;
 }
 const cli = join(process.cwd(), 'node_modules/.bin/convex');
 for (const event of changed) {
  const { path, ...payload } = event;
  try {
   await run(cli, ['run', '--prod', 'agentActivity:record', JSON.stringify(payload)], { cwd: process.cwd(), timeout: 60_000, maxBuffer: 1024 * 1024 });
   state.published[event.key] = [...(Array.isArray(state.published[event.key]) ? state.published[event.key] : [state.published[event.key]].filter(Boolean)), event.eventId].slice(-12);
   await mkdir(dirname(statePath), { recursive: true });
   await writeFile(statePath, JSON.stringify(state, null, 2), { mode: 0o600 });
   console.log(`Published ${event.name}: ${event.kind}`);
  } catch (error) { console.error(`Publish failed for ${event.name}: ${error.message.split('\n')[0]}`); process.exitCode = 1; }
 }
 if (!changed.length) console.log('No new agent activity.');
}
await tick();
if (watch) {
 // Serial polling avoids concurrent writes when the Convex CLI takes longer than one interval.
 while (true) {
  await new Promise(resolve => setTimeout(resolve, 15_000));
  try { await tick(); } catch (e) { console.error(`Bridge scan failed: ${e.message}`); process.exitCode = 1; }
 }
}
