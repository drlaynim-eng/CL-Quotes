# Contact Lens Quotes

A separate local prototype for comparing contact lens supply quotes. Staff choose one supply length at a time. Six- and twelve-month options are always available. Daily 30-packs also allow one- and three-month supplies; daily 90-packs allow a three-month supply. Mixed-eye quotes show only durations supported by both products. It does not use patient names or prescriptions, and it does not place orders.

Run `python -m http.server 8010` from this directory, then open `http://localhost:8010/`. The browser saves the product and price inputs on that computer so a draft survives a refresh. This is not yet shared across staff devices.

Select the exact prescribed lens from the curated catalog. The listed **office selling prices** were captured from Dr. Desk Price Book > CL on September 26, 2026. They may be changed for a quote; edits do not change Dr. Desk. ABB wholesale costs are intentionally not used for margins or shown on patient quotes because they may be out of date. The catalog is a snapshot, not a live Price Book connection. Matching Dr. Desk prices are loaded for PRECISION1, AIR OPTIX, and reusable Acuvue Oasys products. Acuvue Oasys MAX, Acuvue Oasys 1-Day 30pk, and Acuvue Oasys Multifocal 6pk entries without a matching Price Book row remain unpriced and require staff to enter the current office price. One Biotrue ONEday for Presbyopia 30pk entry is $34.60 in the Price Book; verify that particular price before quoting.

OD and OS are shown side by side and may use the same or different products. The arrow between the cards copies the right-eye product, price, and quantity to OS when both eyes match. Both eyes are assumed; a small **Choose one eye** control exposes OD-only and OS-only quoting when needed. Product box size and replacement schedule come from the catalog and are not staff-editable. Daily 30-packs default to one box per selected eye because they are generally quoted for occasional wear; staff can override the quantity. Daily 90-packs and reusable lenses continue to use supply-length-based suggested quantities. For two-week 12-packs, one box per eye is the six-month quantity and two boxes per eye qualify as the annual quantity.

Use **Add second lens option** when a patient wants two separate alternatives, such as daily lenses versus monthly lenses. Option B has its own OD/OS products, supply length, quantities, office prices, and automatic rebates. It uses the same entered insurance allowance as Option A, but each option is calculated independently; the two totals are never added together. The quote summary, printout, email draft, and take-home quote include both office alternatives.

**Copy Option A lenses** copies the active eyes, OD/OS products, and per-box prices into Option B without changing Option B's supply length. Option B then recalculates its suggested quantities, making it quick to compare six and twelve months of the same lenses.

**Hide second option** removes Option B from the active quote and summary without clearing its saved entries; reopening it restores the previous selections.

Enter the insurance allowance for the combined office quote. A checkbox turns the allowance on or off without erasing its amount. The rebate settings page stores the office's full two-eye annual rebates, initially $50 for daily lenses and $25 for reusable/monthly lenses. The app applies them only when the quoted boxes provide a full annual quantity and prorates them by eye for mixed or one-eye quotes.

Each lens option keeps its office price, benefits, rebates, and calculated totals inside the same panel as its lens selections. A final summary compares alternatives by effective monthly cost so different box sizes remain comparable.

Manufacturer rebates are managed on a separate settings page and stored locally by lens family with a full two-eye annual amount and optional expiration date. They apply only when the actual box quantity provides a full annual supply; mixed-family and one-eye quotes receive half of each matching family amount when that eye has an annual quantity. Expired rules remain visible but are not applied. **Due today** reflects any enabled allowance. **Effective total** also subtracts eligible office and manufacturer annual rebates. The effective monthly cost divides that total by the selected supply length. The quote summary labels each option by the actual number of boxes quoted rather than by the supply-length selector.

The header's **Create quote** menu offers a printable quote, a plain-text email draft, and a take-home quote page. The take-home page lets a patient review the saved alternatives and submit an order request with contact information. Requests return to the local staff inbox for verification; the prototype does not process payment, apply insurance, or submit rebates.

Run `node scripts/test-quote.js` to check quantity and price calculations.
