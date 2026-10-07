"use strict";
const STORAGE_KEY = "dd1155-builder-draft-v1";
const FORMAT = "kthq-dd1155-v1";
const fields = {
  document: [
    ["orderType", "Order type", ["Purchase order", "Delivery order", "BPA call"]],
    ["contractNumber", "1. Contract / purchase order / agreement no."],
    ["orderNumber", "2. Delivery order / call no."],
    ["orderDate", "3. Date of order / call (YYYYMMMDD)"],
    ["requisition", "4. Requisition / purchase request no."],
    ["priority", "5. Priority"]
  ],
  government: [
    ["issuedCode", "6. Issuing office DoDAAC"], ["issuedBy", "6. Issued by / buyer / phone", "textarea"],
    ["adminCode", "7. Administration DoDAAC"], ["adminBy", "7. Administered by", "textarea"],
    ["fob", "8. Delivery FOB", ["Destination", "Other — see schedule"]],
    ["deliveryDate", "10. Deliver to FOB point by (YYYYMMMDD)"],
    ["invoiceBlock", "13. Invoice address block", ["6", "7", "14", "15", "See Schedule"]],
    ["shipCode", "14. Ship-to DoDAAC"], ["shipTo", "14. Ship to", "textarea"],
    ["paymentCode", "15. Payment office DoDAAC"], ["paymentBy", "15. Payment will be made by", "textarea"]
  ],
  contractor: [
    ["cage", "9. Contractor CAGE"], ["facility", "9. Facility code"], ["contractor", "9. Contractor name and address", "textarea"],
    ["small", "11. Small business", "checkbox"], ["disadvantaged", "11. Small disadvantaged", "checkbox"], ["womenOwned", "11. Women-owned", "checkbox"],
    ["discount", "12. Discount terms (purchase orders)"], ["quotation", "16. Quotation reference"],
    ["acceptance", "16. Supplier acceptance required", "checkbox"], ["copies", "16. Copies to return", "number"],
    ["supplierSigner", "16. Supplier typed name / title"], ["supplierDate", "16. Date signed (YYYYMMMDD)"],
    ["supplierSigned", "16. Show simulated supplier signature", "checkbox"],
    ["officer", "24. Contracting / ordering officer"], ["officerSigned", "24. Show simulated officer signature", "checkbox"]
  ],
  terms: [["accounting", "17. Accounting and appropriation data", "textarea"], ["terms", "Schedule terms / clauses / delivery instructions", "textarea"]],
  receiving: [
    ["differences", "26. Differences", "textarea"],
    ["inspected", "27a. Inspected", "checkbox"], ["received", "27a. Received", "checkbox"], ["accepted", "27a. Accepted", "checkbox"],
    ["exceptions", "27a. Exceptions noted", "textarea"], ["receiverSignature", "27b. Simulated representative signature"],
    ["acceptanceDate", "27c. Date (YYYYMMMDD)"], ["receiverName", "27d. Representative name / title"],
    ["receiverAddress", "27e. Representative mailing address", "textarea"], ["receiverPhone", "27f. Telephone"], ["receiverEmail", "27g. Email"],
    ["shipmentNumber", "28. Shipment no."], ["shipmentStatus", "28. Shipment status", ["", "Partial", "Final"]],
    ["voucherNumber", "29. D.O. voucher no."], ["initials", "30. Initials"],
    ["paymentStatus", "31. Payment status", ["", "Complete", "Partial", "Final"]], ["paidBy", "32. Paid by", "textarea"],
    ["verifiedAmount", "33. Amount verified correct for"], ["checkNumber", "34. Check number"], ["billOfLading", "35. Bill of lading no."],
    ["certificationDate", "36a. Date (YYYYMMMDD)"], ["certifierSignature", "36b. Simulated certifying officer signature / title"],
    ["receivedAt", "37. Received at"], ["receivedBy", "38. Received by"], ["receivedDate", "39. Date received (YYYYMMMDD)"],
    ["containers", "40. Total containers"], ["srAccount", "41. S/R account number"], ["srVoucher", "42. S/R voucher no."]
  ]
};
const sample = {
  orderType:"Purchase order", contractNumber:"FA4867XXP0001", orderNumber:"", orderDate:"20XXAPR29",
  requisition:"F2D3JC-F9-20XX-0001", priority:"", issuedCode:"FA4867",
  issuedBy:"Deployed Contracting Squadron\n67 Deployed St\nUndisclosed Location, Overseas\nBuyer: Capt Nadia Sullivan\nPhone: DSN 318-555-0106",
  adminCode:"", adminBy:"See Block 6", fob:"Destination", deliveryDate:"20XXMAY29", invoiceBlock:"15",
  shipCode:"F2D3JC", shipTo:"Expeditionary Support Squadron\n104 Expeditionary Support Ave\nUndisclosed Location, Overseas",
  paymentCode:"F03000", paymentBy:"DFAS Columbus\nTraining payment office",
  cage:"9XX01", facility:"", contractor:"Pioneer Logistics Group LLC\n64 Forward Vendor Lot\nUndisclosed Location, Overseas",
  small:true, disadvantaged:false, womenOwned:false, discount:"Net 30", quotation:"Email quotation dated 20XX0425",
  acceptance:false, copies:1, supplierSigner:"Casey Porter, Authorized Official", supplierDate:"", supplierSigned:false,
  officer:"Capt Nadia Sullivan", officerSigned:false,
  accounting:"TRAINING FUNDING ONLY\nACRN AA — 57XX3400 — F2D3JC-F9-20XX-0001",
  terms:"Delivery: FOB destination to Block 14 by the date in Block 10.\nInspection and acceptance: Government representative at destination.\nPackaging: Commercial packaging suitable for overseas delivery.\nInsert scenario-specific clauses and payment instructions here.",
  lines:[{number:"0001", description:"NSN: None\nPortable work lights; commercial packaging. Inspection and acceptance at destination.", quantity:12, unit:"EA", price:125, delivery:"20XXMAY29", acrn:"AA"}]
};
// Older v1 drafts predate the optional receiving/payment editor.
for (const [key,,type] of fields.receiving) sample[key] = type === "checkbox" ? false : "";
const definitions = Object.values(fields).flat();
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money = value => new Intl.NumberFormat("en-US", {style:"currency",currency:"USD"}).format(value);
const lineAmount = line => Math.round(line.quantity * line.price * 100) / 100;
const totalAmount = () => state.lines.reduce((total,line) => total + Math.round(lineAmount(line)*100),0)/100;
function validateDraft(data) {
  if (!data || data.format !== FORMAT || !data.state || typeof data.state !== "object") throw new Error("Choose a DD 1155 draft exported by this builder.");
  const clean = structuredClone(sample);
  for (const [key,label,type] of definitions) {
    const value = fields.receiving.some(field=>field[0]===key) ? (data.state[key] ?? sample[key]) : data.state[key];
    if (type === "checkbox" ? typeof value !== "boolean" : type === "number" ? !Number.isInteger(value) || value < 0 || value > 100 : typeof value !== "string" || value.length > 50000 || (Array.isArray(type) && !type.includes(value))) throw new Error(`Invalid value for ${label}.`);
    clean[key] = value;
  }
  if (!Array.isArray(data.state.lines) || data.state.lines.length > 500) throw new Error("Draft must contain no more than 500 line items.");
  clean.lines = data.state.lines.map(line => {
    const result = {};
    for (const key of ["number","description","unit","delivery","acrn"]) {
      if (typeof line[key] !== "string" || line[key].length > 50000) throw new Error("Invalid line item text.");
      result[key] = line[key];
    }
    for (const key of ["quantity","price"]) {
      if (!Number.isFinite(line[key]) || line[key] < 0 || line[key] > 1e9) throw new Error("Quantity and price must be valid nonnegative numbers.");
      result[key] = line[key];
    }
    return result;
  });
  return clean;
}
let state = structuredClone(sample);
try { const saved = localStorage.getItem(STORAGE_KEY); if (saved) { state = validateDraft(JSON.parse(saved)); document.querySelector("#draftStatus").textContent = "Saved draft loaded"; } } catch { document.querySelector("#draftStatus").textContent = "Draft unavailable; sample loaded"; }
function inputField(key,label,type,value,attrs="") {
  const common = `${attrs} aria-label="${escapeHtml(label)}"`;
  if (type === "textarea") return `<label class="field-span-two">${escapeHtml(label)}<textarea ${common} rows="4">${escapeHtml(value)}</textarea></label>`;
  if (Array.isArray(type)) return `<label>${escapeHtml(label)}<select ${common}>${type.map(option=>`<option ${option===value?"selected":""}>${escapeHtml(option)}</option>`).join("")}</select></label>`;
  if (type === "checkbox") return `<label><input ${common} type="checkbox" ${value?"checked":""}> ${escapeHtml(label)}</label>`;
  return `<label>${escapeHtml(label)}<input ${common} type="${type==="number"?"number":"text"}" ${type==="number"?'min="0" max="100" step="1"':""} value="${escapeHtml(value)}"></label>`;
}
function renderEditor() {
  for (const [group,items] of Object.entries(fields)) document.querySelector(`#${group}Fields`).innerHTML = items.map(([key,label,type])=>inputField(key,label,type,state[key],`data-field="${key}"`)).join("");
  renderLines();
}
function renderLines() {
  document.querySelector("#lineEditor").innerHTML = state.lines.map((line,index)=>`<div class="clin-card"><header><strong>CLIN ${escapeHtml(line.number)}</strong><button type="button" class="small" data-remove="${index}" aria-label="Remove line ${index+1}">Remove</button></header><div class="field-grid two">${[["number","Item no."],["description","Description / NSN / inspection / packaging","textarea"],["quantity","Quantity"],["unit","Unit"],["price","Unit price"],["delivery","Delivery date"],["acrn","ACRN"]].map(([key,label,type])=>["quantity","price"].includes(key)?`<label>${label}<input aria-label="${label}" type="number" min="0" max="1000000000" step="any" value="${line[key]}" data-line="${index}" data-key="${key}"></label>`:inputField(key,label,type,line[key],`data-line="${index}" data-key="${key}"`)).join("")}</div><span data-amount="${index}">${money(lineAmount(line))}</span></div>`).join("");
}
const box = (label,value) => `<div class="dd-box"><div class="dd-label">${escapeHtml(label)}</div><div class="dd-value">${escapeHtml(value)}</div></div>`;
const row = (content,kind="") => `<div class="dd-row ${kind}">${content}</div>`;
const tick = value => value ? "[X]" : "[ ]";
function schedule(lines) {
  return `<table class="dd-schedule"><thead><tr><th style="width:10%">18. Item no.</th><th style="width:42%">19. Schedule of supplies / services</th><th style="width:12%">20. Quantity ordered</th><th style="width:8%">21. Unit</th><th style="width:14%">22. Unit price</th><th style="width:14%">23. Amount</th></tr></thead><tbody>${lines.length?lines.map(line=>`<tr><td>${escapeHtml(line.number)}</td><td>${escapeHtml(line.description)}\n${escapeHtml(line.delivery?`Delivery: ${line.delivery}`:"")}\n${escapeHtml(line.acrn?`ACRN: ${line.acrn}`:"")}</td><td>${line.quantity}</td><td>${escapeHtml(line.unit)}</td><td>${money(line.price)}</td><td>${money(lineAmount(line))}</td></tr>`).join(""):'<tr><td colspan="6">No line items entered.</td></tr>'}</tbody></table>`;
}
function page(content,number,count) {
  return `<section class="dd-page"><p class="dd-training">TRAINING SAMPLE — NOT AN OFFICIAL CONTRACT</p><div class="dd-header"><span>DD 1155-style order · DEC 2001</span><span>Page ${number} of ${count}</span></div>${content}<div class="dd-footer"><span>${escapeHtml(state.contractNumber)}${state.orderNumber?` / ${escapeHtml(state.orderNumber)}`:""}</span><strong>ContractingHQ · Training order</strong></div></section>`;
}
function splitText(text,max=2200) {
  const pieces=[];
  while(text.length) { let end=Math.min(max,text.length); if(end<text.length) { const boundary=text.lastIndexOf("\n",end); if(boundary>max/2) end=boundary+1; } pieces.push(text.slice(0,end)); text=text.slice(end); }
  return pieces;
}
function renderPreview() {
  const isPurchase = state.orderType === "Purchase order";
  const continuations=[];
  const linePages=[];
  let batch=[]; let length=0;
  for (const line of state.lines) {
    const parts=splitText(line.description,1400); const description=parts.shift()||"";
    const cost=Math.max(1,Math.ceil(description.length/70),description.split("\n").length)+3;
    if(batch.length && (length+cost>32 || batch.length>=8)) { linePages.push(schedule(batch)); batch=[]; length=0; }
    batch.push({...line,description:description+(parts.length?"\nDescription continued on additional pages.":"")}); length+=cost;
    parts.forEach(text=>continuations.push(`<h2>CLIN ${escapeHtml(line.number)} — description continued</h2><div class="dd-text">${escapeHtml(text)}</div>`));
  }
  if(batch.length || !linePages.length) linePages.push(schedule(batch));
  const cover = renderExactCover(1, continuations);
  const contents=[...linePages.map(content=>`<h2>Schedule of Supplies / Services</h2>${content}`),...continuations,...splitText(state.terms).map((text,index)=>`<h2>Order Terms${index?" — continued":""}</h2><div class="dd-text">${escapeHtml(text)}</div>`)];
  const totalPages=1+contents.length;
  // Update page count without running overflow collection a second time.
  const finalCover=cover.replace(/(data-template-field="totalPages"[^>]*>)1(<\/div>)/, (_,before,after)=>before+totalPages+after);
  document.querySelector("#preview").innerHTML=`<div class="document-pack">${finalCover}${contents.map((content,index)=>page(content,index+2,totalPages)).join("")}</div>`;
  document.querySelector("#pageCount").textContent=`${totalPages} pages`;
  document.querySelector("#orderTotal").textContent=`Order total: ${money(totalAmount())}`;
  document.querySelectorAll("[data-amount]").forEach(element=>element.textContent=money(lineAmount(state.lines[Number(element.dataset.amount)])));
  document.querySelector('[data-field="orderNumber"]').disabled=isPurchase;
  document.querySelector('[data-field="discount"]').disabled=!isPurchase;
}
function dirty() { document.querySelector("#draftStatus").textContent="Unsaved"; }
document.querySelector("#editor").addEventListener("submit",event=>event.preventDefault());
document.querySelector("#editor").addEventListener("input",event=>{
  const input=event.target;
  if (input.dataset.field) { state[input.dataset.field]=input.type==="checkbox"?input.checked:input.type==="number"?Math.min(100,Math.max(0,Number(input.value)||0)):input.value; }
  else if(input.dataset.line!==undefined) { const numeric=["quantity","price"].includes(input.dataset.key); state.lines[Number(input.dataset.line)][input.dataset.key]=numeric?Math.min(1e9,Math.max(0,Number(input.value)||0)):input.value; }
  else return;
  dirty(); renderPreview();
});
document.querySelector("#editor").addEventListener("click",event=>{
  const button=event.target.closest("[data-remove]"); if(!button) return;
  state.lines.splice(Number(button.dataset.remove),1); renderLines(); dirty(); renderPreview();
});
document.querySelector("#addLineBtn").addEventListener("click",()=>{ if(state.lines.length>=500) return; state.lines.push({number:String(state.lines.length+1).padStart(4,"0"),description:"",quantity:1,unit:"EA",price:0,delivery:state.deliveryDate,acrn:"AA"}); renderLines(); dirty(); renderPreview(); });
document.querySelector("#sampleBtn").addEventListener("click",()=>{ if(!confirm("Replace the current editor with the sample? Your saved draft stays available until you save again.")) return; state=structuredClone(sample); renderEditor(); dirty(); renderPreview(); });
document.querySelector("#saveDraftBtn").addEventListener("click",()=>{ try { localStorage.setItem(STORAGE_KEY,JSON.stringify({format:FORMAT,state})); document.querySelector("#draftStatus").textContent="Saved locally"; } catch { document.querySelector("#draftStatus").textContent="Save unavailable — export JSON to keep this draft"; } });
document.querySelector("#exportBtn").addEventListener("click",()=>{
  const url=URL.createObjectURL(new Blob([JSON.stringify({format:FORMAT,state},null,2)],{type:"application/json"}));
  const link=document.createElement("a"); link.href=url; link.download=`${(state.orderNumber||state.contractNumber||"dd1155-draft").replace(/[^a-z0-9_-]/gi,"_")}.json`; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
});
document.querySelector("#importInput").addEventListener("change",async event=>{
  const file=event.target.files[0]; if(!file) return;
  try { if(file.size>5e6) throw new Error("Draft must be smaller than 5 MB."); const imported=validateDraft(JSON.parse(await file.text())); if(!confirm("Replace the current editor with this DD 1155 draft?")) return; state=imported; renderEditor(); dirty(); renderPreview(); } catch(error) { alert(error.message); } finally { event.target.value=""; }
});
document.querySelector("#printBtn").addEventListener("click",()=>{ renderPreview(); window.print(); });
renderEditor(); renderPreview();
