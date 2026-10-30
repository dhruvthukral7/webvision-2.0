/* Student dashboard: register, login, exam countdowns.
   Data is saved in this browser only (localStorage). See the note at the bottom for moving to a real server. */
(function(){
"use strict";
var USERS_KEY="sr_users", SESSION_KEY="sr_session";
var q=function(s,r){return (r||document).querySelector(s)};
var esc=function(s){return String(s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})};

/* ---------- storage ---------- */
function load(k,d){try{var v=JSON.parse(localStorage.getItem(k));return v==null?d:v}catch(e){return d}}
function save(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}}
var users=load(USERS_KEY,{});
var session=load(SESSION_KEY,null);       // lower-case username or null
function me(){return session&&users[session]?users[session]:null}

/* ---------- password hashing (SHA-256 with a random salt) ---------- */
function rnd(){var a=new Uint8Array(16);(window.crypto||{getRandomValues:function(x){for(var i=0;i<x.length;i++)x[i]=Math.random()*256}}).getRandomValues(a);return Array.prototype.map.call(a,function(b){return b.toString(16).padStart(2,"0")}).join("")}
function hash(pw,salt){
  var data=new TextEncoder().encode(salt+":"+pw);
  if(window.crypto&&crypto.subtle){
    return crypto.subtle.digest("SHA-256",data).then(function(buf){return Array.prototype.map.call(new Uint8Array(buf),function(b){return b.toString(16).padStart(2,"0")}).join("")});
  }
  var h=5381;for(var i=0;i<data.length;i++)h=((h<<5)+h+data[i])|0;   // fallback for non-https pages
  return Promise.resolve("f"+(h>>>0).toString(16));
}

/* ---------- build the page pieces ---------- */
var section=document.createElement("section");
section.id="dashboard";section.setAttribute("aria-label","Student dashboard");
var firstSec=q("main .sec");
var h=document.createElement("h2");h.className="sec";
h.innerHTML='Exam Countdown<small>Log in, add your exam date and watch the days go down</small>';
firstSec.parentNode.insertBefore(h,firstSec);
firstSec.parentNode.insertBefore(section,firstSec);

var uBtn=document.createElement("button");
uBtn.className="ib";uBtn.id="userBtn";
uBtn.innerHTML='<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>';
var a11y=q("#a11yBtn");a11y.parentNode.insertBefore(uBtn,q("#searchBtn"));
var ICON=uBtn.innerHTML;
var ab=document.createElement("span");ab.id="authBtns";
ab.innerHTML='<button class="hbtn solid" data-m="login">Login</button><button class="hbtn" data-m="register">Register</button>';
uBtn.parentNode.insertBefore(ab,uBtn);
ab.addEventListener("click",function(e){var b=e.target.closest("button");if(b)openAuth(b.dataset.m)});
function avatar(u,cls){return u.photo?'<img class="'+cls+'" src="'+u.photo+'" alt="">':'<span class="'+cls+'">'+esc(u.name.charAt(0).toUpperCase())+'</span>'}
function paintBtn(u){uBtn.innerHTML=u?avatar(u,"av"):ICON}

var dlg=document.createElement("dialog");
dlg.id="authDlg";dlg.className="sm";dlg.setAttribute("aria-labelledby","authTitle");
dlg.innerHTML=
'<div class="dh"><h2 id="authTitle">Student login</h2><button class="ib" data-close aria-label="Close"><svg class="i"><use href="#i-x"/></svg></button></div>'+
'<div class="authtabs" role="tablist"><button role="tab" data-m="login" aria-selected="true">Login</button><button role="tab" data-m="register" aria-selected="false">New student</button></div>'+
'<form class="authform" id="authForm" autocomplete="on" novalidate>'+
 '<label class="fld">Username<input id="auUser" name="username" autocomplete="username" maxlength="20" required></label>'+
 '<label class="fld">Password<input id="auPass" name="password" type="password" autocomplete="current-password" required></label>'+
 '<label class="fld" id="auPass2Wrap" hidden>Confirm password<input id="auPass2" type="password" autocomplete="new-password"></label>'+
 '<p class="msg" id="auMsg" role="alert" style="padding:0"></p>'+
 '<button class="btn" id="auGo" type="submit">Login</button>'+
'</form>'+
'<p class="authnote">Your account and exam dates are saved on this device only.</p>';
document.body.appendChild(dlg);
dlg.addEventListener("click",function(e){if(e.target===dlg||e.target.closest("[data-close]"))dlg.close()});

