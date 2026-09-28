(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.QuoteCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const money=value=>Math.round((Number(value)||0)*100)/100;
  const nonnegative=value=>Math.max(0,money(value));
  const whole=value=>Math.max(0,Math.floor(Number(value)||0));

  function suggestedBoxes(months,lensesPerBox,replacementDays,eyes){
    const pack=whole(lensesPerBox),days=whole(replacementDays),eyeCount=whole(eyes);
    if(!pack||!days||!eyeCount)return 0;
    if(pack===24&&days===14)return eyeCount;
    if(pack===30&&days===1)return eyeCount;
    return Math.ceil((whole(months)*30/days)/pack)*eyeCount;
  }

  function fullAnnualBoxes(lensesPerBox,replacementDays,eyes){
    const pack=whole(lensesPerBox),days=whole(replacementDays),eyeCount=whole(eyes);
    if(!pack||!days||!eyeCount)return 0;
    if(pack===24&&days===14)return eyeCount;
    return Math.ceil((12*30/days)/pack)*eyeCount;
  }

  function officeQuote(input){
    const boxes=whole(input.boxes),price=nonnegative(input.pricePerBox),allowance=nonnegative(input.insuranceAllowance);
    const rebate=nonnegative(input.rebate),instantDiscount=nonnegative(input.instantDiscount),fees=nonnegative(input.fees);
    const gross=money(boxes*price),discountUsed=Math.min(gross,instantDiscount);
    const beforeAllowance=money(gross-discountUsed+fees),allowanceUsed=Math.min(beforeAllowance,allowance);
    const dueToday=money(beforeAllowance-allowanceUsed),rebateUsed=Math.min(dueToday,rebate);
    const effectiveTotal=money(dueToday-rebateUsed);
    return {boxes,gross,discountUsed,fees,allowanceUsed,dueToday,rebateUsed,effectiveTotal,effectivePerBox:boxes?money(effectiveTotal/boxes):0};
  }

  function officeQuoteLines(input){
    const lines=Array.isArray(input.lines)?input.lines:[];
    const boxes=lines.reduce((sum,line)=>sum+whole(line.boxes),0);
    const lenses=lines.reduce((sum,line)=>sum+whole(line.boxes)*whole(line.lensesPerBox),0);
    const gross=money(lines.reduce((sum,line)=>sum+whole(line.boxes)*nonnegative(line.pricePerBox),0));
    const months=whole(input.supplyMonths),allowance=nonnegative(input.insuranceAllowance),officeRebate=nonnegative(input.officeRebate??input.rebate),manufacturerRebate=nonnegative(input.manufacturerRebate);
    const instantDiscount=nonnegative(input.instantDiscount),fees=nonnegative(input.fees);
    const discountUsed=Math.min(gross,instantDiscount),beforeAllowance=money(gross-discountUsed+fees);
    const allowanceUsed=Math.min(beforeAllowance,allowance),dueToday=money(beforeAllowance-allowanceUsed);
    const officeRebateUsed=Math.min(dueToday,officeRebate),afterOfficeRebate=money(dueToday-officeRebateUsed);
    const manufacturerRebateUsed=Math.min(afterOfficeRebate,manufacturerRebate),rebateUsed=money(officeRebateUsed+manufacturerRebateUsed),effectiveTotal=money(dueToday-rebateUsed);
    return {boxes,lenses,months,gross,discountUsed,fees,allowanceUsed,dueToday,officeRebateUsed,manufacturerRebateUsed,rebateUsed,effectiveTotal,effectivePerBox:boxes?money(effectiveTotal/boxes):0,effectivePerLens:lenses?money(effectiveTotal/lenses):0,effectivePerMonth:months?money(effectiveTotal/months):0};
  }

  function retailerQuote(input){
    const boxes=whole(input.boxes),price=nonnegative(input.pricePerBox),shipping=nonnegative(input.shipping),fees=nonnegative(input.fees);
    const discount=nonnegative(input.discount),rebate=nonnegative(input.rebate);
    const gross=money(boxes*price),dueToday=money(Math.max(0,gross+shipping+fees-discount));
    const rebateUsed=Math.min(dueToday,rebate),effectiveTotal=money(dueToday-rebateUsed);
    return {boxes,gross,shipping,fees,discountUsed:Math.min(gross+shipping+fees,discount),dueToday,rebateUsed,effectiveTotal,effectivePerBox:boxes?money(effectiveTotal/boxes):0};
  }

  function retailerQuoteLines(input){
    const lines=Array.isArray(input.lines)?input.lines:[];
    const boxes=lines.reduce((sum,line)=>sum+whole(line.boxes),0);
    const gross=money(lines.reduce((sum,line)=>sum+whole(line.boxes)*nonnegative(line.pricePerBox),0));
    const shipping=nonnegative(input.shipping),fees=nonnegative(input.fees),discount=nonnegative(input.discount);
    const rebate=nonnegative(input.rebate);
    const dueToday=money(Math.max(0,gross+shipping+fees-discount));
    const rebateUsed=Math.min(dueToday,rebate),effectiveTotal=money(dueToday-rebateUsed);
    return {boxes,gross,shipping,fees,discountUsed:Math.min(gross+shipping+fees,discount),dueToday,rebateUsed,effectiveTotal,effectivePerBox:boxes?money(effectiveTotal/boxes):0};
  }

  return {suggestedBoxes,fullAnnualBoxes,officeQuote,officeQuoteLines,retailerQuote,retailerQuoteLines};
});
