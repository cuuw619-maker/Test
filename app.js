(() => {
"use strict";
const API_URL="https://commons.wikimedia.org/w/api.php";
const STORAGE_KEY="wallora-favorites-v1";
const CATEGORY_QUERIES={all:"landscape wallpaper nature",nature:"nature landscape mountain forest wallpaper",space:"outer space nebula galaxy stars",architecture:"architecture city building photography",cars:"sports car automobile photography",ocean:"ocean sea underwater waves",minimal:"minimalist abstract background photography",animals:"wildlife animal nature photography"};
const $=s=>document.querySelector(s);
const el={grid:$("#wallpaperGrid"),searchForm:$("#searchForm"),searchInput:$("#searchInput"),categoryRow:$("#categoryRow"),orientation:$("#orientationFilter"),sort:$("#sortSelect"),status:$("#resultStatus"),visibleCount:$("#visibleCount"),title:$("#sectionTitle"),subtitle:$("#sectionSubtitle"),loadMoreWrap:$("#loadMoreWrap"),loadMore:$("#loadMoreButton"),empty:$("#emptyState"),emptyTitle:$("#emptyTitle"),emptyDescription:$("#emptyDescription"),reset:$("#resetButton"),homeNav:$("#homeNav"),favoritesNav:$("#favoritesNav"),favoriteCount:$("#favoriteCount"),modal:$("#imageModal"),modalImage:$("#modalImage"),modalTitle:$("#modalTitle"),modalFacts:$("#modalFacts"),modalCredit:$("#modalCredit"),modalFavorite:$("#modalFavorite"),download:$("#downloadLink"),source:$("#sourceLink"),license:$("#licenseNote"),toast:$("#toast")};
const state={items:[],continuation:null,loading:false,query:CATEGORY_QUERIES.all,category:"all",view:"all",orientation:"all",sort:"relevance",activeItem:null,requestId:0,toastTimer:null};
let favorites=readFavorites();
function readFavorites(){try{const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]");return Array.isArray(saved)?saved.filter(item=>item&&item.id&&item.thumb&&item.original):[]}catch(error){console.warn("Не удалось прочитать избранное:",error);return[]}}
function saveFavorites(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(favorites));updateFavoriteCount()}catch(error){showToast("Не удалось сохранить: хранилище браузера заполнено")}}
function updateFavoriteCount(){el.favoriteCount.textContent=String(favorites.length)}
function cleanText(value){return String(value||"").replace(/<[^>]*>/g," ").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;/g,"'").replace(/&#x([0-9a-f]+);/gi,(_,code)=>String.fromCodePoint(parseInt(code,16))).replace(/&#(\d+);/g,(_,code)=>String.fromCodePoint(Number(code))).replace(/\s+/g," ").trim()}
function metadataValue(metadata,key){return cleanText(metadata&&metadata[key]&&metadata[key].value)}
function normalizePage(page){
 const info=page.imageinfo&&page.imageinfo[0];if(!info||!info.thumburl||!info.url)return null;if(info.mime&&!info.mime.startsWith("image/"))return null;
 const metadata=info.extmetadata||{},width=Number(info.width)||0,height=Number(info.height)||0;
 return{id:String(page.pageid),title:cleanText((page.title||"Изображение").replace(/^File:/i,"").replace(/\.[^.]+$/,"")),thumb:info.thumburl,original:info.url,pageUrl:info.descriptionurl||"https://commons.wikimedia.org/",width,height,mime:info.mime||"",artist:metadataValue(metadata,"Artist")||metadataValue(metadata,"Credit")||"Автор не указан",license:metadataValue(metadata,"LicenseShortName")||metadataValue(metadata,"UsageTerms")||"Лицензия указана на странице файла"};
}
function apiUrl(continuation){const params=new URLSearchParams({action:"query",format:"json",origin:"*",generator:"search",gsrnamespace:"6",gsrsearch:state.query,gsrlimit:"30",prop:"imageinfo",iiprop:"url|size|mime|extmetadata",iiurlwidth:"900",iiextmetadatalanguage:"ru|en"});if(continuation)Object.entries(continuation).forEach(([key,value])=>params.set(key,String(value)));return API_URL+"?"+params.toString()}
async function loadWallpapers(append=false){
 if(state.loading||(append&&!state.continuation))return;
 const requestId=++state.requestId;state.loading=true;el.loadMore.disabled=true;el.loadMore.textContent="Загружаем...";el.status.textContent="Загрузка изображений";
 if(!append){state.items=[];el.grid.innerHTML='<div class="loading-state"><span class="loader"></span><p>Собираем изображения...</p></div>';el.empty.hidden=true;el.loadMoreWrap.hidden=true}
 try{
  const response=await fetch(apiUrl(append?state.continuation:null));if(!response.ok)throw new Error("Сервис изображений ответил с ошибкой "+response.status);
  const data=await response.json();if(requestId!==state.requestId)return;
  const pages=Object.values(data.query&&data.query.pages?data.query.pages:{}),normalized=pages.map(normalizePage).filter(Boolean),existing=new Set(state.items.map(item=>item.id));
  normalized.forEach(item=>{if(!existing.has(item.id)&&(item.width>=900||item.height>=900)){state.items.push(item);existing.add(item.id)}});
  state.continuation=data.continue||null;state.loading=false;render();el.status.textContent="Wikimedia Commons · открытая медиатека";el.loadMoreWrap.hidden=!state.continuation||state.view==="favorites";el.loadMore.disabled=false;el.loadMore.innerHTML='Показать ещё <span>↓</span>';
  if(!state.items.length){el.empty.hidden=false;el.emptyTitle.textContent="Подходящих изображений не найдено";el.emptyDescription.textContent="Попробуйте другой запрос. В библиотеке лучше работают короткие запросы на английском языке."}
 }catch(error){if(requestId!==state.requestId)return;state.loading=false;el.status.textContent="Не удалось загрузить";el.loadMore.disabled=false;el.loadMore.innerHTML='Повторить загрузку <span>↻</span>';if(!state.items.length){el.grid.innerHTML="";el.empty.hidden=false;el.emptyTitle.textContent="Не удалось подключиться к библиотеке";el.emptyDescription.textContent="Проверьте подключение к интернету и попробуйте ещё раз. "+error.message}else showToast("Не удалось загрузить следующую страницу");el.loadMoreWrap.hidden=false}
}
function getVisibleItems(){
 const source=state.view==="favorites"?favorites:state.items;let result=source.filter(item=>state.orientation==="landscape"?item.width>item.height:state.orientation==="portrait"?item.height>item.width:state.orientation==="square"?item.width===item.height:true);
 if(state.sort==="resolution")result=result.slice().sort((a,b)=>(b.width*b.height)-(a.width*a.height));else if(state.sort==="title")result=result.slice().sort((a,b)=>a.title.localeCompare(b.title));else if(state.sort==="random")result=result.slice().sort((a,b)=>hash(a.id)-hash(b.id));return result
}
function hash(value){let result=0;for(let i=0;i<value.length;i++)result=((result<<5)-result+value.charCodeAt(i))|0;return Math.abs(result)}
function dimensions(item){return item.width&&item.height?item.width.toLocaleString("ru-RU")+" × "+item.height.toLocaleString("ru-RU"):"Размер неизвестен"}
function createCard(item){
 const card=document.createElement("article");card.className="wallpaper-card";
 const wrap=document.createElement("div");wrap.className="card-image-wrap";wrap.tabIndex=0;wrap.setAttribute("role","button");wrap.setAttribute("aria-label","Открыть "+item.title);
 const img=document.createElement("img");img.className="card-image";img.src=item.thumb;img.alt=item.title;img.loading="lazy";img.decoding="async";img.addEventListener("error",()=>card.remove(),{once:true});
 const overlay=document.createElement("div");overlay.className="card-overlay";
 const fav=document.createElement("button");fav.className="favorite-button"+(isFavorite(item.id)?" is-favorite":"");fav.type="button";fav.textContent=isFavorite(item.id)?"♥":"♡";fav.setAttribute("aria-label",isFavorite(item.id)?"Убрать из избранного":"Добавить в избранное");
 fav.addEventListener("click",event=>{event.stopPropagation();toggleFavorite(item);const saved=isFavorite(item.id);fav.classList.toggle("is-favorite",saved);fav.textContent=saved?"♥":"♡";fav.setAttribute("aria-label",saved?"Убрать из избранного":"Добавить в избранное")});
 overlay.append(fav);wrap.append(img,overlay);wrap.addEventListener("click",()=>openModal(item));wrap.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();openModal(item)}});
 const caption=document.createElement("div");caption.className="card-caption";const title=document.createElement("span");title.className="card-title";title.textContent=item.title;title.title=item.title;const size=document.createElement("span");size.className="card-size";size.textContent=item.width&&item.height?item.width+"×"+item.height:"IMAGE";caption.append(title,size);card.append(wrap,caption);return card
}
function render(){
 const items=getVisibleItems();el.grid.innerHTML="";el.empty.hidden=items.length>0;el.visibleCount.textContent=items.length+" изображений";
 if(state.view==="favorites"){el.title.textContent="Твоё избранное";el.subtitle.textContent="Изображения, сохранённые в этом браузере.";el.status.textContent="Личная подборка";el.loadMoreWrap.hidden=true;el.categoryRow.hidden=true;if(!items.length){el.emptyTitle.textContent="Здесь пока пусто";el.emptyDescription.textContent="Нажимай на сердечко у понравившихся изображений, чтобы сохранить их здесь."}}
 else{el.title.textContent=state.query===CATEGORY_QUERIES.all?"Свежая коллекция":"Подборка для тебя";el.subtitle.textContent="Подборка изображений из открытой медиатеки Wikimedia Commons.";el.categoryRow.hidden=false;el.loadMoreWrap.hidden=!state.continuation}
 items.forEach(item=>el.grid.append(createCard(item)));if(state.view==="all"&&!state.loading&&state.items.length===0)el.empty.hidden=false
}
function isFavorite(id){return favorites.some(item=>item.id===id)}
function toggleFavorite(item){
 if(isFavorite(item.id)){favorites=favorites.filter(entry=>entry.id!==item.id);showToast("Удалено из избранного")}else{favorites.unshift(item);showToast("Сохранено в избранное")}
 saveFavorites();if(state.view==="favorites")render();if(state.activeItem&&state.activeItem.id===item.id)updateModalFavorite()
}
function updateModalFavorite(){const saved=state.activeItem&&isFavorite(state.activeItem.id);el.modalFavorite.classList.toggle("is-favorite",Boolean(saved));el.modalFavorite.textContent=saved?"♥":"♡";el.modalFavorite.setAttribute("aria-label",saved?"Убрать из избранного":"Добавить в избранное")}
function addFact(label,value){if(!value)return;const span=document.createElement("span");span.textContent=label+": "+value;el.modalFacts.append(span)}
function openModal(item){
 state.activeItem=item;el.modalImage.src=item.original;el.modalImage.alt=item.title;el.modalTitle.textContent=item.title;el.modalFacts.innerHTML="";
 addFact("Размер",dimensions(item));addFact("Формат",item.mime.replace("image/","").toUpperCase());addFact("Лицензия",item.license);
 el.modalCredit.textContent="Автор / источник: "+item.artist;el.download.href=item.original;el.source.href=item.pageUrl;el.license.textContent="Перед использованием проверьте условия лицензии на странице оригинала. Некоторые лицензии требуют указания автора или сохранения той же лицензии.";
 updateModalFavorite();el.modal.hidden=false;document.body.style.overflow="hidden";el.modalClose.focus()
}
function closeModal(){el.modal.hidden=true;document.body.style.overflow="";state.activeItem=null}
function showToast(message){el.toast.textContent=message;el.toast.classList.add("is-visible");window.clearTimeout(state.toastTimer);state.toastTimer=window.setTimeout(()=>el.toast.classList.remove("is-visible"),2200)}
function setView(view){
 state.view=view;el.homeNav.classList.toggle("is-active",view==="all");el.favoritesNav.classList.toggle("is-active",view==="favorites");
 if(view==="all"){el.orientation.value=state.orientation;render();if(!state.items.length)loadWallpapers(false)}else render();
 $("#collection").scrollIntoView({behavior:"smooth",block:"start"})
}
function selectCategory(category){
 state.category=category;state.view="all";state.query=CATEGORY_QUERIES[category]||CATEGORY_QUERIES.all;state.continuation=null;el.searchInput.value="";
 el.categoryRow.querySelectorAll(".category-chip").forEach(chip=>chip.classList.toggle("is-active",chip.dataset.category===category));
 el.homeNav.classList.add("is-active");el.favoritesNav.classList.remove("is-active");state.sort="relevance";el.sort.value="relevance";loadWallpapers(false)
}
el.searchForm.addEventListener("submit",event=>{event.preventDefault();const query=el.searchInput.value.trim();if(!query){selectCategory("all");return}state.category="search";state.query=query;state.view="all";state.continuation=null;el.categoryRow.querySelectorAll(".category-chip").forEach(chip=>chip.classList.remove("is-active"));el.homeNav.classList.add("is-active");el.favoritesNav.classList.remove("is-active");loadWallpapers(false)});
el.categoryRow.addEventListener("click",event=>{const chip=event.target.closest("[data-category]");if(chip)selectCategory(chip.dataset.category)});
el.orientation.addEventListener("change",()=>{state.orientation=el.orientation.value;render()});el.sort.addEventListener("change",()=>{state.sort=el.sort.value;render()});
el.loadMore.addEventListener("click",()=>{if(state.continuation)loadWallpapers(true);else loadWallpapers(false)});
el.homeNav.addEventListener("click",()=>setView("all"));el.favoritesNav.addEventListener("click",()=>setView("favorites"));
$("#modalClose").addEventListener("click",closeModal);$("#modalBackdrop").addEventListener("click",closeModal);el.modalFavorite.addEventListener("click",()=>{if(state.activeItem)toggleFavorite(state.activeItem)});
el.reset.addEventListener("click",()=>{el.orientation.value="all";state.orientation="all";el.sort.value="relevance";state.sort="relevance";selectCategory("all")});
document.addEventListener("keydown",event=>{if(event.key==="Escape"&&!el.modal.hidden)closeModal()});
$("#currentYear").textContent=String(new Date().getFullYear());updateFavoriteCount();loadWallpapers(false);
})();