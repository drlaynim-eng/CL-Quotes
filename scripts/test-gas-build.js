const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const gas = path.join(root, 'google-apps-script');
const read = name => fs.readFileSync(path.join(gas, name), 'utf8');

for (const file of ['Code.gs', 'appsscript.json', 'Index.html', 'Rebates.html', 'PatientOrder.html']) assert(fs.existsSync(path.join(gas, file)), `${file} was not built`);
const manifest = JSON.parse(read('appsscript.json'));
assert.equal(manifest.webapp.access, 'ANYONE_ANONYMOUS');
assert.equal(manifest.webapp.executeAs, 'USER_DEPLOYING');
for (const file of ['Index.html', 'Rebates.html', 'PatientOrder.html']) {
  const html = read(file);
  assert(!/<script\s+src=/i.test(html), `${file} has an external script`);
  assert(!/<link\s+rel=["']stylesheet/i.test(html), `${file} has an external stylesheet`);
  const compilable = html.replace(/<\?!=[\s\S]*?\?>/g, 'null');
  for (const match of compilable.matchAll(/<script>([\s\S]*?)<\/script>/gi)) new vm.Script(match[1], { filename: file });
}
assert.match(read('Index.html'), /window\.open\('about:blank','_blank'\)/, 'Apps Script quote creation must open its window before the asynchronous server callback');
assert.doesNotMatch(read('Index.html'), /stored only in this browser/, 'Apps Script inbox copy must describe shared storage');
assert.match(read('Index.html'), /\.request-inbox,footer\{display:none!important\}/, 'Patient printouts must hide the staff request inbox');

const properties = new Map([['STAFF_ACCESS_KEY', 'secret']]);
const propertyApi = {
  getProperty: key => properties.has(key) ? properties.get(key) : null,
  setProperty: (key, value) => (properties.set(key, String(value)), propertyApi),
  deleteProperty: key => (properties.delete(key), propertyApi),
  getProperties: () => Object.fromEntries(properties)
};
let id = 0;
const context = {
  console,
  Date,
  JSON,
  Math,
  Number,
  Object,
  String,
  Array,
  RegExp,
  Error,
  encodeURIComponent,
  PropertiesService: { getScriptProperties: () => propertyApi },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  Utilities: { getUuid: () => `00000000-0000-4000-8000-${String(++id).padStart(12, '0')}` },
  ScriptApp: { getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/test/exec' }) },
  HtmlService: { createTemplateFromFile: file => ({ file, evaluate() { return { setTitle() { return this; }, addMetaTag() { return this; } }; } }) }
};
vm.createContext(context);
vm.runInContext(read('Code.gs'), context, { filename: 'Code.gs' });

assert.throws(() => context.getSharedSettings('wrong'), /incorrect/);
assert.equal(context.getSharedSettings('secret').officeRebates.daily, 50);
const settings = context.saveSharedSettings({ officeRebates: { daily: 55, reusable: 30 }, rebateRules: [{ key: 'Alcon|AIR OPTIX', amount: 100, expires: '2027-12-31' }] }, 'secret');
assert.equal(settings.officeRebates.reusable, 30);

const now = new Date();
const quote = {
  quoteId: 'CLQ-TEST',
  createdAt: now.toISOString(),
  expiresAt: new Date(now.getTime() + 7 * 86400000).toISOString(),
  options: [{ label: 'Option A', supplyMonths: 12, eyes: [{ eye: 'OD', product: 'Infuse 90pk', boxes: 4, lensesPerBox: 90, pricePerBox: 142 }], gross: 568, allowance: 130, dueToday: 438, officeRebate: 25, manufacturerRebate: 100, effectiveTotal: 313, effectivePerMonth: 26.08 }]
};
const savedQuote = context.saveQuote(quote, 'secret');
assert.match(savedQuote.url, /page=order&token=/);
const request = context.submitOrderRequest({ quoteToken: savedQuote.token, quoteId: quote.quoteId, optionIndex: 0, patientName: 'Test Patient', phone: '555-555-5555', email: '', contactMethod: 'text' });
assert.match(request.requestId, /^REQ-/);
assert.equal(context.listOrderRequests('secret').length, 1);
assert.equal(context.markOrderRequestContacted(request.requestId, 'secret').status, 'Contacted');
assert.equal(context.listOrderRequests('secret')[0].status, 'Contacted');
assert.throws(() => context.submitOrderRequest({ quoteToken: 'missing' }), /unavailable|expired/);

console.log('Google Apps Script build and server workflow tests passed.');

