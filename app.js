(() => {
"use strict";
const COMMONS_API="https://commons.wikimedia.org/w/api.php";
const WALLHAVEN_API="https://wallhaven.cc/api/v1/search";
const WIKI_API="https://ru.wikipedia.org/w/api.php";
const FAVORITES_KEY="wallora-favorites-v2";
const SETTINGS_KEY="wallora-settings-v1";
const CATEGORIES={
 wallpapers:[
  ["all","Для тебя","wallpaper"],
  ["anime","Аниме","anime wallpaper"],
  ["manga","Манга","manga illustration"],
  ["illustration","Иллюстрации","digital illustration"],
  ["minimal","Минимализм","minimalist wallpaper"],
  ["gaming","Игры","video game artwork"],
  ["pixel","Пиксель-арт","pixel art"],
  ["cyberpunk","Киберпанк","cyberpunk wallpaper"],
  ["lofi","Lo-fi","lofi anime"],
  ["synthwave","Synthwave","synthwave art"],
  ["dark","Тёмные","dark fantasy"],
  ["retro","Ретро","retro anime"],
  ["cars","Авто","car wallpaper"],
  ["space","Космос","space art"],
  ["nature","Природа","fantasy landscape"],
  ["abstract","Абстракция","abstract wallpaper"],
  ["horror","Мрачные","dark horror illustration"]
 ],
 avatars:[
  ["all","Для тебя","avatar portrait"],
  ["anime","Аниме","anime portrait"],
  ["pixel","Пиксель-арт","pixel art avatar"],
  ["minimal","Минимализм","minimalist avatar"],
  ["fantasy","Фэнтези","fantasy character portrait"],
  ["animals","Животные","illustrated animal portrait"],
  ["gaming","Игры","video game character portrait"],
  ["dark","Тёмные","dark character portrait"],
  ["abstract","Абстракция","abstract avatar"]
 ]
};
const $=s=>document.querySelector(s);
const el={
 grid:$("#wallpaperGrid"),searchForm:$("#searchForm"),searchInput:$("#searchInput"),
 categoryRow:$("#categoryRow"),categoryArea:$("#categoryArea"),orientation:$("#orientationFilter"),sort:$("#sortSelect"),
 status:$("#resultStatus"),visibleCount:$("#visibleCount"),title:$("#sectionTitle"),subtitle:$("#sectionSubtitle"),
 sectionEyebrow:$("#sectionEyebrow"),loadMoreWrap:$("#loadMoreWrap"),loadMore:$("#loadMoreButton"),
 empty:$("#emptyState"),emptyTitle:$("#emptyTitle"),emptyDescription:$("#emptyDescription"),reset:$("#resetButton"),
 homeModes:[...document.querySelectorAll("[data-mode]")],favoritesNav:$("#favoritesNav"),favoriteCount:$("#favoriteCount"),
 heroTitle:$("#heroTitle"),heroDescription:$("#heroDescription"),heroEyebrow:$("#heroEyebrow"),heroMeta:$("#heroMeta"),
 collection:$("#collection"),factsSection:$("#factsSection"),sourceNote:$("#sourceNote"),
 modal:$("#imageModal"),modalClose:$("#modalClose"),modalImage:$("#modalImage"),modalTitle:$("#modalTitle"),
 modalFacts:$("#modalFacts"),modalCredit:$("#modalCredit"),modalFavorite:$("#modalFavorite"),download:$("#downloadLink"),
 source:$("#sourceLink"),license:$("#licenseNote"),toast:$("#toast"),settings:$("#settingsModal"),
 particlesToggle:$("#particlesToggle"),motionToggle:$("#motionToggle"),tiltToggle:$("#tiltToggle"),
 factLoading:$("#factLoading"),factContent:$("#factContent"),factError:$("#factError"),factTitle:$("#factTitle"),
 factExtract:$("#factExtract"),factImageWrap:$("#factImageWrap"),factImage:$("#factImage"),factSource:$("#factSource"),
 factCategory:$("#factCategory"),randomFact:$("#randomFactButton"),heroVisual:$("#heroVisual")
};
const state={items:[],continuation:null,loading:false,query:"wallpaper",category:"all",mode:"wallpapers",view:"all",orientation:"all",sort:"relevance",activeItem:null,requestId:0,factLoading:false,factRequestId:0,toastTimer:null};
const defaults={theme:"dark",particles:true,motion:true,tilt:true};
let settings=readSettings();
let favorites=readFavorites();
let factHistory=[];
let canvasFrame=0;
let particles=[];
let canvasContext=null;
let canvasWidth=0,canvasHeight=0,lastPointer={x:-1000,y:-1000};
let systemThemeQuery=null;

function readSettings(){try{return{...defaults,...JSON.parse(localStorage.getItem(SETTINGS_KEY)||"{}")}}catch{return{...defaults}}}
function saveSettings(){try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings))}catch(error){console.warn("Настройки не сохранены",error)}}
function readFavorites(){try{const value=JSON.parse(localStorage.getItem(FAVORITES_KEY)||"[]");return Array.isArray(value)?value.filter(x=>x&&x.id&&x.thumb&&x.original):[]}catch{return[]}}
function saveFavorites(){try{localStorage.setItem(FAVORITES_KEY,JSON.stringify(favorites));updateFavoriteCount()}catch{showToast("Не удалось сохранить: память браузера заполнена")}}
function updateFavoriteCount(){el.favoriteCount.textContent=String(favorites.length)}
function applyTheme(){
 const theme=settings.theme==="system"?(window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"):settings.theme;
 document.body.dataset.theme=theme;
 const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=theme==="light"?"#f1f3f5":"#0c1018";
 document.querySelectorAll("[data-theme-choice]").forEach(button=>button.classList.toggle("is-active",button.dataset.themeChoice===settings.theme));
}
function applyEffects(){
 document.body.classList.toggle("effects-off",!settings.motion);
 document.body.classList.toggle("tilt-off",!settings.tilt);
 el.particlesToggle.checked=settings.particles;
 el.motionToggle.checked=settings.motion;
 el.tiltToggle.checked=settings.tilt;
 if(settings.particles)startParticles();else stopParticles();
}
function syncSettings(){applyTheme();applyEffects();saveSettings()}
function openSettings(){el.settings.hidden=false;document.body.style.overflow="hidden";$("#settingsClose").focus()}
function closeSettings(){el.settings.hidden=true;if(el.modal.hidden)document.body.style.overflow=""}
function showToast(message){el.toast.textContent=message;el.toast.classList.add("is-visible");clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>el.toast.classList.remove("is-visible"),2300)}
function cleanText(value){return String(value||"").replace(/<[^>]*>/g," ").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;/g,"'").replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/\s+/g," ").trim()}
function metadataValue(metadata,key){return cleanText(metadata&&metadata[key]&&metadata[key].value)}
function commonsApiUrl(continuation){
 const params=new URLSearchParams({action:"query",format:"json",origin:"*",generator:"search",gsrnamespace:"6",gsrsearch:state.query,gsrlimit:"30",prop:"imageinfo",iiprop:"url|size|mime|extmetadata",iiurlwidth:"1100",iiextmetadatalanguage:"en"});
 if(continuation)Object.entries(continuation).forEach(([key,value])=>params.set(key,String(value)));
 return COMMONS_API+"?"+params.toString();
}
function wallhavenSearchQuery(){
 const query=state.query.trim();
 if(state.mode==="wallpapers"&&state.category==="all")return "";
 return query.replace(/\bwallpaper\b/gi,"").replace(/\s+/g," ").trim();
}
function normalizeWallhaven(image){
 if(!image||!image.path)return null;
 const width=Number(image.dimension_x)||0,height=Number(image.dimension_y)||0;
 const tags=(Array.isArray(image.tags)?image.tags:[]).map(tag=>cleanText(tag&&tag.name)).filter(Boolean).slice(0,3);
 const uploader=image.uploader&&image.uploader.username;
 return{
  id:"wallhaven:"+String(image.id),
  title:tags.join(" · ")||("Wallpaper "+String(image.id)),
  thumb:image.thumbs&&(image.thumbs.large||image.thumbs.original)||image.path,
  original:image.path,
  pageUrl:image.url||image.short_url||("https://wallhaven.cc/w/"+image.id),
  width,height,mime:cleanText(image.file_type||""),
  artist:cleanText(uploader||"Автор не указан"),
  license:"Права зависят от автора. SFW-фильтр не означает свободную лицензию.",
  source:"Wallhaven"
 };
}
async function fetchWallhavenPage(page){
 const params=new URLSearchParams({purity:"100",categories:state.category==="anime"||state.category==="manga"||state.category==="lofi"?"010":"111",sorting:wallhavenSearchQuery()?"relevance":"date_added",order:"desc",page:String(page)});
 const query=wallhavenSearchQuery();
 if(query)params.set("q",query);
 if(state.orientation==="landscape")params.set("ratios","16x9,16x10,21x9");
 else if(state.orientation==="portrait")params.set("ratios","9x16,10x16,9x21");
 else if(state.orientation==="square")params.set("ratios","1x1");
 else if(state.mode==="avatars")params.set("ratios","1x1,3x4,4x5");
 const response=await fetch(WALLHAVEN_API+"?"+params.toString(),{headers:{Accept:"application/json"}});
 if(!response.ok)throw new Error("Wallhaven "+response.status);
 const data=await response.json(),meta=data.meta||{};
 const next=Number(meta.current_page||page)<Number(meta.last_page||page)?Number(meta.current_page||page)+1:null;
 return{provider:"Wallhaven",items:(data.data||[]).map(normalizeWallhaven).filter(Boolean),next};
}
function shouldLoadWaifu(){
 return state.mode==="avatars"||["anime","manga","lofi"].includes(state.category)||/\b(anime|manga|waifu)\b/i.test(state.query);
}
function normalizeWaifu(image){
 if(!image||!image.url||image.is_nsfw===true)return null;
 const width=Number(image.width)||0,height=Number(image.height)||0;
 const tags=(Array.isArray(image.tags)?image.tags:[]).map(tag=>cleanText(tag&&tag.name||tag)).filter(Boolean).slice(0,3);
 const artist=image.artist&&(image.artist.name||image.artist);
 const pageUrl=typeof image.source==="string"&&/^https?:\/\//i.test(image.source)?image.source:"https://www.waifu.im/";
 return{
  id:"waifuim:"+String(image.id||image.signature||image.url),
  title:tags.join(" · ")||"Anime illustration",
  thumb:image.preview_url||image.url,original:image.url,pageUrl,width,height,
  mime:image.extension?"image/"+String(image.extension).replace(/^\./,""):"image",
  artist:cleanText(artist||"Автор не указан"),
  license:"Права принадлежат автору; условия использования смотри в исходной публикации.",
  source:"Waifu.im"
 };
}
async function fetchWaifuPage(){
 const params=new URLSearchParams({is_nsfw:"false",many:"true",included_tags:"waifu"});
 if(state.orientation==="landscape")params.set("orientation","LANDSCAPE");
 else if(state.orientation==="portrait")params.set("orientation","PORTRAIT");
 const response=await fetch("https://api.waifu.im/search/?"+params.toString(),{headers:{Accept:"application/json"}});
 if(!response.ok)throw new Error("Waifu.im "+response.status);
 const data=await response.json();
 return{provider:"Waifu.im",items:(data.images||[]).map(normalizeWaifu).filter(Boolean),next:null};
}
function openverseQuery(){
 const query=state.query.trim();
 if(state.mode==="avatars")return query;
 return query;
}
function articQuery(){
 const q=(state.query+" "+state.category).toLowerCase();
 if(/anime|manga|japan|pixel|avatar/.test(q))return "Japanese art print";
 if(/car|auto/.test(q))return "automobile";
 if(/space|galaxy|nebula/.test(q))return "abstract art";
 if(/nature|mountain|forest|ocean/.test(q))return "landscape";
 if(/city|cyberpunk|gaming|game/.test(q))return "city night";
 if(/minimal|abstract|dark/.test(q))return "abstract art";
 return "illustration";
}
function normalizePage(page){
 const info=page.imageinfo&&page.imageinfo[0];if(!info||!info.thumburl||!info.url)return null;
 if(info.mime&&!info.mime.startsWith("image/"))return null;
 const metadata=info.extmetadata||{},width=Number(info.width)||0,height=Number(info.height)||0;
 return{id:"commons:"+String(page.pageid),title:cleanText((page.title||"Image").replace(/^File:/i,"").replace(/\\.[^.]+$/,"")),thumb:info.thumburl,original:info.url,pageUrl:info.descriptionurl||"https://commons.wikimedia.org/",width,height,mime:info.mime||"",artist:metadataValue(metadata,"Artist")||metadataValue(metadata,"Credit")||"Автор не указан",license:metadataValue(metadata,"LicenseShortName")||metadataValue(metadata,"UsageTerms")||"Условия на странице файла",source:"Wikimedia Commons"};
}
function normalizeOpenverse(item){
 if(!item||!item.url||!item.foreign_landing_url)return null;
 const width=Number(item.width)||0,height=Number(item.height)||0;
 const filetype=String(item.filetype||"").toLowerCase();
 if(filetype&&!["jpg","jpeg","png","webp","gif","avif"].includes(filetype))return null;
 const license=[item.license,item.license_version].filter(Boolean).join(" ").toUpperCase();
 return{id:"openverse:"+String(item.id),title:cleanText(item.title||"Openverse image")||"Untitled image",thumb:item.thumbnail||item.url,original:item.url,pageUrl:item.foreign_landing_url,width,height,mime:filetype?"image/"+filetype:"",artist:cleanText(item.creator||"Автор не указан"),license:license||"Проверь лицензию на странице файла",source:"Openverse"};
}
function normalizeArtic(item){
 if(!item||!item.image_id||item.is_public_domain!==true)return null;
 const id=String(item.image_id);
 const title=cleanText(item.title||"Artwork");
 return{id:"artic:"+String(item.id),title,thumb:"https://www.artic.edu/iiif/2/"+encodeURIComponent(id)+"/full/843,/0/default.jpg",original:"https://www.artic.edu/iiif/2/"+encodeURIComponent(id)+"/full/2000,/0/default.jpg",pageUrl:"https://www.artic.edu/artworks/"+item.id,width:0,height:0,mime:"image/jpeg",artist:cleanText(item.artist_display||"Art Institute of Chicago"),license:"Public Domain · Open Access",source:"Art Institute of Chicago"};
}
function metQuery(){
 const q=(state.query+" "+state.category).toLowerCase();
 if(/anime|japan|avatar|pixel/.test(q))return "Japanese";
 if(/car|auto/.test(q))return "automobile";
 if(/space|galaxy|nebula/.test(q))return "space";
 if(/nature|mountain|forest|ocean/.test(q))return "landscape";
 if(/city|cyberpunk|gaming|game/.test(q))return "fantasy";
 if(/minimal|abstract|dark/.test(q))return "abstract";
 return "illustration";
}
function normalizeMet(item){
 if(!item||item.isPublicDomain!==true||!item.primaryImage)return null;
 return{id:"met:"+String(item.objectID),title:cleanText(item.title||"Museum artwork"),thumb:item.primaryImageSmall||item.primaryImage,original:item.primaryImage,pageUrl:item.objectURL||"https://www.metmuseum.org/art/collection",width:0,height:0,mime:"image/jpeg",artist:cleanText(item.artistDisplayName||"The Metropolitan Museum of Art"),license:"Public Domain · Open Access",source:"The Metropolitan Museum of Art"};
}
async function fetchMetPage(offset){
 const searchParams=new URLSearchParams({hasImages:"true",isPublicDomain:"true",q:metQuery()});
 const searchResponse=await fetch("https://collectionapi.metmuseum.org/public/collection/v1/search?"+searchParams.toString());
 if(!searchResponse.ok)throw new Error("The Met "+searchResponse.status);
 const searchData=await searchResponse.json(),ids=searchData.objectIDs||[],start=Number(offset)||0,batch=ids.slice(start,start+6);
 const objects=await Promise.allSettled(batch.map(async id=>{
  const response=await fetch("https://collectionapi.metmuseum.org/public/collection/v1/objects/"+id);
  if(!response.ok)throw new Error("The Met object "+response.status);
  return response.json();
 }));
 const items=objects.filter(result=>result.status==="fulfilled").map(result=>normalizeMet(result.value)).filter(Boolean);
 const next=start+batch.length<ids.length?start+batch.length:null;
 return{provider:"The Metropolitan Museum of Art",items,next};
}
function shouldLoadNasa(){
 return /space|galaxy|nebula|planet|cosmos|космос|планет/i.test(state.query+" "+state.category);
}
async function fetchCommonsPage(cursor){
 const response=await fetch(commonsApiUrl(cursor));if(!response.ok)throw new Error("Wikimedia Commons "+response.status);
 const data=await response.json(),pages=Object.values(data.query&&data.query.pages?data.query.pages:{});
 return{provider:"Wikimedia Commons",items:pages.map(normalizePage).filter(Boolean),next:data.continue||null};
}
async function fetchOpenversePage(nextUrl){
 const url=nextUrl||("https://api.openverse.org/v1/images/?"+new URLSearchParams({q:openverseQuery(),page_size:"30"}).toString());
 const response=await fetch(url,{headers:{Accept:"application/json"}});if(!response.ok)throw new Error("Openverse "+response.status);
 const data=await response.json();
 return{provider:"Openverse",items:(data.results||[]).map(normalizeOpenverse).filter(Boolean),next:data.next||null};
}
async function fetchArticPage(page){
 const params=new URLSearchParams({q:articQuery(),limit:"24",page:String(page),fields:"id,title,artist_display,image_id,is_public_domain,date_display"});
 params.set("query[term][is_public_domain]","true");
 const response=await fetch("https://api.artic.edu/api/v1/artworks/search?"+params.toString());if(!response.ok)throw new Error("Art Institute "+response.status);
 const data=await response.json(),pagination=data.pagination||{};
 const next=Number(pagination.current_page||page)<Number(pagination.total_pages||0)?Number(pagination.current_page||page)+1:null;
 return{provider:"Art Institute of Chicago",items:(data.data||[]).map(normalizeArtic).filter(Boolean),next};
}
async function fetchNasaPage(page){
 const params=new URLSearchParams({q:state.query+" space",media_type:"image",page_size:"30",page:String(page)});
 const response=await fetch("https://images-api.nasa.gov/search?"+params.toString());if(!response.ok)throw new Error("NASA "+response.status);
 const data=await response.json(),items=[];
 (data.collection&&data.collection.items||[]).forEach(entry=>{
  const meta=(entry.data||[])[0]||{},preview=(entry.links||[]).find(link=>link.rel==="preview")||(entry.links||[])[0];
  if(!preview||!preview.href||!meta.nasa_id)return;
  const original=preview.href.replace(/~thumb(?=\\.[a-z0-9]+(?:$|\\?))/i,"~orig");
  items.push({id:"nasa:"+meta.nasa_id,title:cleanText(meta.title||"NASA image"),thumb:preview.href,original,pageUrl:entry.href||"https://images.nasa.gov/",width:0,height:0,mime:"image/jpeg",artist:cleanText(meta.photographer||meta.center||"NASA"),license:"NASA media · проверь условия конкретного файла",source:"NASA Image and Video Library"});
 });
 const paging=data.collection&&data.collection.metadata||{};
 const next=Number(paging.total_hits||0)>0&&items.length>=20?page+1:null;
 return{provider:"NASA Image and Video Library",items,next};
}
async function loadWallpapers(append=false){
 if(append&&state.loading)return;
 const currentCursor=append?(state.continuation||{}):{wallhaven:1,commons:null,openverse:null};
 if(append&&!currentCursor.wallhaven&&!currentCursor.commons&&!currentCursor.openverse)return;
 const requestId=++state.requestId;state.loading=true;el.loadMore.disabled=true;el.loadMore.textContent="Ищем...";
 if(!append){state.items=[];el.grid.innerHTML='<div class="loading-state"><span class="loader"></span><p>Ищем обои в специализированных каталогах...</p></div>';el.empty.hidden=true;el.loadMoreWrap.hidden=true}
 const tasks=[];
 if(!append||currentCursor.wallhaven)tasks.push(fetchWallhavenPage(currentCursor.wallhaven||1));
 if(!append&&shouldLoadWaifu())tasks.push(fetchWaifuPage());
 if(append&&currentCursor.commons)tasks.push(fetchCommonsPage(currentCursor.commons));
 if(append&&currentCursor.openverse)tasks.push(fetchOpenversePage(currentCursor.openverse));
 const runTasks=async list=>Promise.all(list.map(async task=>{try{return await task}catch(error){return{provider:"Источник недоступен",items:[],next:null,error}}}));
 let results=await runTasks(tasks);
 if(requestId!==state.requestId)return;
 const wallhavenResult=results.find(result=>result.provider==="Wallhaven");
 const hasWallpaperResults=Boolean(wallhavenResult&&!wallhavenResult.error&&wallhavenResult.items.length);
 if(!append&&!hasWallpaperResults){
  const fallback=await runTasks([fetchCommonsPage(null),fetchOpenversePage(null)]);
  if(requestId!==state.requestId)return;
  results=results.concat(fallback);
 }
 const failed=results.filter(result=>result.error);
 const successful=results.filter(result=>!result.error);
 const seenIds=new Set(state.items.map(item=>item.id));
 const seenUrls=new Set(state.items.map(item=>item.original));
 successful.forEach(result=>result.items.forEach(item=>{
  if(!seenIds.has(item.id)&&!seenUrls.has(item.original)&&(item.width===0||item.height===0||Math.max(item.width,item.height)>=360)){
   state.items.push(item);seenIds.add(item.id);seenUrls.add(item.original);
  }
 }));
 state.continuation={
  wallhaven:successful.find(result=>result.provider==="Wallhaven")?.next||null,
  commons:successful.find(result=>result.provider==="Wikimedia Commons")?.next||null,
  openverse:successful.find(result=>result.provider==="Openverse")?.next||null
 };
 const hasMore=Object.values(state.continuation).some(Boolean);
 state.loading=false;renderGrid();
 const providerNames=successful.filter(result=>result.items.length).map(result=>result.provider);
 el.status.textContent=providerNames.length?providerNames.join(" · "):"Каталоги временно недоступны";
 el.loadMoreWrap.hidden=!hasMore||state.view==="favorites";el.loadMore.disabled=false;el.loadMore.innerHTML='Показать ещё <span>↓</span>';
 if(!state.items.length){
  el.empty.hidden=false;el.emptyTitle.textContent=failed.length===results.length?"Не удалось подключиться к каталогам":"Под эту тему пока нет изображений";
  el.emptyDescription.textContent="Попробуй другое название или повтори загрузку. Основной поиск рассчитан на готовые обои, а открытые медиатеки используются как резерв.";
  el.loadMoreWrap.hidden=false;
 }else if(failed.length===results.length){
  showToast("Каталоги изображений временно не отвечают");
 }
}
function visibleItems(){
 const list=state.view==="favorites"?favorites:state.items;
 let result=list.filter(item=>state.orientation==="landscape"?item.width>item.height:state.orientation==="portrait"?item.height>item.width:state.orientation==="square"?item.width===item.height:true);
 if(state.sort==="resolution")result=result.slice().sort((a,b)=>b.width*b.height-a.width*a.height);
 else if(state.sort==="title")result=result.slice().sort((a,b)=>a.title.localeCompare(b.title));
 else if(state.sort==="random")result=result.slice().sort((a,b)=>hash(a.id)-hash(b.id));
 return result;
}
function hash(value){let n=0;for(let i=0;i<value.length;i++)n=((n<<5)-n+value.charCodeAt(i))|0;return Math.abs(n)}
function isFavorite(id){return favorites.some(item=>item.id===id)}
function makeCard(item,index){
 const card=document.createElement("article");card.className="wallpaper-card";card.style.animationDelay=Math.min(index*35,350)+"ms";
 const wrap=document.createElement("div");wrap.className="card-image-wrap";wrap.tabIndex=0;wrap.setAttribute("role","button");wrap.setAttribute("aria-label","Открыть "+item.title);
 const img=document.createElement("img");img.className="card-image";img.alt=item.title;img.loading="lazy";img.decoding="async";img.addEventListener("load",()=>img.classList.add("is-loaded"),{once:true});img.addEventListener("error",()=>card.remove(),{once:true});img.src=item.thumb;if(img.complete&&img.naturalWidth)img.classList.add("is-loaded");
 const overlay=document.createElement("div");overlay.className="card-overlay";
 const fav=document.createElement("button");fav.className="favorite-button"+(isFavorite(item.id)?" is-favorite":"");fav.type="button";fav.textContent=isFavorite(item.id)?"♥":"♡";fav.setAttribute("aria-label",isFavorite(item.id)?"Убрать из избранного":"Добавить в избранное");
 fav.addEventListener("click",event=>{event.stopPropagation();toggleFavorite(item);const saved=isFavorite(item.id);fav.classList.toggle("is-favorite",saved);fav.textContent=saved?"♥":"♡";fav.setAttribute("aria-label",saved?"Убрать из избранного":"Добавить в избранное")});
 overlay.append(fav);wrap.append(img,overlay);wrap.addEventListener("click",()=>openImage(item));wrap.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();openImage(item)}});
 const caption=document.createElement("div");caption.className="card-caption";const title=document.createElement("span");title.className="card-title";title.textContent=item.title;title.title=item.title;const size=document.createElement("span");size.className="card-size";size.textContent=item.width&&item.height?item.width+"×"+item.height:"IMAGE";caption.append(title,size);const provider=document.createElement("div");provider.className="card-provider";provider.textContent=item.source||"Открытый источник";card.append(wrap,caption,provider);
 if(settings.tilt&&!matchMedia("(pointer: coarse)").matches){
  card.addEventListener("pointermove",event=>{const r=card.getBoundingClientRect(),x=(event.clientX-r.left)/r.width-.5,y=(event.clientY-r.top)/r.height-.5;card.style.transform="perspective(850px) rotateX("+(-y*4)+"deg) rotateY("+(x*5)+"deg) translateY(-2px)"});
  card.addEventListener("pointerleave",()=>{card.style.transform=""});
 }
 return card;
}
function renderGrid(){
 const items=visibleItems();el.grid.innerHTML="";el.empty.hidden=items.length>0;el.visibleCount.textContent=items.length+" изображений";
 if(state.view==="favorites"){el.title.textContent="Сохранённое";el.subtitle.textContent="Твои изображения, сохранённые в этом браузере.";el.status.textContent="Личная коллекция";el.loadMoreWrap.hidden=true;el.categoryArea.hidden=true;if(!items.length){el.emptyTitle.textContent="Пока ничего нет";el.emptyDescription.textContent="Нажимай на сердечко, чтобы сохранять понравившиеся изображения."}}
 else{el.title.textContent=state.mode==="avatars"?"Аватарки под настроение":"Обои под настроение";el.subtitle.textContent=state.mode==="avatars"?"Квадратные иллюстрации и персонажи для профиля.":"Подборка изображений, которые можно поставить фоном на телефон или компьютер.";el.categoryArea.hidden=false;el.loadMoreWrap.hidden=!state.continuation}
 items.forEach((item,index)=>el.grid.append(makeCard(item,index)));
 if(state.view==="all"&&!state.loading&&!state.items.length)el.empty.hidden=false;
}
function toggleFavorite(item){
 if(isFavorite(item.id)){favorites=favorites.filter(x=>x.id!==item.id);showToast("Удалено из сохранённого")}else{favorites.unshift(item);showToast("Добавлено в сохранённое")}
 saveFavorites();if(state.view==="favorites")renderGrid();if(state.activeItem&&state.activeItem.id===item.id)updateModalFavorite();
}
function updateModalFavorite(){const saved=state.activeItem&&isFavorite(state.activeItem.id);el.modalFavorite.classList.toggle("is-favorite",Boolean(saved));el.modalFavorite.textContent=saved?"♥":"♡";el.modalFavorite.setAttribute("aria-label",saved?"Убрать из избранного":"Добавить в избранное")}
function addFact(label,value){if(!value)return;const span=document.createElement("span");span.textContent=label+": "+value;el.modalFacts.append(span)}
function openImage(item){
 state.activeItem=item;el.modalImage.src=item.original;el.modalImage.alt=item.title;el.modalTitle.textContent=item.title;el.modalFacts.innerHTML="";
 addFact("Размер",item.width&&item.height?item.width+" × "+item.height:"Не указан");addFact("Формат",item.mime.replace("image/","").toUpperCase());addFact("Источник",item.source);addFact("Лицензия",item.license);
 el.modalCredit.textContent="Автор / источник: "+item.artist;el.download.href=item.original;el.source.href=item.pageUrl;el.license.textContent="Перед использованием проверь лицензию на странице оригинала. Некоторые лицензии требуют указания автора или сохранения той же лицензии.";
 updateModalFavorite();el.modal.hidden=false;document.body.style.overflow="hidden";el.modalClose.focus();
}
function closeImage(){el.modal.hidden=true;document.body.style.overflow="";state.activeItem=null}
function setCategoryButtons(){
 const list=CATEGORIES[state.mode==="avatars"?"avatars":"wallpapers"];el.categoryRow.innerHTML="";
 list.forEach(([id,label])=>{const button=document.createElement("button");button.type="button";button.className="category-chip"+(state.category===id?" is-active":"");button.dataset.category=id;button.textContent=label;el.categoryRow.append(button)});
}
function switchMode(mode){
 state.mode=mode;state.view="all";state.category="all";state.continuation=null;state.orientation="all";state.sort="relevance";el.orientation.value="all";el.sort.value="relevance";el.searchInput.value="";
 el.homeModes.forEach(button=>button.classList.toggle("is-active",button.dataset.mode===mode));
 const facts=mode==="facts";el.searchForm.hidden=facts;el.heroVisual.hidden=facts;el.heroMeta.hidden=facts;el.categoryArea.hidden=facts;el.collection.hidden=facts;el.factsSection.hidden=!facts;el.sourceNote.hidden=false;
 if(mode==="wallpapers"){el.heroEyebrow.textContent="YOUR SCREEN. YOUR VIBE.";el.heroTitle.innerHTML='Твой экран.<br><em>Твои правила.</em>';el.heroDescription.textContent="Обои для телефона и компьютера: аниме, игры, минимализм, киберпанк и другие стили.";el.heroMeta.innerHTML="<span><i>✳</i> Обои для любых экранов</span><span><i>↗</i> Открытые источники</span><span><i>♡</i> Своё избранное</span>";el.sectionEyebrow.textContent="FIND YOUR WALLPAPER";el.title.textContent="Подбери настроение.";state.query="wallpaper"}
 if(mode==="avatars"){el.heroEyebrow.textContent="YOUR PROFILE. YOUR STYLE.";el.heroTitle.innerHTML='Твой профиль.<br><em>Твой персонаж.</em>';el.heroDescription.textContent="Аватарки, персонажи, пиксель-арт и иллюстрации — выбери изображение для своего профиля.";el.heroMeta.innerHTML="<span><i>◉</i> Квадратные и портретные</span><span><i>✳</i> Разные стили</span><span><i>♡</i> Своё избранное</span>";el.sectionEyebrow.textContent="FIND YOUR AVATAR";state.query="avatar portrait illustration"}
 if(mode==="facts"){el.heroEyebrow.textContent="RANDOM KNOWLEDGE";el.heroTitle.innerHTML='Случайное.<br><em>Но интересное.</em>';el.heroDescription.textContent="Каждое нажатие открывает новую статью из русской Википедии. Узнавай то, о чём даже не собирался искать.";el.sectionEyebrow.textContent="WIKIPEDIA DISCOVERY";fetchRandomFact()}
 setCategoryButtons();el.homeModes.forEach(b=>b.classList.toggle("is-active",b.dataset.mode===mode));
 if(!facts){el.status.textContent="Открытая медиатека";loadWallpapers(false)}
}
function chooseCategory(category){
 state.category=category;state.view="all";const categoryList=CATEGORIES[state.mode==="avatars"?"avatars":"wallpapers"];const entry=categoryList.find(x=>x[0]===category)||categoryList[0];state.query=entry[2];
 state.continuation=null;el.homeModes.forEach(b=>b.classList.toggle("is-active",b.dataset.mode===state.mode));el.categoryRow.querySelectorAll(".category-chip").forEach(b=>b.classList.toggle("is-active",b.dataset.category===category));
 if(category==="all")state.query=state.mode==="avatars"?"avatar illustration":"wallpaper";
 el.favoritesNav.classList.remove("is-active");loadWallpapers(false);
}
async function fetchRandomFact(){
 if(state.factLoading)return;state.factLoading=true;const requestId=++state.factRequestId;el.randomFact.disabled=true;el.randomFact.innerHTML='<span class="random-icon">⟳</span> Ищем новую статью...';el.factLoading.hidden=false;el.factContent.hidden=true;el.factError.hidden=true;el.factCard.classList.remove("is-changing");
 const params=new URLSearchParams({action:"query",format:"json",origin:"*",generator:"random",grnnamespace:"0",grnlimit:"1",prop:"extracts|pageimages|info",exintro:"1",explaintext:"1",exchars:"1100",piprop:"thumbnail",pithumbsize:"1000",inprop:"url"});
 try{
  let article=null;
  for(let attempt=0;attempt<4&&!article;attempt++){
   const response=await fetch(WIKI_API+"?"+params.toString());if(!response.ok)throw new Error("Wikipedia API: "+response.status);
   const data=await response.json();if(requestId!==state.factRequestId)return;
   const pages=Object.values(data.query&&data.query.pages?data.query.pages:{}),page=pages[0];
   if(page&&page.extract&&page.extract.trim().length>90&&!factHistory.includes(page.pageid))article=page;
   if(page)factHistory.push(page.pageid);if(factHistory.length>30)factHistory.shift();
  }
  if(!article)throw new Error("No article returned");
  el.factTitle.textContent=article.title||"Случайная статья";el.factExtract.textContent=article.extract.trim();
  el.factSource.href=article.fullurl||"https://ru.wikipedia.org/wiki/"+encodeURIComponent(article.title||"");
  const thumbnail=article.thumbnail&&article.thumbnail.source;
  if(thumbnail){el.factImage.src=thumbnail;el.factImage.alt=article.title||"Иллюстрация к статье";el.factImageWrap.hidden=false}else el.factImageWrap.hidden=true;
  el.factCategory.textContent="Википедия · Русский язык · Случайная статья";
  el.factLoading.hidden=true;el.factContent.hidden=false;el.factCard.classList.remove("is-changing");void el.factCard.offsetWidth;el.factCard.classList.add("is-changing");
 }catch(error){if(requestId!==state.factRequestId)return;el.factLoading.hidden=true;el.factError.hidden=false;showToast("Не удалось получить случайную статью")}
 finally{if(requestId===state.factRequestId){state.factLoading=false;el.randomFact.disabled=false;el.randomFact.innerHTML='<span class="random-icon">⟳</span> Другая случайная статья <span>↗</span>'}}
}
function startParticles(){
 if(canvasFrame)return;const canvas=$("#ambientCanvas");canvasContext=canvas.getContext("2d");if(!canvasContext)return;
 resizeCanvas();particles=Array.from({length:Math.min(55,Math.max(22,Math.round(window.innerWidth/25)))},()=>newParticle());
 const draw=()=>{
  if(!settings.particles){canvasFrame=0;return}
  canvasContext.clearRect(0,0,canvasWidth,canvasHeight);
  const accent=getComputedStyle(document.body).getPropertyValue("--accent").trim()||"#c5f36b";
  particles.forEach((p,i)=>{p.x+=p.vx;p.y+=p.vy;if(p.x<-10)p.x=canvasWidth+10;if(p.x>canvasWidth+10)p.x=-10;if(p.y<-10)p.y=canvasHeight+10;if(p.y>canvasHeight+10)p.y=-10;
   const dx=p.x-lastPointer.x,dy=p.y-lastPointer.y,dist=Math.sqrt(dx*dx+dy*dy);if(dist<85&&dist>0){p.x+=dx/dist*.14;p.y+=dy/dist*.14}
   canvasContext.globalAlpha=p.alpha;canvasContext.fillStyle=accent;canvasContext.beginPath();canvasContext.arc(p.x,p.y,p.r,0,Math.PI*2);canvasContext.fill();
   if(i%5===0){const next=particles[(i+1)%particles.length],d=Math.hypot(p.x-next.x,p.y-next.y);if(d<125){canvasContext.globalAlpha=(1-d/125)*.12;canvasContext.strokeStyle=accent;canvasContext.lineWidth=.7;canvasContext.beginPath();canvasContext.moveTo(p.x,p.y);canvasContext.lineTo(next.x,next.y);canvasContext.stroke()}}
  });
  canvasContext.globalAlpha=1;canvasFrame=requestAnimationFrame(draw);
 };
 canvasFrame=requestAnimationFrame(draw);
}
function newParticle(){return{x:Math.random()*canvasWidth,y:Math.random()*canvasHeight,vx:(Math.random()-.5)*.24,vy:(Math.random()-.5)*.24,r:Math.random()*1.7+.45,alpha:Math.random()*.32+.08}}
function resizeCanvas(){const canvas=$("#ambientCanvas"),dpr=Math.min(window.devicePixelRatio||1,1.5);canvasWidth=window.innerWidth;canvasHeight=window.innerHeight;canvas.width=Math.floor(canvasWidth*dpr);canvas.height=Math.floor(canvasHeight*dpr);canvasContext.setTransform(dpr,0,0,dpr,0,0)}
function stopParticles(){if(canvasFrame)cancelAnimationFrame(canvasFrame);canvasFrame=0;if(canvasContext)canvasContext.clearRect(0,0,canvasWidth,canvasHeight)}
function setupEvents(){
 el.searchForm.addEventListener("submit",event=>{event.preventDefault();const q=el.searchInput.value.trim();if(!q){chooseCategory("all");return}state.category="search";state.query=q;state.view="all";state.continuation=null;el.categoryRow.querySelectorAll(".category-chip").forEach(b=>b.classList.remove("is-active"));loadWallpapers(false)});
 el.categoryRow.addEventListener("click",event=>{const button=event.target.closest("[data-category]");if(button)chooseCategory(button.dataset.category)});
 el.orientation.addEventListener("change",()=>{state.orientation=el.orientation.value;renderGrid()});el.sort.addEventListener("change",()=>{state.sort=el.sort.value;renderGrid()});
 el.loadMore.addEventListener("click",()=>{const canContinue=state.continuation&&Object.values(state.continuation).some(Boolean);loadWallpapers(Boolean(canContinue))});
 el.homeModes.forEach(button=>button.addEventListener("click",()=>switchMode(button.dataset.mode)));
 el.favoritesNav.addEventListener("click",()=>{state.view="favorites";el.homeModes.forEach(b=>b.classList.remove("is-active"));renderGrid();el.collection.scrollIntoView({behavior:"smooth",block:"start"})});
 el.modalClose.addEventListener("click",closeImage);$("#modalBackdrop").addEventListener("click",closeImage);el.modalFavorite.addEventListener("click",()=>{if(state.activeItem)toggleFavorite(state.activeItem)});
 el.reset.addEventListener("click",()=>{el.orientation.value="all";el.sort.value="relevance";state.orientation="all";state.sort="relevance";chooseCategory("all")});
 $("#openSettings").addEventListener("click",openSettings);$("#settingsClose").addEventListener("click",closeSettings);$("#settingsBackdrop").addEventListener("click",closeSettings);
 document.querySelectorAll("[data-theme-choice]").forEach(button=>button.addEventListener("click",()=>{settings.theme=button.dataset.themeChoice;syncSettings()}));
 el.particlesToggle.addEventListener("change",()=>{settings.particles=el.particlesToggle.checked;syncSettings()});
 el.motionToggle.addEventListener("change",()=>{settings.motion=el.motionToggle.checked;syncSettings()});
 el.tiltToggle.addEventListener("change",()=>{settings.tilt=el.tiltToggle.checked;syncSettings();renderGrid()});
 $("#resetSettings").addEventListener("click",()=>{settings={...defaults};syncSettings();showToast("Настройки сброшены")});
 el.randomFact.addEventListener("click",fetchRandomFact);
 document.addEventListener("keydown",event=>{if(event.key==="Escape"){if(!el.settings.hidden)closeSettings();if(!el.modal.hidden)closeImage()}});
 window.addEventListener("resize",()=>{if(settings.particles){resizeCanvas();particles=Array.from({length:Math.min(55,Math.max(22,Math.round(window.innerWidth/25)))},()=>newParticle())}});
 window.addEventListener("pointermove",event=>{lastPointer.x=event.clientX;lastPointer.y=event.clientY},{passive:true});
 if(window.matchMedia){systemThemeQuery=window.matchMedia("(prefers-color-scheme: light)");systemThemeQuery.addEventListener?.("change",()=>{if(settings.theme==="system")applyTheme()})}
}
function init(){const year=$("#currentYear");if(year)year.textContent=String(new Date().getFullYear());updateFavoriteCount();applyTheme();applyEffects();setupEvents();switchMode("wallpapers")}
init();
})();