(() => {
"use strict";
const COMMONS_API="https://commons.wikimedia.org/w/api.php";
const WIKI_API="https://ru.wikipedia.org/w/api.php";
const FAVORITES_KEY="wallora-favorites-v2";
const SETTINGS_KEY="wallora-settings-v1";
const CATEGORIES={
 wallpapers:[
  ["all","Для тебя","wallpaper"],
  ["anime","Аниме","anime landscape illustration"],
  ["minimal","Минимализм","minimalist wallpaper"],
  ["gaming","Игры","video game digital art"],
  ["cyberpunk","Киберпанк","cyberpunk city neon"],
  ["dark","Тёмные","dark aesthetic wallpaper"],
  ["cars","Авто","sports car photography"],
  ["space","Космос","galaxy nebula space"],
  ["nature","Природа","mountain landscape"],
  ["abstract","Абстракция","abstract digital art"]
 ],
 avatars:[
  ["all","Для тебя","avatar illustration"],
  ["anime","Аниме","anime character portrait"],
  ["pixel","Пиксель-арт","pixel art character"],
  ["minimal","Минимализм","minimalist portrait illustration"],
  ["fantasy","Фэнтези","fantasy character portrait"],
  ["animals","Животные","animal portrait illustration"],
  ["abstract","Абстракция","abstract avatar art"]
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
const state={items:[],continuation:null,loading:false,query:"nature landscape",category:"all",mode:"wallpapers",view:"all",orientation:"all",sort:"relevance",activeItem:null,requestId:0,factLoading:false,factRequestId:0,toastTimer:null};
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
function updateFavoriteCount(){el.favoriteCount.querySelector("b").textContent=String(favorites.length)}
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
function apiUrl(continuation){
 const params=new URLSearchParams({action:"query",format:"json",origin:"*",generator:"search",gsrnamespace:"6",gsrsearch:state.query,gsrlimit:"30",prop:"imageinfo",iiprop:"url|size|mime|extmetadata",iiurlwidth:"1000",iiextmetadatalanguage:"en"});
 if(continuation)Object.entries(continuation).forEach(([key,value])=>params.set(key,String(value)));
 return COMMONS_API+"?"+params.toString();
}
function normalizePage(page){
 const info=page.imageinfo&&page.imageinfo[0];if(!info||!info.thumburl||!info.url)return null;
 if(info.mime&&!info.mime.startsWith("image/"))return null;
 const metadata=info.extmetadata||{},width=Number(info.width)||0,height=Number(info.height)||0;
 return{id:String(page.pageid),title:cleanText((page.title||"Image").replace(/^File:/i,"").replace(/\.[^.]+$/,"")),thumb:info.thumburl,original:info.url,pageUrl:info.descriptionurl||"https://commons.wikimedia.org/",width,height,mime:info.mime||"",artist:metadataValue(metadata,"Artist")||metadataValue(metadata,"Credit")||"Автор не указан",license:metadataValue(metadata,"LicenseShortName")||metadataValue(metadata,"UsageTerms")||"Условия на странице файла"};
}
async function loadWallpapers(append=false){
 if(append&&state.loading)return;
 if(append&&!state.continuation)return;
 const requestId=++state.requestId;state.loading=true;el.loadMore.disabled=true;el.loadMore.textContent="Загружаем...";
 if(!append){state.items=[];el.grid.innerHTML='<div class="loading-state"><span class="loader"></span><p>Подбираем изображения...</p></div>';el.empty.hidden=true;el.loadMoreWrap.hidden=true}
 try{
  const response=await fetch(apiUrl(append?state.continuation:null));if(!response.ok)throw new Error("Wikimedia Commons: "+response.status);
  const data=await response.json();if(requestId!==state.requestId)return;
  const pages=Object.values(data.query&&data.query.pages?data.query.pages:{}),normalized=pages.map(normalizePage).filter(Boolean),seen=new Set(state.items.map(item=>item.id));
  normalized.forEach(item=>{if(!seen.has(item.id)&&(item.width>=420||item.height>=420)){state.items.push(item);seen.add(item.id)}});
  state.continuation=data.continue||null;state.loading=false;renderGrid();
  el.status.textContent="Wikimedia Commons · открытая медиатека";el.loadMoreWrap.hidden=!state.continuation||state.view==="favorites";
  el.loadMore.disabled=false;el.loadMore.innerHTML='Показать ещё <span>↓</span>';
  if(!state.items.length){el.empty.hidden=false;el.emptyTitle.textContent="Пока нет подходящих изображений";el.emptyDescription.textContent="Попробуй более короткий запрос или другую категорию."}
 }catch(error){
  if(requestId!==state.requestId)return;state.loading=false;el.status.textContent="Ошибка загрузки";el.loadMore.disabled=false;el.loadMore.innerHTML='Повторить загрузку <span>↻</span>';
  if(!state.items.length){el.grid.innerHTML="";el.empty.hidden=false;el.emptyTitle.textContent="Не удалось подключиться к библиотеке";el.emptyDescription.textContent="Проверь подключение к интернету и повтори попытку. "+error.message}else showToast("Не удалось загрузить следующую страницу");
  el.loadMoreWrap.hidden=false;
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
 const img=document.createElement("img");img.className="card-image";img.src=item.thumb;img.alt=item.title;img.loading="lazy";img.decoding="async";img.addEventListener("error",()=>card.remove(),{once:true});
 const overlay=document.createElement("div");overlay.className="card-overlay";
 const fav=document.createElement("button");fav.className="favorite-button"+(isFavorite(item.id)?" is-favorite":"");fav.type="button";fav.textContent=isFavorite(item.id)?"♥":"♡";fav.setAttribute("aria-label",isFavorite(item.id)?"Убрать из избранного":"Добавить в избранное");
 fav.addEventListener("click",event=>{event.stopPropagation();toggleFavorite(item);const saved=isFavorite(item.id);fav.classList.toggle("is-favorite",saved);fav.textContent=saved?"♥":"♡";fav.setAttribute("aria-label",saved?"Убрать из избранного":"Добавить в избранное")});
 overlay.append(fav);wrap.append(img,overlay);wrap.addEventListener("click",()=>openImage(item));wrap.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();openImage(item)}});
 const caption=document.createElement("div");caption.className="card-caption";const title=document.createElement("span");title.className="card-title";title.textContent=item.title;title.title=item.title;const size=document.createElement("span");size.className="card-size";size.textContent=item.width&&item.height?item.width+"×"+item.height:"IMAGE";caption.append(title,size);card.append(wrap,caption);
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
 addFact("Размер",item.width&&item.height?item.width+" × "+item.height:"Не указан");addFact("Формат",item.mime.replace("image/","").toUpperCase());addFact("Лицензия",item.license);
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
 if(mode==="wallpapers"){el.heroEyebrow.textContent="YOUR SCREEN. YOUR VIBE.";el.heroTitle.innerHTML='Твой экран.<br><em>Твои правила.</em>';el.heroDescription.textContent="Обои для телефона и компьютера: аниме, игры, минимализм, киберпанк и другие стили.";el.heroMeta.innerHTML="<span><i>✳</i> Обои для любых экранов</span><span><i>↗</i> Открытые источники</span><span><i>♡</i> Своё избранное</span>";el.sectionEyebrow.textContent="FIND YOUR WALLPAPER";el.title.textContent="Подбери настроение.";state.query="nature landscape"}
 if(mode==="avatars"){el.heroEyebrow.textContent="YOUR PROFILE. YOUR STYLE.";el.heroTitle.innerHTML='Твой профиль.<br><em>Твой персонаж.</em>';el.heroDescription.textContent="Аватарки, персонажи, пиксель-арт и иллюстрации — выбери изображение для своего профиля.";el.heroMeta.innerHTML="<span><i>◉</i> Квадратные и портретные</span><span><i>✳</i> Разные стили</span><span><i>♡</i> Своё избранное</span>";el.sectionEyebrow.textContent="FIND YOUR AVATAR";state.query="anime character portrait"}
 if(mode==="facts"){el.heroEyebrow.textContent="RANDOM KNOWLEDGE";el.heroTitle.innerHTML='Случайное.<br><em>Но интересное.</em>';el.heroDescription.textContent="Каждое нажатие открывает новую статью из русской Википедии. Узнавай то, о чём даже не собирался искать.";el.sectionEyebrow.textContent="WIKIPEDIA DISCOVERY";fetchRandomFact()}
 setCategoryButtons();el.homeModes.forEach(b=>b.classList.toggle("is-active",b.dataset.mode===mode));
 if(!facts){el.status.textContent="Открытая медиатека";loadWallpapers(false)}
}
function chooseCategory(category){
 state.category=category;state.view="all";const categoryList=CATEGORIES[state.mode==="avatars"?"avatars":"wallpapers"];const entry=categoryList.find(x=>x[0]===category)||categoryList[0];state.query=entry[2];
 state.continuation=null;el.homeModes.forEach(b=>b.classList.toggle("is-active",b.dataset.mode===state.mode));el.categoryRow.querySelectorAll(".category-chip").forEach(b=>b.classList.toggle("is-active",b.dataset.category===category));
 if(category==="all")state.query=state.mode==="avatars"?"anime portrait illustration":"nature landscape";
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
 el.searchForm.addEventListener("submit",event=>{event.preventDefault();const q=el.searchInput.value.trim();if(!q){chooseCategory("all");return}state.category="search";state.query=q;state.view="all";el.categoryRow.querySelectorAll(".category-chip").forEach(b=>b.classList.remove("is-active"));loadWallpapers(false)});
 el.categoryRow.addEventListener("click",event=>{const button=event.target.closest("[data-category]");if(button)chooseCategory(button.dataset.category)});
 el.orientation.addEventListener("change",()=>{state.orientation=el.orientation.value;renderGrid()});el.sort.addEventListener("change",()=>{state.sort=el.sort.value;renderGrid()});
 el.loadMore.addEventListener("click",()=>state.continuation?loadWallpapers(true):loadWallpapers(false));
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