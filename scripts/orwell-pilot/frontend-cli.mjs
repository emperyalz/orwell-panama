#!/usr/bin/env node
/** Root release wrapper: native Vercel CLI followed by actual product browser QA. */
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {verifyProductBrowser} from './frontend-browser-gate.mjs';
const args=process.argv.slice(2),expected=['deploy','--yes','--prod','--archive=tgz'];
if(JSON.stringify(args)!==JSON.stringify(expected)||process.getuid()!==0)throw Error('Only the fixed root production release is supported');
const stateDir='/var/lib/orwell-agent-controller';
const affinity=JSON.parse(await readFile(`${stateDir}/affinity.json`,'utf8'));
if(!affinity?.itemKey)throw Error('Current trusted release item is required');
const child=spawn('/opt/paperclip-runtime/bin/node',['/opt/orwell-deploy/node_modules/vercel/dist/index.js',...args],{cwd:process.cwd(),env:process.env,stdio:'inherit'});
const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);});
if(code!==0)process.exit(code??1);
const proof=await verifyProductBrowser({itemKey:affinity.itemKey,stateDir});
console.error(`Independent production browser gate: ${proof.state}; ${proof.checks.length} scenarios. Evidence saved in private controller state.`);
