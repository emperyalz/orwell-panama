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
    checks.push({language,text,person:person.externalId,account:account.url,zeroPosts:account.posts,screenshot,runtimeErrors:errors});await context.close();
   }
  }else{
   const page=await browser.newPage();const response=await page.goto(productionUrl,{waitUntil:'domcontentloaded',timeout:60000});
   if(response?.status()!==200)throw Error('Production page unavailable');await page.locator('main').waitFor({state:'visible',timeout:30000});checks.push({kind:'production-render',status:response.status()});
  }
  const record={itemKey,at:Date.now(),productionUrl,state:'passed',checks};await writeFile(join(directory,'result.json'),JSON.stringify(record,null,2),{mode:0o600});return record;
 }catch(error){await writeFile(join(directory,'failure.json'),JSON.stringify({itemKey,at:Date.now(),reason:error.message,checks},null,2),{mode:0o600});throw error;}
 finally{await browser.close();}
}
