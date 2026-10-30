import JsBarcode from "jsbarcode";

// Label roll size. Change here once the printer from Phase 0 is confirmed (e.g. 80 x 50).
const LABEL_WIDTH_MM = 58;
const LABEL_HEIGHT_MM = 40;

type LabelProduct = { barcode?: string; productName?: string; name?: string; category?: string; brand?: string };

const esc = (value: unknown) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// shortcut: browser print works with any printer that has a driver; switch to ZPL/ESC-POS only if the chosen printer cannot take a custom page size.
export function printLabels(products: LabelProduct[]) {
  const labels = products
    .filter((p) => p.barcode)
    .map((p) => {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      JsBarcode(svg, p.barcode!, { format: "CODE128", displayValue: false, margin: 0, height: 60, width: 2 });
      svg.setAttribute("preserveAspectRatio", "none");
      return `<div class="label">
        <div class="shop">MAULI AUTO CAR WORLD</div>
        ${svg.outerHTML}
        <div class="code">${esc(p.barcode)}</div>
        <div class="name">${esc(p.productName || p.name)}</div>
        <div class="meta">${esc(p.category)} | ${esc(p.brand)}</div>
      </div>`;
    });
  if (!labels.length) return;

  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;width:0;height:0;border:0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(`<!doctype html><html><head><style>
    @page { size: ${LABEL_WIDTH_MM}mm ${LABEL_HEIGHT_MM}mm; margin: 0; }
    * { box-sizing: border-box; margin: 0; }
    body { font-family: Arial, sans-serif; color: #000; }
    .label { width: ${LABEL_WIDTH_MM}mm; height: ${LABEL_HEIGHT_MM}mm; padding: 1.5mm 2mm; overflow: hidden;
      display: flex; flex-direction: column; align-items: center; text-align: center; page-break-after: always; }
    .shop { font-size: 7pt; font-weight: bold; letter-spacing: 0.3pt; }
    /* ~5mm quiet zone each side so scanners lock on */
    svg { width: ${LABEL_WIDTH_MM - 14}mm; height: 13mm; margin-top: 1mm; }
    .code { font-size: 9pt; font-weight: bold; font-family: monospace; }
    .name { font-size: 8pt; line-height: 1.15; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .meta { font-size: 6.5pt; margin-top: auto; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
  </style></head><body>${labels.join("")}</body></html>`);
  doc.close();

  const win = frame.contentWindow!;
  win.onafterprint = () => frame.remove();
  win.focus();
  win.print();
}
