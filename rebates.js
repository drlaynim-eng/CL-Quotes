(()=>{
  'use strict';
  const storeKey='contact-lens-quotes-v3',$=id=>document.getElementById(id),catalog=window.LensCatalog.catalog;
  const currency=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(value)||0);
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const familyKey=item=>`${item.manufacturer}|${item.family}`;
  const familyLabel=key=>{const [manufacturer,family]=key.split('|');return `${manufacturer} · ${family}`;};
  const todayKey=()=>{const now=new Date(),offset=now.getTimezoneOffset()*60000;return new Date(now-offset).toISOString().slice(0,10);};
  let state={};
  try{state=JSON.parse(localStorage.getItem(storeKey)||'{}')||{};}catch{}
  let rules=Array.isArray(state.rebateRules)?state.rebateRules.filter(rule=>rule?.key&&Number(rule.amount)>=0):[];
  let officeRebates={daily:50,reusable:25,...(state.officeRebates||{})};
  officeRebates.daily=Number.isFinite(Number(officeRebates.daily))&&Number(officeRebates.daily)>=0?Number(officeRebates.daily):50;
  officeRebates.reusable=Number.isFinite(Number(officeRebates.reusable))&&Number(officeRebates.reusable)>=0?Number(officeRebates.reusable):25;

  const keys=[...new Set(catalog.map(familyKey))].sort((a,b)=>familyLabel(a).localeCompare(familyLabel(b)));
  $('rebate-family').innerHTML=keys.map(key=>`<option value="${esc(key)}">${esc(familyLabel(key))}</option>`).join('');

  function persist(){try{state=JSON.parse(localStorage.getItem(storeKey)||'{}')||{};}catch{state={};}state.rebateRules=rules;state.officeRebates=officeRebates;localStorage.setItem(storeKey,JSON.stringify(state));}
  function clearForm(){$('rebate-rule-amount').value='';$('rebate-rule-expires').value='';$('rebate-family').focus();}
  function render(){
    $('rebate-count').textContent=`${rules.length} saved`;
    $('rebate-rule-list').innerHTML=rules.length?rules.slice().sort((a,b)=>familyLabel(a.key).localeCompare(familyLabel(b.key))).map(rule=>`<article class="saved-rebate"><div><strong>${esc(familyLabel(rule.key))}</strong><span>${currency(rule.amount)} annual rebate</span><span>${rule.expires?`Valid through ${esc(rule.expires)}`:'No expiration entered'}${rule.expires&&rule.expires<todayKey()?' · Expired':''}</span></div><div><button type="button" class="secondary" data-edit-rebate="${esc(rule.key)}">Edit</button><button type="button" data-remove-rebate="${esc(rule.key)}">Remove</button></div></article>`).join(''):'<p class="empty">No manufacturer rebates saved yet.</p>';
  }
  function save(){
    const key=$('rebate-family').value,raw=$('rebate-rule-amount').value,amount=Number(raw),expires=$('rebate-rule-expires').value;
    if(!key||raw===''||!Number.isFinite(amount)||amount<0){alert('Choose a lens family and enter a valid annual rebate amount.');return;}
    const next={key,amount:Math.round(amount*100)/100,expires},index=rules.findIndex(rule=>rule.key===key);
    if(index>=0)rules[index]=next;else rules.push(next);
    persist();render();clearForm();
  }
  function saveOfficeRebates(){
    const daily=Number($('office-rebate-daily').value),reusable=Number($('office-rebate-reusable').value);
    if(!Number.isFinite(daily)||daily<0||!Number.isFinite(reusable)||reusable<0){alert('Enter valid nonnegative in-office rebate amounts.');return;}
    officeRebates={daily:Math.round(daily*100)/100,reusable:Math.round(reusable*100)/100};persist();
    $('office-save-status').textContent='Saved';setTimeout(()=>{$('office-save-status').textContent='';},1800);
  }

  document.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.id==='save-office-rebates'){saveOfficeRebates();return;}
    if(button.id==='save-rebate-rule'){save();return;}
    if(button.id==='clear-rebate-form'){clearForm();return;}
    if(button.dataset.editRebate){const rule=rules.find(item=>item.key===button.dataset.editRebate);if(!rule)return;$('rebate-family').value=rule.key;$('rebate-rule-amount').value=rule.amount;$('rebate-rule-expires').value=rule.expires||'';$('rebate-rule-amount').focus();return;}
    if(button.dataset.removeRebate){rules=rules.filter(rule=>rule.key!==button.dataset.removeRebate);persist();render();}
  });
  $('office-rebate-daily').value=officeRebates.daily.toFixed(2);
  $('office-rebate-reusable').value=officeRebates.reusable.toFixed(2);
  render();
})();
