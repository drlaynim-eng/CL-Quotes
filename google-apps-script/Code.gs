const CLQ = Object.freeze({
  settingsKey: 'clq:settings',
  quotePrefix: 'clq:quote:',
  orderPrefix: 'clq:order:',
  staffKeyProperty: 'STAFF_ACCESS_KEY',
  quoteLifetimeMs: 14 * 24 * 60 * 60 * 1000,
  maxStoredOrders: 200
});

function doGet(e) {
  const params = (e && e.parameter) || {};
  const page = String(params.page || 'quotes').toLowerCase();
  const file = page === 'rebates' ? 'Rebates' : page === 'order' ? 'PatientOrder' : 'Index';
  const template = HtmlService.createTemplateFromFile(file);
  template.appUrl = ScriptApp.getService().getUrl();
  template.quoteToken = page === 'order' ? String(params.token || '') : '';
  template.quoteJson = page === 'order' ? safeJson_(readQuote_(template.quoteToken)) : 'null';
  return template.evaluate()
    .setTitle(page === 'rebates' ? 'Rebate Settings' : page === 'order' ? 'Review Your Contact Lens Quote' : 'Contact Lens Quotes')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function getSharedSettings(accessKey) {
  requireStaff_(accessKey);
  const raw = PropertiesService.getScriptProperties().getProperty(CLQ.settingsKey);
  if (!raw) return { rebateRules: [], officeRebates: { daily: 50, reusable: 25 } };
  try {
    return normalizeSettings_(JSON.parse(raw));
  } catch (error) {
    throw new Error('Saved rebate settings are damaged. Restore them from the rebate settings page.');
  }
}

function saveSharedSettings(settings, accessKey) {
  requireStaff_(accessKey);
  const normalized = normalizeSettings_(settings);
  PropertiesService.getScriptProperties().setProperty(CLQ.settingsKey, JSON.stringify(normalized));
  return normalized;
}

function saveQuote(snapshot, accessKey) {
  requireStaff_(accessKey);
  const quote = normalizeQuote_(snapshot);
  const token = Utilities.getUuid();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    cleanupExpiredQuotes_();
    PropertiesService.getScriptProperties().setProperty(CLQ.quotePrefix + token, JSON.stringify(quote));
  } finally {
    lock.releaseLock();
  }
  return { token: token, url: ScriptApp.getService().getUrl() + '?page=order&token=' + encodeURIComponent(token), quoteId: quote.quoteId };
}

function submitOrderRequest(request) {
  const input = request && typeof request === 'object' ? request : {};
  const token = cleanText_(input.quoteToken, 100);
  const quote = readQuote_(token);
  if (!quote) throw new Error('This quote is unavailable or has expired. Ask the office for a new link.');
  if (quote.quoteId !== cleanText_(input.quoteId, 80)) throw new Error('The quote reference does not match this link.');
  const optionIndex = Math.floor(Number(input.optionIndex));
  if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= quote.options.length) throw new Error('Choose a valid quote option.');
  const patientName = cleanText_(input.patientName, 100);
  const phone = cleanText_(input.phone, 40);
  const email = cleanText_(input.email, 160);
  const contactMethod = ['phone', 'text', 'email'].includes(input.contactMethod) ? input.contactMethod : '';
  if (!patientName) throw new Error('Enter the patient name.');
  if (!contactMethod) throw new Error('Choose a contact method.');
  if ((contactMethod === 'phone' || contactMethod === 'text') && !phone) throw new Error('Enter a phone number.');
  if (contactMethod === 'email' && !email) throw new Error('Enter an email address.');
  const requestId = 'REQ-' + Utilities.getUuid().replace(/-/g, '').slice(0, 10).toUpperCase();
  const saved = {
    requestId: requestId,
    quoteId: quote.quoteId,
    quoteToken: token,
    optionIndex: optionIndex,
    optionLabel: quote.options[optionIndex].label,
    submittedAt: new Date().toISOString(),
    patientName: patientName,
    phone: phone,
    email: email,
    contactMethod: contactMethod,
    status: 'Awaiting office review'
  };
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const properties = PropertiesService.getScriptProperties();
    properties.setProperty(CLQ.orderPrefix + requestId, JSON.stringify(saved));
    trimOrders_(properties);
  } finally {
    lock.releaseLock();
  }
  return { requestId: requestId, status: saved.status };
}

function listOrderRequests(accessKey) {
  requireStaff_(accessKey);
  const properties = PropertiesService.getScriptProperties().getProperties();
  return Object.keys(properties)
    .filter(function (key) { return key.indexOf(CLQ.orderPrefix) === 0; })
    .map(function (key) { try { return JSON.parse(properties[key]); } catch (error) { return null; } })
    .filter(Boolean)
    .sort(function (a, b) { return String(b.submittedAt).localeCompare(String(a.submittedAt)); });
}

