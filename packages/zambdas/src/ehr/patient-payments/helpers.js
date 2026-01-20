"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPaymentsForPatient = exports.getPaymentsForEncounter = void 0;
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var getPaymentsForEncounter = function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var oystehrClient, stripeClient, account, encounterId, fhirPaymentNotices, stripePayments, paymentMethods, stripeAccount, customerId, _a, paymentIntents, pms, error_1, _b, paymentIntents, pms, error_2;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                oystehrClient = input.oystehrClient, stripeClient = input.stripeClient, account = input.account, encounterId = input.encounterId;
                return [4 /*yield*/, oystehrClient.fhir.search({
                        resourceType: 'PaymentNotice',
                        params: [
                            {
                                name: 'request',
                                value: "Encounter/".concat(encounterId),
                            },
                        ],
                    })];
            case 1:
                fhirPaymentNotices = (_c.sent()).unbundle();
                stripePayments = [];
                paymentMethods = [];
                return [4 /*yield*/, (0, utils_1.getStripeAccountForAppointmentOrEncounter)({ encounterId: encounterId }, oystehrClient)];
            case 2:
                stripeAccount = _c.sent();
                console.log('found a stripe account from the schedule owner, ', stripeAccount);
                customerId = (0, utils_1.getStripeCustomerIdFromAccount)(account, stripeAccount);
                if (!(encounterId && customerId)) return [3 /*break*/, 7];
                _c.label = 3;
            case 3:
                _c.trys.push([3, 5, , 6]);
                return [4 /*yield*/, Promise.all([
                        stripeClient.paymentIntents.search({
                            query: "metadata['encounterId']:\"".concat(encounterId, "\" OR metadata['oystehr_encounter_id']:\"").concat(encounterId, "\""),
                            limit: 20, // default is 10
                        }, {
                            stripeAccount: stripeAccount,
                        }),
                        stripeClient.paymentMethods.list({
                            customer: customerId,
                            type: 'card',
                        }, {
                            stripeAccount: stripeAccount,
                        }),
                    ])];
            case 4:
                _a = _c.sent(), paymentIntents = _a[0], pms = _a[1];
                console.log('Payment Intent search results:', JSON.stringify(paymentIntents, null, 2));
                stripePayments.push.apply(stripePayments, paymentIntents.data);
                paymentMethods.push.apply(paymentMethods, pms.data);
                return [3 /*break*/, 6];
            case 5:
                error_1 = _c.sent();
                console.error('Error fetching payment intents or payment methods for encounter:', error_1);
                throw (0, utils_1.checkForStripeCustomerDeletedError)(error_1);
            case 6: return [3 /*break*/, 11];
            case 7:
                if (!customerId) return [3 /*break*/, 11];
                _c.label = 8;
            case 8:
                _c.trys.push([8, 10, , 11]);
                return [4 /*yield*/, Promise.all([
                        stripeClient.paymentIntents.list({
                            customer: customerId,
                        }, {
                            stripeAccount: stripeAccount,
                        }),
                        stripeClient.paymentMethods.list({
                            customer: customerId,
                            type: 'card',
                        }, {
                            stripeAccount: stripeAccount,
                        }),
                    ])];
            case 9:
                _b = _c.sent(), paymentIntents = _b[0], pms = _b[1];
                console.log('Payment Intent list results (fallback):', JSON.stringify(paymentIntents, null, 2));
                stripePayments.push.apply(stripePayments, paymentIntents.data);
                paymentMethods.push.apply(paymentMethods, pms.data);
                return [3 /*break*/, 11];
            case 10:
                error_2 = _c.sent();
                console.error('Error fetching payment intents or payment methods:', error_2);
                throw (0, utils_1.checkForStripeCustomerDeletedError)(error_2);
            case 11: return [2 /*return*/, buildPaymentDTOs(fhirPaymentNotices, stripePayments, paymentMethods, encounterId)];
        }
    });
}); };
exports.getPaymentsForEncounter = getPaymentsForEncounter;
var getPaymentsForPatient = function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var oystehrClient, stripeClient, account, patientId, encounterId, params, fhirPaymentNotices, stripePayments, paymentMethods, stripeAccount, customerId, _a, paymentIntents, pms, error_3, _b, paymentIntents, pms, error_4;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                oystehrClient = input.oystehrClient, stripeClient = input.stripeClient, account = input.account, patientId = input.patientId, encounterId = input.encounterId;
                params = encounterId
                    ? [{ name: 'request', value: "Encounter/".concat(encounterId) }]
                    : [{ name: 'request.patient._id', value: patientId }];
                return [4 /*yield*/, oystehrClient.fhir.search({
                        resourceType: 'PaymentNotice',
                        params: params,
                    })];
            case 1:
                fhirPaymentNotices = (_c.sent()).unbundle();
                stripePayments = [];
                paymentMethods = [];
                return [4 /*yield*/, (0, utils_1.getStripeAccountForAppointmentOrEncounter)({ encounterId: encounterId }, oystehrClient)];
            case 2:
                stripeAccount = _c.sent();
                console.log('found a stripe account from the schedule owner, ', stripeAccount);
                customerId = (0, utils_1.getStripeCustomerIdFromAccount)(account, stripeAccount);
                if (!(encounterId && customerId)) return [3 /*break*/, 7];
                _c.label = 3;
            case 3:
                _c.trys.push([3, 5, , 6]);
                return [4 /*yield*/, Promise.all([
                        stripeClient.paymentIntents.search({
                            query: "metadata['encounterId']:\"".concat(encounterId, "\" OR metadata['oystehr_encounter_id']:\"").concat(encounterId, "\""),
                            limit: 20,
                        }, {
                            stripeAccount: stripeAccount,
                        }),
                        stripeClient.paymentMethods.list({
                            customer: customerId,
                            type: 'card',
                        }, {
                            stripeAccount: stripeAccount,
                        }),
                    ])];
            case 4:
                _a = _c.sent(), paymentIntents = _a[0], pms = _a[1];
                console.log('Payment Intent created:', JSON.stringify(paymentIntents, null, 2));
                stripePayments.push.apply(stripePayments, paymentIntents.data);
                paymentMethods.push.apply(paymentMethods, pms.data);
                return [3 /*break*/, 6];
            case 5:
                error_3 = _c.sent();
                console.error('Error fetching payment intents or payment methods for encounter:', error_3);
                throw (0, utils_1.checkForStripeCustomerDeletedError)(error_3);
            case 6: return [3 /*break*/, 11];
            case 7:
                if (!customerId) return [3 /*break*/, 11];
                _c.label = 8;
            case 8:
                _c.trys.push([8, 10, , 11]);
                return [4 /*yield*/, Promise.all([
                        stripeClient.paymentIntents.list({
                            customer: customerId,
                        }, {
                            stripeAccount: stripeAccount,
                        }),
                        stripeClient.paymentMethods.list({
                            customer: customerId,
                            type: 'card',
                        }, {
                            stripeAccount: stripeAccount,
                        }),
                    ])];
            case 9:
                _b = _c.sent(), paymentIntents = _b[0], pms = _b[1];
                console.log('Payment Intent list results:', JSON.stringify(paymentIntents, null, 2));
                stripePayments.push.apply(stripePayments, paymentIntents.data);
                paymentMethods.push.apply(paymentMethods, pms.data);
                return [3 /*break*/, 11];
            case 10:
                error_4 = _c.sent();
                console.error('Error fetching payment intents or payment methods:', error_4);
                throw (0, utils_1.checkForStripeCustomerDeletedError)(error_4);
            case 11: return [2 /*return*/, buildPaymentDTOs(fhirPaymentNotices, stripePayments, paymentMethods, encounterId)];
        }
    });
}); };
exports.getPaymentsForPatient = getPaymentsForPatient;
function buildPaymentDTOs(fhirPaymentNotices, stripePayments, paymentMethods, encounterId) {
    var cardPayments = fhirPaymentNotices
        .flatMap(function (paymentNotice) {
        var _a, _b, _c, _d, _e, _f, _g;
        var pnStripeId = (_b = (_a = paymentNotice.identifier) === null || _a === void 0 ? void 0 : _a.find(function (id) { return id.system === shared_1.STRIPE_PAYMENT_ID_SYSTEM; })) === null || _b === void 0 ? void 0 : _b.value;
        if (!pnStripeId) {
            // not a card payment, skip!
            return [];
        }
        var paymentIntent = stripePayments.find(function (pi) { return pi.id === pnStripeId; });
        var stripePaymentId = paymentIntent ? paymentIntent.id : pnStripeId;
        var last4 = (_d = (_c = paymentMethods.find(function (pm) { return pm.id === (paymentIntent === null || paymentIntent === void 0 ? void 0 : paymentIntent.payment_method); })) === null || _c === void 0 ? void 0 : _c.card) === null || _d === void 0 ? void 0 : _d.last4;
        var paymentMethodId = (_e = paymentMethods.find(function (pm) { return pm.id === (paymentIntent === null || paymentIntent === void 0 ? void 0 : paymentIntent.payment_method); })) === null || _e === void 0 ? void 0 : _e.id;
        var dateISO = luxon_1.DateTime.fromISO(paymentNotice.created).toISO();
        if (!dateISO || !paymentNotice.id) {
            console.log('missing data for payment notice:', paymentNotice.id, 'dateISO', dateISO);
            return [];
        }
        return {
            paymentMethod: 'card',
            stripePaymentId: stripePaymentId,
            amountInCents: ((_f = paymentNotice.amount.value) !== null && _f !== void 0 ? _f : 0) * 100,
            description: (_g = paymentIntent === null || paymentIntent === void 0 ? void 0 : paymentIntent.description) !== null && _g !== void 0 ? _g : undefined,
            stripePaymentMethodId: paymentMethodId,
            fhirPaymentNotificationId: paymentNotice.id,
            cardLast4: last4,
            dateISO: dateISO,
        };
    })
        .slice(0, 20); // We only fetch the last 20 payments from stripe, which should be more than enough for pretty much any real world use case
    // todo: the data here should be fetched from candid and then linked to the payment notice ala stripe,
    // but that awaits the candid integration portion
    var cashPayments = (0, utils_1.convertPaymentNoticeListToCashPaymentDTOs)(fhirPaymentNotices, encounterId);
    var payments = __spreadArray(__spreadArray([], cardPayments, true), cashPayments, true).sort(function (a, b) {
        return luxon_1.DateTime.fromISO(b.dateISO).toMillis() - luxon_1.DateTime.fromISO(a.dateISO).toMillis();
    });
    return payments;
}
