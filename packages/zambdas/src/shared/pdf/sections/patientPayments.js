"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPatientPaymentsSection = exports.composePatientPaymentsData = void 0;
var lodash_1 = require("lodash");
var utils_1 = require("utils");
var composePatientPaymentsData = function (_a) {
    var payments = _a.payments;
    var paymentsInfo = payments.map(function (payment) {
        var date = (0, utils_1.formatDateForDisplay)(payment.dateISO);
        var label = '';
        if (payment.paymentMethod === 'card') {
            label = "XXXX - XXXX - XXXX - ".concat(payment.cardLast4);
        }
        else {
            label = (0, lodash_1.capitalize)(payment.paymentMethod);
        }
        var amount = "$".concat(payment.amountInCents / 100);
        return { date: date, label: label, amount: amount };
    });
    return { payments: paymentsInfo };
};
exports.composePatientPaymentsData = composePatientPaymentsData;
var createPatientPaymentsSection = function () { return ({
    title: 'Patient Payments',
    dataSelector: function (data) { return data.paymentHistory; },
    render: function (client, paymentHistory, styles) {
        if (paymentHistory.payments.length === 0) {
            client.drawText('No payments recorded.', styles.textStyles.regular);
        }
        else {
            paymentHistory.payments.map(function (payment) {
                client.drawTextSequential("".concat(payment.label, " ").concat(payment.date, " ").concat(payment.amount), styles.textStyles.regular);
            });
        }
    },
}); };
exports.createPatientPaymentsSection = createPatientPaymentsSection;
