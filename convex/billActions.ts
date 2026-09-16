'use node';
import {internalAction} from './_generated/server';
import {internal} from './_generated/api';
import {v} from 'convex/values';
import {load} from 'cheerio';
const source='https://sistemas.asamblea.gob.pa/segLegis/viewsPublico/SeguimientoLegislativo';
/** Read-only ASP.NET search. Preserve official stage and ficha, not inferred voting outcomes. */
export const refresh=internalAction({args:{maxPages:v.optional(v.number())},handler:async(ctx,{maxPages=10}):Promise<{pages:number;inserted:number;changed:number;errors:string[]}>=>{
 let inserted=0,changed=0,pages=0;const errors:string[]=[];
 try{const initial=await fetch(source,{signal:AbortSignal.timeout(30000)});if(!initial.ok)throw Error(`HTTP ${initial.status}`);let cookie=initial.headers.get('set-cookie')?.split(';')[0]||'';let html=await initial.text();
  async function post(button:string,next?:number){const $=load(html);const body=new URLSearchParams();$('input[type="hidden"]').each((_,el)=>{const name=$(el).attr('name');if(name)body.set(name,$(el).attr('value')||'');});if(next){body.set('__EVENTTARGET','dataTable');body.set('__EVENTARGUMENT',`Page$${next}`);}else body.set(button,'🔎');const res=await fetch(source,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Cookie:cookie},body,signal:AbortSignal.timeout(45000)});if(!res.ok)throw Error(`HTTP ${res.status}`);cookie=res.headers.get('set-cookie')?.split(';')[0]||cookie;html=await res.text();}
  await post('btnMostrarTodo');
  for(let page=1;page<=Math.min(maxPages,150);page++){
   const $=load(html);const rows=$('#dataTable>tbody>tr,#dataTable>tr').toArray().flatMap(el=>{const cells=$(el).children('td');if(cells.length!==9)return [];const value=(i:number)=>cells.eq(i).text().replace(/\s+/g,' ').trim();const date=value(2).match(/^(\d{2})-(\d{2})-(\d{4})$/);if(!date)return [];return [{ficha:value(3),projectNumber:value(4)&&value(4)!=='0'?value(4):undefined,anteprojectNumber:value(5)&&value(5)!=='0'?value(5):undefined,title:value(6),stage:value(7),proponents:value(8),presentedAt:Date.parse(`${date[3]}-${date[2]}-${date[1]}T00:00:00Z`),sourceUrl:source}];});
   if(!rows.length)throw Error(`No bill rows on page ${page}`);const result=await ctx.runMutation(internal.bills.ingest,{rows});inserted+=result.inserted;changed+=result.changed;pages++;
   if(rows.every(r=>r.presentedAt<Date.parse('2024-07-01')))break;const next=page+1;if(!$('a[href]').toArray().some(el=>$(el).attr('href')?.includes(`Page$${next}'`)))break;await post('',next);
  }
 }catch(e){errors.push(String(e));}
 await ctx.runMutation(internal.activity.logRun,{kind:'bills',inserted,errors});return {pages,inserted,changed,errors};
}});
