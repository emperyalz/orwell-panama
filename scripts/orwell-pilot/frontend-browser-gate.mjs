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
  if(itemKey==='communication-trends/label-uncertainty-and-archive-gaps'){
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
    checks.push({language,scenario:'selected-month-gap',person:positivePerson.externalId,platform:positive.platform,accountHasPosts:positive.posts,month:'1900-01',screenshot:gapScreenshot,runtimeErrors:errors});await context.close();
   }
  }else{
   const page=await browser.newPage();const response=await page.goto(productionUrl,{waitUntil:'domcontentloaded',timeout:60000});
   if(response?.status()!==200)throw Error('Production page unavailable');await page.locator('main').waitFor({state:'visible',timeout:30000});checks.push({kind:'production-render',status:response.status()});
  }
  const record={itemKey,at:Date.now(),productionUrl,state:'passed',checks};await writeFile(join(directory,'result.json'),JSON.stringify(record,null,2),{mode:0o600});return record;
 }catch(error){await writeFile(join(directory,'failure.json'),JSON.stringify({itemKey,at:Date.now(),reason:error.message,checks},null,2),{mode:0o600});throw error;}
 finally{await browser.close();}
}
