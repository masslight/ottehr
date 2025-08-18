"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapPatientInformationToPatientResource = exports.getPatientData = void 0;
var utils_1 = require("utils");
var utils_2 = require("../../telemed/utils");
var resources_helper_1 = require("./resources.helper");
var getPatientData = function (patient) {
    var _a, _b;
    var patientName = (0, utils_2.getPatientName)(patient === null || patient === void 0 ? void 0 : patient.name);
    var patientAddress = (0, utils_1.getPatientAddress)(patient === null || patient === void 0 ? void 0 : patient.address);
    var dob = (0, resources_helper_1.getDateFromFormat)(patient === null || patient === void 0 ? void 0 : patient.birthDate);
    var gender = patient === null || patient === void 0 ? void 0 : patient.gender;
    var genderLabel = (patient === null || patient === void 0 ? void 0 : patient.gender) && resources_helper_1.mapGenderToLabel[patient.gender];
    var phone = (_b = (_a = patient === null || patient === void 0 ? void 0 : patient.telecom) === null || _a === void 0 ? void 0 : _a.find(function (item) { return item.system === 'phone'; })) === null || _b === void 0 ? void 0 : _b.value;
    return __assign(__assign(__assign({}, patientName), patientAddress), { dob: dob, gender: gender, genderLabel: genderLabel, phone: phone });
};
exports.getPatientData = getPatientData;
var mapPatientInformationToPatientResource = function (patient, patientInformation) {
    var patientCopy = structuredClone(patient);
    (0, resources_helper_1.mapPersonInformationToResource)(patientCopy, patientInformation);
    return patientCopy;
};
exports.mapPatientInformationToPatientResource = mapPatientInformationToPatientResource;
//# sourceMappingURL=patient.helper.js.map