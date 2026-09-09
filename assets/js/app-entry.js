/* CRM Suministros V11.23.0
   Canonical composition root: all cross-cutting runtime enhancements are loaded once,
   then the application core boots through main.js. No parallel module script tags. */

import "./modules/responsive-foundation-v11190.js";
import "./modules/global-progress-v11100.js";
import "./modules/bootstrap-v113.js";
import "./modules/inventory-scan-bootstrap-v116.js";
import "./modules/order-priority-v117.js";
import "./modules/pagination-v1184.js";
import "./modules/commercial-v1187.js";
import "./modules/commercial-records-v1188.js";
import "./modules/popup-ux-v1190.js";
import "./modules/order-create-v1191.js";
import "./modules/receiving-order-v1192.js";
import "./modules/receiving-focus-v1193.js";
import "./modules/receiving-polish-v1194.js";
import "./modules/picking-focus-v1195.js";
import "./modules/billing-focus-v1198.js";
import "./modules/billing-upload-v1199.js";
import "./modules/billing-invoice-reader-v1199.js";
import "./modules/billing-multiformat-v11101.js";
import "./modules/shipping-guide-reader-v11101.js";
import "./modules/flow-performance-v11130.js";

import "./main.js";