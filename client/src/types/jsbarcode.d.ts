declare module "jsbarcode" {
  const JsBarcode: (element: Element, text: string, options?: Record<string, unknown>) => unknown;
  export default JsBarcode;
}
