"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentType = exports.ClosureType = exports.getVisitTypeLabelForAppointment = exports.fhirAppointmentTypeToVisitType = exports.getFhirAppointmentTypeForVisitType = exports.PersonSex = exports.VisitTypeToLabelTelemed = exports.VisitTypeToLabel = exports.VisitType = exports.appointmentTypeLabels = exports.AllStates = void 0;
var utils_1 = require("utils");
var utils_2 = require("utils");
Object.defineProperty(exports, "AllStates", { enumerable: true, get: function () { return utils_2.AllStates; } });
exports.appointmentTypeLabels = {
    prebook: 'Pre-booked',
    walkin: 'Walk-in',
    posttelemed: 'Post Telemed',
};
// this might be a bit redundant given the AppointmentType type. is "booked" still used somewhere?
var VisitType;
(function (VisitType) {
    VisitType["WalkIn"] = "walk-in";
    VisitType["PreBook"] = "pre-booked";
    VisitType["PostTelemed"] = "post-telemed";
})(VisitType || (exports.VisitType = VisitType = {}));
exports.VisitTypeToLabel = {
    'walk-in': 'Walk-in In Person Visit',
    'pre-booked': 'Pre-booked In Person Visit',
    'post-telemed': 'Post Telemed Lab Only',
};
exports.VisitTypeToLabelTelemed = {
    'walk-in': 'On-demand Telemed',
    'pre-booked': 'Pre-booked Telemed',
    'post-telemed': 'Post Telemed Lab Only',
};
var PersonSex;
(function (PersonSex) {
    PersonSex["Male"] = "male";
    PersonSex["Female"] = "female";
    PersonSex["Intersex"] = "other";
})(PersonSex || (exports.PersonSex = PersonSex = {}));
var getFhirAppointmentTypeForVisitType = function (visitType) {
    if (visitType === VisitType.WalkIn) {
        return utils_1.FhirAppointmentType.walkin;
    }
    else if (visitType === VisitType.PostTelemed) {
        return utils_1.FhirAppointmentType.posttelemed;
    }
    else if (visitType === VisitType.PreBook) {
        return utils_1.FhirAppointmentType.prebook;
    }
    else {
        return undefined;
    }
};
exports.getFhirAppointmentTypeForVisitType = getFhirAppointmentTypeForVisitType;
exports.fhirAppointmentTypeToVisitType = {
    prebook: VisitType.PreBook,
    walkin: VisitType.WalkIn,
    posttelemed: VisitType.PostTelemed,
};
var getVisitTypeLabelForAppointment = function (appointment) {
    var _a, _b, _c;
    var fhirAppointmentType = (_a = appointment === null || appointment === void 0 ? void 0 : appointment.appointmentType) === null || _a === void 0 ? void 0 : _a.text;
    var isFhirAppointmentMetaTagTelemed = (_c = (_b = appointment.meta) === null || _b === void 0 ? void 0 : _b.tag) === null || _c === void 0 ? void 0 : _c.find(function (tag) { return tag.code === utils_1.OTTEHR_MODULE.TM; });
    var visitTypeToLabelEnum = exports.VisitTypeToLabel;
    if (isFhirAppointmentMetaTagTelemed) {
        visitTypeToLabelEnum = exports.VisitTypeToLabelTelemed;
    }
    var visitType = exports.fhirAppointmentTypeToVisitType[fhirAppointmentType];
    var label = visitTypeToLabelEnum[visitType];
    return label || '-';
};
exports.getVisitTypeLabelForAppointment = getVisitTypeLabelForAppointment;
var ClosureType;
(function (ClosureType) {
    ClosureType["OneDay"] = "one-day";
    ClosureType["Period"] = "period";
})(ClosureType || (exports.ClosureType = ClosureType = {}));
var DocumentType;
(function (DocumentType) {
    DocumentType["InsuranceFront"] = "insurance-card-front";
    DocumentType["InsuranceBack"] = "insurance-card-back";
    DocumentType["FullInsurance"] = "fullInsuranceCard";
    DocumentType["InsuranceFrontSecondary"] = "insurance-card-front-2";
    DocumentType["InsuranceBackSecondary"] = "insurance-card-back-2";
    DocumentType["FullInsuranceSecondary"] = "fullInsuranceCard-2";
    DocumentType["PhotoIdFront"] = "photo-id-front";
    DocumentType["PhotoIdBack"] = "photo-id-back";
    DocumentType["FullPhotoId"] = "fullPhotoIDCard";
    DocumentType["HipaaConsent"] = "HIPAA Acknowledgement";
    DocumentType["CttConsent"] = "Consent to Treat, Guarantee of Payment & Card on File Agreement";
    DocumentType["CttConsentOld"] = "Consent to Treat and Guarantee of Payment";
})(DocumentType || (exports.DocumentType = DocumentType = {}));
//# sourceMappingURL=types.js.map