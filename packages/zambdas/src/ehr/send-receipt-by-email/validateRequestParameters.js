"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
var utils_1 = require("utils");
var send_receipt_by_email_types_1 = require("utils/lib/types/api/send-receipt-by-email.types");
function validateRequestParameters(input) {
    if (!input.body)
        throw utils_1.MISSING_REQUEST_BODY;
    var data = JSON.parse(input.body);
    var _a = send_receipt_by_email_types_1.SendReceiptByEmailZambdaInputSchema.parse(data), recipientFullName = _a.recipientFullName, email = _a.email, receiptDocRefId = _a.receiptDocRefId;
    return { recipientFullName: recipientFullName, email: email, receiptDocRefId: receiptDocRefId, secrets: input.secrets };
}
