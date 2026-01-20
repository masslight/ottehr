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
Object.defineProperty(exports, "__esModule", { value: true });
exports.index = void 0;
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var validateRequestParameters_1 = require("./validateRequestParameters");
var m2mToken;
var ZAMBDA_NAME = 'daily-payments-report';
// Helper function to parse string as number, defaulting to 0
function parseAsNumber(value) {
    if (value === null || value === undefined || value === '') {
        return 0;
    }
    if (typeof value === 'number') {
        return isNaN(value) ? 0 : value;
    }
    if (typeof value === 'string') {
        var parsed_1 = parseFloat(value);
        return isNaN(parsed_1) ? 0 : parsed_1;
    }
    // For any other type, try to convert to string first, then parse
    var stringValue = String(value);
    var parsed = parseFloat(stringValue);
    return isNaN(parsed) ? 0 : parsed;
}
// Helper to return ISO string for date-time
function formatGMTToLocalDate(gmtDateString) {
    if (!gmtDateString)
        return 'N/A';
    try {
        // Parse the GMT date string and validate it
        var gmtDate = new Date(gmtDateString);
        if (isNaN(gmtDate.getTime()))
            return 'N/A';
        // Return ISO string for front-end to format as needed
        return gmtDate.toISOString();
    }
    catch (_a) {
        return 'N/A';
    }
}
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, dateRange, locationId_1, oystehr, searchParams, paymentNoticeSearchResult, allResources, paymentNotices, encounters, appointments, encounterMap_1, appointmentMap_1, response_1, paymentItems, paymentsByMethod_1, totalAmount_1, allCurrencies_1, paymentMethods, response, error_1, ENVIRONMENT;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                dateRange = validatedParameters.dateRange, locationId_1 = validatedParameters.locationId;
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, validatedParameters.secrets)];
            case 1:
                // Get M2M token for FHIR access
                m2mToken = _a.sent();
                oystehr = (0, shared_1.createOystehrClient)(m2mToken, validatedParameters.secrets);
                console.log('Searching for payment notices in date range:', dateRange);
                if (locationId_1) {
                    console.log('Filtering by location ID:', locationId_1);
                }
                searchParams = [
                    {
                        name: 'created',
                        value: "ge".concat(dateRange.start),
                    },
                    {
                        name: 'created',
                        value: "le".concat(dateRange.end),
                    },
                    {
                        name: '_count',
                        value: '1000',
                    },
                ];
                // Add _include parameters to get related resources for location filtering
                if (locationId_1) {
                    searchParams.push({
                        name: '_include',
                        value: 'PaymentNotice:request',
                    }, {
                        name: '_include:iterate',
                        value: 'Encounter:appointment',
                    }, {
                        name: '_include:iterate',
                        value: 'Appointment:location',
                    });
                }
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'PaymentNotice',
                        params: searchParams,
                    })];
            case 2:
                paymentNoticeSearchResult = _a.sent();
                allResources = paymentNoticeSearchResult.unbundle();
                paymentNotices = allResources.filter(function (r) { return r.resourceType === 'PaymentNotice'; });
                console.log("Found ".concat(paymentNotices.length, " payment notices"));
                // If locationId filter is provided, filter payment notices by location
                if (locationId_1 && paymentNotices.length > 0) {
                    encounters = allResources.filter(function (r) { return r.resourceType === 'Encounter'; });
                    appointments = allResources.filter(function (r) { return r.resourceType === 'Appointment'; });
                    encounterMap_1 = new Map();
                    encounters.forEach(function (encounter) {
                        if (encounter.id) {
                            encounterMap_1.set(encounter.id, encounter);
                        }
                    });
                    appointmentMap_1 = new Map();
                    appointments.forEach(function (appointment) {
                        if (appointment.id) {
                            appointmentMap_1.set(appointment.id, appointment);
                        }
                    });
                    // Filter payment notices by location
                    paymentNotices = paymentNotices.filter(function (payment) {
                        var _a;
                        // Get the encounter reference from payment notice
                        if (!((_a = payment.request) === null || _a === void 0 ? void 0 : _a.reference) || !payment.request.reference.startsWith('Encounter/')) {
                            return false;
                        }
                        var encounterId = payment.request.reference.replace('Encounter/', '');
                        var encounter = encounterMap_1.get(encounterId);
                        if (!encounter || !encounter.appointment || encounter.appointment.length === 0) {
                            return false;
                        }
                        // Get the appointment reference from encounter
                        var appointmentRef = encounter.appointment[0].reference;
                        if (!appointmentRef) {
                            return false;
                        }
                        var appointmentId = appointmentRef.replace('Appointment/', '');
                        var appointment = appointmentMap_1.get(appointmentId);
                        if (!appointment || !appointment.participant) {
                            return false;
                        }
                        // Check if appointment has the specified location
                        return appointment.participant.some(function (participant) {
                            var _a;
                            var locationRef = (_a = participant.actor) === null || _a === void 0 ? void 0 : _a.reference;
                            return locationRef && locationRef === "Location/".concat(locationId_1);
                        });
                    });
                    console.log("After location filtering: ".concat(paymentNotices.length, " payment notices"));
                }
                if (paymentNotices.length === 0) {
                    response_1 = {
                        message: 'No payment notices found for the specified date range',
                        totalAmount: 0,
                        totalTransactions: 0,
                        currencies: [],
                        paymentMethods: [],
                    };
                    return [2 /*return*/, {
                            statusCode: 200,
                            body: JSON.stringify(response_1),
                        }];
                }
                paymentItems = paymentNotices.map(function (payment) {
                    var _a, _b, _c;
                    // Extract payment method from extension
                    var paymentMethodExtension = (_a = payment.extension) === null || _a === void 0 ? void 0 : _a.find(function (ext) { return ext.url === 'https://extensions.fhir.zapehr.com/payment-method'; });
                    var paymentMethod = (paymentMethodExtension === null || paymentMethodExtension === void 0 ? void 0 : paymentMethodExtension.valueString) || 'N/A';
                    // Extract amount and currency
                    var amount = parseAsNumber((_b = payment.amount) === null || _b === void 0 ? void 0 : _b.value);
                    var currency = ((_c = payment.amount) === null || _c === void 0 ? void 0 : _c.currency) || 'USD';
                    // Format created date
                    var createdDate = formatGMTToLocalDate(payment.created || '');
                    return {
                        id: payment.id || '',
                        paymentMethod: paymentMethod,
                        amount: amount,
                        currency: currency,
                        createdDate: createdDate,
                        // TODO: Add patient name and appointment ID if needed
                        patientName: undefined,
                        appointmentId: undefined,
                    };
                });
                paymentsByMethod_1 = new Map();
                totalAmount_1 = 0;
                allCurrencies_1 = new Set();
                paymentItems.forEach(function (payment) {
                    if (!paymentsByMethod_1.has(payment.paymentMethod)) {
                        paymentsByMethod_1.set(payment.paymentMethod, []);
                    }
                    paymentsByMethod_1.get(payment.paymentMethod).push(payment);
                    totalAmount_1 += payment.amount;
                    allCurrencies_1.add(payment.currency);
                });
                paymentMethods = Array.from(paymentsByMethod_1.entries())
                    .map(function (_a) {
                    var _b;
                    var method = _a[0], payments = _a[1];
                    var methodTotal = payments.reduce(function (sum, payment) { return sum + payment.amount; }, 0);
                    var methodCurrency = ((_b = payments[0]) === null || _b === void 0 ? void 0 : _b.currency) || 'USD'; // Assume same currency per method
                    return {
                        paymentMethod: method,
                        totalAmount: methodTotal,
                        currency: methodCurrency,
                        transactionCount: payments.length,
                        payments: payments,
                    };
                })
                    .sort(function (a, b) { return a.paymentMethod.localeCompare(b.paymentMethod); });
                response = {
                    message: "Found ".concat(paymentNotices.length, " payment notices with total amount ").concat(totalAmount_1.toFixed(2)),
                    totalAmount: totalAmount_1,
                    totalTransactions: paymentNotices.length,
                    currencies: Array.from(allCurrencies_1),
                    paymentMethods: paymentMethods,
                };
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 3:
                error_1 = _a.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)(ZAMBDA_NAME, error_1, ENVIRONMENT)];
            case 4: return [2 /*return*/];
        }
    });
}); });
