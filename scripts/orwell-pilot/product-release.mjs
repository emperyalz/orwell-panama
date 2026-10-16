/** Root-owned policy checks. Never source commands or writable scope from model output. */
import {createHash} from 'node:crypto';
import {constants} from 'node:fs';
import {lstat,open,readdir} from 'node:fs/promises';
import {join,relative,resolve} from 'node:path';

const excluded=new Set(['.git','node_modules','.next','.vercel','.impeccable','artifacts','tmp','output']);
const ignored=name=>excluded.has(name)||name.startsWith('.env')||name.endsWith('.tsbuildinfo');

/** A whole-source snapshot, including untracked files, deletions and permission changes. */
export async function sourceManifest(workspace){
 const root=resolve(workspace),files=Object.create(null);
 if((await lstat(root)).isSymbolicLink())throw Error('Workspace symlink refused');
 async function visit(directory){
  for(const name of (await readdir(directory)).sort()){
   if(ignored(name))continue;
   const path=join(directory,name),info=await lstat(path),key=relative(root,path).split('\\').join('/');
   if(info.isSymbolicLink())throw Error(`Source symlink refused: ${key}`);
   if(info.isDirectory())await visit(path);
   else if(info.isFile()){
    const file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
    try{
     const actual=await file.stat();
     if(!actual.isFile()||actual.ino!==info.ino||actual.dev!==info.dev)throw Error(`Source changed during snapshot: ${key}`);
     files[key]=Object.freeze({sha256:createHash('sha256').update(await file.readFile()).digest('hex'),mode:actual.mode&0o777});
    }finally{await file.close();}
   }else throw Error(`Special source file refused: ${key}`);
  }
 }
 await visit(root);
 const revision=`sha256:${createHash('sha256').update(JSON.stringify(files)).digest('hex')}`;
 return Object.freeze({files:Object.freeze(files),revision});
}

function allowedPaths(itemKey,scope){
 const paths=scope?.allowedPaths?.[itemKey];
 if(!Array.isArray(paths)||!paths.length)throw Error(`Missing allowed paths: ${itemKey}`);
 for(const path of paths){
  if(typeof path!=='string'||!path||path.startsWith('/')||path.includes('\\')||/[\0\r\n*?\[\]{}]/.test(path))throw Error('Invalid allowed path');
  const parts=path.replace(/\/$/,'').split('/');
  if(parts.some(part=>!part||part==='.'||part==='..'||ignored(part)))throw Error('Invalid or excluded allowed path');
 }
 return paths;
}

/** Call around every mutable worker turn, using the saved pre-turn snapshot. */
export function assertScopedChanges({before,after,itemKey,scope}){
 const paths=allowedPaths(itemKey,scope);
 if(!before?.files||!after?.files)throw Error('Both source manifests are required');
 const changes=[...new Set([...Object.keys(before.files),...Object.keys(after.files)])].sort().filter(path=>JSON.stringify(before.files[path])!==JSON.stringify(after.files[path]));
 const unauthorized=changes.filter(file=>!paths.some(path=>path.endsWith('/')?file.startsWith(path):file===path));
 if(unauthorized.length)throw Error(`Source changes outside ${itemKey}: ${unauthorized.join(', ')}`);
 return changes;
}

/** Run only fixed commands in the private trusted scope with the controller's unprivileged runner. */
export async function verifyProductArtifact({workspace,itemKey,scope,runCommand}){
 allowedPaths(itemKey,scope);
 const configured=scope?.productChecks?.[itemKey];
 const commands=Array.isArray(configured)&&typeof configured[0]==='string'?[configured]:configured;
 if(!Array.isArray(commands)||!commands.length||typeof runCommand!=='function')throw Error(`Missing product checks: ${itemKey}`);
 // Validate the entire plan before executing any part of it.
 for(const entry of commands){
  if(!Array.isArray(entry)||entry.length!==2||typeof entry[0]!=='string'||!entry[0]||/[\0\r\n]/.test(entry[0])||!Array.isArray(entry[1])||entry[1].some(arg=>typeof arg!=='string'||arg.includes('\0')))throw Error('Invalid product check command');
 }
 const before=await sourceManifest(workspace),checks=[];
 for(const [command,args] of commands){
  const result=await runCommand(command,[...args],{cwd:workspace,shell:false});
  const check={command,args:[...args],code:result?.code??null,out:String(result?.out??''),err:String(result?.err??'')};
  checks.push(check);
  if(check.code!==0||result?.signal){
   const error=Error(`Product check failed: ${command} (exit ${check.code})`);error.checks=checks;throw error;
  }
 }
 const after=await sourceManifest(workspace);
 if(before.revision!==after.revision){const error=Error('Product verifier changed source');error.checks=checks;throw error;}
 return {itemKey,checks,revision:after.revision};
}
