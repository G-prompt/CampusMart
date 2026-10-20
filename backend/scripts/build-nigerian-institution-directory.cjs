#!/usr/bin/env node
/**
 * National Universities Commission (NUC) live-source extraction.
 * Reads the regulator's university table directly; NEVER fabricates institutions.
 * Fails closed if source shape/content changes. Writes a REVIEWABLE CSV for the importer.
 * Includes a separately sourced, partial NBTE polytechnic starter file.
 * Usage from backend: node scripts/build-nigerian-institution-directory.cjs
 * Offline fixture: node scripts/build-nigerian-institution-directory.cjs --html path/to/nuc.html
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const NUC = 'https://enuc.nuc.edu.ng/nus';
const ST = new Set(['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara']);
const FEATURED = new Set(['Rivers State University','University of Port Harcourt','Ignatius Ajuru University of Education','PAMO University of Medical Sciences','University of Lagos','University of Ibadan','University of Benin','University of Nigeria','Ahmadu Bello University','University of Calabar','University of Ilorin','Obafemi Awolowo University','Covenant University','Babcock University','University of Abuja','Nnamdi Azikiwe University','Federal University of Technology, Owerri','Federal University of Technology, Akure','Lagos State University']);
function htmlText(s) {
  const entities = {nbsp:' ',amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',ndash:'–',mdash:'—',rsquo:'’',lsquo:'‘',ldquo:'“',rdquo:'”'};
  return s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
    .replace(/<[^>]*>/g,' ').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(_,x)=>{
      if(x[0]==='#') { const n = x[1]?.toLowerCase()==='x'?parseInt(x.slice(2),16):parseInt(x.slice(1),10); return Number.isFinite(n)&&n>0&&n<0x110000?String.fromCodePoint(n):' '; }
      return entities[x.toLowerCase()] ?? ' ';
    }).replace(/\s+/g,' ').trim();
}
function parseNUC(html){
  const rows=[];
  const tr=[...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi)];
  for(const match of tr){
    const cells=[...match[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]\s*>/gi)].map(m=>htmlText(m[1]));
    // NUC table is ordinal, University Name, Year Established, Ownership, State, Action.
    if(cells.length < 5 || !/^\d{1,3}$/.test(cells[0]))continue;
    const [rank,name,year,ownership,rawState] = cells;
    if(!/^20\d\d$|^19\d\d$|^18\d\d$/.test(year) || !['Federal','State','Private'].includes(ownership))continue;
    let state=rawState.replace(/^FCT\s*Abuja$/i,'FCT').replace(/^Anambara$/i,'Anambra').trim();
    if(!ST.has(state))throw Error(`Official source has an unrecognised state for ${name}: ${rawState}`);
    const parts=name.split(',').map(x=>x.trim()).filter(Boolean);
    let city='Not specified';
    if(parts.length>=2){
      const candidate=parts[1];
      const cleaned=candidate.replace(/\s+State$/i,'').trim();
      if(cleaned && !/^(?:fct|state|university)$/i.test(cleaned) && cleaned.toLowerCase()!==state.toLowerCase() && !/university/i.test(cleaned)) city=cleaned;
    }
    if (state==='FCT' && city==='Not specified')city='Abuja';
    // Keep source wording for traceability. Preserve core existing CampusMart IDs via import aliases.
    const base=parts[0].replace(/\s+/g,' ');
    const featured=state==='Rivers'||[...FEATURED].some(x=>base.toLowerCase().includes(x.toLowerCase()));
    rows.push({rank:Number(rank),name,shortName:base.slice(0,100),state,city,kind:'university',featuredInSignup:featured,sourceAuthority:'NUC',sourceUrl:NUC,sourceYear:year,ownership});
  }
  rows.sort((a,b)=>a.rank-b.rank);
  if(rows.length < 300 || rows.length > 500) throw Error(`NUC scrape returned ${rows.length} rows; expected ~328. Website structure may have changed; NO CSV WRITTEN.`);
  if(new Set(rows.map(x=>x.rank)).size!==rows.length || rows[0].rank!==1)throw Error('NUC rank mismatch or duplicate; inspect source.');
  if(!rows.some(x=>x.state==='Rivers'&&x.name.includes('University of Port-Harcourt')))throw Error('NUC verification failed: UNIPORT absent.');
  if(!rows.some(x=>x.name.includes('University of Calabar')))throw Error('NUC verification failed: UNICAL absent.');
  return rows;
}
function csv(rows){
  const keys=['name','shortName','state','city','kind','featuredInSignup','sourceAuthority','sourceUrl','sourceYear','ownership'];
  const esc=v=>{const s=String(v??'');return /[",\n\r]/.test(s)?`"${s.replaceAll('"','""')}"`:s;};
  return [keys.join(','),...rows.map(r=>keys.map(k=>esc(r[k])).join(','))].join('\r\n')+'\r\n';
}
async function main(){
  const offlineIdx=process.argv.indexOf('--html');
  const html=offlineIdx>-1?fs.readFileSync(process.argv[offlineIdx+1],'utf8'):await (async()=>{
    const abort=AbortSignal.timeout(45000);
    const response=await fetch(NUC,{signal:abort,headers:{'User-Agent':'CampusMartDirectoryReview/1.0 (admin-sourced publicly available NUC directory)','Accept':'text/html'}});
    if(!response.ok)throw Error(`NUC returned HTTP ${response.status}`);
    return await response.text();
  })();
  const universities=parseNUC(html);
  const output=path.resolve(__dirname,'../data/nuc-universities-reviewed.csv');
  fs.writeFileSync(output,csv(universities),'utf8');
  console.log(`NUC reviewed source: ${universities.length} universities across ${new Set(universities.map(x=>x.state)).size} states/FCT.`);
  console.log(`Saved: ${output}`);
  console.log('City marked "Not specified" means NUC source did not clearly identify a city. It is NOT a guessed location.');
  console.log('NEXT: run the importer in DRY RUN mode with this CSV. The database is unchanged.');
}
if(require.main===module){main().catch(e=>{console.error('DIRECTORY BUILD FAILED:',e.message);process.exitCode=1;});}
module.exports={parseNUC,htmlText,csv};
