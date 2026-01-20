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
exports.getCandidItemizationMap = getCandidItemizationMap;
exports.mapResourcesToInvoiceablePatient = mapResourcesToInvoiceablePatient;
var candidhealth_1 = require("candidhealth");
var luxon_1 = require("luxon");
var utils_1 = require("utils");
function getCandidItemizationMap(candid, claims) {
    return __awaiter(this, void 0, void 0, function () {
        var itemizationPromises, itemizationResponse, itemizationToClaimIdMap;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    itemizationPromises = claims.map(function (claim) { return candid.patientAr.v1.itemize(candidhealth_1.CandidApi.ClaimId(claim.claimId)); });
                    return [4 /*yield*/, Promise.all(itemizationPromises)];
                case 1:
                    itemizationResponse = _a.sent();
                    itemizationToClaimIdMap = {};
                    itemizationResponse.forEach(function (res) {
                        if (res && res.ok && res.body) {
                            var itemization = res.body;
                            if (itemization.claimId)
                                itemizationToClaimIdMap[itemization.claimId] = itemization;
                        }
                    });
                    return [2 /*return*/, itemizationToClaimIdMap];
            }
        });
    });
}
function mapResourcesToInvoiceablePatient(input) {
    var _a, _b, _c, _d, _e, _f;
    var itemizationMap = input.itemizationMap, claim = input.claim, patientToIdMap = input.patientToIdMap, accountsToPatientIdMap = input.accountsToPatientIdMap, encounterToCandidIdMap = input.encounterToCandidIdMap, appointmentToIdMap = input.appointmentToIdMap, allFhirResources = input.allFhirResources;
    var patient = patientToIdMap[claim.patientExternalId];
    if ((patient === null || patient === void 0 ? void 0 : patient.id) === undefined)
        return logErrorForClaimAndReturn('Patient', claim);
    var account = accountsToPatientIdMap[claim.patientExternalId];
    var responsibleParty = (0, utils_1.getResponsiblePartyFromAccount)(account, allFhirResources);
    if (!responsibleParty)
        return logErrorForClaimAndReturn('Responsible party', claim);
    var encounter = encounterToCandidIdMap[claim.encounterId];
    if (!encounter)
        return logErrorForClaimAndReturn('Encounter', claim);
    var appointmentId = (_c = (_b = (_a = encounter.appointment) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.reference) === null || _c === void 0 ? void 0 : _c.split('/')[1];
    var appointment = appointmentId ? appointmentToIdMap[appointmentId] : undefined;
    if (!appointment)
        return logErrorForClaimAndReturn('Appointment', claim);
    var appointmentStart = appointment.start;
    var patientBalance = itemizationMap[claim.claimId].patientBalanceCents;
    var dateFormat = 'MM/dd/yyyy';
    return {
        id: claim.patientExternalId,
        claimId: claim.claimId,
        name: (0, utils_1.getFullName)(patient),
        dob: patient.birthDate ? isoToFormat(patient.birthDate, dateFormat) : '--',
        appointmentDate: appointmentStart ? isoToFormat(appointmentStart, dateFormat) : '--',
        finalizationDate: isoToFormat(claim.timestamp, dateFormat + ' HH:mm'),
        responsiblePartyName: responsibleParty ? (_d = (0, utils_1.getFullName)(responsibleParty)) !== null && _d !== void 0 ? _d : '--' : '--',
        responsiblePartyRelationshipToPatient: (_f = (_e = getResponsiblePartyRelationship(responsibleParty)) === null || _e === void 0 ? void 0 : _e.toLowerCase()) !== null && _f !== void 0 ? _f : '--',
        amountInvoiceable: "".concat(patientBalance / 100), // converting from cents to USD
    };
}
function logErrorForClaimAndReturn(resourceType, claim) {
    var errorMessage = "".concat(resourceType, " resource not found for this claim.");
    console.error("\uD83D\uDD34 ".concat(errorMessage));
    return {
        claimId: claim.claimId,
        patientId: claim.patientExternalId,
        candidEncounterId: claim.encounterId,
        error: errorMessage,
    };
}
function getResponsiblePartyRelationship(responsibleParty) {
    var _a;
    var result = undefined;
    if (responsibleParty.resourceType === 'Patient')
        return 'Self';
    (_a = responsibleParty.relationship) === null || _a === void 0 ? void 0 : _a.find(function (rel) {
        var _a;
        return (_a = rel.coding) === null || _a === void 0 ? void 0 : _a.find(function (coding) {
            if (coding.system === utils_1.FHIR_EXTENSION.RelatedPerson.responsiblePartyRelationship.url) {
                result = coding.code;
                return true;
            }
            return false;
        });
    });
    return result;
}
function isoToFormat(isoDate, format) {
    if (format === void 0) { format = 'MM-dd-yyyy HH:mm:ss'; }
    return luxon_1.DateTime.fromISO(isoDate).toFormat(format);
}