var mode="login";
function setMode(m){
  mode=m;
  dlg.querySelectorAll(".authtabs button").forEach(function(b){b.setAttribute("aria-selected",b.dataset.m===m)});
  q("#auPass2Wrap").hidden=m==="login";
  q("#auGo").textContent=m==="login"?"Login":"Create account";
  q("#authTitle").textContent=m==="login"?"Student login":"New student";
  q("#auPass").autocomplete=m==="login"?"current-password":"new-password";
  q("#auMsg").textContent="";
}
dlg.querySelector(".authtabs").addEventListener("click",function(e){var b=e.target.closest("button");if(b)setMode(b.dataset.m)});
function openAuth(m){setMode(m||"login");q("#authForm").reset();if(!dlg.open)dlg.showModal();q("#auUser").focus()}

q("#authForm").addEventListener("submit",function(e){
  e.preventDefault();
  var msg=q("#auMsg"),name=q("#auUser").value.trim(),pw=q("#auPass").value,key=name.toLowerCase();
  if(!/^[A-Za-z0-9_.]{3,20}$/.test(name)){msg.textContent="Username must be 3 to 20 letters, numbers, dots or underscores.";return}
  if(pw.length<6){msg.textContent="Password must be at least 6 characters.";return}
  if(mode==="register"){
    if(pw!==q("#auPass2").value){msg.textContent="The two passwords do not match.";return}
    if(users[key]){msg.textContent="This username is taken. Pick another one.";return}
    var salt=rnd();
    hash(pw,salt).then(function(hx){
      users[key]={name:name,salt:salt,hash:hx,exams:[]};
      if(!save(USERS_KEY,users)){delete users[key];msg.textContent="Could not save. Check that browser storage is allowed.";return}
      signIn(key);
    });
  }else{
    var u=users[key];
    if(!u){msg.textContent="No account with this username. Use New student to register.";return}
    hash(pw,u.salt).then(function(hx){
      if(hx!==u.hash){msg.textContent="Wrong password. Try again.";return}
      signIn(key);
    });
  }
});
function signIn(key){session=key;save(SESSION_KEY,key);dlg.close();render();section.scrollIntoView({behavior:"smooth",block:"start"})}
function signOut(){closeProfile();session=null;try{localStorage.removeItem(SESSION_KEY)}catch(e){}render()}

uBtn.addEventListener("click",function(e){e.stopPropagation();me()?toggleProfile():openAuth("login")});

