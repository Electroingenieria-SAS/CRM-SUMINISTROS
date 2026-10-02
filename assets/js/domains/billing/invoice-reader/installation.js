import { enhanceInvoiceDialog } from "./ui/invoice-dialog.js";

export function installInvoiceReader(modal){
  return enhanceInvoiceDialog(modal);
}
