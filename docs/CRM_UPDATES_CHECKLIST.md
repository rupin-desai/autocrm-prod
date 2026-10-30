# CRM updates checklist (2026-10-30)

**Result: all 14 items DONE.** The server behaviour was checked end-to-end against a throwaway database, logged in as Admin, Sales Executive and Service Staff. The client type-checks and builds, but was not clicked through in a browser.

The "Found" column is the status **before** implementation. "Labour" = the `Service Staff` role (the users listed as service handlers). "Sales" = `Sales Executive`; Admin/Manager are treated as admin.

| # | Request | Found | Plan |
|---|---------|-------|------|
| 1 | Customer profile shows the parts the customer enquired about | PARTIAL: profile shows the parts picked at registration, but not parts from Customer Inquiries | Add a "Parts enquired" list from the customer's inquiries (names and quantities, no prices) |
| 2 | If no part is selected, a dropdown of **all** parts with a search bar, for sales | NOT DONE: registration only lists in-stock "compatible" parts, and for Sales Executive that list is always empty (`/api/products` needs `products:read`, which sales lacks) | Searchable all-parts picker on the profile (add/remove parts on a vehicle) and on the registration parts step, using the existing job-card part search that sales already has access to |
| 3 | Labour cannot edit these; they only see parts and service requested, no price | NOT DONE: labour today cannot open Service Visits or customer profiles at all | Give labour a **read-only** Service Visits view. The server removes every amount from what it sends them. Edit buttons are hidden, and the server already blocks edits (`orders:update`) |
| 4 | Display a note on the customer profile | NOT DONE | Add a customer `notes` field: sales/admin can edit it on the profile, other roles can only read it |
| 5 | Fitting charges field in Service Visits | NOT DONE: labour charges exist only as an invoice line at billing time | `fittingCharges` on the visit, editable in "Update Service". The job total is parts plus fitting. The invoice "Labour Charges" line is pre-filled from it |
| 6 | Registration: "Labour charges" field below Parts Needed, entered by sales | NOT DONE | `labourCharges` on the vehicle. It is copied into the auto-created service visit as its fitting charges |
| 7 | Fitting charges visible only to admin/sales; labour sees work, parts and car only | NOT DONE | Amounts are visible to roles that already see Service Visits (`orders:read`). Labour gets no amounts in the API or the UI |
| 8 | When GST is selected, calculate GST and **add** it to the total | NOT DONE: the invoice dialog took GST out of the price (inclusive) instead of adding it | GST = price × qty × rate%, added to the line total. Invoice summary shows a GST row. The PDF already uses total − GST |
| 9 | Product compulsory when creating a ticket | NOT DONE: no product field | Required product picker in Create Ticket, enforced on the server too. The product is shown in ticket details |
| 10 | Merge Support & Feedback with Warranty Management | NOT DONE: they were separate sidebar items | One sidebar item "Support & Warranty" with two tabs. Each tab is shown based on the user's permissions. `/warranty-claims` still works for old links |
| 11 | Quote: custom entry for stock items (Name, Price, Qty) | PARTIAL: a custom name input existed, but the catalogue dropdown was empty for sales (no `products:read`) and capped at 200 items. Typing a custom name kept the old product link | Searchable stock lookup that fills Name and Price. Typing your own name makes it a custom item. Columns relabelled Name / Qty / Price |
| 12 | Lazy loading of inventory items | NOT DONE: every product card rendered at once | Categories collapsed by default. Inside an open category, cards load in batches of 24 as you scroll |
| 13 | Inventory grouped by category → stock items | PARTIAL: a category filter dropdown existed | Products Catalog grouped into collapsible category sections, each with its stock items and a count |
| 14 | Remove Communications tab | NOT DONE | Removed the sidebar item, route and page. Server endpoints left as they are |

Left unchanged on purpose: Inventory Manager keeps seeing part prices on Service Visits as it does today. The checks above are by permission, so it also sees fitting charges.
