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
exports.postChargeIssueRequest = postChargeIssueRequest;
exports.getPaymentDataRequest = getPaymentDataRequest;
exports.composeAndCreateReceiptPdf = composeAndCreateReceiptPdf;
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var receipt_pdf_1 = require("../../../shared/pdf/receipt-pdf");
function postChargeIssueRequest(apiUrl, token, encounterId) {
    return __awaiter(this, void 0, void 0, function () {
        var serviceUrl;
        return __generator(this, function (_a) {
            serviceUrl = "".concat(apiUrl, "/payment/charge/issue");
            console.debug("Posting to payment charge service at ".concat(serviceUrl, " for encounter ").concat(encounterId));
            if (encounterId === undefined) {
                throw new Error('Encounter ID must be specified for payments.');
            }
            return [2 /*return*/, fetch(serviceUrl, {
                    headers: {
                        Authorization: "Bearer ".concat(token),
                    },
                    method: 'POST',
                    body: JSON.stringify({ encounterId: encounterId }),
                }).then(function (response) {
                    if (!response.ok) {
                        throw new Error("Error charging for the encounter. Status: ".concat(response.statusText));
                    }
                })];
        });
    });
}
function getPaymentDataRequest(apiUrl, token, encounterId) {
    return __awaiter(this, void 0, void 0, function () {
        var serviceUrl;
        return __generator(this, function (_a) {
            serviceUrl = "".concat(apiUrl, "/payment/charge/status");
            console.debug("Getting payment data at ".concat(serviceUrl, " for encounter ").concat(encounterId));
            if (encounterId === undefined) {
                throw new Error('Encounter ID must be specified for payments.');
            }
            return [2 /*return*/, fetch(serviceUrl, {
                    headers: {
                        Authorization: "Bearer ".concat(token),
                    },
                    method: 'POST',
                    body: JSON.stringify({ encounterId: encounterId }),
                }).then(function (response) {
                    if (!response.ok) {
                        throw new Error("Error getting charge status for the encounter. Status: ".concat(response.statusText));
                    }
                    return response.json();
                })];
        });
    });
}
function composeAndCreateReceiptPdf(paymentData, chartData, appointmentPackage, secrets, token) {
    return __awaiter(this, void 0, void 0, function () {
        var data;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('Start composing data for pdf');
                    data = composeDataForPdf(paymentData, chartData, appointmentPackage);
                    console.log('Start creating pdf');
                    return [4 /*yield*/, (0, receipt_pdf_1.createReceiptPdf)(data, appointmentPackage.patient, secrets, token)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
function composeDataForPdf(paymentData, chartData, appointmentPackage) {
    var patient = appointmentPackage.patient, location = appointmentPackage.location;
    if (!patient)
        throw new Error('No patient found for this encounter');
    // --- Facility information ---
    console.log('Location: ' + JSON.stringify(location));
    var facilityInfo = getFacilityInfo(location);
    // --- Patient information ---
    var patientName = getPatientFullName(patient);
    var patientDOB = getPatientDob(patient);
    var patientAccountId = chartData.patientId;
    // --- Payment information ---
    var paymentAmount = "".concat(paymentData.amount, " ").concat(paymentData.currency.toUpperCase());
    var paymentDate = getPaymentDate(paymentData.date);
    return {
        facility: facilityInfo,
        patient: {
            name: patientName || '',
            dob: patientDOB || '',
            account: patientAccountId,
        },
        amount: paymentAmount,
        date: paymentDate || '',
    };
}
function getPatientFullName(patient) {
    var _a, _b, _c;
    var name = patient.name;
    var firstName = (_b = (_a = name === null || name === void 0 ? void 0 : name[0]) === null || _a === void 0 ? void 0 : _a.given) === null || _b === void 0 ? void 0 : _b[0];
    var lastName = (_c = name === null || name === void 0 ? void 0 : name[0]) === null || _c === void 0 ? void 0 : _c.family;
    // const suffix = name?.[0]?.suffix?.[0];
    // const isFullName = !!firstName && !!lastName && !!suffix;
    // return isFullName ? `${lastName}${suffix ? ` ${suffix}` : ''}, ${firstName}` : undefined;
    var isFullName = !!firstName && !!lastName;
    return isFullName ? "".concat(lastName, ", ").concat(firstName) : undefined;
}
function getPatientDob(patient) {
    return (patient === null || patient === void 0 ? void 0 : patient.birthDate) && luxon_1.DateTime.fromFormat(patient.birthDate, 'yyyy-MM-dd').toFormat('MM/dd/yyyy');
}
function getPaymentDate(paymentDate) {
    return paymentDate && luxon_1.DateTime.fromFormat(paymentDate, 'yyyy-MM-dd').toFormat('MM/dd/yyyy');
}
function getFacilityInfo(location) {
    if (!location || !location.address || !location.address.state) {
        return undefined;
    }
    var state = location.address.state;
    var stateFullName = utils_1.AllStatesToNames[state];
    if (!stateFullName) {
        return undefined;
    }
    var facility = utils_1.FacilitiesTelemed.find(function (facility) { return facility.name.includes(stateFullName); });
    if (!facility) {
        return undefined;
    }
    return {
        name: facility.name,
        address: facility.address,
        phone: facility.phone,
    };
}
