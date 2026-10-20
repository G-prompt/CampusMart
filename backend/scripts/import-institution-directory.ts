/**
 * Trusted operator import: supply an accurately reviewed NUC/NBTE CSV.
 * Required headers: name,shortName,state,city,kind
 * Optional: featuredInSignup
 * Safeguards: preserves existing IDs by exact slug/name+state matching, dry run by default,
 * never turns on seller onboarding or student verification for a new institution.
 * Example:
 *   npx tsx scripts/import-institution-directory.ts ./data/official-institutions.csv
 *   CAMPUSMART_DIRECTORY_CONFIRM=YES npx tsx scripts/import-institution-directory.ts ./data/official-institutions.csv
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";
import { InstitutionKind } from "../src/generated/prisma/client";
const allowed = new Set(Object.values(InstitutionKind));
function slugify(s: string) { return s.normalize("NFKC").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,""); }
// RFC4180-style quoted cells, commas, double quotes and newlines.
function parse(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quotes = false;
  for (let i=0;i<text.length;i++) {
    const c=text[i];
    if (c==='"') { if(quotes && text[i+1]==='"'){cell+='"';i++;}else{quotes=!quotes;} }
    else if(c===','&&!quotes){row.push(cell.trim());cell="";}
    else if((c==='\n'||c==='\r')&&!quotes){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell.trim()); if(row.some(Boolean))rows.push(row);row=[];cell="";}
    else cell+=c;
  }
  if(quotes)throw new Error("Invalid CSV quotation");
  row.push(cell.trim());if(row.some(Boolean))rows.push(row);
  return rows;
}
async function main() {
  const file=process.argv[2];if(!file)throw Error("Pass a reviewed NUC/NBTE CSV file path.");
  const rows=parse(readFileSync(file,"utf8"));const headers=rows.shift()?.map(s=>s.replace(/^\uFEFF/,"").trim());
  if(!headers)throw Error("Missing headers");
  for(const required of ["name","shortName","state","city","kind"])if(!headers.includes(required))throw Error("Missing column: "+required);
  const index=(key:string)=>headers.indexOf(key);
  const list=rows.map((row,n)=>{
    const get=(key:string)=>row[index(key)]?.normalize("NFKC").trim()||"";
    const name=get("name"),shortName=get("shortName"),state=get("state"),city=get("city"),kind=get("kind");
    if(!name||!shortName||!state||!city||!allowed.has(kind as InstitutionKind))throw Error(`Invalid required data at CSV row ${n+2}`);
    return { name,shortName,state,city,kind:kind as InstitutionKind,featuredInSignup:get("featuredInSignup").toLowerCase()==="true" };
  });
  const seen=new Set<string>();
  for(const entry of list){const key=slugify(entry.name)+'|'+slugify(entry.state);if(seen.has(key))throw Error("Duplicate institution: "+entry.name);seen.add(key);}
  const confirmed=process.env.CAMPUSMART_DIRECTORY_CONFIRM==="YES";
  let existing=0,inserted=0,skipped=0;
  for(const item of list) {
    const slug=slugify(item.name);
    const found=await prisma.university.findFirst({where:{OR:[{slug},{name:{equals:item.name,mode:"insensitive"},state:{equals:item.state,mode:"insensitive"}}]}});
    if(found){existing++;continue;} // Existing identities, status and IDs must never be reset.
    if(!confirmed){skipped++;continue;}
    await prisma.university.create({data:{name:item.name,shortName:item.shortName,slug, state:item.state,city:item.city,country:"Nigeria",institutionKind:item.kind,
      featuredInSignup:item.featuredInSignup||item.state.toLowerCase()==="rivers",active:true,sellerApplicationsOpen:false,studentVerificationEnabled:false}});
    inserted++;
  }
  console.log(JSON.stringify({confirmed,sourceFile:file,csvRows:rows.length,alreadyPresent:existing,created:inserted,wouldCreate:skipped},null,2));
  if(!confirmed)console.log("DRY RUN ONLY. Validate the source, then set CAMPUSMART_DIRECTORY_CONFIRM=YES to import.");
}
main().catch(err=>{console.error(err);process.exitCode=1;}).finally(()=>prisma.$disconnect());
