"use strict";
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
exports.getPatientNameSearchParams = exports.MAX_RESULTS = void 0;
var utils_1 = require("utils");
exports.MAX_RESULTS = 20;
var getPatientNameSearchParams = function (input) {
    var _a;
    var submittedName = input.submittedName, firstLast = input.firstLast, _b = input.narrowByRelatedPersonAndAppointment, narrowByRelatedPersonAndAppointment = _b === void 0 ? true : _b, _c = input.maxResultOverride, maxResults = _c === void 0 ? exports.MAX_RESULTS : _c;
    var hasParams = narrowByRelatedPersonAndAppointment
        ? [
            { name: '_has:RelatedPerson:patient:relationship', value: 'user-relatedperson' }, // RelatedPerson referenced by the Person resource
            { name: '_has:Appointment:patient:_tag', value: [utils_1.OTTEHR_MODULE.IP, utils_1.OTTEHR_MODULE.TM].join(',') }, // this is unnecessary now; there are no BH patients to worry about
        ]
        : [];
    var fhirSearchParams = __spreadArray(__spreadArray([], hasParams, true), [
        { name: '_count', value: maxResults.toString() },
        { name: '_total', value: 'accurate' },
        {
            name: '_sort',
            value: 'family',
        },
        { name: '_elements', value: 'id,name,birthDate' },
    ], false);
    if (submittedName) {
        var _d = ((_a = submittedName === null || submittedName === void 0 ? void 0 : submittedName.toLowerCase()) !== null && _a !== void 0 ? _a : '').split(','), lastName = _d[0], firstName = _d[1];
        if (lastName && firstName) {
            fhirSearchParams.push({ name: 'family', value: lastName.trim() }, { name: 'given', value: firstName.trim() });
        }
        else {
            fhirSearchParams.push({ name: 'name', value: submittedName.replace(/\W/g, '') });
        }
    }
    else if (firstLast) {
        var firstName = firstLast.first, lastName = firstLast.last;
        if (lastName && firstName) {
            fhirSearchParams.push({ name: 'family', value: lastName.trim() }, { name: 'given', value: firstName.trim() });
        }
    }
    return fhirSearchParams;
};
exports.getPatientNameSearchParams = getPatientNameSearchParams;
//# sourceMappingURL=patientSearch.js.map