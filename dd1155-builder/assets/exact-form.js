// Positions come directly from the user-supplied DD 1155 PDF (612 x 792 points).
function renderExactCover(totalPages, continuations) {
  const slots = {};
  const assign = (name, value) => { slots[name] = value == null ? "" : String(value); };
  const purchase = state.orderType === "Purchase order";
  const date = value => String(value).replace(/^(\d{4}|20XX)(\d{2})(\d{2})$/, (_,year,month,day) => year + (["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"][Number(month)-1] || month) + day);
  const map = {
    one:"contractNumber", two:"orderNumber", three:"orderDate", four:"requisition", five:"priority",
    six_code:"issuedCode", six_info:"issuedBy", seven_code:"adminCode", seven_info:"adminBy",
    nine_code:"cage", nine_facility:"facility", nine_name_address:"contractor", ten:"deliveryDate", twelve:"discount", thirteen:"invoiceBlock",
    fourteen_code:"shipCode", fourteen_info:"shipTo", fifteen_code:"paymentCode", fifteen_info:"paymentBy",
    sixteen_refYour:"quotation", sixteen_typedNameTitle:"supplierSigner", sixteen_dateSigned:"supplierDate", seventeen:"accounting",
    twenty6A:"differences", twenty7A_noted:"exceptions", SignatureField2:"receiverSignature", twenty7C:"acceptanceDate",
    twenty7D:"receiverName", twenty7E:"receiverAddress", twenty7F:"receiverPhone", twenty7G:"receiverEmail",
    twenty8_shipNo:"shipmentNumber", twenty9:"voucherNumber", thirtyA:"initials", thirty2:"paidBy",
    thirty3:"verifiedAmount", thirty4:"checkNumber", thirty5:"billOfLading", thirty6_date:"certificationDate",
    SignatureField3:"certifierSignature", thirty7:"receivedAt", thirty8:"receivedBy", thirty9:"receivedDate",
    forty:"containers", forty1:"srAccount", forty2:"srVoucher"
  };
  for (const [name,key] of Object.entries(map)) assign(name, /Date$/.test(key) ? date(state[key]) : state[key]);
  assign("two", purchase ? "" : state.orderNumber);
  assign("twelve", purchase ? state.discount : "");
  assign("sixteen_refYour", purchase ? state.quotation : "");
  assign("sixteen_nameOfContractor", state.contractor.split("\n")[0]);
  assign("SignatureField1", purchase && state.supplierSigned ? "SIMULATED: " + state.supplierSigner : "");
  assign("sixteen_dateSigned", purchase && state.supplierSigned ? date(state.supplierDate) : "");
  assign("sixteen_copies", purchase && state.acceptance ? state.copies : "");
  assign("twenty4_by", state.officerSigned ? "SIMULATED: " + state.officer : state.officer);
  assign("twenty5", money(totalAmount()));
  assign("totalPages", totalPages);
  const checks = {
    eight_destination:state.fob === "Destination", eight_other:state.fob !== "Destination",
    eleven_small:state.small, eleven_smallDisadvantaged:state.disadvantaged, eleven_womenOwned:state.womenOwned,
    sixteen_deliveryCall:!purchase, sixteen_purchase:purchase, sixteen_ifBoxMarked:purchase && state.acceptance,
    twenty7A_inspected:state.inspected, twenty7A_received:state.received, twenty7A_accepted:state.accepted,
    twenty8_partial:state.shipmentStatus === "Partial", twenty8_final:state.shipmentStatus === "Final",
    thirty1_complete:state.paymentStatus === "Complete", thirty1_partial:state.paymentStatus === "Partial", thirty1_final:state.paymentStatus === "Final"
  };
  // Restore the original checkboxes, which were PDF widgets rather than page artwork.
  const overlays = Object.entries(checks).map(([name, checked]) => exactOverlay(name, checked ? "X" : "", true));
  if (state.lines.length > 3) {
    assign("nineteenA", "SEE CONTINUATION FOR ALL LINE ITEMS");
  } else {
    state.lines.forEach((line,index) => {
      const suffix = ["A","B","C"][index];
      assign("eighteen"+suffix,line.number);
      assign("nineteen"+suffix,line.description);
      assign("twenty"+suffix,line.quantity);
      assign("twenty1"+suffix,line.unit);
      assign("twenty2"+suffix,money(line.price));
      assign("twenty3"+suffix,money(lineAmount(line)));
    });
  }
  for (const [name,value] of Object.entries(slots)) {
    if (!value) continue;
    const field = DD1155_FIELDS[name];
    const [x,y,right,bottom] = field.rect;
    const fitted = fitExactText(value, right-x-2, bottom-y-1);
    if (!fitted) {
      const key = map[name];
      const label = key ? definitions.find(item=>item[0]===key)?.[1] : name;
      continuations.push(...splitText(value).map((text,index)=>`<h2>${escapeHtml(label || name)}${index?" — continued":""}</h2><div class="dd-text">${escapeHtml(text)}</div>`));
    }
    const fallback = fitExactText("SEE CONT.", right-x-2, bottom-y-1) || {text:"SEE CONT.", size:5.5};
    overlays.push(exactOverlay(name, (fitted || fallback).text, false, (fitted || fallback).size));
  }
  return `<section class="dd-page dd-exact-page" aria-label="DD Form 1155, page 1"><img class="dd-form-art" src="assets/dd1155-template.svg" alt="DD Form 1155, DEC 2001 — original 42-block layout">${overlays.join("")}</section>`;
}
function exactOverlay(name, value, checkbox=false, fontSize=8) {
  const [left,top,right,bottom] = DD1155_FIELDS[name].rect;
  const style=`left:${left/612*100}%;top:${top/792*100}%;width:${(right-left)/612*100}%;height:${(bottom-top)/792*100}%;font-size:${fontSize}pt;`;
  return `<div class="dd-form-value${checkbox?" dd-form-check":""}" data-template-field="${name}" style="${style}">${escapeHtml(value)}</div>`;
}
function fitExactText(text, width, height) {
  const context = document.createElement("canvas").getContext("2d");
  for (const size of [8,7.5,7,6.5]) {
    context.font=`${size}px Arial`;
    const lines=[];
    for (const paragraph of String(text).split("\n")) {
      let line="";
      for (const word of paragraph.split(/\s+/)) {
        if (context.measureText(word).width>width) { // Preserve even unbroken tokens.
          if(line) { lines.push(line); line=""; }
          let part="";
          for(const char of word) { if(context.measureText(part+char).width>width) {lines.push(part);part="";} part+=char; }
          line=part;
        } else if (line && context.measureText(line+" "+word).width>width) { lines.push(line); line=word; }
        else line+=(line?" ":"")+word;
      }
      lines.push(line);
    }
    if(lines.length*size*1.12<=height) return {text:lines.join("\n"),size};
  }
  return null;
}
