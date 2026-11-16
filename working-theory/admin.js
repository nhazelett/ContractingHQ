(function () {
  'use strict';
  var config = window.KTHQ_WORKING_THEORY || {}, account = window.KTHQAccount;
  var people = [], posts = [], generation = 0, activeTab = 'people', legacyToken = '';
  var status = document.getElementById('admin-status'), results = document.getElementById('admin-results');
  var signin = document.getElementById('admin-account-signin'), signout = document.getElementById('admin-account-signout');
  var search = document.getElementById('admin-search'), removed = document.getElementById('admin-show-removed');
  function node(tag,text,cls) { var el=document.createElement(tag); if(text!==undefined) el.textContent=text; if(cls) el.className=cls; return el; }
  async function request(path,payload) {
    var token = legacyToken || (account && await account.accessToken());
    if (!token) throw new Error('Sign in with your KTHQ administrator account.');
    var options = {cache:'no-store',credentials:'omit',headers:{Authorization:'Bearer '+token}};
    if(payload) {options.method='POST';options.headers['Content-Type']='application/json';options.body=JSON.stringify(payload);}
    var response=await fetch(String(config.apiBase || '').replace(/\/$/,'')+path,options);
    var data=await response.json(); if(!response.ok) throw new Error(data.error || 'The request failed.'); return data;
  }
  function action(parent,label,fn,secondary) {
    var button=node('button',label,'wt-button'+(secondary?' wt-secondary':''));button.type='button';
    button.addEventListener('click',async function(){button.disabled=true;try{await fn();}catch(error){status.textContent=error.message;}finally{button.disabled=false;}});parent.append(button);return button;
  }
  function render() {
    results.replaceChildren(); var query=search.value.trim().toLowerCase();
    var records=activeTab==='people'?people:posts;
    var filtered=records.filter(function(record){return (removed.checked || !['removed','deleted'].includes(record.status)) && (!query || [record.name,record.email,record.title,record.body,record.mentor&&record.mentor.name,record.status].filter(Boolean).join(' ').toLowerCase().includes(query));});
    document.getElementById('admin-record-count').textContent=filtered.length+' '+(activeTab==='people'?'mentors':'posts');
    filtered.forEach(function(record){
      var card=node('article',undefined,'wt-admin-card');
      card.append(node('p',record.status+' · '+(activeTab==='people'?'Mentor':record.kind),'wt-kicker'));
      card.append(node('h3',activeTab==='people'?record.name:record.title || (record.kind==='take'?'Take on '+record.topicSlug:'Essay')));
      if(activeTab==='people') {
        card.append(node('p',[record.rank,record.role,record.email].filter(Boolean).join(' · '),'wt-note'));
        card.append(node('p',record.bio,'wt-plain'));
        if(record.status!=='approved') action(card,record.status==='pending'?'Approve mentor':'Restore mentor access',async function(){await request('/admin/mentors/update',{id:record.id,status:'approved'});await load();});
        if(record.status==='pending') action(card,'Decline application',async function(){if(!window.confirm('Decline this mentor application?'))return;await request('/admin/mentors/update',{id:record.id,status:'rejected'});await load();},true);
        if(record.status!=='removed') action(card,'Remove mentor',async function(){if(!window.confirm('Remove '+record.name+' from mentors? Their writing will be hidden. You can restore access later.'))return;await request('/admin/mentors/update',{id:record.id,status:'removed'});await load();},true);
      } else {
        card.append(node('p',(record.mentor&&record.mentor.name || 'Removed mentor')+' · '+new Date(record.createdAt).toLocaleDateString(),'wt-note'));
        card.append(node('p',record.body.slice(0,360)+(record.body.length>360?'…':''),'wt-plain'));
        action(card,'Edit post',function(){edit(card,record);},true);
        if(record.status!=='deleted') action(card,'Remove post',async function(){if(!window.confirm('Remove this post from public view? You can restore it later.'))return;await request('/admin/posts/remove',{kind:record.kind,id:record.id,topicSlug:record.topicSlug});await load();},true);
        else action(card,'Restore post',async function(){await request('/admin/posts/restore',{kind:record.kind,id:record.id,topicSlug:record.topicSlug});await load();});
      }
      results.append(card);
    });
    if(!filtered.length) results.append(node('p','No matching '+(activeTab==='people'?'mentors':'posts')+'.','wt-note'));
  }
  function edit(card,record) {
    if(card.querySelector('form'))return;
    var form=node('form',undefined,'wt-form'), inputs={};
    function field(label,name,large){var id='edit-'+record.id+'-'+name;var l=node('label',label);l.htmlFor=id;var input=node(name==='category'?'select':large?'textarea':'input');if(name==='category')['Concept','Moment'].forEach(function(value){var option=node('option',value);option.value=value;input.append(option);});input.id=id;input.value=record[name]||'';input.required=name!=='sources';inputs[name]=input;form.append(l,input);}
    if(record.kind==='essay'){field('Title','title');field('Card introduction','summary',true);field('Type','category');}
    field('Writing','body',true);inputs.body.rows=16;
    if(record.kind==='essay')field('Sources and further reading','sources',true);
    var save=node('button','Save changes','wt-button');save.type='submit';var msg=node('p','','wt-message');msg.setAttribute('role','status');form.append(save,msg);
    action(form,'Cancel',function(){form.remove();},true);
    form.addEventListener('submit',async function(event){event.preventDefault();save.disabled=true;msg.textContent='Saving…';try{var payload={kind:record.kind,id:record.id,topicSlug:record.topicSlug};Object.keys(inputs).forEach(function(key){payload[key]=inputs[key].value;});await request('/admin/posts/edit',payload);await load();status.textContent='Post updated.';}catch(error){msg.textContent=error.message;}finally{save.disabled=false;}});
    card.append(form);
  }
  async function load() {
    var current=++generation;results.replaceChildren();document.getElementById('admin-controls').hidden=true;
    var user=account&&account.user();signin.hidden=!!user;signout.hidden=!user;
    if(!user&&!legacyToken){status.textContent='Sign in with your designated KTHQ administrator account.';return;}
    status.textContent='Checking administrator access…';
    try {
      var cursors={mentors:'',takes:'',essays:''}, nextPeople=[], nextPosts=[];
      do {
        var data=await request('/admin/dashboard?'+new URLSearchParams(cursors));
        if(current!==generation)return;
        nextPeople.push.apply(nextPeople,data.mentors);nextPosts.push.apply(nextPosts,data.posts);cursors=data.cursors;
      }while(cursors.mentors!=='done'||cursors.takes!=='done'||cursors.essays!=='done');
      people=nextPeople;posts=nextPosts.sort(function(a,b){return b.createdAt.localeCompare(a.createdAt);});
      document.getElementById('admin-controls').hidden=false;
      status.textContent='Administrator access verified. '+people.filter(function(p){return p.status==='pending';}).length+' mentor applications awaiting review. Approved mentors’ new writing publishes automatically.';
      render();
    }catch(error){if(current===generation)status.textContent=error.message;}
  }
  signin.addEventListener('submit',async function(event){event.preventDefault();var button=signin.querySelector('button');button.disabled=true;try{if(!account)throw new Error('Account services are unavailable.');var result=await account.client.auth.signInWithPassword({email:signin.elements.email.value.trim(),password:signin.elements.password.value});if(result.error)throw result.error;legacyToken='';await account.refresh();}catch(error){status.textContent=error.message;}finally{signin.elements.password.value='';button.disabled=false;}});
  signout.addEventListener('click',async function(){legacyToken='';people=[];posts=[];if(account){await account.client.auth.signOut({scope:'local'});await account.refresh();}else await load();});
  document.getElementById('admin-token-login').addEventListener('submit',async function(event){event.preventDefault();legacyToken=event.target.elements.token.value.trim();event.target.elements.token.value='';await load();});
  document.getElementById('admin-refresh').addEventListener('click',function(){void load();});
  ['people','posts'].forEach(function(tab){var button=document.getElementById('admin-tab-'+tab);button.addEventListener('click',function(){activeTab=tab;['people','posts'].forEach(function(name){document.getElementById('admin-tab-'+name).setAttribute('aria-pressed',String(name===tab));});render();});});
  search.addEventListener('input',render);removed.addEventListener('change',render);
  document.addEventListener('kthq-account-changed',function(){void load();});void load();
})();
