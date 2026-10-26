// Minimal EventTarget DOM for isolated component unit tests; no HTML loader, network or script execution.
export class Element extends EventTarget{
 constructor(tag,doc){super();this.tagName=tag.toUpperCase();this.doc=doc;this.children=[];this.dataset={};this.style={};this.attributes={};this._text='';this.hidden=false;this.open=false;this.value='';}
 set textContent(value){this._text=String(value??'');this.children=[];}get textContent(){return this._text+this.children.map(n=>n.textContent).join('');}
 append(...nodes){for(const n of nodes){if(n.parentElement)n.parentElement.children=n.parentElement.children.filter(c=>c!==n);n.parentElement=this;this.children.push(n);}}
 replaceChildren(...nodes){this._text='';this.children=[];this.append(...nodes);}
 setAttribute(k,v){this.attributes[k]=String(v);}getAttribute(k){return this.attributes[k]??null;}removeAttribute(k){delete this.attributes[k];}
 click(){this.dispatchEvent(new Event('click',{cancelable:true}));}focus(){this.doc.activeElement=this;}
 showModal(){this.open=true;}close(){if(this.open){this.open=false;this.dispatchEvent(new Event('close'));}}
 replaceWith(node){const parent=this.parentElement,index=parent.children.indexOf(this);parent.children[index]=node;node.parentElement=parent;this.parentElement=null;}
 matches(selector){if(selector.includes(','))return selector.split(',').some(s=>this.matches(s));return selector.startsWith('.')?this.className?.split(' ').includes(selector.slice(1)):selector==='[data-award]'?!!this.dataset.award:this.tagName.toLowerCase()===selector;}
 querySelectorAll(selector){return this.children.flatMap(n=>[...(n.matches(selector)?[n]:[]),...n.querySelectorAll(selector)]);}querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
 closest(selector){return this.matches(selector)?this:this.parentElement?.closest(selector)||null;}
}
export function createDocument(ids=[]){const doc={activeElement:null,nodes:new Map(),documentElement:{dataset:{}},createElement(tag){return new Element(tag,this);},getElementById(id){return this.nodes.get(id);}};for(const id of ids){const n=doc.createElement('div');n.id=id;doc.nodes.set(id,n);}return doc;}
