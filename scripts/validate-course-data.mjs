import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const db = JSON.parse(fs.readFileSync("data/courses/asia-courses.json", "utf8"));
const html = fs.readFileSync("index.html", "utf8");
const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
const ids = new Set();
const allowedCountries = new Set(db.countries || []);
assert.ok(allowedCountries.size > 0, "country registry in course dataset must not be empty");
const allowedStatuses = new Set(["verified","partially_verified","unverified"]);

assert.ok(Array.isArray(db.courses) && db.courses.length > 0, "courses array must be populated");
for (const c of db.courses) {
  assert.ok(c.course_id && !ids.has(c.course_id), "course_id must exist and be unique: " + c.course_id);
  ids.add(c.course_id);
  assert.match(c.course_id, /^[a-z0-9][a-z0-9-]+$/);
  assert.ok(typeof c.name_en === "string" && c.name_en.length >= 2, c.course_id + " needs English name");
  assert.ok(allowedCountries.has(c.country_code), c.course_id + " has unsupported country");
  assert.ok(allowedStatuses.has(c.verification_status), c.course_id + " has invalid verification status");
  const hasLat = Number.isFinite(c.latitude), hasLon = Number.isFinite(c.longitude);
  assert.equal(hasLat, hasLon, c.course_id + " must have both GPS coordinates or neither");
  if (hasLat) {
    assert.ok(c.latitude >= -90 && c.latitude <= 90, c.course_id + " latitude out of range");
    assert.ok(c.longitude >= -180 && c.longitude <= 180, c.course_id + " longitude out of range");
    assert.ok(c.timezone, c.course_id + " GPS requires IANA timezone");
    assert.doesNotThrow(() => new Intl.DateTimeFormat("en", { timeZone: c.timezone }), c.course_id + " invalid timezone");
  }
  if (c.verification_status === "verified") {
    assert.ok(hasLat && c.timezone && c.official_address && c.official_website, c.course_id + " verified record incomplete");
  }
}
const vietnam = db.courses.filter(c => c.country_code === "VN");
assert.equal(vietnam.length, 8, "Vietnam should contain 8 courses including the 3 Hanoi additions");

function normalize(value) {
  return String(value ?? "").normalize("NFKC").toLocaleLowerCase()
    .replace(/[’'".,，。・、\-_/\\()（）\[\]{}]/g, " ").replace(/\s+/g, " ").trim();
}
function distance(a,b) {
  const x=[...a], y=[...b]; if (Math.abs(x.length-y.length)>3) return 99;
  let prev=Array.from({length:y.length+1},(_,i)=>i);
  for(let i=1;i<=x.length;i++){const cur=[i];for(let j=1;j<=y.length;j++)cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(x[i-1]===y[j-1]?0:1));prev=cur;}
  return prev[y.length];
}
function searchScore(c, query) {
  const q=normalize(query); if(!q)return 1;
  const fields=[c.name_en,c.local_name,c.short_name,...(c.aliases||[]),...(c.search_keywords||[]),c.city,c.region,c.country,c.official_address,c.local_address,c.postal_code];
  const values=fields.filter(Boolean).map(normalize);
  if(values.includes(q))return 1000;
  if(values.some(x=>x.startsWith(q)))return 850;
  const tokens=q.split(" ").filter(Boolean), joined=values.join(" ");
  if(tokens.every(t=>joined.includes(t)))return 700;
  const best=Math.min(...values.map(x=>distance(q,x.slice(0,Math.max(q.length,Math.min(x.length,q.length+3))))));
  return best<=2?500-best*50:0;
}
const expected = [
  ["Long Bien","vn-long-bien"],["Long Biên","vn-long-bien"],
  ["Legend Hill","vn-legend-hill"],["BRG Legend Hill","vn-legend-hill"],
  ["Kings Island","vn-kings-island"],["King's Island","vn-kings-island"],["Đảo Vua","vn-kings-island"]
];
for (const [term,id] of expected) {
  const matches=db.courses.map(c=>({id:c.course_id,score:searchScore(c,term)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
  assert.equal(matches[0]?.id,id,"search should resolve " + term);
}
const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(s=>s.trim());
for(const [i,code] of scripts.entries()) new vm.Script(code,{filename:"index-inline-"+i+".js"});
assert.equal(manifest.name,"World Golf Weather");
assert.ok(manifest.icons.some(x=>x.sizes==="192x192") && manifest.icons.some(x=>x.sizes==="512x512"),"PWA icons missing");
console.log("PASS: "+db.courses.length+" courses; "+db.courses.filter(c=>Number.isFinite(c.latitude)&&c.timezone).length+" GPS+timezone; "+vietnam.length+" Vietnam courses; 7 alias/name search cases; "+scripts.length+" inline script syntax; manifest checks.");
