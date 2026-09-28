(()=>{
  'use strict';
  const $=id=>document.getElementById(id),currency=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(value)||0);
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const token=decodeURIComponent(location.hash.slice(1));
  let quote=null,selectedIndex=-1;
  try{quote=JSON.parse(localStorage.getItem(`contact-lens-patient-quote:${token}`)||'null');}catch{}

  function fail(message){$('quote-meta').textContent='Quote unavailable';$('quote-options').innerHTML=`<section class="panel unavailable"><h2>We could not open this quote</h2><p>${esc(message)}</p><p>Please contact the office and ask for a new take-home quote.</p></section>`;}
  if(!quote||!Array.isArray(quote.options)||!quote.options.length){fail('The link is incomplete, expired, or was created on another device.');return;}

  const expired=Date.now()>Date.parse(quote.expiresAt);
  $('quote-meta').innerHTML=`<strong>${esc(quote.quoteId)}</strong><span>Prepared ${new Date(quote.createdAt).toLocaleDateString()}</span><span>Valid through ${new Date(quote.expiresAt).toLocaleDateString()}</span>`;
  if(expired){fail('This quote has expired.');return;}

  function optionCard(option,index){
    const eyes=option.eyes.map(eye=>`<li><strong>${esc(eye.eye)}</strong><span>${esc(eye.product)}</span><span>${eye.boxes} ${eye.boxes===1?'box':'boxes'} · ${currency(eye.pricePerBox)}/box</span></li>`).join('');
    const rebate=value=>Number(value)>0?`−${currency(value)}`:currency(0);
    return `<article class="patient-option panel"><div class="option-title"><div><span class="option-kicker">${esc(option.label)}</span><h2>${option.supplyMonths}-month supply</h2></div><span class="box-count">${option.eyes.reduce((sum,eye)=>sum+Number(eye.boxes||0),0)} boxes</span></div><ul class="patient-lenses">${eyes}</ul><div class="patient-costs"><div><span>Due at office checkout</span><strong>${currency(option.dueToday)}</strong></div><div><span>Office annual rebate</span><strong>${rebate(option.officeRebate)}</strong></div><div><span>Manufacturer annual rebate</span><strong>${rebate(option.manufacturerRebate)}</strong></div><div class="patient-effective"><span>Estimated total after rebates</span><strong>${currency(option.effectiveTotal)}</strong></div><div><span>Effective price per month</span><strong>${currency(option.effectivePerMonth)}</strong></div></div><p class="fine">Insurance allowance applied: ${currency(option.allowance)}. Rebates are not deducted at checkout.</p><button type="button" class="choose-option primary-action" data-option-index="${index}">Request ${esc(option.label)}</button></article>`;
  }

  function renderOptions(){$('quote-options').innerHTML=`<div class="patient-step"><span class="step">1</span><div><h2>Review your saved options</h2><p>Choose the supply you would like the office to verify.</p></div></div><div class="patient-option-grid">${quote.options.map(optionCard).join('')}</div>`;}
  renderOptions();

  document.addEventListener('click',event=>{
    const choose=event.target.closest('[data-option-index]');
    if(choose){selectedIndex=Number(choose.dataset.optionIndex);const option=quote.options[selectedIndex];$('selected-option').innerHTML=`<strong>${esc(option.label)} · ${option.supplyMonths}-month supply</strong><span>${currency(option.dueToday)} due at checkout · ${currency(option.effectiveTotal)} estimated after rebates</span>`;$('quote-options').hidden=true;$('request-panel').hidden=false;$('patient-name').focus();return;}
    if(event.target.id==='back-to-options'){$('request-panel').hidden=true;$('quote-options').hidden=false;selectedIndex=-1;window.scrollTo({top:0,behavior:'smooth'});}
  });

  $('request-form').addEventListener('submit',event=>{
    event.preventDefault();
    const phone=$('patient-phone').value.trim(),email=$('patient-email').value.trim(),method=$('contact-method').value;
    if((method==='phone'||method==='text')&&!phone){alert('Enter a mobile phone number for the selected contact method.');$('patient-phone').focus();return;}
    if(method==='email'&&!email){alert('Enter an email address for email follow-up.');$('patient-email').focus();return;}
    const request={requestId:`REQ-${Date.now().toString(36).toUpperCase()}`,quoteId:quote.quoteId,quoteToken:token,optionIndex:selectedIndex,optionLabel:quote.options[selectedIndex].label,submittedAt:new Date().toISOString(),patientName:$('patient-name').value.trim(),phone,email,contactMethod:method,status:'Awaiting office review'};
    let requests=[];try{requests=JSON.parse(localStorage.getItem('contact-lens-order-requests-v1')||'[]');if(!Array.isArray(requests))requests=[];requests.push(request);localStorage.setItem('contact-lens-order-requests-v1',JSON.stringify(requests));}catch{alert('The request could not be saved in this browser.');return;}
    $('request-panel').hidden=true;$('confirmation').hidden=false;$('confirmation').innerHTML=`<div class="confirmation-mark" aria-hidden="true">✓</div><h2>Request saved for office follow-up</h2><p>Reference <strong>${esc(request.requestId)}</strong> when speaking with the office.</p><div class="selected-option"><strong>${esc(request.optionLabel)} · ${quote.options[selectedIndex].supplyMonths}-month supply</strong><span>${currency(quote.options[selectedIndex].dueToday)} due at checkout before rebates</span></div><p class="fine"><strong>Prototype note:</strong> this request is stored only on this device. A production version will securely send it to the office and trigger the selected phone, text, or email follow-up.</p>`;window.scrollTo({top:0,behavior:'smooth'});
  });
})();
