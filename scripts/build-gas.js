const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'google-apps-script');
fs.mkdirSync(out, { recursive: true });

const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const write = (name, value) => fs.writeFileSync(path.join(out, name), value.replace(/\r\n/g, '\n'));
const stripAssets = html => html
  .replace(/^\s*<link rel="stylesheet"[^>]+>\s*$/gm, '')
  .replace(/^\s*<script src="[^"]+" defer><\/script>\s*$/gm, '');
const injectBefore = (html, marker, value) => html.replace(marker, `${value}\n${marker}`);
const script = source => `<script>\n${source}\n</script>`;
const style = source => `<style>\n${source}\n</style>`;

const gasBootstrap = `window.GAS_MODE=true;window.CLQ_APP_URL=<?!= JSON.stringify(appUrl) ?>;`;
const staffHelpers = `
function clqStaffKey(){let key='';try{key=sessionStorage.getItem('clq-staff-key')||'';}catch{}if(!key){key=prompt('Enter the staff access key for shared quotes and order requests:')||'';try{if(key)sessionStorage.setItem('clq-staff-key',key);}catch{}}return key;}
function clqServerFailure(error){const message=error&&error.message?error.message:String(error||'The shared app could not complete that request.');alert(message);if(/access key/i.test(message)){try{sessionStorage.removeItem('clq-staff-key');}catch{}}}
`;

let app = read('app.js');
app = app.replace("  let rebateRules=[],officeRebates={daily:50,reusable:25},alternativeEnabled=false;", "  let rebateRules=[],officeRebates={daily:50,reusable:25},alternativeEnabled=false,serverOrderRequests=[];");
app = app.replace(
  "  function orderRequests(){try{const requests=JSON.parse(localStorage.getItem('contact-lens-order-requests-v1')||'[]');return Array.isArray(requests)?requests:[];}catch{return [];}}",
  `  function orderRequests(){if(window.GAS_MODE)return serverOrderRequests;try{const requests=JSON.parse(localStorage.getItem('contact-lens-order-requests-v1')||'[]');return Array.isArray(requests)?requests:[];}catch{return [];}}
  function refreshServerOrderRequests(){if(!window.GAS_MODE)return;const key=clqStaffKey();if(!key)return;google.script.run.withSuccessHandler(requests=>{serverOrderRequests=Array.isArray(requests)?requests:[];renderOrderRequests();}).withFailureHandler(clqServerFailure).listOrderRequests(key);}
  function refreshServerSettings(){if(!window.GAS_MODE)return;const key=clqStaffKey();if(!key)return;google.script.run.withSuccessHandler(settings=>{rebateRules=Array.isArray(settings?.rebateRules)?settings.rebateRules:[];officeRebates=settings?.officeRebates||{daily:50,reusable:25};render();}).withFailureHandler(clqServerFailure).getSharedSettings(key);}`
);
const oldOpen = "    try{localStorage.setItem(`contact-lens-patient-quote:${token}`,JSON.stringify(snapshot));}catch{alert('This browser could not save the take-home quote.');return;}\n    window.open(`patient-order.html#${encodeURIComponent(token)}`,'_blank','noopener');";
const newOpen = "    if(window.GAS_MODE){const key=clqStaffKey();if(!key)return;const patientWindow=window.open('about:blank','_blank');if(!patientWindow){alert('Allow pop-ups for this app to open the take-home quote.');return;}patientWindow.document.title='Preparing quote…';patientWindow.document.body.innerHTML='<p style=\"font:16px system-ui;padding:24px\">Preparing the take-home quote…</p>';google.script.run.withSuccessHandler(saved=>patientWindow.location.replace(saved.url)).withFailureHandler(error=>{patientWindow.close();clqServerFailure(error);}).saveQuote(snapshot,key);return;}\n    try{localStorage.setItem(`contact-lens-patient-quote:${token}`,JSON.stringify(snapshot));}catch{alert('This browser could not save the take-home quote.');return;}\n    window.open(`patient-order.html#${encodeURIComponent(token)}`,'_blank','noopener');";
if (!app.includes(oldOpen)) throw new Error('Could not patch take-home quote persistence.');
app = app.replace(oldOpen, newOpen);
app = app.replace(
  "if(button.dataset.markContacted){const requests=orderRequests(),request=requests.find(item=>item.requestId===button.dataset.markContacted);if(request){request.status='Contacted';request.contactedAt=new Date().toISOString();localStorage.setItem('contact-lens-order-requests-v1',JSON.stringify(requests));renderOrderRequests();}return;}",
  "if(button.dataset.markContacted){if(window.GAS_MODE){const key=clqStaffKey();if(!key)return;google.script.run.withSuccessHandler(()=>refreshServerOrderRequests()).withFailureHandler(clqServerFailure).markOrderRequestContacted(button.dataset.markContacted,key);return;}const requests=orderRequests(),request=requests.find(item=>item.requestId===button.dataset.markContacted);if(request){request.status='Contacted';request.contactedAt=new Date().toISOString();localStorage.setItem('contact-lens-order-requests-v1',JSON.stringify(requests));renderOrderRequests();}return;}"
);
app = app.replace("for(const eye of eyes){productOptions($(`product-${eye}`));productOptions($(`alt-product-${eye}`));}restore();render();", "for(const eye of eyes){productOptions($(`product-${eye}`));productOptions($(`alt-product-${eye}`));}restore();render();refreshServerSettings();");
app = app.replace("if(button.id==='toggle-request-inbox'){", "if(button.id==='toggle-request-inbox'){refreshServerOrderRequests();");

