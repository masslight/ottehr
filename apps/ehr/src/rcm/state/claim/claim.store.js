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
exports.useClaimStore = void 0;
var zustand_1 = require("zustand");
var utils_1 = require("../../utils");
var CLAIM_INITIAL = {};
exports.useClaimStore = (0, zustand_1.create)()(function (set, get) { return (__assign(__assign({}, CLAIM_INITIAL), { setResources: function (data) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        var claim = (0, utils_1.findResourceByType)(data, 'Claim');
        var encounter = (0, utils_1.findResourceByType)(data, 'Encounter');
        var appointment = (0, utils_1.findResourceByType)(data, 'Appointment');
        var patientReference = (_a = claim === null || claim === void 0 ? void 0 : claim.patient) === null || _a === void 0 ? void 0 : _a.reference;
        var patient = (0, utils_1.findResourceByTypeAndId)(data, 'Patient', patientReference === null || patientReference === void 0 ? void 0 : patientReference.split('/')[1]);
        var coverageReference = (_d = (_c = (_b = claim === null || claim === void 0 ? void 0 : claim.insurance) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.coverage) === null || _d === void 0 ? void 0 : _d.reference;
        var coverage = (0, utils_1.findResourceByTypeAndId)(data, 'Coverage', coverageReference === null || coverageReference === void 0 ? void 0 : coverageReference.split('/')[1]);
        var subscriberReference = (_e = coverage === null || coverage === void 0 ? void 0 : coverage.subscriber) === null || _e === void 0 ? void 0 : _e.reference;
        var subscriber = (0, utils_1.findResourceByTypeAndId)(data, subscriberReference === null || subscriberReference === void 0 ? void 0 : subscriberReference.split('/')[0], subscriberReference === null || subscriberReference === void 0 ? void 0 : subscriberReference.split('/')[1]);
        var additionalCoverageReference = (_h = (_g = (_f = claim === null || claim === void 0 ? void 0 : claim.insurance) === null || _f === void 0 ? void 0 : _f[1]) === null || _g === void 0 ? void 0 : _g.coverage) === null || _h === void 0 ? void 0 : _h.reference;
        var additionalCoverage = (0, utils_1.findResourceByTypeAndId)(data, 'Coverage', additionalCoverageReference === null || additionalCoverageReference === void 0 ? void 0 : additionalCoverageReference.split('/')[1]);
        var additionalSubscriberReference = (_j = additionalCoverage === null || additionalCoverage === void 0 ? void 0 : additionalCoverage.subscriber) === null || _j === void 0 ? void 0 : _j.reference;
        var additionalSubscriber = (0, utils_1.findResourceByTypeAndId)(data, additionalSubscriberReference === null || additionalSubscriberReference === void 0 ? void 0 : additionalSubscriberReference.split('/')[0], additionalSubscriberReference === null || additionalSubscriberReference === void 0 ? void 0 : additionalSubscriberReference.split('/')[1]);
        var visitNoteDocument = data.find(function (resource) {
            var _a, _b;
            return resource.resourceType === 'DocumentReference' &&
                ((_b = (_a = resource.type) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.find(function (coding) { return coding.code === '75498-6'; }));
        });
        var _k = get(), setPatientData = _k.setPatientData, setCoverageData = _k.setCoverageData, setAdditionalCoverageData = _k.setAdditionalCoverageData, setClaimData = _k.setClaimData;
        setPatientData(patient);
        setCoverageData(coverage, subscriber);
        setAdditionalCoverageData(additionalCoverage, additionalSubscriber);
        setClaimData(claim);
        set({ encounter: encounter, appointment: appointment, visitNoteDocument: visitNoteDocument });
    }, setPatientData: function (patient) {
        var patientData = (0, utils_1.getPatientData)(patient);
        set({ patient: patient, patientData: patientData });
    }, setCoverageData: function (coverage, subscriber) {
        var coverageData = (0, utils_1.getCoverageData)(coverage, subscriber);
        set({ coverage: coverage, coverageData: coverageData, subscriber: subscriber });
    }, setAdditionalCoverageData: function (additionalCoverage, additionalSubscriber) {
        var additionalCoverageData = (0, utils_1.getCoverageData)(additionalCoverage, additionalSubscriber);
        set({ additionalCoverage: additionalCoverage, additionalCoverageData: additionalCoverageData, additionalSubscriber: additionalSubscriber });
    }, setClaimData: function (claim) {
        var claimData = (0, utils_1.getClaimData)(claim);
        set({ claim: claim, claimData: claimData });
    }, setPlansOwnedBy: function (insurancePlans, organizations) {
        var plansOwnedBy = insurancePlans === null || insurancePlans === void 0 ? void 0 : insurancePlans.map(function (plan) { return (__assign(__assign({}, plan), { ownedBy: organizations.find(function (organization) { var _a, _b; return organization.id === ((_b = (_a = plan.ownedBy) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.split('/')[1]); }) })); });
        set({ insurancePlans: insurancePlans, organizations: organizations, plansOwnedBy: plansOwnedBy });
    } })); });
//# sourceMappingURL=claim.store.js.map