function markOrderRequestContacted(requestId, accessKey) {
  requireStaff_(accessKey);
  const key = CLQ.orderPrefix + cleanText_(requestId, 80);
  const properties = PropertiesService.getScriptProperties();
  const raw = properties.getProperty(key);
  if (!raw) throw new Error('Order request not found.');
  const request = JSON.parse(raw);
  request.status = 'Contacted';
  request.contactedAt = new Date().toISOString();
  properties.setProperty(key, JSON.stringify(request));
  return request;
}

function readQuote_(token) {
  if (!token) return null;
  const properties = PropertiesService.getScriptProperties();
  const key = CLQ.quotePrefix + cleanText_(token, 100);
  const raw = properties.getProperty(key);
  if (!raw) return null;
  try {
    const quote = JSON.parse(raw);
    if (!quote.expiresAt || Date.now() > Date.parse(quote.expiresAt)) {
      properties.deleteProperty(key);
      return null;
    }
    return quote;
  } catch (error) {
    properties.deleteProperty(key);
    return null;
  }
}

function requireStaff_(accessKey) {
  const expected = PropertiesService.getScriptProperties().getProperty(CLQ.staffKeyProperty);
  if (!expected) throw new Error('The administrator must set the STAFF_ACCESS_KEY script property before staff tools can be used.');
  if (String(accessKey || '') !== expected) throw new Error('The staff access key is incorrect.');
}

function normalizeSettings_(settings) {
  const input = settings && typeof settings === 'object' ? settings : {};
  const office = input.officeRebates && typeof input.officeRebates === 'object' ? input.officeRebates : {};
  const amount = function (value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) / 100 : fallback;
  };
  const rules = Array.isArray(input.rebateRules) ? input.rebateRules.slice(0, 100).map(function (rule) {
    return { key: cleanText_(rule && rule.key, 160), amount: amount(rule && rule.amount, 0), expires: /^\d{4}-\d{2}-\d{2}$/.test(String(rule && rule.expires || '')) ? String(rule.expires) : '' };
  }).filter(function (rule) { return rule.key; }) : [];
  return { rebateRules: rules, officeRebates: { daily: amount(office.daily, 50), reusable: amount(office.reusable, 25) } };
}

function normalizeQuote_(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') throw new Error('Quote data is missing.');
  const quoteId = cleanText_(snapshot.quoteId, 80);
  const createdAt = String(snapshot.createdAt || '');
  const expiresAt = String(snapshot.expiresAt || '');
  if (!quoteId || !Number.isFinite(Date.parse(createdAt)) || !Number.isFinite(Date.parse(expiresAt))) throw new Error('Quote dates or reference are invalid.');
  const expiry = Date.parse(expiresAt);
  if (expiry <= Date.now() || expiry > Date.now() + CLQ.quoteLifetimeMs + 60000) throw new Error('Quote expiration must be within 14 days.');
  if (!Array.isArray(snapshot.options) || !snapshot.options.length || snapshot.options.length > 2) throw new Error('A quote must contain one or two options.');
  const options = snapshot.options.map(function (option, index) {
    if (!option || !Array.isArray(option.eyes) || !option.eyes.length || option.eyes.length > 2) throw new Error('Each quote option must contain one or two eyes.');
    const numericFields = ['supplyMonths', 'gross', 'allowance', 'dueToday', 'officeRebate', 'manufacturerRebate', 'effectiveTotal', 'effectivePerMonth'];
    const normalized = { label: cleanText_(option.label || ('Option ' + (index + 1)), 40), eyes: option.eyes.map(function (eye) {
      return { eye: cleanText_(eye.eye, 4), product: cleanText_(eye.product, 160), boxes: nonnegative_(eye.boxes), lensesPerBox: nonnegative_(eye.lensesPerBox), pricePerBox: nonnegative_(eye.pricePerBox) };
    }) };
    numericFields.forEach(function (field) { normalized[field] = nonnegative_(option[field]); });
    return normalized;
  });
  return { quoteId: quoteId, createdAt: createdAt, expiresAt: expiresAt, options: options, prototype: false };
}

function cleanupExpiredQuotes_() {
  const properties = PropertiesService.getScriptProperties();
  const all = properties.getProperties();
  Object.keys(all).filter(function (key) { return key.indexOf(CLQ.quotePrefix) === 0; }).forEach(function (key) {
    try { if (Date.now() > Date.parse(JSON.parse(all[key]).expiresAt)) properties.deleteProperty(key); }
    catch (error) { properties.deleteProperty(key); }
  });
}

function trimOrders_(properties) {
  const all = properties.getProperties();
  const orders = Object.keys(all).filter(function (key) { return key.indexOf(CLQ.orderPrefix) === 0; }).map(function (key) {
    try { return { key: key, submittedAt: JSON.parse(all[key]).submittedAt || '' }; } catch (error) { return { key: key, submittedAt: '' }; }
  }).sort(function (a, b) { return String(b.submittedAt).localeCompare(String(a.submittedAt)); });
  orders.slice(CLQ.maxStoredOrders).forEach(function (order) { properties.deleteProperty(order.key); });
}

function cleanText_(value, maxLength) { return String(value == null ? '' : value).trim().slice(0, maxLength); }
function nonnegative_(value) { const number = Number(value); return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) / 100 : 0; }
function safeJson_(value) { return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026'); }

