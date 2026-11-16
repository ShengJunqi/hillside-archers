import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// This is a DOM event adapter, not a browser or CSS layout engine. Parse the
// shipped hierarchy so hidden ancestors and modal focus are exercised as well.
export function shippedInterface({width=390,height=780,save={unlocked:true}}={}) {
 let document;
 class Element {
  constructor(tag='div') {
   this.tagName=tag.toUpperCase();this.children=[];this.parentElement=null;this.style={};this.dataset={};this.attributes={};this.listeners=new Map();this.hidden=false;this.disabled=false;this.open=false;this.value='';this._text='';this._html='';this.captures=new Set();this.classes=new Set();
   this.classList={add:name=>this.classes.add(name),contains:name=>this.classes.has(name),toggle:(name,forced)=>{const next=forced??!this.classes.has(name);if(next)this.classes.add(name);else this.classes.delete(name);return next;}};
  }
  set className(value){this.classes=new Set(String(value).split(/\s+/));}
  get className(){return [...this.classes].join(' ');}
  set textContent(value){this._text=String(value);this.children=[];}
  get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
  set innerHTML(value){this._html=String(value);this._text=String(value).replace(/<[^>]+>/g,'');this.children=[];}
  get innerHTML(){return this._html;}
  setAttribute(name,value){this.attributes[name]=value;if(name==='class')this.className=value;if(name==='tabindex')this.tabIndex=Number(value);if(name.startsWith('data-'))this.dataset[name.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=value;}
  getAttribute(name){return this.attributes[name]??null;}
  addEventListener(name,fn){const list=this.listeners.get(name)||[];list.push(fn);this.listeners.set(name,list);}
  dispatch(name,event={}){event.preventDefault??=()=>{event.prevented=true;};event.target??=this;for(const fn of this.listeners.get(name)||[])fn(event);return event;}
  append(child){child.parentElement=this;this.children.push(child);}
  replaceChildren(...children){for(const child of this.children)child.parentElement=null;this.children=[];this._text='';for(const child of children)this.append(child);}
  contains(child){return this===child||this.children.some(node=>node.contains(child));}
  matches(selector){const tag=selector.match(/^[a-z]+/i)?.[0],classes=[...selector.matchAll(/\.([\w-]+)/g)].map(m=>m[1]);return (!tag||this.tagName===tag.toUpperCase())&&classes.every(name=>this.classes.has(name))&&(!selector.includes(':disabled')||!this.disabled);}
  querySelectorAll(selector){const all=[];for(const child of this.children){if(selector.split(',').some(part=>child.matches(part.trim())))all.push(child);all.push(...child.querySelectorAll(selector));}return all;}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  visible(){for(let current=this;current;current=current.parentElement){if(current.hidden)return false;const parent=current.parentElement;if(parent?.tagName==='DETAILS'&&!parent.open&&current.tagName!=='SUMMARY')return false;}return true;}
  getClientRects(){return this.visible()?[this.getBoundingClientRect()]:[];}
  getBoundingClientRect(){return {left:0,top:0,width,height:height-78};}
  focus(){if(this.visible()&&!this.disabled)document.activeElement=this;}
  click(){if(!this.visible()||this.disabled)return;this.focus();const result=this.onclick?.({target:this,preventDefault(){}});if(this.tagName==='SUMMARY'&&this.parentElement?.tagName==='DETAILS')this.parentElement.open=!this.parentElement.open;return result;}
  setPointerCapture(id){this.captures.add(id);}
  hasPointerCapture(id){return this.captures.has(id);}
  releasePointerCapture(id){this.captures.delete(id);this.dispatch('lostpointercapture',{pointerId:id});}
 }
 const html=fs.readFileSync(new URL('../../dist/index.html',import.meta.url),'utf8'),ids=new Map(),root=new Element('document'),stack=[root],voidTags=new Set(['meta','link','input','br','img','hr','source','wbr']);
 for(const match of html.matchAll(/<!--[\s\S]*?-->|<\/?([a-z][\w:-]*)\b([^>]*?)\/?>|([^<]+)/gi)){
  const [token,tag,attrs,text]=match;if(!tag){if(text)stack.at(-1)._text+=text;continue;}
  if(token.startsWith('</')){const at=stack.findLastIndex(node=>node.tagName===tag.toUpperCase());if(at>0){stack[at]._html=html.slice(stack[at].contentStart,match.index);stack.length=at;}continue;}
  const node=new Element(tag);for(const attr of attrs.matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s]+)))?/g)){const name=attr[1],value=attr[2]??attr[3]??attr[4]??'';node.setAttribute(name,value);if(name==='id'){assert.ok(!ids.has(value),'duplicate ID '+value);ids.set(value,node);}if(['hidden','disabled','open'].includes(name))node[name]=true;if(name==='value')node.value=value;}
  node.contentStart=match.index+token.length;stack.at(-1).append(node);if(!voidTags.has(tag.toLowerCase())&&!token.endsWith('/>'))stack.push(node);
 }
 document=root;document.documentElement=root.querySelector('html');document.body=root.querySelector('body');document.documentElement.dataset.offline='true';document.hidden=false;document.activeElement=document.body;document.getElementById=id=>{assert.ok(ids.has(id),'missing shipped element '+id);return ids.get(id);};document.createElement=tag=>new Element(tag);
 const window=new Element('window');window.innerWidth=width;window.innerHeight=height;window.matchMedia=()=>({matches:width<700});window.visualViewport=new Element();
 const noop=()=>{},ctx=new Proxy({},{get:(o,n)=>n in o?o[n]:n==='createLinearGradient'?()=>({addColorStop:noop}):noop,set:(o,n,v)=>{o[n]=v;return true;}});ids.get('game').getContext=()=>ctx;
 const memory=new Map([['hillside-archers-save-v2',JSON.stringify(save)]]);let now=0,nextFrame;
 const sandbox={window,document,navigator:{maxTouchPoints:width<700?5:0},console,btoa,atob,localStorage:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)},ResizeObserver:class{observe(){}},performance:{now:()=>now},requestAnimationFrame:fn=>{nextFrame=fn;}};
 const modules=['names','combat','body','encounters','bounties','relics','collection','core','save-transfer','emotes','feedback','scenery','render','input','display','cloud-save','cloud-client','cloud-ui','app'];
 const code=modules.map(name=>fs.readFileSync(new URL('../../dist/'+name+'.mjs',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/\bexport /g,'')).join('\n');
 const context=vm.createContext(sandbox);vm.runInContext(code+'\nglobalThis.api={game,input,renderer,get paused(){return paused;},get pauseTab(){return pauseTab;}};',context);
 const frame=(frames=1)=>{for(let i=0;i<frames;i++){now+=16.67;nextFrame(now);}},$=id=>ids.get(id);
 const key=(key,target=document.activeElement,extra={})=>window.dispatch('keydown',{key,target,...extra}),up=(key,target=$('game'))=>window.dispatch('keyup',{key,target});
 const pointer=(name,x=210,y=300)=>$('game').dispatch(name,{pointerId:1,pointerType:'touch',isPrimary:true,clientX:x,clientY:y,button:0,buttons:name==='pointerup'?0:1});
 frame();return {api:context.api,$,html,ids,document,window,frame,key,up,pointer,memory};
}
