(()=>{
  'use strict';
  const core=window.QuoteCore,storeKey='contact-lens-quotes-v3';
  const $=id=>document.getElementById(id),eyes=['od','os'];
  const textFields=['supply-months','eye-mode','product-od','product-os','boxes-od','boxes-os','office-price-od','office-price-os','allowance'];
  const altTextFields=['alt-supply-months','alt-eye-mode','alt-product-od','alt-product-os','alt-boxes-od','alt-boxes-os','alt-office-price-od','alt-office-price-os'];
  const currency=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value||0);
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const amount=id=>Math.max(0,Number($(id).value)||0);
  const catalog=window.LensCatalog.catalog,productById=new Map(catalog.map(item=>[item.id,item]));
  const productIdMigrations=Object.freeze({'P-AO2W12':'C204','P-AO2W24':'C205','P-AO2WA6':'C207','P-PR130':'C293','P-PR190':'C294','P-PR1A30':'C311','P-PR1A90':'C298','P-AOHG6':'C241','P-AOHGA6':'C235','P-AOHGMF6':'C181','P-AOND6':'C292','P-AOC6':'C244'});
  let rebateRules=[],officeRebates={daily:50,reusable:25},alternativeEnabled=false;

  function activeEyes(){const mode=$('eye-mode').value;return mode==='both'?eyes:[mode];}
  function product(eye){return productById.get($(`product-${eye}`).value);}
  function altActiveEyes(){const mode=$('alt-eye-mode').value;return mode==='both'?eyes:[mode];}
  function altProduct(eye){return productById.get($(`alt-product-${eye}`).value);}
  function eyeName(eye){return eye==='od'?'OD':'OS';}
  function familyKey(item){return item?`${item.manufacturer}|${item.family}`:'';}
  function familyLabel(key){const [manufacturer,family]=key.split('|');return `${manufacturer} · ${family}`;}
  function todayKey(){const now=new Date(),offset=now.getTimezoneOffset()*60000;return new Date(now-offset).toISOString().slice(0,10);}

  function productOptions(select){
    for(const family of [...new Set(catalog.map(item=>item.family))]){
      const group=document.createElement('optgroup');group.label=family;
      for(const item of catalog.filter(entry=>entry.family===family)){
        const option=document.createElement('option');option.value=item.id;option.textContent=item.name;group.append(option);
      }
      select.append(group);
    }
  }

  function restore(){
    let saved;try{saved=JSON.parse(localStorage.getItem(storeKey)||'null');}catch{}
    if(saved?.fields)for(const id of textFields)if(saved.fields[id]!==undefined)$(id).value=id.startsWith('product-')?(productIdMigrations[saved.fields[id]]||saved.fields[id]):saved.fields[id];
    alternativeEnabled=Boolean(saved?.alternative?.enabled);
    if(saved?.alternative?.fields)for(const id of altTextFields)if(saved.alternative.fields[id]!==undefined)$(id).value=id.startsWith('alt-product-')?(productIdMigrations[saved.alternative.fields[id]]||saved.alternative.fields[id]):saved.alternative.fields[id];
    $('apply-allowance').checked=saved?.applyAllowance!==false;
    rebateRules=Array.isArray(saved?.rebateRules)?saved.rebateRules.filter(rule=>rule&&rule.key&&Number(rule.amount)>=0):[];
    const savedOfficeRebates=saved?.officeRebates||{};
    officeRebates={daily:Number.isFinite(Number(savedOfficeRebates.daily))&&Number(savedOfficeRebates.daily)>=0?Number(savedOfficeRebates.daily):50,reusable:Number.isFinite(Number(savedOfficeRebates.reusable))&&Number(savedOfficeRebates.reusable)>=0?Number(savedOfficeRebates.reusable):25};
    for(const eye of eyes)$(`boxes-${eye}`).dataset.manual=String(Boolean(saved?.manual?.[eye]));
    for(const eye of eyes)$(`alt-boxes-${eye}`).dataset.manual=String(Boolean(saved?.alternative?.manual?.[eye]));
  }

  function persist(){
    try{localStorage.setItem(storeKey,JSON.stringify({fields:Object.fromEntries(textFields.map(id=>[id,$(id).value])),applyAllowance:$('apply-allowance').checked,manual:Object.fromEntries(eyes.map(eye=>[eye,$(`boxes-${eye}`).dataset.manual==='true'])),alternative:{enabled:alternativeEnabled,fields:Object.fromEntries(altTextFields.map(id=>[id,$(id).value])),manual:Object.fromEntries(eyes.map(eye=>[eye,$(`alt-boxes-${eye}`).dataset.manual==='true']))},rebateRules,officeRebates}));}catch{}
  }

  function chooseProduct(eye){
    const item=product(eye);
    $(`office-price-${eye}`).value=item&&item.officePrice>0?item.officePrice.toFixed(2):'';
    $(`boxes-${eye}`).dataset.manual='false';render();
  }

  function chooseAltProduct(eye){
    const item=altProduct(eye);
    $(`alt-office-price-${eye}`).value=item&&item.officePrice>0?item.officePrice.toFixed(2):'';
    $(`alt-boxes-${eye}`).dataset.manual='false';render();
  }

  function recalcBoxes(){
    for(const eye of eyes){const item=product(eye),field=$(`boxes-${eye}`);if(field.dataset.manual!=='true')field.value=item?core.suggestedBoxes(amount('supply-months'),item.pack,item.frequency,1):'';}
  }

  function recalcAltBoxes(){
    if(!alternativeEnabled)return;
    for(const eye of eyes){const item=altProduct(eye),field=$(`alt-boxes-${eye}`);if(field.dataset.manual!=='true')field.value=item?core.suggestedBoxes(amount('alt-supply-months'),item.pack,item.frequency,1):'';}
  }

  function refreshSupplyOptions(){
    const selected=activeEyes().map(product),allSelected=selected.length>0&&selected.every(Boolean);
    const oneMonth=allSelected&&selected.every(item=>item.frequency===1&&item.pack===30);
    const threeMonths=allSelected&&selected.every(item=>item.frequency===1&&(item.pack===30||item.pack===90));
    const choices=[...(oneMonth?[1]:[]),...(threeMonths?[3]:[]),6,12],select=$('supply-months'),previous=Number(select.value)||12;
    const next=choices.includes(previous)?previous:6;
    select.innerHTML=choices.map(months=>`<option value="${months}" ${months===next?'selected':''}>${months} month${months===1?'':'s'}</option>`).join('');
    if(next!==previous)for(const eye of eyes)$(`boxes-${eye}`).dataset.manual='false';
  }

  function refreshAltSupplyOptions(){
    if(!alternativeEnabled)return;
    const selected=altActiveEyes().map(altProduct),allSelected=selected.length>0&&selected.every(Boolean);
    const oneMonth=allSelected&&selected.every(item=>item.frequency===1&&item.pack===30);
    const threeMonths=allSelected&&selected.every(item=>item.frequency===1&&(item.pack===30||item.pack===90));
    const choices=[...(oneMonth?[1]:[]),...(threeMonths?[3]:[]),6,12],select=$('alt-supply-months'),previous=Number(select.value)||12;
    const next=choices.includes(previous)?previous:6;
    select.innerHTML=choices.map(months=>`<option value="${months}" ${months===next?'selected':''}>${months} month${months===1?'':'s'}</option>`).join('');
    if(next!==previous)for(const eye of eyes)$(`alt-boxes-${eye}`).dataset.manual='false';
  }

  function quoteLines(priceSource){return activeEyes().map(eye=>({boxes:amount(`boxes-${eye}`),pricePerBox:priceSource(eye),lensesPerBox:product(eye)?.pack||0}));}
  function appliedAllowance(){return $('apply-allowance').checked?amount('allowance'):0;}
  function hasAnnualQuantity(eye,isAlt=false){const item=isAlt?altProduct(eye):product(eye),boxes=amount(`${isAlt?'alt-':''}boxes-${eye}`);return Boolean(item)&&boxes>=core.fullAnnualBoxes(item.pack,item.frequency,1);}
  function officeRebateAmount(){return activeEyes().reduce((sum,eye)=>sum+(hasAnnualQuantity(eye)?(product(eye).frequency===1?officeRebates.daily:officeRebates.reusable)/2:0),0);}
  function manufacturerRebateAmount(){
    return activeEyes().reduce((sum,eye)=>{const item=product(eye),rule=rebateRules.find(entry=>entry.key===familyKey(item));if(!hasAnnualQuantity(eye)||!rule||(rule.expires&&rule.expires<todayKey()))return sum;return sum+Math.max(0,Number(rule.amount)||0)/2;},0);
  }
  function refreshRebates(){$('rebate').value=officeRebateAmount().toFixed(2);$('manufacturer-rebate').value=manufacturerRebateAmount().toFixed(2);}
  function officeQuote(){return core.officeQuoteLines({lines:quoteLines(eye=>amount(`office-price-${eye}`)),supplyMonths:amount('supply-months'),insuranceAllowance:appliedAllowance(),instantDiscount:0,fees:0,officeRebate:officeRebateAmount(),manufacturerRebate:manufacturerRebateAmount()});}

  function altQuoteLines(priceSource){return altActiveEyes().map(eye=>({boxes:amount(`alt-boxes-${eye}`),pricePerBox:priceSource(eye),lensesPerBox:altProduct(eye)?.pack||0}));}
  function altOfficeRebateAmount(){return altActiveEyes().reduce((sum,eye)=>sum+(hasAnnualQuantity(eye,true)?(altProduct(eye).frequency===1?officeRebates.daily:officeRebates.reusable)/2:0),0);}
  function altManufacturerRebateAmount(){
    return altActiveEyes().reduce((sum,eye)=>{const item=altProduct(eye),rule=rebateRules.find(entry=>entry.key===familyKey(item));if(!hasAnnualQuantity(eye,true)||!rule||(rule.expires&&rule.expires<todayKey()))return sum;return sum+Math.max(0,Number(rule.amount)||0)/2;},0);
  }
  function altOfficeQuote(){return core.officeQuoteLines({lines:altQuoteLines(eye=>amount(`alt-office-price-${eye}`)),supplyMonths:amount('alt-supply-months'),insuranceAllowance:appliedAllowance(),instantDiscount:0,fees:0,officeRebate:altOfficeRebateAmount(),manufacturerRebate:altManufacturerRebateAmount()});}

  function lines(result){return `<div class="total-line"><span>${result.boxes} boxes · ${result.lenses} lenses · before benefits</span><strong>${currency(result.gross)}</strong></div><div class="total-line"><span>Allowance applied</span><strong>−${currency(result.allowanceUsed)}</strong></div><div class="total-line"><span>Due today</span><strong>${currency(result.dueToday)}</strong></div><div class="total-line"><span>In-office annual rebate</span><strong>−${currency(result.officeRebateUsed)}</strong></div><div class="total-line"><span>Manufacturer annual rebate</span><strong>−${currency(result.manufacturerRebateUsed)}</strong></div><div class="total-line emphasis"><span>Effective total</span><strong>${currency(result.effectiveTotal)}</strong></div><div class="total-line effective"><span>Effective per month</span><strong>${currency(result.effectivePerMonth)}</strong></div>`;}

  function renderEyes(){
    const active=new Set(activeEyes());
    for(const eye of eyes){
      document.querySelector(`[data-eye-card="${eye}"]`).hidden=!active.has(eye);
      const item=product(eye),source=$(`price-source-${eye}`);
      source.textContent=item?(item.officePrice>0?`${item.pack} lenses per box · predetermined ${item.frequency}-day replacement · Dr. Desk CL item ${item.id} · office price captured ${window.LensCatalog.priceBookDate}.${item.id==='C354'?' Verify the listed $34.60 price.':''}`:`${item.pack} lenses per box · predetermined ${item.frequency}-day replacement · office price not loaded; enter the current office price below.`):`Choose an ${eyeName(eye)} lens to load its box size and office price.`;
    }
  }

  function renderAlternative(){
    $('alternative-quote').hidden=!alternativeEnabled;
    $('add-alternative').parentElement.hidden=alternativeEnabled;
    if(!alternativeEnabled)return;
    const active=new Set(altActiveEyes());
    for(const eye of eyes){
      document.querySelector(`[data-alt-eye-card="${eye}"]`).hidden=!active.has(eye);
      const item=altProduct(eye),source=$(`alt-price-source-${eye}`);
      source.textContent=item?(item.officePrice>0?`${item.pack} lenses per box · predetermined ${item.frequency}-day replacement · Dr. Desk CL item ${item.id} · office price captured ${window.LensCatalog.priceBookDate}.`:`${item.pack} lenses per box · predetermined ${item.frequency}-day replacement · office price not loaded; enter the current office price below.`):`Choose an ${eyeName(eye)} lens to load its box size and office price.`;
    }
    $('alt-rebate').value=altOfficeRebateAmount().toFixed(2);
    $('alt-manufacturer-rebate').value=altManufacturerRebateAmount().toFixed(2);
    const ready=altActiveEyes().every(eye=>$(`alt-office-price-${eye}`).value!=='');
    $('alt-office-total').innerHTML=ready?lines(altOfficeQuote()):'<div class="empty">Choose a lens for each eye in this option.</div>';
  }

  function lensSummary(){return activeEyes().map(eye=>{const item=product(eye),boxes=amount(`boxes-${eye}`);return `${eyeName(eye)}: ${item?.name||'lens not selected'} · ${boxes} ${boxes===1?'box':'boxes'}`;}).join(' | ');}
  function altLensSummary(){return altActiveEyes().map(eye=>{const item=altProduct(eye),boxes=amount(`alt-boxes-${eye}`);return `${eyeName(eye)}: ${item?.name||'lens not selected'} · ${boxes} ${boxes===1?'box':'boxes'}`;}).join(' | ');}
  function quotedQuantityLabel(isAlt=false){const selectedEyes=isAlt?altActiveEyes():activeEyes(),prefix=isAlt?'alt-':'',boxes=selectedEyes.reduce((sum,eye)=>sum+amount(`${prefix}boxes-${eye}`),0);return `${boxes} box${boxes===1?'':'es'} quoted`;}
  function summaryRow(label,notes,result){return `<tr><td><strong>${esc(label)}</strong><br><span class="retailer-meta">${esc(notes)}</span></td><td>${currency(result.effectiveTotal)}<br><span class="retailer-meta">${currency(result.effectivePerMonth)} / month</span></td></tr>`;}

  function renderSummary(){
    const rows=[],officeReady=activeEyes().every(eye=>$(`office-price-${eye}`).value!=='');
    if(officeReady)rows.push(summaryRow(alternativeEnabled?'Your office — Option A':'Your office',`${officeQuote().boxes} boxes · ${$('apply-allowance').checked?'allowance enabled':'allowance not applied'}`,officeQuote()));
    const altReady=alternativeEnabled&&altActiveEyes().every(eye=>$(`alt-office-price-${eye}`).value!=='');
    if(altReady)rows.push(summaryRow('Your office — Option B',`${altOfficeQuote().boxes} boxes · ${$('apply-allowance').checked?'allowance enabled':'allowance not applied'} · separate alternative`,altOfficeQuote()));
    $('quote-date').textContent=new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});
    const optionDetails=`<p><strong>${alternativeEnabled?'Option A · ':''}${quotedQuantityLabel()}</strong><br>${esc(lensSummary())}</p>`+(alternativeEnabled?`<p><strong>Option B · ${quotedQuantityLabel(true)}</strong><br>${esc(altLensSummary())}</p>`:'');
    $('summary').innerHTML=optionDetails+(rows.length?`<div class="table-scroll"><table class="summary-table"><thead><tr><th>Source</th><th>Selected quantity · effective total</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`:'<p class="empty">Choose the lens and enter prices to build the quote.</p>');
  }

  function orderRequests(){try{const requests=JSON.parse(localStorage.getItem('contact-lens-order-requests-v1')||'[]');return Array.isArray(requests)?requests:[];}catch{return [];}}
  function renderOrderRequests(){
    const requests=orderRequests().sort((a,b)=>String(b.submittedAt).localeCompare(String(a.submittedAt))),waiting=requests.filter(request=>request.status!=='Contacted').length;
    $('request-count').textContent=`${waiting} waiting`;
    $('request-list').innerHTML=requests.length?requests.map(request=>`<article class="request-card"><div><strong>${esc(request.patientName||'Patient')}</strong><span>${esc(request.optionLabel||'Selected option')} · Quote ${esc(request.quoteId||'')}</span><span>${request.submittedAt?`Submitted ${new Date(request.submittedAt).toLocaleString()}`:''}</span></div><div><span>${esc(request.contactMethod||'Contact')}: ${esc(request.contactMethod==='email'?request.email:request.phone)}</span><span class="request-status ${request.status==='Contacted'?'complete':''}">${esc(request.status||'Awaiting office review')}</span>${request.status==='Contacted'?'':`<button type="button" data-mark-contacted="${esc(request.requestId)}">Mark contacted</button>`}</div></article>`).join(''):'<p class="empty">No patient requests have been submitted yet.</p>';
  }

  function emailQuote(){
    const office=officeQuote(),linesText=[`Contact Lens Quote`,quotedQuantityLabel(),lensSummary(),'',`Office due today: ${currency(office.dueToday)}`,`In-office annual rebate: ${currency(office.officeRebateUsed)}`,`Manufacturer annual rebate: ${currency(office.manufacturerRebateUsed)}`,`Office effective total: ${currency(office.effectiveTotal)}`,`Office effective per month: ${currency(office.effectivePerMonth)}`];
    if(alternativeEnabled){const alt=altOfficeQuote();linesText.push('','OPTION B',quotedQuantityLabel(true),altLensSummary(),`Office due today: ${currency(alt.dueToday)}`,`In-office annual rebate: ${currency(alt.officeRebateUsed)}`,`Manufacturer annual rebate: ${currency(alt.manufacturerRebateUsed)}`,`Office effective total: ${currency(alt.effectiveTotal)}`,`Office effective per month: ${currency(alt.effectivePerMonth)}`);}
    linesText.push('','Verify insurance and rebate eligibility before finalizing the order.');
    window.location.href=`mailto:?subject=${encodeURIComponent('Contact Lens Quote')}&body=${encodeURIComponent(linesText.join('\n'))}`;
  }

  function snapshotOption(label,isAlt=false){
    const selectedEyes=isAlt?altActiveEyes():activeEyes(),itemForEye=isAlt?altProduct:product,prefix=isAlt?'alt-':'',result=isAlt?altOfficeQuote():officeQuote();
    return {label,supplyMonths:amount(`${prefix}supply-months`),eyes:selectedEyes.map(eye=>({eye:eyeName(eye),product:itemForEye(eye)?.name||'Lens not selected',boxes:amount(`${prefix}boxes-${eye}`),lensesPerBox:itemForEye(eye)?.pack||0,pricePerBox:amount(`${prefix}office-price-${eye}`)})),gross:result.gross,allowance:result.allowanceUsed,dueToday:result.dueToday,officeRebate:result.officeRebateUsed,manufacturerRebate:result.manufacturerRebateUsed,effectiveTotal:result.effectiveTotal,effectivePerMonth:result.effectivePerMonth};
  }

  function openPatientOrder(){
    const optionAReady=activeEyes().every(eye=>product(eye)&&$(`office-price-${eye}`).value!=='');
    if(!optionAReady){alert('Choose the lens and office price for each quoted eye before creating a take-home quote.');return;}
    const optionBReady=alternativeEnabled&&altActiveEyes().every(eye=>altProduct(eye)&&$(`alt-office-price-${eye}`).value!=='');
    const now=new Date(),expires=new Date(now.getTime()+14*24*60*60*1000),datePart=todayKey().replaceAll('-',''),shortId=Math.random().toString(36).slice(2,8).toUpperCase();
    const token=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const snapshot={quoteId:`CLQ-${datePart}-${shortId}`,createdAt:now.toISOString(),expiresAt:expires.toISOString(),options:[snapshotOption('Option A')],prototype:true};
    if(optionBReady)snapshot.options.push(snapshotOption('Option B',true));
    try{localStorage.setItem(`contact-lens-patient-quote:${token}`,JSON.stringify(snapshot));}catch{alert('This browser could not save the take-home quote.');return;}
    window.open(`patient-order.html#${encodeURIComponent(token)}`,'_blank','noopener');
  }

  function render(){refreshSupplyOptions();recalcBoxes();refreshAltSupplyOptions();recalcAltBoxes();refreshRebates();renderEyes();renderAlternative();$('office-total').innerHTML=activeEyes().every(eye=>$(`office-price-${eye}`).value!=='')?lines(officeQuote()):'<div class="empty">Choose a lens for each eye in this quote.</div>';renderSummary();renderOrderRequests();persist();}

  for(const eye of eyes){productOptions($(`product-${eye}`));productOptions($(`alt-product-${eye}`));}restore();render();
  document.addEventListener('input',event=>{
    if(eyes.some(eye=>event.target.id===`boxes-${eye}`))event.target.dataset.manual='true';
    if(eyes.some(eye=>event.target.id===`alt-boxes-${eye}`))event.target.dataset.manual='true';
    render();
  });
  document.addEventListener('change',event=>{
    if(event.target.id==='product-od')chooseProduct('od');else if(event.target.id==='product-os')chooseProduct('os');
    else if(event.target.id==='alt-product-od')chooseAltProduct('od');else if(event.target.id==='alt-product-os')chooseAltProduct('os');
    else{if(['supply-months','eye-mode'].includes(event.target.id))for(const eye of eyes)$(`boxes-${eye}`).dataset.manual='false';if(['alt-supply-months','alt-eye-mode'].includes(event.target.id))for(const eye of eyes)$(`alt-boxes-${eye}`).dataset.manual='false';render();}
  });
  document.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.id==='create-quote'){const menu=$('quote-delivery'),opening=menu.hidden;menu.hidden=!opening;button.setAttribute('aria-expanded',String(opening));$('settings-menu').hidden=true;$('settings-menu-button').setAttribute('aria-expanded','false');return;}
    if(button.id==='settings-menu-button'){const menu=$('settings-menu'),opening=menu.hidden;menu.hidden=!opening;button.setAttribute('aria-expanded',String(opening));$('quote-delivery').hidden=true;$('create-quote').setAttribute('aria-expanded','false');return;}
    if(['print','email','patient-order'].includes(button.id)){$('quote-delivery').hidden=true;$('create-quote').setAttribute('aria-expanded','false');}
    if(button.id==='print'){window.print();return;}if(button.id==='email'){emailQuote();return;}if(button.id==='patient-order'){openPatientOrder();return;}
    if(button.id==='toggle-request-inbox'){const content=$('request-inbox-content'),opening=content.hidden;content.hidden=!opening;button.setAttribute('aria-expanded',String(opening));button.textContent=opening?'Hide requests':'Show requests';renderOrderRequests();return;}
    if(button.dataset.markContacted){const requests=orderRequests(),request=requests.find(item=>item.requestId===button.dataset.markContacted);if(request){request.status='Contacted';request.contactedAt=new Date().toISOString();localStorage.setItem('contact-lens-order-requests-v1',JSON.stringify(requests));renderOrderRequests();}return;}
    if(button.id==='add-alternative'){alternativeEnabled=true;for(const eye of eyes)$(`alt-boxes-${eye}`).dataset.manual='false';render();$('alternative-heading').scrollIntoView({behavior:'smooth',block:'start'});return;}
    if(button.id==='remove-alternative'){alternativeEnabled=false;render();return;}
    if(button.id==='copy-option-a'){$('alt-eye-mode').value=$('eye-mode').value;for(const eye of eyes){$(`alt-product-${eye}`).value=$(`product-${eye}`).value;$(`alt-office-price-${eye}`).value=$(`office-price-${eye}`).value;$(`alt-boxes-${eye}`).dataset.manual='false';}render();return;}
    if(button.id==='alt-show-eye-choice'){$('alt-eye-choice').hidden=false;button.hidden=true;$('alt-eye-mode').focus();return;}
    if(button.id==='alt-copy-od'){$('alt-product-os').value=$('alt-product-od').value;$('alt-office-price-os').value=$('alt-office-price-od').value;$('alt-boxes-os').value=$('alt-boxes-od').value;$('alt-boxes-os').dataset.manual=$('alt-boxes-od').dataset.manual;render();return;}
    if(button.dataset.altResetBoxes){$(`alt-boxes-${button.dataset.altResetBoxes}`).dataset.manual='false';render();return;}
    if(button.id==='show-eye-choice'){$('eye-choice').hidden=false;button.hidden=true;$('eye-mode').focus();return;}
    if(button.id==='copy-od'){$('product-os').value=$('product-od').value;$('office-price-os').value=$('office-price-od').value;$('boxes-os').value=$('boxes-od').value;$('boxes-os').dataset.manual=$('boxes-od').dataset.manual;render();return;}
    if(button.dataset.resetBoxes){$(`boxes-${button.dataset.resetBoxes}`).dataset.manual='false';render();return;}
  });
  window.addEventListener('storage',event=>{if(event.key==='contact-lens-order-requests-v1')renderOrderRequests();if(event.key===storeKey){try{const saved=JSON.parse(event.newValue||'null');rebateRules=Array.isArray(saved?.rebateRules)?saved.rebateRules:[];const settings=saved?.officeRebates||{};officeRebates={daily:Number.isFinite(Number(settings.daily))&&Number(settings.daily)>=0?Number(settings.daily):50,reusable:Number.isFinite(Number(settings.reusable))&&Number(settings.reusable)>=0?Number(settings.reusable):25};render();}catch{}}});
})();
