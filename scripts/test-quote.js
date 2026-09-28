const assert=require('node:assert/strict');
const {suggestedBoxes,fullAnnualBoxes,officeQuote,officeQuoteLines,retailerQuote,retailerQuoteLines}=require('../quote-core.js');
const {catalog}=require('../catalog.js');

assert.equal(catalog.length,53);
assert.equal(new Set(catalog.map(item=>item.id)).size,catalog.length);
assert.deepEqual(new Set(catalog.map(item=>item.manufacturer)),new Set(['Bausch + Lomb','CooperVision','Johnson & Johnson','Alcon']));
assert(catalog.every(item=>item.officePrice>=0&&item.pack>0&&[1,14,30].includes(item.frequency)));
assert.equal(catalog.filter(item=>item.officePrice===0).length,8);
assert.equal(catalog.find(item=>item.id==='C294').officePrice,108);
assert.equal(catalog.find(item=>item.id==='C181').officePrice,154);
assert.equal(catalog.find(item=>item.id==='C204').officePrice,118);
assert.equal(catalog.find(item=>item.id==='C356').officePrice,142);
assert.equal(catalog.find(item=>item.id==='C197').officePrice,110.50);

assert.equal(suggestedBoxes(6,90,1,2),4);
assert.equal(suggestedBoxes(12,90,1,2),8);
assert.equal(suggestedBoxes(1,30,1,1),1);
assert.equal(suggestedBoxes(6,30,1,1),1);
assert.equal(suggestedBoxes(12,30,1,2),2);
assert.equal(suggestedBoxes(6,6,30,2),2);
assert.equal(suggestedBoxes(12,6,30,2),4);
assert.equal(suggestedBoxes(6,90,1,1),2);
assert.equal(suggestedBoxes(12,24,14,1),1);
assert.equal(suggestedBoxes(12,24,14,2),2);
assert.equal(suggestedBoxes(6,12,14,1),1);
assert.equal(suggestedBoxes(12,12,14,1),2);
assert.equal(fullAnnualBoxes(30,1,1),12);
assert.equal(fullAnnualBoxes(90,1,1),4);
assert.equal(fullAnnualBoxes(6,30,1),2);
assert.equal(fullAnnualBoxes(24,14,1),1);
assert.equal(fullAnnualBoxes(12,14,1),2);
assert.equal(fullAnnualBoxes(12,14,2),4);

assert.deepEqual(officeQuote({boxes:4,pricePerBox:80,insuranceAllowance:150,instantDiscount:20,fees:0,rebate:40}),{
  boxes:4,gross:320,discountUsed:20,fees:0,allowanceUsed:150,dueToday:150,rebateUsed:40,effectiveTotal:110,effectivePerBox:27.5
});
assert.equal(officeQuote({boxes:4,pricePerBox:20,insuranceAllowance:300,rebate:50}).effectiveTotal,0);
assert.equal(officeQuote({boxes:0,pricePerBox:80}).effectivePerBox,0);
assert.deepEqual(officeQuoteLines({lines:[{boxes:2,pricePerBox:80,lensesPerBox:6},{boxes:3,pricePerBox:100,lensesPerBox:30}],supplyMonths:6,insuranceAllowance:150,instantDiscount:20,fees:10,rebate:40}),{
  boxes:5,lenses:102,months:6,gross:460,discountUsed:20,fees:10,allowanceUsed:150,dueToday:300,officeRebateUsed:40,manufacturerRebateUsed:0,rebateUsed:40,effectiveTotal:260,effectivePerBox:52,effectivePerLens:2.55,effectivePerMonth:43.33
});
assert.deepEqual(officeQuoteLines({lines:[{boxes:4,pricePerBox:100,lensesPerBox:90}],supplyMonths:12,officeRebate:25,manufacturerRebate:50}),{
  boxes:4,lenses:360,months:12,gross:400,discountUsed:0,fees:0,allowanceUsed:0,dueToday:400,officeRebateUsed:25,manufacturerRebateUsed:50,rebateUsed:75,effectiveTotal:325,effectivePerBox:81.25,effectivePerLens:0.9,effectivePerMonth:27.08
});

const online={boxes:4,pricePerBox:70,shipping:0,fees:15,discount:10,rebate:20};
assert.equal(retailerQuote(online).effectiveTotal,265);
assert.equal(retailerQuote({...online,discount:1000}).effectiveTotal,0);
assert.equal(retailerQuoteLines({lines:[{boxes:2,pricePerBox:70},{boxes:3,pricePerBox:90}],fees:15,discount:10,rebate:20}).effectiveTotal,395);

console.log('Quote calculations passed.');
