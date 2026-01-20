"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSecondaryInsuranceSection = exports.createPrimaryInsuranceSection = exports.composeInsuranceData = void 0;
var utils_1 = require("utils");
var pdf_common_1 = require("../pdf-common");
var composeInsuranceData = function (_a) {
    var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13, _14, _15, _16, _17, _18;
    var coverages = _a.coverages, insuranceOrgs = _a.insuranceOrgs;
    var primary = coverages.primary, secondary = coverages.secondary, primarySubscriber = coverages.primarySubscriber, secondarySubscriber = coverages.secondarySubscriber;
    var primaryInsurancePlanReference;
    var secondaryInsurancePlanReference;
    var primaryMemberId = '';
    var secondaryMemberId = '';
    var primaryPlanType;
    var secondaryPlanType;
    if (primary) {
        var payerId_1 = (_b = primary.class) === null || _b === void 0 ? void 0 : _b[0].value;
        var org = insuranceOrgs.find(function (tempOrg) { return (0, utils_1.getPayerId)(tempOrg) === payerId_1; });
        if (payerId_1 && org) {
            primaryInsurancePlanReference = {
                reference: "Organization/".concat(org.id),
                display: org.name,
            };
        }
    }
    if (secondary) {
        var payerId_2 = (_c = secondary.class) === null || _c === void 0 ? void 0 : _c[0].value;
        var org = insuranceOrgs.find(function (tempOrg) { return (0, utils_1.getPayerId)(tempOrg) === payerId_2; });
        if (payerId_2 && org) {
            secondaryInsurancePlanReference = {
                reference: "Organization/".concat(org.id),
                display: org.name,
            };
        }
    }
    if (primary) {
        primaryMemberId =
            (_f = (_e = (_d = primary.identifier) === null || _d === void 0 ? void 0 : _d.find(function (i) { var _a, _b, _c, _d, _e; return ((_c = (_b = (_a = i.type) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.code) === 'MB' && ((_d = i.assigner) === null || _d === void 0 ? void 0 : _d.reference) === ((_e = primary.payor[0]) === null || _e === void 0 ? void 0 : _e.reference); })) === null || _e === void 0 ? void 0 : _e.value) !== null && _f !== void 0 ? _f : '';
    }
    if (secondary) {
        secondaryMemberId =
            (_j = (_h = (_g = secondary.identifier) === null || _g === void 0 ? void 0 : _g.find(function (i) { var _a, _b, _c, _d, _e; return ((_c = (_b = (_a = i.type) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.code) === 'MB' && ((_d = i.assigner) === null || _d === void 0 ? void 0 : _d.reference) === ((_e = secondary.payor[0]) === null || _e === void 0 ? void 0 : _e.reference); })) === null || _h === void 0 ? void 0 : _h.value) !== null && _j !== void 0 ? _j : '';
    }
    if (primary) {
        primaryPlanType = (0, utils_1.getCandidPlanTypeCodeFromCoverage)(primary);
    }
    if (secondary) {
        secondaryPlanType = (0, utils_1.getCandidPlanTypeCodeFromCoverage)(secondary);
    }
    var primarySubscriberDoB = (0, utils_1.formatDateForDisplay)(primarySubscriber === null || primarySubscriber === void 0 ? void 0 : primarySubscriber.birthDate);
    var primarySubscriberBirthSex = (_k = utils_1.genderMap[primarySubscriber === null || primarySubscriber === void 0 ? void 0 : primarySubscriber.gender]) !== null && _k !== void 0 ? _k : '';
    var primarySubscriberFullName = '';
    var relationshipToInsured = (_o = (_m = (_l = primary === null || primary === void 0 ? void 0 : primary.relationship) === null || _l === void 0 ? void 0 : _l.coding) === null || _m === void 0 ? void 0 : _m[0].display) !== null && _o !== void 0 ? _o : '';
    var policyHolderAddress = (_p = primarySubscriber === null || primarySubscriber === void 0 ? void 0 : primarySubscriber.address) === null || _p === void 0 ? void 0 : _p[0];
    var policyHolderZip = (_q = policyHolderAddress === null || policyHolderAddress === void 0 ? void 0 : policyHolderAddress.postalCode) !== null && _q !== void 0 ? _q : '';
    var policyHolderState = (_r = policyHolderAddress === null || policyHolderAddress === void 0 ? void 0 : policyHolderAddress.state) !== null && _r !== void 0 ? _r : '';
    var policyHolderCity = (_s = policyHolderAddress === null || policyHolderAddress === void 0 ? void 0 : policyHolderAddress.city) !== null && _s !== void 0 ? _s : '';
    var policyHolderAddressAdditionalLine = (_u = (_t = policyHolderAddress === null || policyHolderAddress === void 0 ? void 0 : policyHolderAddress.line) === null || _t === void 0 ? void 0 : _t[1]) !== null && _u !== void 0 ? _u : '';
    var policyHolderAddressLine = (_w = (_v = policyHolderAddress === null || policyHolderAddress === void 0 ? void 0 : policyHolderAddress.line) === null || _v === void 0 ? void 0 : _v[0]) !== null && _w !== void 0 ? _w : '';
    if (primarySubscriber) {
        primarySubscriberFullName = (_x = (0, utils_1.getFullName)(primarySubscriber)) !== null && _x !== void 0 ? _x : '';
    }
    var primaryAdditionalInformation = (_0 = (_z = (_y = primary === null || primary === void 0 ? void 0 : primary.extension) === null || _y === void 0 ? void 0 : _y.find(function (e) { return e.url === utils_1.COVERAGE_ADDITIONAL_INFORMATION_URL; })) === null || _z === void 0 ? void 0 : _z.valueString) !== null && _0 !== void 0 ? _0 : '';
    var secondarySubscriberDoB = (0, utils_1.formatDateForDisplay)(secondarySubscriber === null || secondarySubscriber === void 0 ? void 0 : secondarySubscriber.birthDate);
    var secondarySubscriberBirthSex = (_1 = utils_1.genderMap[secondarySubscriber === null || secondarySubscriber === void 0 ? void 0 : secondarySubscriber.gender]) !== null && _1 !== void 0 ? _1 : '';
    var secondarySubscriberFullName = '';
    var secondaryRelationshipToInsured = (_4 = (_3 = (_2 = secondary === null || secondary === void 0 ? void 0 : secondary.relationship) === null || _2 === void 0 ? void 0 : _2.coding) === null || _3 === void 0 ? void 0 : _3[0].display) !== null && _4 !== void 0 ? _4 : '';
    var secondaryPolicyHolderAddress = (_5 = secondarySubscriber === null || secondarySubscriber === void 0 ? void 0 : secondarySubscriber.address) === null || _5 === void 0 ? void 0 : _5[0];
    var secondaryPolicyHolderZip = (_6 = secondaryPolicyHolderAddress === null || secondaryPolicyHolderAddress === void 0 ? void 0 : secondaryPolicyHolderAddress.postalCode) !== null && _6 !== void 0 ? _6 : '';
    var secondaryPolicyHolderState = (_7 = secondaryPolicyHolderAddress === null || secondaryPolicyHolderAddress === void 0 ? void 0 : secondaryPolicyHolderAddress.state) !== null && _7 !== void 0 ? _7 : '';
    var secondaryPolicyHolderCity = (_8 = secondaryPolicyHolderAddress === null || secondaryPolicyHolderAddress === void 0 ? void 0 : secondaryPolicyHolderAddress.city) !== null && _8 !== void 0 ? _8 : '';
    var secondaryPolicyHolderAddressAdditionalLine = (_10 = (_9 = secondaryPolicyHolderAddress === null || secondaryPolicyHolderAddress === void 0 ? void 0 : secondaryPolicyHolderAddress.line) === null || _9 === void 0 ? void 0 : _9[1]) !== null && _10 !== void 0 ? _10 : '';
    var secondaryPolicyHolderAddressLine = (_12 = (_11 = secondaryPolicyHolderAddress === null || secondaryPolicyHolderAddress === void 0 ? void 0 : secondaryPolicyHolderAddress.line) === null || _11 === void 0 ? void 0 : _11[0]) !== null && _12 !== void 0 ? _12 : '';
    if (secondarySubscriber) {
        secondarySubscriberFullName = (_13 = (0, utils_1.getFullName)(secondarySubscriber)) !== null && _13 !== void 0 ? _13 : '';
    }
    var secondaryAdditionalInformation = (_16 = (_15 = (_14 = secondary === null || secondary === void 0 ? void 0 : secondary.extension) === null || _14 === void 0 ? void 0 : _14.find(function (e) { return e.url === utils_1.COVERAGE_ADDITIONAL_INFORMATION_URL; })) === null || _15 === void 0 ? void 0 : _15.valueString) !== null && _16 !== void 0 ? _16 : '';
    return {
        primary: {
            insuranceCarrier: (_17 = primaryInsurancePlanReference === null || primaryInsurancePlanReference === void 0 ? void 0 : primaryInsurancePlanReference.display) !== null && _17 !== void 0 ? _17 : '',
            planType: primaryPlanType,
            memberId: primaryMemberId,
            policyHoldersName: primarySubscriberFullName,
            policyHoldersDateOfBirth: primarySubscriberDoB,
            policyHoldersSex: primarySubscriberBirthSex,
            streetAddress: policyHolderAddressLine,
            addressLineOptional: policyHolderAddressAdditionalLine,
            city: policyHolderCity,
            state: policyHolderState,
            zip: policyHolderZip,
            relationship: relationshipToInsured,
            additionalInformation: primaryAdditionalInformation,
        },
        secondary: {
            insuranceCarrier: (_18 = secondaryInsurancePlanReference === null || secondaryInsurancePlanReference === void 0 ? void 0 : secondaryInsurancePlanReference.display) !== null && _18 !== void 0 ? _18 : '',
            planType: secondaryPlanType,
            memberId: secondaryMemberId,
            policyHoldersName: secondarySubscriberFullName,
            policyHoldersDateOfBirth: secondarySubscriberDoB,
            policyHoldersSex: secondarySubscriberBirthSex,
            streetAddress: secondaryPolicyHolderAddressLine,
            addressLineOptional: secondaryPolicyHolderAddressAdditionalLine,
            city: secondaryPolicyHolderCity,
            state: secondaryPolicyHolderState,
            zip: secondaryPolicyHolderZip,
            relationship: secondaryRelationshipToInsured,
            additionalInformation: secondaryAdditionalInformation,
        },
    };
};
exports.composeInsuranceData = composeInsuranceData;
var createInsuranceSection = function (title, dataSelector) {
    return (0, pdf_common_1.createConfiguredSection)('insurance', function (shouldShow) { return ({
        title: title,
        dataSelector: dataSelector,
        shouldRender: function (coverage) { return !!coverage.insuranceCarrier; },
        render: function (client, data, styles) {
            if (shouldShow('insurance-carrier')) {
                client.drawLabelValueRow('Insurance Carrier', data.insuranceCarrier, styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            if (shouldShow('insurance-member-id')) {
                client.drawLabelValueRow('Member ID', data.memberId, styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            if (shouldShow('policy-holder-first-name') ||
                shouldShow('policy-holder-middle-name') ||
                shouldShow('policy-holder-last-name')) {
                client.drawLabelValueRow("Policy holder's name", data.policyHoldersName, styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            if (shouldShow('policy-holder-date-of-birth')) {
                client.drawLabelValueRow("Policy holder's date of birth", data.policyHoldersDateOfBirth, styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            if (shouldShow('policy-holder-birth-sex')) {
                client.drawLabelValueRow("Policy holder's sex", data.policyHoldersSex, styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            if (shouldShow('policy-holder-address')) {
                client.drawLabelValueRow('Street address', data.streetAddress, styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            if (shouldShow('policy-holder-address-additional-line')) {
                client.drawLabelValueRow('Address line 2', data.addressLineOptional, styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            if ((shouldShow('policy-holder-city') && shouldShow('policy-holder-state')) || shouldShow('policy-holder-zip')) {
                client.drawLabelValueRow('City, State, ZIP', "".concat(data.city, ", ").concat(data.state, ", ").concat(data.zip), styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            if (shouldShow('patient-relationship-to-insured')) {
                client.drawLabelValueRow("Patient's relationship to insured", data.relationship, styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            if (shouldShow('insurance-additional-information')) {
                client.drawLabelValueRow("Additional insurance information", data.additionalInformation, styles.textStyles.regular, styles.textStyles.regular, {
                    spacing: 16,
                });
            }
        },
    }); });
};
var createPrimaryInsuranceSection = function () { return createInsuranceSection('Primary insurance information', function (data) { var _a; return (_a = data.insurances) === null || _a === void 0 ? void 0 : _a.primary; }); };
exports.createPrimaryInsuranceSection = createPrimaryInsuranceSection;
var createSecondaryInsuranceSection = function () { return createInsuranceSection('Secondary insurance information', function (data) { var _a; return (_a = data.insurances) === null || _a === void 0 ? void 0 : _a.secondary; }); };
exports.createSecondaryInsuranceSection = createSecondaryInsuranceSection;
