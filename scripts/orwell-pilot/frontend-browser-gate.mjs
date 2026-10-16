/** Fixed live product checks. Run after publication, before release acknowledgement. */
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
export async function verifyProductBrowser({itemKey,stateDir='/var/lib/orwell-agent-controller',productionUrl='https://orwell-panama.vercel.app'}){
 if(productionUrl!=='https://orwell-panama.vercel.app')throw Error('Wrong production browser target');
 const {chromium}=createRequire('/opt/orwell-deploy/package.json')('playwright');
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const directory=join(stateDir,`browser-${Date.now()}`);await mkdir(directory,{recursive:true,mode:0o700});
 const checks=[];
 try{
  if(itemKey==='scoreboard-budget40/apply-and-verify'){
   const page=await browser.newPage();const response=await page.goto(productionUrl+'/scoreboard#live-operations',{waitUntil:'domcontentloaded',timeout:60000});
   if(response?.status()!==200)throw Error('Scoreboard unavailable');
   const panel=page.locator('#live-operations');await panel.locator('.controller-status-providers').waitFor({state:'visible',timeout:60000});
   const r=await fetch('https://fleet-vole-527.convex.cloud/api/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:'controllerStatus:snapshot',args:{},format:'json'})});const snapshot=(await r.json()).value;
   const budget=await panel.locator('.controller-status-allowance').innerText();
   if(!budget.includes('Codex 40')||!budget.includes('Claude 30'))throw Error('Distinct40/30 provider budgets missing from live scoreboard');
   const work=await panel.locator('.controller-status-work').innerText();
   if(!work.includes(snapshot.progress.completed+' / '+snapshot.progress.total))throw Error('Displayed progress differs from authoritative checklist');
   for(const blocker of snapshot.blockers)if(!work.replace(/\s+/g,' ').includes(blocker.reason.replace(/\s+/g,' ')))throw Error('Actual blocker missing from scoreboard: '+blocker.key);
   const screenshot=join(directory,'scoreboard-budget40.png');await page.screenshot({path:screenshot,fullPage:true});
   checks.push({kind:'actual-live-scoreboard',providerLimits:snapshot.providers.map(p=>({provider:p.provider,limitPoints:p.limitPoints})),progress:snapshot.progress,blockerKeys:snapshot.blockers.map(b=>b.key),screenshot});
  }else if(itemKey==='communication-trends/track-communication-changes'){
   const r=await fetch('https://fleet-vole-527.convex.cloud/api/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:'intelligence:archive',args:{},format:'json'})});const data=(await r.json()).value;
   const shift=m=>{const d=new Date(m+'-01T00:00:00Z');d.setUTCMonth(d.getUTCMonth()+1);return d.toISOString().slice(0,7);};
   const prior=data.buckets.find(b=>b.count>0&&data.people.some(p=>p.id===b.person)&&data.accounts.some(a=>a.person===b.person&&a.platform===b.platform&&a.posts>0)&&!data.buckets.some(c=>c.person===b.person&&c.platform===b.platform&&c.month===shift(b.month)&&c.count>0));
   if(!prior)throw Error('Actual zero-current positive-prior archive fixture required');
   const person=data.people.find(p=>p.id===prior.person),month=shift(prior.month),sum=data.buckets.filter(b=>b.person===prior.person&&b.platform===prior.platform&&b.month===prior.month).reduce((n,b)=>n+b.count,0);
   const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addInitScript(()=>localStorage.setItem('orwell-panama-language','en'));
   const page=await context.newPage();await page.goto(productionUrl+'/inteligencia?person='+encodeURIComponent(person.externalId),{waitUntil:'domcontentloaded',timeout:60000});await page.locator('.intelligence-health tbody tr').first().waitFor({state:'visible',timeout:60000});
   await page.locator('.intelligence-platforms button').nth([...new Set(data.buckets.map(b=>b.platform))].sort().indexOf(prior.platform)+1).click();
   const dates=page.locator('.intelligence-filters input[type=month]');await dates.nth(0).fill(month);await dates.nth(1).fill(month);await page.locator('.intelligence-trend header button').nth(2).click();
   const change=page.locator('.intelligence-change[role=status]');await change.waitFor({state:'visible',timeout:15000});
   const values=(await change.locator('strong').allTextContents()).map(t=>Number(t.replace(/[^0-9+-]/g,'')));
   if(JSON.stringify(values)!==JSON.stringify([0,sum,-sum]))throw Error('Rendered0-minus-N delta differs from actual archived counts: '+JSON.stringify({values,expected:[0,sum,-sum]}));
   const screenshot=join(directory,'actual-zero-current-decline.png');await page.screenshot({path:screenshot,fullPage:true});
   await page.locator('.intelligence-trend header button').nth(0).click();if(await change.isVisible())throw Error('Chart selection did not preserve ordinary empty state');
   checks.push({kind:'actual-zero-current-decline',person:person.externalId,platform:prior.platform,month,priorMonth:prior.month,values,screenshot});await context.close();
  }else if(itemKey==='communication-trends/label-uncertainty-and-archive-gaps'){
   const response=await fetch('https://fleet-vole-527.convex.cloud/api/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:'intelligence:archive',args:{},format:'json'}),signal:AbortSignal.timeout(30000)});
   const result=await response.json();if(!response.ok||result.status!=='success')throw Error('Live archive unavailable');
   const data=result.value,account=data.accounts.find(a=>a.posts===0),person=data.people.find(p=>p.id===account?.person);
   if(!person)throw Error('No actual zero-post account available for the live gap scenario');
   const latestMonth=data.buckets.map(b=>b.month).sort().at(-1);
   const positive=data.accounts.find(a=>a.posts>0&&data.accounts.filter(b=>b.person===a.person&&b.platform===a.platform).every(b=>b.posts>0)&&!data.buckets.some(b=>b.person===a.person&&b.platform===a.platform&&b.month===latestMonth));
   const positivePerson=data.people.find(p=>p.id===positive?.person),covered=data.buckets.find(b=>b.person===positive?.person&&b.platform===positive?.platform&&b.count>0);
   if(!positivePerson||!covered||data.buckets.some(b=>b.month==='1900-01'))throw Error('Actual covered-month and empty-month fixtures are required');
   const platformIndex=[...new Set(data.buckets.map(b=>b.platform))].sort().indexOf(positive.platform)+1;
   const importDate=new Date(data.lastSocialImport?.date??0).getTime(),freshImport=Number.isFinite(importDate)&&Date.now()-importDate<=30*86400000;
   const expected={en:'Archive gap:',es:'Brecha de archivo:',pt:'Falha no arquivo:'};
   for(const [language,prefix] of Object.entries(expected)){
    const context=await browser.newContext({viewport:language==='pt'?{width:390,height:844}:{width:1440,height:1000}});
    await context.addInitScript(lang=>localStorage.setItem('orwell-panama-language',lang),language);
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    const navigation=await page.goto(`${productionUrl}/inteligencia?person=${encodeURIComponent(person.externalId)}`,{waitUntil:'domcontentloaded',timeout:60000});
    if(navigation?.status()!==200)throw Error('Product route did not return HTTP200');
    await page.locator('.intelligence-health tbody tr').first().waitFor({state:'visible',timeout:60000});
    const label=page.locator('.intelligence-gap-note[role="status"]');await label.waitFor({state:'visible',timeout:15000});
    const text=(await label.innerText()).trim();if(!text.startsWith(prefix))throw Error(`Missing ${language} gap translation`);
    if(!(await page.locator('.intelligence-health').innerText()).includes(person.name))throw Error('Live gap scenario shows the wrong person');
    const screenshot=join(directory,`${language}.png`);await page.screenshot({path:screenshot,fullPage:true});
    if(errors.length)throw Error(`Product browser runtime error: ${errors.join('; ')}`);
    checks.push({language,scenario:'zero-post-account',text,person:person.externalId,account:account.url,zeroPosts:account.posts,screenshot});
    await page.goto(`${productionUrl}/inteligencia?person=${encodeURIComponent(positivePerson.externalId)}`,{waitUntil:'domcontentloaded',timeout:60000});
    await page.locator('.intelligence-health tbody tr').first().waitFor({state:'visible',timeout:60000});
    await page.locator('.intelligence-platforms button').nth(platformIndex).click();
    const dates=page.locator('.intelligence-filters input[type="month"]');
    await dates.nth(0).fill(covered.month);await dates.nth(1).fill(covered.month);
    await page.waitForFunction(()=>Number(document.querySelector('.intelligence-metrics div:first-child strong')?.textContent?.replace(/\D/g,''))>0,{},{timeout:10000});
    if(freshImport&&await label.isVisible())throw Error('A covered month with positive accounts and a fresh import is falsely labeled as a gap');
    checks.push({language,scenario:'covered-month',person:positivePerson.externalId,platform:positive.platform,month:covered.month,freshImport,gapVisible:await label.isVisible()});
    await dates.nth(0).fill(latestMonth);await dates.nth(1).fill('');
    await page.waitForFunction(()=>document.querySelector('.intelligence-metrics div:first-child strong')?.textContent?.trim()==='0',{},{timeout:10000});
    await label.waitFor({state:'visible',timeout:10000});
    if(!(await label.innerText()).startsWith(prefix))throw Error('Implicit-end monthly gap translation missing');
    checks.push({language,scenario:'month-gap-with-implicit-end',person:positivePerson.externalId,platform:positive.platform,month:latestMonth,gapVisible:true});
    await dates.nth(0).fill('1900-01');await dates.nth(1).fill('1900-01');
    await page.waitForFunction(()=>document.querySelector('.intelligence-metrics div:first-child strong')?.textContent?.trim()==='0',{},{timeout:10000});
    await label.waitFor({state:'visible',timeout:10000});
    if(!(await label.innerText()).startsWith(prefix)||await page.locator('.intelligence-examples article').count())throw Error('Selected-month gap behavior is incorrect');
    const gapScreenshot=join(directory,`${language}-month-gap.png`);await page.screenshot({path:gapScreenshot,fullPage:true});
    if(errors.length)throw Error(`Product browser runtime error: ${errors.join('; ')}`);
    checks.push({language,scenario:'selected-month-gap',person:positivePerson.externalId,platform:positive.platform,accountHasPosts:positive.posts,month:'1900-01',screenshot:gapScreenshot,runtimeErrors:errors});
    await dates.nth(1).fill('1900-02');
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(null)))));
    await label.waitFor({state:'visible',timeout:10000});
    if(!(await label.innerText()).startsWith(prefix)||await page.locator('.intelligence-examples article').count())throw Error('Selected multi-month empty-range gap behavior is incorrect');
    checks.push({language,scenario:'selected-empty-range-gap',person:positivePerson.externalId,platform:positive.platform,from:'1900-01',to:'1900-02',gapVisible:true});await context.close();
   }
  }else{
   const page=await browser.newPage();const response=await page.goto(productionUrl,{waitUntil:'domcontentloaded',timeout:60000});
   if(response?.status()!==200)throw Error('Production page unavailable');await page.locator('main').waitFor({state:'visible',timeout:30000});checks.push({kind:'production-render',status:response.status()});
  }
  const record={itemKey,at:Date.now(),productionUrl,state:'passed',checks};await writeFile(join(directory,'result.json'),JSON.stringify(record,null,2),{mode:0o600});return record;
 }catch(error){await writeFile(join(directory,'failure.json'),JSON.stringify({itemKey,at:Date.now(),reason:error.message,checks},null,2),{mode:0o600});throw error;}
 finally{await browser.close();}
}