let index = stripAssets(read('index.html'))
  .replace('<span class="status">Local prototype · Data stays on this device</span>', '<span class="status">Shared Apps Script edition</span>')
  .replace('Requests submitted through the take-home page appear here for staff verification. In this prototype, they are stored only in this browser.', 'Requests submitted through a take-home link appear here for staff verification. Patient contact details are stored in this Apps Script project.')
  .replace('href="rebates.html"', 'href="<?!= appUrl ?>?page=rebates"')
  .replace('Contact Lens Quotes · Local calculator prototype', 'Contact Lens Quotes · Shared Apps Script calculator');
index = injectBefore(index, '</head>', style(read('styles.css')));
index = injectBefore(index, '</body>', script(gasBootstrap + staffHelpers) + '\n' + script(read('quote-core.js')) + '\n' + script(read('catalog.js')) + '\n' + script(app));
write('Index.html', index);

let rebateJs = read('rebates.js');
rebateJs = rebateJs.replace(
  "  function persist(){try{state=JSON.parse(localStorage.getItem(storeKey)||'{}')||{};}catch{state={};}state.rebateRules=rules;state.officeRebates=officeRebates;localStorage.setItem(storeKey,JSON.stringify(state));}",
  "  function persist(){if(window.GAS_MODE){const key=clqStaffKey();if(!key)return;google.script.run.withSuccessHandler(()=>{$('office-save-status').textContent='Saved to shared app';setTimeout(()=>{$('office-save-status').textContent='';},1800);}).withFailureHandler(clqServerFailure).saveSharedSettings({rebateRules:rules,officeRebates},key);return;}try{state=JSON.parse(localStorage.getItem(storeKey)||'{}')||{};}catch{state={};}state.rebateRules=rules;state.officeRebates=officeRebates;localStorage.setItem(storeKey,JSON.stringify(state));}"
);
rebateJs = rebateJs.replace("  render();\n})();", "  render();\n  if(window.GAS_MODE){const key=clqStaffKey();if(key)google.script.run.withSuccessHandler(settings=>{rules=Array.isArray(settings?.rebateRules)?settings.rebateRules:[];officeRebates=settings?.officeRebates||{daily:50,reusable:25};$('office-rebate-daily').value=Number(officeRebates.daily||0).toFixed(2);$('office-rebate-reusable').value=Number(officeRebates.reusable||0).toFixed(2);render();}).withFailureHandler(clqServerFailure).getSharedSettings(key);}\n})();");
let rebates = stripAssets(read('rebates.html'))
  .replace('href="index.html"', 'href="<?!= appUrl ?>"');
rebates = injectBefore(rebates, '</head>', style(read('styles.css')) + '\n' + style(read('rebates.css')));
rebates = injectBefore(rebates, '</body>', script(gasBootstrap + staffHelpers) + '\n' + script(read('catalog.js')) + '\n' + script(rebateJs));
write('Rebates.html', rebates);

