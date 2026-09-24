/* Training finder: no service, tracking, or runtime page crawl. */
(function (root) {
  'use strict';
  const ignored = new Set('a an and are at be by for how i in is of on or the to what with'.split(' '));
  const equivalents = [
    ['coc','competency'], ['pp','performance'], ['sap','simplified'],
    ['rfq','quotation','quotations','quote','quotes'], ['rfp','proposal','proposals'],
    ['gpc','purchasecard'], ['udm','deployment'], ['mod','mods','modification','modifications'],
    ['ratify','ratification','ratifications'], ['contract','contracts'],
    ['bond','bonds','bonding'], ['clause','clauses'], ['warrant','warrants'],
    ['invoice','invoices','invoicing'], ['closeout','closeouts'],
    ['setaside','setasides'], ['responsibility','responsible']
  ];
  const synonymMap = new Map();
  equivalents.forEach(group => group.forEach(word => synonymMap.set(word,group)));
  function normalize(text) {
    return String(text).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
      .replace(/set[ -]asides?/g,'setaside').replace(/purchase card/g,'purchasecard')
      .replace(/[^a-z0-9]+/g,' ').trim();
  }
  function words(text) { return normalize(text).split(/\s+/).filter(Boolean); }
  function prepare(entries) {
    return entries.filter(entry => /^[a-z0-9][a-z0-9-]*\.html$/.test(entry.url)).map(entry => ({
      ...entry,
      normalTitle:normalize(entry.title),
      fields:[entry.title,entry.aliases,entry.description,entry.headings,entry.terms,entry.tracks.join(' ')].map(text=>new Set(words(text)))
    }));
  }
  function oneEdit(a,b) {
    if(Math.abs(a.length-b.length)>1) return false;
    let i=0,j=0,changes=0;
    while(i<a.length && j<b.length) {
      if(a[i]===b[j]) {i++;j++;continue;}
      if(++changes>1) return false;
      if(a.length>b.length) i++; else if(b.length>a.length) j++; else {i++;j++;}
    }
    return changes+(i<a.length||j<b.length?1:0)<=1;
  }
  function tokenScore(token,entry,fuzzy) {
    const options=synonymMap.get(token)||[token];
    const weights=[100,80,35,25,8,12];
    for(let i=0;i<entry.fields.length;i++) {
      const field=entry.fields[i];
      if(options.some(option=>field.has(option))) return weights[i];
      if(token.length>=3 && [...field].some(word=>word.startsWith(token))) return weights[i]*0.65;
      // Typo recovery is deliberately limited to titles and known aliases.
      if(fuzzy && i<2 && token.length>=5 && [...field].some(word=>oneEdit(token,word))) return weights[i]*0.35;
    }
    return 0;
  }
  function search(entries,query) {
    const normalized=normalize(String(query).slice(0,120));
    const tokens=[...new Set(normalized.split(/\s+/).filter(w=>w&&!ignored.has(w)))].slice(0,8);
    if(normalized.length<2 || !tokens.length) return {matches:[],fuzzy:false};
    function rank(fuzzy) {
      return entries.map(entry=>{
        const scores=tokens.map(token=>tokenScore(token,entry,fuzzy));
        if(scores.some(score=>score===0)) return null;
        const exact=entry.normalTitle===normalized?1000:entry.normalTitle.includes(normalized)?350:0;
        return {entry,score:scores.reduce((a,b)=>a+b,0)+exact};
      }).filter(Boolean).sort((a,b)=>b.score-a.score||a.entry.title.localeCompare(b.entry.title));
    }
    const matches=rank(false);
    return matches.length?{matches,fuzzy:false}:{matches:rank(true),fuzzy:true};
  }
  const api={normalize,prepare,search};
  if(typeof module==='object'&&module.exports) module.exports=api;
  if(!root.document) return;
  const document=root.document;
  const box=document.getElementById('training-finder');
  if(!box) return;
  if(root.KTHQ_trainingSearchCleanup)root.KTHQ_trainingSearchCleanup();
  const input=document.getElementById('training-query');
  const panel=document.getElementById('training-search-panel');
  const list=document.getElementById('training-search-list');
  const summary=document.getElementById('training-search-summary');
  const status=document.getElementById('training-search-status');
  const more=document.getElementById('training-search-more');
  const clear=document.getElementById('training-search-clear');
  const retry=document.getElementById('training-search-retry');
  const indexURL=new URL('training-search-index.js',document.currentScript.src);
  indexURL.search=new URL(document.currentScript.src).search;
  const scriptURL=indexURL.href;
  const cached=root.KTHQ_TRAINING_SEARCH_INDEX;
  let loading=null,index=cached?.version===1&&Array.isArray(cached.entries)?prepare(cached.entries):null,timer,request=0,limit=6,current=null;
  function close() {panel.hidden=true;box.classList.remove('is-open');}
  function open() {panel.hidden=false;box.classList.add('is-open');}
  function load() {
    if(index) return Promise.resolve(index);
    if(loading) return loading;
    loading=new Promise((resolve,reject)=>{
      let settled=false;
      const tag=document.createElement('script');tag.src=scriptURL;tag.async=true;
      const timeout=setTimeout(()=>fail(),12000);
      function fail(){if(settled)return;settled=true;clearTimeout(timeout);tag.remove();loading=null;reject(new Error('Training index unavailable'));}
      tag.onerror=fail;
      tag.onload=()=>{
        if(settled)return;
        clearTimeout(timeout);
        const data=root.KTHQ_TRAINING_SEARCH_INDEX;
        if(!data||data.version!==1||!Array.isArray(data.entries)) {fail();return;}
        index=prepare(data.entries);settled=true;resolve(index);
      };
      document.head.appendChild(tag);
    });
    return loading;
  }
  function render(result) {
    current=result;list.replaceChildren();retry.hidden=true;
    const count=result.matches.length;
    summary.textContent=count?(result.fuzzy?'Closest matches':'Matching training')+' · '+count:'No matching training';
    status.textContent=count?count+' training '+(count===1?'topic':'topics')+' found.':'No matching training. Try a broader topic or a different term.';
    if(!count) {
      const item=document.createElement('li');item.className='ts-empty';item.textContent='Try a broader topic, such as “past performance,” “funding,” or “deployment.” You can also browse the tracks below.';list.appendChild(item);
    }
    result.matches.slice(0,limit).forEach(({entry})=>{
      const item=document.createElement('li');const link=document.createElement('a');link.href=entry.url;link.className='ts-result';
      const heading=document.createElement('span');heading.className='ts-result-heading';heading.textContent=entry.title;
      const badge=document.createElement('span');badge.className='ts-result-track';badge.textContent=entry.tracks.join(' · ');badge.dataset.track=entry.tracks[0];
      const description=document.createElement('span');description.className='ts-result-description';description.textContent=entry.description;
      link.append(badge,heading,description);item.append(link);list.append(item);
    });
    more.hidden=count<=limit;more.textContent='Show more ('+Math.max(0,count-limit)+' remaining)';
    open();
  }
  async function run() {
    const id=++request;const query=input.value.trim();clear.hidden=!query;limit=6;
    if(normalize(query).length<2) {close();status.textContent=query?'Type at least two characters.':'';return;}
    if(!index){summary.textContent='Loading training topics…';list.replaceChildren();more.hidden=true;retry.hidden=true;open();}
    try {
      const entries=await load();
      if(id!==request || !box.contains(document.activeElement)) return;
      render(search(entries,query));
    } catch {
      if(id!==request || !box.contains(document.activeElement)) return;
      list.replaceChildren();more.hidden=true;retry.hidden=false;summary.textContent='Search is temporarily unavailable';status.textContent='Search could not load. Retry or browse the training tracks below.';open();
    }
  }
  box.hidden=false;
  box.addEventListener('submit',event=>{event.preventDefault();clearTimeout(timer);run();});
  input.addEventListener('focus',()=>{if(input.value.trim().length>=2)run();else load().catch(()=>{});});
  input.addEventListener('input',()=>{++request;clearTimeout(timer);clear.hidden=!input.value;timer=setTimeout(run,90);});
  input.addEventListener('keydown',event=>{
    if(event.key==='ArrowDown'&&!panel.hidden){const first=list.querySelector('a');if(first){event.preventDefault();first.focus();}}
    if(event.key==='Escape'){event.preventDefault();++request;clearTimeout(timer);close();}
  });
  panel.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();input.focus();++request;clearTimeout(timer);close();return;}
    if(event.key!=='ArrowDown'&&event.key!=='ArrowUp')return;
    const links=[...list.querySelectorAll('a')];const position=links.indexOf(document.activeElement);
    if(position<0)return;
    event.preventDefault();if(event.key==='ArrowUp'&&position===0)input.focus();else links[Math.max(0,Math.min(links.length-1,position+(event.key==='ArrowDown'?1:-1)))].focus();
  });
  more.addEventListener('click',()=>{const previous=limit;limit+=6;render(current);list.querySelectorAll('a')[previous]?.focus();});
  clear.addEventListener('click',()=>{input.value='';++request;clearTimeout(timer);close();clear.hidden=true;status.textContent='Search cleared.';input.focus();});
  retry.addEventListener('click',run);
  function outside(event){if(!box.contains(event.target)){++request;close();}}
  document.addEventListener('pointerdown',outside);
  root.KTHQ_trainingSearchCleanup=()=>{++request;clearTimeout(timer);document.removeEventListener('pointerdown',outside);};
  box.addEventListener('focusout',()=>{setTimeout(()=>{if(!box.contains(document.activeElement)){++request;close();}},0);});
})(typeof window==='undefined'?globalThis:window);
