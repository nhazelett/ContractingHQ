// Measure at the actual letter-page width; every continuation receives its own header/footer.
function paginateContinuations(blocks) {
  const measure=document.createElement("div");
  measure.className="dd-measure";document.body.append(measure);
  const pages=[];const limit=850;
  const fits=html=>{measure.innerHTML=html;return measure.getBoundingClientRect().height-76.8<=limit;};
  function takeText(text,makeHtml) {
    let low=1,high=text.length,best=0;
    while(low<=high) {const mid=Math.floor((low+high)/2);if(fits(makeHtml(text.slice(0,mid)))) {best=mid;low=mid+1;}else high=mid-1;}
    if(!best) throw new Error("Continuation heading is too long to fit on a page.");
    if(best<text.length) {
      const boundary=Math.max(text.lastIndexOf("\n",best-1),text.lastIndexOf(" ",best-1));
      if(boundary>best*.5) best=boundary+1;
    }
    return best;
  }
  try {
    for(const block of blocks) {
      if(fits(block)) {pages.push(block);continue;}
      const wrapper=document.createElement("div");wrapper.innerHTML=block;
      const heading=wrapper.querySelector("h2")?.textContent||"Continuation";
      const textBox=wrapper.querySelector(".dd-text");
      if(textBox) {
        let rest=textBox.textContent;let index=0;
        while(rest.length) {
          const makeHtml=text=>`<h2>${escapeHtml(heading)}${index && !heading.endsWith(" — continued")?" — continued":""}</h2><div class="dd-text">${escapeHtml(text)}</div>`;
          const end=takeText(rest,makeHtml);pages.push(makeHtml(rest.slice(0,end)));rest=rest.slice(end);index++;
        }
        continue;
      }
      const sourceTable=wrapper.querySelector(".dd-schedule");
      if(sourceTable) {
        const table=sourceTable.cloneNode(true);table.querySelector("tbody").innerHTML="";
        const tbody=table.querySelector("tbody");
        let index=0;
        const html=()=>`<h2>${escapeHtml(heading)}${index?" — continued":""}</h2>${table.outerHTML}`;
        const flush=()=>{if(tbody.children.length) {pages.push(html());tbody.innerHTML="";index++;}};
        for(const sourceRow of sourceTable.querySelectorAll("tbody tr")) {
          const row=sourceRow.cloneNode(true);tbody.append(row);
          if(fits(html())) continue;
          row.remove();flush();tbody.append(row);
          if(fits(html())) continue;
          row.remove();
          if(row.cells.length!==6) throw new Error("Schedule row cannot fit on a continuation sheet.");
          let rest=row.cells[1].textContent;let segment=0;
          while(rest.length) {
            const fragment=row.cloneNode(true);
            if(segment) {fragment.cells[0].textContent=row.cells[0].textContent+" (cont.)";for(let column=2;column<6;column++)fragment.cells[column].textContent="";}
            const makeHtml=text=>{fragment.cells[1].textContent=text;tbody.innerHTML="";tbody.append(fragment);return html();};
            const end=takeText(rest,makeHtml);makeHtml(rest.slice(0,end));flush();rest=rest.slice(end);segment++;
          }
        }
        flush();continue;
      }
      throw new Error("Unsupported continuation content.");
    }
    return pages;
  } finally {measure.remove();}
}
