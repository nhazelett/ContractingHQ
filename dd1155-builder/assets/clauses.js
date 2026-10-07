const CLAUSE_METHODS = ["Reference", "Full text", "In parent contract / BPA"];
const clauseDefaults = () => ({purchaseProfile:"Commercial purchase",bpaBasis:"Part 13 BPA",scheduleContract:"",parentTerms:"",incorporationUrls:"https://www.acquisition.gov/far/part-52\nhttps://www.acquisition.gov/dfars/part-252-solicitation-provisions-and-contract-clauses",clauses:[]});
function validateClauseSettings(value) {
  if (value === undefined) return clauseDefaults();
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid clause settings.");
  const clean=clauseDefaults();
  for(const key of ["purchaseProfile","bpaBasis","scheduleContract","parentTerms","incorporationUrls"]) {
    if(typeof value[key]!=="string" || value[key].length>50000) throw new Error("Invalid clause setting: "+key);
    clean[key]=value[key];
  }
  if(!["Commercial purchase","Noncommercial purchase"].includes(clean.purchaseProfile) || !["Part 13 BPA","Federal Supply Schedule BPA","Other BPA"].includes(clean.bpaBasis)) throw new Error("Invalid clause profile.");
  if(!Array.isArray(value.clauses) || value.clauses.length>200) throw new Error("Choose no more than 200 clauses.");
  clean.clauses=value.clauses.map(clause=>{
    const entry={};
    for(const key of ["number","title","date","method","body","fillIns","sourceUrl"]) {
      if(typeof clause[key]!=="string" || clause[key].length>100000) throw new Error("Invalid clause field: "+key);
      entry[key]=clause[key];
    }
    if(typeof clause.included!=="boolean" || !CLAUSE_METHODS.includes(entry.method)) throw new Error("Invalid clause inclusion method.");
    entry.included=clause.included;
    return entry;
  });
  return clean;
}
function safeClauseUrl(value) {
  try {const url=new URL(value);return ["https:","http:"].includes(url.protocol)?url.href:"";}catch{return "";}
}
function clauseField(key,label,value,index,type="text") {
  const attrs=`data-clause="${index}" data-clause-key="${key}"`;
  return inputField(key,label,type,value,attrs);
}
function renderClauseEditor() {
  const settings=state.clauseSettings;
  document.querySelector("#clauseSettings").innerHTML = [
    inputField("purchaseProfile","Purchase starter",["Commercial purchase","Noncommercial purchase"],settings.purchaseProfile,'data-clause-setting="purchaseProfile"'),
    inputField("bpaBasis","BPA basis",["Part 13 BPA","Federal Supply Schedule BPA","Other BPA"],settings.bpaBasis,'data-clause-setting="bpaBasis"'),
    inputField("scheduleContract","Underlying schedule contract no.",undefined,settings.scheduleContract,'data-clause-setting="scheduleContract"'),
    inputField("parentTerms","Parent terms / references", "textarea",settings.parentTerms,'data-clause-setting="parentTerms"'),
    inputField("incorporationUrls","Full-text addresses for incorporation by reference","textarea",settings.incorporationUrls,'data-clause-setting="incorporationUrls"')
  ].join("");
  document.querySelector("#clauseCatalog").innerHTML='<option value="">Choose a clause…</option>'+DD1155_CLAUSE_CATALOG.map(clause=>`<option value="${clause.number}">${escapeHtml(clause.number+" — "+clause.title)}</option>`).join("");
  renderClauseRows();
}
function renderClauseRows() {
  document.querySelector("#clauseEditor").innerHTML=state.clauseSettings.clauses.map((clause,index)=>`<div class="clause-card"><header><label><input type="checkbox" data-clause="${index}" data-clause-key="included" ${clause.included?"checked":""}> Include clause ${index+1}</label><button type="button" class="small" data-remove-clause="${index}">Remove</button></header><div class="field-grid two">${clauseField("number","Clause no.",clause.number,index)}${clauseField("date","Revision date",clause.date,index)}${clauseField("title","Clause title",clause.title,index)}${clauseField("method","Inclusion method",clause.method,index,CLAUSE_METHODS)}${clauseField("sourceUrl","Official source URL",clause.sourceUrl,index)}${clauseField("fillIns","Fill-ins / selections",clause.fillIns,index,"textarea")}<div class="field-span-two" data-clause-body="${index}">${clauseField("body","Full text (editable)",clause.body,index,"textarea")}</div></div>${DD1155_CLAUSE_CATALOG.some(item=>item.number===clause.number)?`<button type="button" class="small" data-load-clause="${index}">Reload official base text</button>`:""}</div>`).join("") || '<p class="empty-note">No clauses selected. Add a starter set, select a clause, or add your own.</p>';
  syncClauseContext();
}
function clauseWarnings() {
  const settings=state.clauseSettings;
  const purchase=state.orderType==="Purchase order";
  const selected=settings.clauses.filter(clause=>clause.included);
  const warnings=[];
  if(purchase && !selected.some(clause=>clause.method!=="In parent contract / BPA")) warnings.push("Select the applicable clauses for this standalone purchase order.");
  if(!purchase && !state.contractNumber.trim()) warnings.push("Enter the parent contract or BPA number in Block 1.");
  if(state.orderType==="BPA call" && settings.bpaBasis==="Federal Supply Schedule BPA" && !settings.scheduleContract.trim()) warnings.push("Enter the underlying Federal Supply Schedule contract number.");
  const seen=new Set();
  selected.forEach(clause=>{
    const label=clause.number||"Untitled clause";
    if(purchase && clause.method==="In parent contract / BPA") {warnings.push(`${label}: parent-only clause is excluded from this purchase order.`);return;}
    if(!clause.number.trim() || !clause.title.trim() || !clause.date.trim()) warnings.push(`${label}: complete the number, title, and revision date.`);
    if(seen.has(clause.number.trim().toUpperCase())) warnings.push(`${label}: duplicate clause number.`);
    seen.add(clause.number.trim().toUpperCase());
    if(clause.method==="Full text" && !clause.body.trim()) warnings.push(`${label}: full text is empty.`);
    if(clause.sourceUrl && !safeClauseUrl(clause.sourceUrl)) warnings.push(`${label}: source URL must start with http:// or https://.`);
    if(["52.212-5","252.232-7006"].includes(clause.number) && clause.method!=="In parent contract / BPA" && !clause.fillIns.trim()) warnings.push(`${label}: review and enter the applicable selections or fill-ins.`);
  });
  const newReferences=selected.some(clause=>clause.method==="Reference");
  if(newReferences && !selected.some(clause=>clause.number==="52.252-2" && clause.method!=="In parent contract / BPA")) warnings.push("Review incorporation-by-reference authority. Add 52.252-2 or document the applicable incorporation language.");
  if(selected.some(clause=>clause.number==="52.252-2" && clause.method==="Full text") && !settings.incorporationUrls.trim()) warnings.push("Complete the full-text addresses for 52.252-2.");
  return warnings;
}
function syncClauseContext() {
  const purchase=state.orderType==="Purchase order";
  const bpa=state.orderType==="BPA call";
  document.querySelector('[data-clause-setting="purchaseProfile"]').closest("label").hidden=!purchase;
  document.querySelector("#applyClauseProfileBtn").hidden=!purchase;
  document.querySelector('[data-clause-setting="bpaBasis"]').closest("label").hidden=!bpa;
  document.querySelector('[data-clause-setting="scheduleContract"]').closest("label").hidden=!(bpa && state.clauseSettings.bpaBasis==="Federal Supply Schedule BPA");
  document.querySelector('[data-clause-setting="parentTerms"]').closest("label").hidden=purchase;
  document.querySelector("#clauseContext").textContent=purchase?"Select clauses for this purchase. Starter sets are editable; review prescriptions, fill-ins, alternates, and agency deviations.":`Block 1 identifies the parent ${bpa?"BPA":"contract"}. Mark existing parent clauses separately from clauses added to this ${bpa?"call":"order"}.`;
  state.clauseSettings.clauses.forEach((clause,index)=>{document.querySelector(`[data-clause-body="${index}"]`).hidden=clause.method!=="Full text";});
  const warnings=clauseWarnings();
  document.querySelector("#clauseWarnings").innerHTML=warnings.length?`<strong>To review</strong><ul>${warnings.map(warning=>`<li>${escapeHtml(warning)}</li>`).join("")}</ul>`:"";
  document.querySelector("#clauseWarnings").hidden=!warnings.length;
}
function addCatalogClause(number) {
  const existing=state.clauseSettings.clauses.find(clause=>clause.number===number);
  if(existing) {existing.included=true;return;}
  if(state.clauseSettings.clauses.length>=200) return;
  const entry=DD1155_CLAUSE_CATALOG.find(clause=>clause.number===number);
  if(!entry) return;
  state.clauseSettings.clauses.push({number:entry.number,title:entry.title,date:entry.date,method:entry.mode,body:entry.body,fillIns:"",sourceUrl:entry.sourceUrl,included:true});
}
function clausePageContents() {
  const settings=state.clauseSettings;
  const purchase=state.orderType==="Purchase order";
  const selected=settings.clauses.filter(clause=>clause.included && (!purchase || clause.method!=="In parent contract / BPA"));
  const blocks=[];
  if(!purchase) {
    const bpa=state.orderType==="BPA call";
    let text=bpa?`This call is issued under BPA ${state.contractNumber || "[Enter BPA number in Block 1]"}. Applicable BPA terms govern this call.`:`This order is issued under contract ${state.contractNumber || "[Enter contract number in Block 1]"} and is subject to its terms and conditions.`;
    if(bpa && settings.bpaBasis==="Federal Supply Schedule BPA") text+=`\nUnderlying schedule contract: ${settings.scheduleContract || "[Enter schedule contract number]"}. Applicable schedule contract terms also govern.`;
    if(settings.parentTerms.trim()) text+="\n\n"+settings.parentTerms;
    blocks.push({title:"Parent Contract / BPA Terms",text});
  }
  const inherited=selected.filter(clause=>clause.method==="In parent contract / BPA");
  if(inherited.length) blocks.push({title:"Clauses Identified in the Parent Contract / BPA",text:inherited.map(clause=>`${clause.number} — ${clause.title} (${clause.date})${clause.fillIns?"\nOrder-specific fill-ins / selections: "+clause.fillIns:""}`).join("\n\n")});
  const references=selected.filter(clause=>clause.method==="Reference");
  if(references.length) blocks.push({title:"Clauses Incorporated by Reference",text:references.map(clause=>`${clause.number} — ${clause.title} (${clause.date})${clause.sourceUrl?"\nSource: "+clause.sourceUrl:""}${clause.fillIns?"\nFill-ins / selections: "+clause.fillIns:""}`).join("\n\n")});
  selected.filter(clause=>clause.method==="Full text").forEach(clause=>{
    let text=clause.body;
    if(clause.number==="52.252-2" && settings.incorporationUrls.trim()) text=text.replace(/_{10,}[\s\S]*?\[\s*Insert one or more Internet addresses\s*\]/,settings.incorporationUrls.trim());
    if(clause.fillIns.trim()) text+="\n\nFill-ins / selections:\n"+clause.fillIns;
    blocks.push({title:`${clause.number} — ${clause.title} (${clause.date})`,text:text||"[Full text not entered]"});
  });
  return blocks.map(block=>`<h2>${escapeHtml(block.title)}</h2><div class="dd-text">${escapeHtml(block.text)}</div>`);
}
function setupClauseEvents() {
  document.querySelector("#clausesSection").addEventListener("input",event=>{
    const input=event.target;
    if(input.dataset.clauseSetting) state.clauseSettings[input.dataset.clauseSetting]=input.value;
    else if(input.dataset.clause!==undefined) state.clauseSettings.clauses[Number(input.dataset.clause)][input.dataset.clauseKey]=input.type==="checkbox"?input.checked:input.value;
    else return;
    dirty();syncClauseContext();renderPreview();
  });
  document.querySelector("#clausesSection").addEventListener("click",event=>{
    const remove=event.target.closest("[data-remove-clause]");
    const reload=event.target.closest("[data-load-clause]");
    if(remove) state.clauseSettings.clauses.splice(Number(remove.dataset.removeClause),1);
    else if(reload) {
      const clause=state.clauseSettings.clauses[Number(reload.dataset.loadClause)];
      const official=DD1155_CLAUSE_CATALOG.find(entry=>entry.number===clause.number);
      if(!official || !confirm("Replace this clause's edited text and revision date with the official base snapshot? Fill-ins stay available.")) return;
      clause.body=official.body;clause.title=official.title;clause.date=official.date;clause.sourceUrl=official.sourceUrl;
    } else return;
    renderClauseRows();dirty();renderPreview();
  });
  document.querySelector("#addCatalogClauseBtn").addEventListener("click",()=>{addCatalogClause(document.querySelector("#clauseCatalog").value);renderClauseRows();dirty();renderPreview();});
  document.querySelector("#addCustomClauseBtn").addEventListener("click",()=>{if(state.clauseSettings.clauses.length>=200)return;state.clauseSettings.clauses.push({number:"",title:"",date:"",method:"Full text",body:"",fillIns:"",sourceUrl:"",included:true});renderClauseRows();dirty();renderPreview();});
  document.querySelector("#addIncorporationClauseBtn").addEventListener("click",()=>{addCatalogClause("52.252-2");renderClauseRows();dirty();renderPreview();});
  document.querySelector("#applyClauseProfileBtn").addEventListener("click",()=>{const numbers=state.clauseSettings.purchaseProfile==="Commercial purchase"?["52.212-4","52.212-5","52.252-2"]:["52.213-4"];numbers.forEach(addCatalogClause);renderClauseRows();dirty();renderPreview();});
}