let patientJs = read('patient-order.js');
patientJs = patientJs.replace("  const token=decodeURIComponent(location.hash.slice(1));\n  let quote=null,selectedIndex=-1;\n  try{quote=JSON.parse(localStorage.getItem(`contact-lens-patient-quote:${token}`)||'null');}catch{}", "  const token=window.GAS_MODE?window.CLQ_QUOTE_TOKEN:decodeURIComponent(location.hash.slice(1));\n  let quote=window.GAS_MODE?window.CLQ_INITIAL_QUOTE:null,selectedIndex=-1;\n  if(!window.GAS_MODE)try{quote=JSON.parse(localStorage.getItem(`contact-lens-patient-quote:${token}`)||'null');}catch{}");
const oldSave = "    let requests=[];try{requests=JSON.parse(localStorage.getItem('contact-lens-order-requests-v1')||'[]');if(!Array.isArray(requests))requests=[];requests.push(request);localStorage.setItem('contact-lens-order-requests-v1',JSON.stringify(requests));}catch{alert('The request could not be saved in this browser.');return;}\n    $('request-panel').hidden=true;$('confirmation').hidden=false;$('confirmation').innerHTML=`<div class=\"confirmation-mark\" aria-hidden=\"true\">✓</div><h2>Request saved for office follow-up</h2><p>Reference <strong>${esc(request.requestId)}</strong> when speaking with the office.</p><div class=\"selected-option\"><strong>${esc(request.optionLabel)} · ${quote.options[selectedIndex].supplyMonths}-month supply</strong><span>${currency(quote.options[selectedIndex].dueToday)} due at checkout before rebates</span></div><p class=\"fine\"><strong>Prototype note:</strong> this request is stored only on this device. A production version will securely send it to the office and trigger the selected phone, text, or email follow-up.</p>`;window.scrollTo({top:0,behavior:'smooth'});";
const newSave = "    const finish=saved=>{request.requestId=saved?.requestId||request.requestId;$('request-panel').hidden=true;$('confirmation').hidden=false;$('confirmation').innerHTML=`<div class=\"confirmation-mark\" aria-hidden=\"true\">✓</div><h2>Request sent for office follow-up</h2><p>Reference <strong>${esc(request.requestId)}</strong> when speaking with the office.</p><div class=\"selected-option\"><strong>${esc(request.optionLabel)} · ${quote.options[selectedIndex].supplyMonths}-month supply</strong><span>${currency(quote.options[selectedIndex].dueToday)} due at checkout before rebates</span></div><p class=\"fine\">The office will verify product availability, insurance, rebate eligibility, and final pricing before completing the order.</p>`;window.scrollTo({top:0,behavior:'smooth'});};\n    if(window.GAS_MODE){google.script.run.withSuccessHandler(finish).withFailureHandler(error=>alert(error?.message||'The request could not be sent.')).submitOrderRequest(request);return;}\n    let requests=[];try{requests=JSON.parse(localStorage.getItem('contact-lens-order-requests-v1')||'[]');if(!Array.isArray(requests))requests=[];requests.push(request);localStorage.setItem('contact-lens-order-requests-v1',JSON.stringify(requests));}catch{alert('The request could not be saved in this browser.');return;}finish(request);";
if (!patientJs.includes(oldSave)) throw new Error('Could not patch patient request persistence.');
patientJs = patientJs.replace(oldSave, newSave);
let patient = stripAssets(read('patient-order.html'))
  .replace('This local prototype demonstrates the patient ordering experience. It does not transmit an order or process payment.', 'Review your saved quote and ask the office to verify the option you prefer. This page does not process payment.');
patient = injectBefore(patient, '</head>', style(read('styles.css')) + '\n' + style(read('patient-order.css')));
patient = injectBefore(patient, '</body>', script(`window.GAS_MODE=true;window.CLQ_QUOTE_TOKEN=<?!= JSON.stringify(quoteToken) ?>;window.CLQ_INITIAL_QUOTE=<?!= quoteJson ?>;`) + '\n' + script(patientJs));
write('PatientOrder.html', patient);

console.log('Built Google Apps Script files in google-apps-script/.');

