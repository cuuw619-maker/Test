/* MULTICORE — tiny shared runtime for the MULTITOOL web app */
(function(global){
  "use strict";
  const reduced=()=>document.body.classList.contains("reduce-motion")||(global.matchMedia&&global.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const tasks=new Set();
  function navigate(name){
    const page=document.getElementById("page-"+name);
    if(!page||page.classList.contains("active"))return false;
    document.querySelectorAll(".page.active").forEach(node=>node.classList.remove("active","page-leaving"));
    page.classList.add("active");
    document.querySelectorAll(".nav-item").forEach(node=>node.classList.toggle("active",node.dataset.page===name));
    return true;
  }
  function animate({duration=300,update=()=>{},complete=()=>{},easing=t=>t}={}){
    const started=performance.now(),time=reduced()?0:duration;
    let frame=0,cancelled=false;
    const handle={cancel(){cancelled=true;if(frame)cancelAnimationFrame(frame);tasks.delete(handle)}};
    const tick=now=>{if(cancelled)return;const p=time?Math.min(1,(now-started)/time):1;update(easing(p),p);if(p<1)frame=requestAnimationFrame(tick);else{tasks.delete(handle);complete()}};
    tasks.add(handle);frame=requestAnimationFrame(tick);return handle;
  }
  function yieldToUI(callback){return global.setTimeout(callback,0)}
  function read(key,fallback){try{const value=global.localStorage.getItem(key);return value===null?fallback:JSON.parse(value)}catch{return fallback}}
  function write(key,value){try{global.localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}}
  function on(target,event,handler,options){const node=typeof target==="string"?document.querySelector(target):target;if(!node)return()=>{};node.addEventListener(event,handler,options);return()=>node.removeEventListener(event,handler,options)}
  function frameLoop(step){let id=0,active=true;const tick=time=>{if(!active)return;step(time);id=requestAnimationFrame(tick)};id=requestAnimationFrame(tick);return()=>{active=false;cancelAnimationFrame(id)}}
  global.MultiCore=Object.freeze({version:"1.0.0",navigate,animate,yieldToUI,read,write,on,frameLoop,reducedMotion:reduced});
})(window);