/* ---------- date helpers ---------- */
function pad(n){return n<10?"0"+n:""+n}
function todayStr(){var d=new Date();return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())}
function target(s){var p=s.split("-");return new Date(+p[0],+p[1]-1,+p[2],0,0,0).getTime()}   // start of exam day, local time
function nice(s){return new Date(target(s)).toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short",year:"numeric"})}

/* ---------- small profile card in the corner ---------- */
var pf=document.createElement("div");pf.id="profile";pf.hidden=true;pf.setAttribute("role","dialog");pf.setAttribute("aria-label","My profile");
document.body.appendChild(pf);
function profileOpen(){return !pf.hidden}
function placeProfile(){pf.style.top=(q("#bar").getBoundingClientRect().bottom+8)+"px"}
function closeProfile(){pf.hidden=true;uBtn.setAttribute("aria-expanded","false")}
function toggleProfile(){if(profileOpen()){closeProfile();return}renderProfile();pf.hidden=false;placeProfile();uBtn.setAttribute("aria-expanded","true")}
function nextExam(u){var now=Date.now();return u.exams.slice().sort(function(a,b){return target(a.date)-target(b.date)}).filter(function(x){return target(x.date)+864e5>now})[0]}
function renderProfile(){
  var u=me();if(!u){closeProfile();return}
  var n=nextExam(u),days=n?Math.ceil((target(n.date)-Date.now())/864e5):0;
  pf.innerHTML=
  '<div class="pf-top"><div class="pf-ph">'+avatar(u,"pf-av")+'<label class="pf-cam" title="Change photo" aria-label="Change photo"><input type="file" id="pfFile" accept="image/*"><svg class="i" viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg></label></div>'+
  '<div><b>'+esc(u.name)+'</b><small>Student</small>'+(u.photo?'<button class="pf-link" id="pfRm">Remove photo</button>':'')+'</div></div>'+
  '<p class="msg" id="pfMsg" role="alert" style="padding:0"></p>'+
  '<div class="pf-exam">'+(n?
    '<span>Next exam</span><b>'+esc(n.name)+'</b><small>'+nice(n.date)+' · '+(days<=0?"today":days+(days==1?" day left":" days left"))+'</small>'+
    '<div class="pf-row"><input type="date" id="pfDate" min="'+todayStr()+'" value="'+n.date+'" aria-label="Change exam date"><button class="btn" id="pfSave" data-id="'+n.id+'">Change date</button></div>'
    :'<span>No upcoming exam</span><small>Add one in the Exam Countdown section.</small>')+'</div>'+
  '<div class="pf-act"><button class="btn ghost" id="pfDash">Open dashboard</button><button class="btn" id="pfOut">Log out</button></div>';
}
function readPhoto(file,cb){
  if(!file||!/^image\//.test(file.type))return cb(null);
  var fr=new FileReader();
  fr.onload=function(){var im=new Image();im.onload=function(){var s=160,c=document.createElement("canvas");c.width=c.height=s;var m=Math.min(im.width,im.height);c.getContext("2d").drawImage(im,(im.width-m)/2,(im.height-m)/2,m,m,0,0,s,s);cb(c.toDataURL("image/jpeg",.8))};im.onerror=function(){cb(null)};im.src=fr.result};
  fr.onerror=function(){cb(null)};fr.readAsDataURL(file);
}
function setDate(id,val,msgEl){
  var u=me(),ex=u&&u.exams.filter(function(x){return x.id===id})[0];if(!ex)return;
  if(!val){msgEl.textContent="Pick a date.";return}
  if(val<todayStr()){msgEl.textContent="The date must be today or later.";return}
  ex.date=val;save(USERS_KEY,users);render();
}
pf.addEventListener("change",function(e){
  if(e.target.id!=="pfFile")return;
  var u=me();readPhoto(e.target.files[0],function(d){
    if(!d){q("#pfMsg").textContent="Choose a picture file (JPG or PNG).";return}
    u.photo=d;if(!save(USERS_KEY,users)){delete u.photo;renderProfile();q("#pfMsg").textContent="Could not save the photo. Storage is full.";return}
    render();
  });
});
pf.addEventListener("click",function(e){
  var b=e.target.closest("button");if(!b)return;
  if(b.id==="pfRm"){delete me().photo;save(USERS_KEY,users);render()}
  else if(b.id==="pfSave")setDate(b.dataset.id,q("#pfDate").value,q("#pfMsg"));
  else if(b.id==="pfDash"){closeProfile();section.scrollIntoView({behavior:"smooth",block:"start"})}
  else if(b.id==="pfOut")signOut();
});
document.addEventListener("click",function(e){if(profileOpen()&&!pf.contains(e.target)&&!uBtn.contains(e.target))closeProfile()});
document.addEventListener("keydown",function(e){if(e.key==="Escape"&&profileOpen()){closeProfile();uBtn.focus()}});
addEventListener("scroll",function(){if(profileOpen())placeProfile()},{passive:true});
addEventListener("resize",function(){if(profileOpen())placeProfile()});

/* ---------- dashboard view ---------- */
function render(){
  var u=me();
  paintBtn(u);if(profileOpen())renderProfile();
  uBtn.setAttribute("aria-label",u?"My profile ("+u.name+")":"Student login or register");
  uBtn.title=u?u.name:"Login";
  ab.hidden=!!u;
  h.hidden=section.hidden=!u;
  if(!u){section.innerHTML="";return}
  section.innerHTML=
  '<div class="dash"><div class="dash-head"><h3>Hello, '+esc(u.name)+'. Keep going!</h3><button class="btn" id="dOut">Log out</button></div>'+
  '<form class="exform" id="exForm" novalidate>'+
   '<label class="fld">Exam name<input id="exName" maxlength="60" placeholder="For example, SSC CGL Tier I" required></label>'+
   '<label class="fld">Exam date<input id="exDate" type="date" min="'+todayStr()+'" required></label>'+
   '<button class="btn" type="submit">Add exam</button></form>'+
  '<p class="msg" id="exMsg" role="alert"></p>'+
  '<ul class="exlist" id="exList"></ul></div>';
  q("#dOut").onclick=signOut;
  q("#exForm").onsubmit=function(e){
    e.preventDefault();
    var n=q("#exName").value.trim(),d=q("#exDate").value,m=q("#exMsg");
    if(!n){m.textContent="Enter the exam name.";return}
    if(!d){m.textContent="Pick the exam date.";return}
    if(d<todayStr()){m.textContent="The exam date must be today or later.";return}
    if(u.exams.length>=20){m.textContent="You can track up to 20 exams. Delete one first.";return}
    u.exams.push({id:Date.now().toString(36),name:n,date:d,added:Date.now()});
    save(USERS_KEY,users);render();
  };
  q("#exList").onclick=function(e){
    var ed=e.target.closest("[data-edit]");
    if(ed){var r=ed.parentNode.querySelector(".editrow");r.hidden=!r.hidden;if(!r.hidden)r.querySelector("input").focus();return}
    var sv=e.target.closest("[data-save]");
    if(sv){var row=sv.closest(".editrow");setDate(sv.dataset.save,row.querySelector("input").value,row.querySelector(".emsg"));return}
    var b=e.target.closest("[data-del]");if(!b)return;
    var ex=u.exams.filter(function(x){return x.id===b.dataset.del})[0];
    if(ex&&confirm("Delete "+ex.name+"?")){u.exams=u.exams.filter(function(x){return x.id!==b.dataset.del});save(USERS_KEY,users);render()}
  };
  drawList(u);tick();
}
function drawList(u){
  var ul=q("#exList"),now=Date.now();
  if(!u.exams.length){ul.innerHTML='<li class="empty" style="grid-column:1/-1">No exams yet. Add your first exam above to start the countdown.</li>';return}
  var list=u.exams.slice().sort(function(a,b){return target(a.date)-target(b.date)});
  var nextId=(list.filter(function(x){return target(x.date)+864e5>now})[0]||{}).id;
  ul.innerHTML=list.map(function(x){
    var over=target(x.date)+864e5<=now;
    return '<li class="ex'+(x.id===nextId?" next":"")+(over?" over":"")+'" data-t="'+target(x.date)+'" data-a="'+(x.added||now)+'">'+
      '<h4>'+esc(x.name)+'</h4><div class="when">'+nice(x.date)+'</div>'+
      (x.id===nextId?'<span class="badge">Next exam</span>':'')+
      '<button class="del" data-del="'+x.id+'" aria-label="Delete '+esc(x.name)+'"><svg class="i"><use href="#i-x"/></svg></button>'+
      '<div class="cdbox"></div>'+
      '<button class="chg" data-edit="'+x.id+'">Change date</button>'+
      '<div class="editrow" hidden><input type="date" min="'+todayStr()+'" value="'+x.date+'" aria-label="New exam date"><button class="btn" data-save="'+x.id+'">Save</button><span class="emsg" role="alert"></span></div></li>';
  }).join("");
}
function tick(){
  var now=Date.now();
  document.querySelectorAll("#exList .ex").forEach(function(li){
    var t=+li.dataset.t,box=li.querySelector(".cdbox"),diff=t-now,html;
    if(diff<=0){
      html=now<t+864e5?'<div class="done">Exam day. All the best!</div>':'<div class="done">Exam completed</div>';
    }else{
      var s=Math.floor(diff/1000),d=Math.floor(s/86400),hh=Math.floor(s%86400/3600),mm=Math.floor(s%3600/60),ss=s%60;
      var total=t-(+li.dataset.a),pct=Math.max(2,Math.min(100,Math.round((1-diff/total)*100)));
      html='<div class="cd" role="timer" aria-label="'+d+' days '+hh+' hours left"><div><b>'+d+'</b><span>days</span></div><div><b>'+pad(hh)+'</b><span>hours</span></div><div><b>'+pad(mm)+'</b><span>mins</span></div><div><b>'+pad(ss)+'</b><span>secs</span></div></div>'+
           '<div class="bar2" aria-hidden="true"><i style="width:'+pct+'%"></i></div>';
    }
    if(box.dataset.h!==html){box.dataset.h=html;box.innerHTML=html}
  });
}
setInterval(tick,1000);
document.addEventListener("visibilitychange",tick);
render();
})();

/* ------------------------------------------------------------------
   NOTE: this keeps everything inside the visitor's browser, so an account
   works only on the device where it was made. For logins that work on any
   device (and real password safety), replace the load/save helpers at the top
   with calls to a server or a service such as Firebase Auth or Supabase.
   ------------------------------------------------------------------ */