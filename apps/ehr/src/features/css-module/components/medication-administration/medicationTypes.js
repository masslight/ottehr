"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.statusTransitions = exports.reasonListValues = exports.ReasonListCodes = void 0;
var ReasonListCodes;
(function (ReasonListCodes) {
    ReasonListCodes["PATIENT_REFUSED"] = "patient-refused";
    ReasonListCodes["CARE_GIVER_REFUSED"] = "caregiver-refused";
    ReasonListCodes["NOT_APPROPRIATE_AT_THIS_TIME"] = "not-appropriate-at-this-time";
    // cSpell:disable-next didnt
    ReasonListCodes["PATIENT_DID_NOT_TOLERATE_MEDICATION"] = "patient-didnt-tolerate-medication";
    ReasonListCodes["OTHER"] = "other";
})(ReasonListCodes || (exports.ReasonListCodes = ReasonListCodes = {}));
exports.reasonListValues = (_a = {},
    _a[ReasonListCodes.PATIENT_REFUSED] = 'Patient refused',
    _a[ReasonListCodes.CARE_GIVER_REFUSED] = 'Caregiver refused',
    _a[ReasonListCodes.NOT_APPROPRIATE_AT_THIS_TIME] = 'Not appropriate at this time',
    _a[ReasonListCodes.PATIENT_DID_NOT_TOLERATE_MEDICATION] = "Patient didn't tolerate medication",
    _a[ReasonListCodes.OTHER] = 'Other',
    _a);
exports.statusTransitions = {
    pending: ['administered-partly', 'administered-not', 'administered', 'cancelled'],
    'administered-partly': [],
    'administered-not': [],
    administered: [],
    cancelled: [],
};
//# sourceMappingURL=medicationTypes.js.map