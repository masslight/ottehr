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
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var uuid_1 = require("uuid");
var vitest_1 = require("vitest");
var in_person_intake_questionnaire_json_1 = require("../../../config/oystehr/in-person-intake-questionnaire.json");
var harvest_1 = require("../src/ehr/shared/harvest");
var expected_coverage_resources_qr1_1 = require("./data/expected-coverage-resources-qr1");
var harvest_test_helpers_1 = require("./helpers/harvest-test-helpers");
var questionnaire = Object.values(in_person_intake_questionnaire_json_1.default.fhirResources).find(function (q) {
    return q.resource.resourceType === 'Questionnaire' &&
        q.resource.status === 'active' &&
        q.resource.url.includes('intake-paperwork-inperson');
});
if (!questionnaire) {
    throw new Error('Questionnaire not found in local config');
}
var InPersonQuestionnaire = questionnaire.resource;
var expectedPrimaryPolicyHolderFromQR1 = (0, harvest_test_helpers_1.fillReferences)(expected_coverage_resources_qr1_1.expectedPrimaryPolicyHolderFromQR1, ['Patient/36ef99c2-43fa-40f6-bf9c-d9ea12c2bf61']);
var expectedSecondaryPolicyHolderFromQR1 = (0, harvest_test_helpers_1.fillReferences)(expected_coverage_resources_qr1_1.expectedSecondaryPolicyHolderFromQR1, [
    'Patient/36ef99c2-43fa-40f6-bf9c-d9ea12c2bf61',
]);
var expectedAccountGuarantorFromQR1 = (0, harvest_test_helpers_1.fillReferences)(expected_coverage_resources_qr1_1.expectedAccountGuarantorFromQR1, ['Patient/36ef99c2-43fa-40f6-bf9c-d9ea12c2bf61']);
(0, vitest_1.describe)('Harvest Module', function () {
    var _a;
    var _b = (0, harvest_1.getCoverageResources)({
        questionnaireResponse: questionnaireResponse1,
        patientId: (_a = newPatient1.id) !== null && _a !== void 0 ? _a : '',
        organizationResources: organizations1,
    }), coverageResources = _b.orderedCoverages, accountCoverage = _b.accountCoverage;
    var primary = coverageResources.primary;
    var secondary = coverageResources.secondary;
    (0, vitest_1.expect)(primary).toBeDefined();
    (0, vitest_1.expect)(secondary).toBeDefined();
    (0, vitest_1.assert)(primary);
    (0, vitest_1.assert)(secondary);
    var expectedAccount = {
        resourceType: 'Account',
        type: {
            coding: [
                {
                    system: 'http://terminology.hl7.org/CodeSystem/account-type',
                    code: 'PBILLACCT',
                    display: 'patient billing account',
                },
            ],
        },
        contained: [
            {
                resourceType: 'RelatedPerson',
                id: 'accountGuarantorId',
                name: [{ given: ['Jane'], family: 'Doe' }],
                birthDate: '1983-02-23',
                gender: 'female',
                patient: { reference: "Patient/".concat(newPatient1.id) },
                address: [
                    {
                        city: 'fakePlace',
                        line: ['123 test lane'],
                        postalCode: '11111',
                        state: 'NY',
                    },
                ],
                relationship: [
                    {
                        coding: [
                            {
                                system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
                                code: 'parent',
                                display: 'Parent',
                            },
                        ],
                    },
                ],
                telecom: [
                    {
                        system: 'phone',
                        value: '+19895556543',
                    },
                    {
                        system: 'email',
                        value: 'rowdyroddypiper@hotmail.com',
                    },
                ],
            },
        ],
        status: 'active',
        subject: [{ reference: "Patient/".concat(newPatient1.id) }],
        description: 'Patient account',
        guarantor: [
            {
                party: {
                    reference: '#accountGuarantorId',
                    type: 'RelatedPerson',
                },
            },
        ],
        coverage: [
            {
                coverage: { reference: "".concat(primary.id) },
                priority: 1,
            },
            {
                coverage: { reference: "".concat(secondary.id) },
                priority: 2,
            },
        ],
    };
    (0, vitest_1.it)('should pass this stub test', function () {
        (0, vitest_1.expect)(true).toBe(true);
    });
    (0, vitest_1.it)('should extract primary policy holder information from answers', function () {
        var _a;
        var expectedPrimaryPolicyHolder = {
            firstName: 'Barnabas',
            middleName: 'Thaddeus',
            lastName: 'PicklesWorth',
            dob: '1982-02-23',
            birthSex: 'Male',
            address: {
                line: ['317 Mustard Street', 'Unit 2'],
                city: 'DeliciousVilla',
                state: 'DE',
                postalCode: '20001',
            },
            relationship: 'Child',
            memberId: 'FafOneJwgNdkOetWwe6',
        };
        var flattened = (0, utils_1.flattenItems)((_a = questionnaireResponse1.item) !== null && _a !== void 0 ? _a : []);
        var primaryPolicyHolder = (0, harvest_1.getPrimaryPolicyHolderFromAnswers)(flattened);
        (0, vitest_1.expect)(primaryPolicyHolder).toEqual(expectedPrimaryPolicyHolder);
    });
    (0, vitest_1.it)('should extract secondary policy holder information from answers', function () {
        var _a;
        var expectedSecondaryPolicyHolder = {
            firstName: 'Jennifer',
            middleName: 'Celeste',
            lastName: 'PicklesWorth',
            dob: '1983-02-23',
            birthSex: 'Female',
            address: {
                line: ['317 R St NW Unit 2', 'conditional-filter-test-1234'],
                city: 'Washington',
                state: 'DC',
                postalCode: '20001',
            },
            relationship: 'Child',
            memberId: 'FdfDfdFdfDfh7897',
        };
        var flattened = (0, utils_1.flattenItems)((_a = questionnaireResponse1.item) !== null && _a !== void 0 ? _a : []);
        var secondaryPolicyHolder = (0, harvest_1.getSecondaryPolicyHolderFromAnswers)(flattened);
        (0, vitest_1.expect)(secondaryPolicyHolder).toEqual(expectedSecondaryPolicyHolder);
    });
    (0, vitest_1.it)('should extract account guarantor information from answers', function () {
        var _a;
        var expectedAccountGuarantor = {
            firstName: 'Jane',
            lastName: 'Doe',
            dob: '1983-02-23',
            address: {
                city: 'fakePlace',
                line: ['123 test lane'],
                postalCode: '11111',
                state: 'NY',
            },
            relationship: 'Parent',
            birthSex: 'Female',
            number: '(989) 555-6543',
            email: 'rowdyroddypiper@hotmail.com',
        };
        var flattened = (0, utils_1.flattenItems)((_a = questionnaireResponse1.item) !== null && _a !== void 0 ? _a : []);
        var accountGuarantor = (0, harvest_1.extractAccountGuarantor)(flattened);
        (0, vitest_1.expect)(accountGuarantor).toEqual(expectedAccountGuarantor);
    });
    (0, vitest_1.it)('should extract coverage resources from answers', function () {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6;
        var expectedCoverageResources = {
            primary: {
                resourceType: 'Coverage',
                identifier: [
                    __assign(__assign({}, utils_1.COVERAGE_MEMBER_IDENTIFIER_BASE), { value: 'FafOneJwgNdkOetWwe6', assigner: {
                            reference: 'Organization/db875d9d-5726-4c45-a689-e11a7bbdf176',
                            display: 'Aetna',
                        } }),
                ],
                contained: [expectedPrimaryPolicyHolderFromQR1],
                status: 'active',
                beneficiary: { reference: 'Patient/36ef99c2-43fa-40f6-bf9c-d9ea12c2bf61', type: 'Patient' },
                payor: [{ reference: 'Organization/db875d9d-5726-4c45-a689-e11a7bbdf176' }],
                subscriberId: 'FafOneJwgNdkOetWwe6',
                subscriber: {
                    reference: "#coverageSubscriber",
                },
                relationship: {
                    coding: [
                        {
                            system: 'http://terminology.hl7.org/CodeSystem/subscriber-relationship',
                            code: 'child',
                            display: 'Child',
                        },
                    ],
                },
                class: [
                    {
                        name: 'Aetna',
                        type: {
                            coding: [
                                {
                                    code: 'plan',
                                    system: 'http://terminology.hl7.org/CodeSystem/coverage-class',
                                },
                            ],
                        },
                        value: '60054',
                    },
                ],
                type: {
                    coding: [
                        {
                            code: '09',
                            system: 'https://fhir.ottehr.com/CodeSystem/candid-plan-type',
                        },
                        {
                            code: 'pay',
                            system: 'http://terminology.hl7.org/CodeSystem/coverage-selfpay',
                        },
                    ],
                },
                extension: [
                    {
                        url: 'https://fhir.zapehr.com/r4/StructureDefinitions/additional-information',
                        valueString: 'Additional info to primary insurance',
                    },
                ],
            },
            secondary: {
                resourceType: 'Coverage',
                identifier: [
                    __assign(__assign({}, utils_1.COVERAGE_MEMBER_IDENTIFIER_BASE), { value: 'FdfDfdFdfDfh7897', assigner: {
                            reference: 'Organization/a9bada42-935a-45fa-ba8e-aa3b29478884',
                            display: 'United Heartland',
                        } }),
                ],
                contained: [expectedSecondaryPolicyHolderFromQR1],
                status: 'active',
                beneficiary: { reference: 'Patient/36ef99c2-43fa-40f6-bf9c-d9ea12c2bf61', type: 'Patient' },
                payor: [{ reference: 'Organization/a9bada42-935a-45fa-ba8e-aa3b29478884' }],
                subscriberId: 'FdfDfdFdfDfh7897',
                subscriber: { reference: '#coverageSubscriber' },
                relationship: {
                    coding: [
                        {
                            system: 'http://terminology.hl7.org/CodeSystem/subscriber-relationship',
                            code: 'child',
                            display: 'Child',
                        },
                    ],
                },
                class: [
                    {
                        name: 'United Heartland',
                        type: {
                            coding: [
                                {
                                    code: 'plan',
                                    system: 'http://terminology.hl7.org/CodeSystem/coverage-class',
                                },
                            ],
                        },
                        value: 'J1859',
                    },
                ],
                type: {
                    coding: [
                        {
                            code: '12',
                            system: 'https://fhir.ottehr.com/CodeSystem/candid-plan-type',
                        },
                        {
                            code: 'PPO',
                            system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
                        },
                    ],
                },
                extension: [
                    {
                        url: 'https://fhir.zapehr.com/r4/StructureDefinitions/additional-information',
                        valueString: 'Additional info to secondary insurance',
                    },
                ],
            },
        };
        var coverageResources = (0, harvest_1.getCoverageResources)({
            questionnaireResponse: questionnaireResponse1,
            patientId: (_a = newPatient1.id) !== null && _a !== void 0 ? _a : '',
            organizationResources: organizations1,
        }).orderedCoverages;
        (0, vitest_1.expect)(coverageResources).toBeDefined();
        var primary = coverageResources.primary;
        var secondary = coverageResources.secondary;
        (0, vitest_1.expect)(primary).toBeDefined();
        (0, vitest_1.expect)(secondary).toBeDefined();
        (0, vitest_1.assert)(primary);
        (0, vitest_1.assert)(secondary);
        (0, vitest_1.expect)(primary.status).toBe('active');
        (0, vitest_1.expect)(secondary.status).toBe('active');
        (0, vitest_1.expect)(primary.beneficiary.reference).toBe("Patient/".concat(newPatient1.id));
        (0, vitest_1.expect)(secondary.beneficiary.reference).toBe("Patient/".concat(newPatient1.id));
        (0, vitest_1.expect)((_b = primary.payor) === null || _b === void 0 ? void 0 : _b[0].reference).toBe((_c = expectedCoverageResources.primary.payor) === null || _c === void 0 ? void 0 : _c[0].reference);
        (0, vitest_1.expect)((_d = secondary.payor) === null || _d === void 0 ? void 0 : _d[0].reference).toBe((_e = expectedCoverageResources.secondary.payor) === null || _e === void 0 ? void 0 : _e[0].reference);
        (0, vitest_1.expect)(primary.subscriberId).toBe('FafOneJwgNdkOetWwe6');
        (0, vitest_1.expect)(secondary.subscriberId).toBe('FdfDfdFdfDfh7897');
        (0, vitest_1.expect)((_f = primary.subscriber) === null || _f === void 0 ? void 0 : _f.reference).toBe("#".concat((_g = primary.contained) === null || _g === void 0 ? void 0 : _g[0].id));
        (0, vitest_1.expect)((_h = secondary.subscriber) === null || _h === void 0 ? void 0 : _h.reference).toBe("#".concat((_j = secondary.contained) === null || _j === void 0 ? void 0 : _j[0].id));
        (0, vitest_1.expect)((_l = (_k = primary.relationship) === null || _k === void 0 ? void 0 : _k.coding) === null || _l === void 0 ? void 0 : _l[0].code).toBe('child');
        (0, vitest_1.expect)((_o = (_m = secondary.relationship) === null || _m === void 0 ? void 0 : _m.coding) === null || _o === void 0 ? void 0 : _o[0].code).toBe('child');
        (0, vitest_1.expect)((_p = primary.contained) === null || _p === void 0 ? void 0 : _p.length).toBe(1);
        (0, vitest_1.expect)((_q = secondary.contained) === null || _q === void 0 ? void 0 : _q.length).toBe(1);
        (0, vitest_1.expect)((_r = primary.contained) === null || _r === void 0 ? void 0 : _r[0].resourceType).toBe('RelatedPerson');
        (0, vitest_1.expect)((_s = secondary.contained) === null || _s === void 0 ? void 0 : _s[0].resourceType).toBe('RelatedPerson');
        (0, vitest_1.expect)((_w = (_v = (_u = (_t = primary.contained) === null || _t === void 0 ? void 0 : _t[0]) === null || _u === void 0 ? void 0 : _u.name) === null || _v === void 0 ? void 0 : _v[0].given) === null || _w === void 0 ? void 0 : _w[0]).toBe('Barnabas');
        (0, vitest_1.expect)((_0 = (_z = (_y = (_x = secondary.contained) === null || _x === void 0 ? void 0 : _x[0]) === null || _y === void 0 ? void 0 : _y.name) === null || _z === void 0 ? void 0 : _z[0].given) === null || _0 === void 0 ? void 0 : _0[0]).toBe('Jennifer');
        (0, vitest_1.expect)((_1 = primary.contained) === null || _1 === void 0 ? void 0 : _1[0].id).toBe('coverageSubscriber');
        (0, vitest_1.expect)((_2 = secondary.contained) === null || _2 === void 0 ? void 0 : _2[0].id).toBe('coverageSubscriber');
        (0, vitest_1.expect)(primary.contained).toEqual(expectedCoverageResources.primary.contained);
        (0, vitest_1.expect)(secondary.contained).toEqual(expectedCoverageResources.secondary.contained);
        (0, vitest_1.expect)(primary.extension).toEqual(expectedCoverageResources.primary.extension);
        (0, vitest_1.expect)(secondary.extension).toEqual(expectedCoverageResources.secondary.extension);
        (0, vitest_1.expect)(primary.relationship).toEqual(expectedCoverageResources.primary.relationship);
        (0, vitest_1.expect)(secondary.relationship).toEqual(expectedCoverageResources.secondary.relationship);
        (0, vitest_1.expect)(__assign(__assign({}, primary), { id: undefined })).toEqual(expectedCoverageResources.primary);
        (0, vitest_1.expect)(__assign(__assign({}, secondary), { id: undefined })).toEqual(expectedCoverageResources.secondary);
        (0, vitest_1.expect)((_3 = primary.id) === null || _3 === void 0 ? void 0 : _3.startsWith('urn:uuid:')).toBe(true);
        (0, vitest_1.expect)((_4 = secondary.id) === null || _4 === void 0 ? void 0 : _4.startsWith('urn:uuid:')).toBe(true);
        var uuidPrimary = ((_5 = primary.id) !== null && _5 !== void 0 ? _5 : '').split(':').pop();
        var uuidSecondary = ((_6 = secondary.id) !== null && _6 !== void 0 ? _6 : '').split(':').pop();
        (0, vitest_1.expect)((0, utils_1.isValidUUID)(uuidPrimary)).toBe(true);
        (0, vitest_1.expect)((0, utils_1.isValidUUID)(uuidSecondary)).toBe(true);
    });
    (0, vitest_1.it)('should create an account with the correct details', function () {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
        var flattened = (0, utils_1.flattenItems)((_a = questionnaireResponse1.item) !== null && _a !== void 0 ? _a : []);
        var accountGuarantor = (0, harvest_1.extractAccountGuarantor)(flattened);
        (0, vitest_1.assert)(accountGuarantor);
        var containedGuarantorResource = (0, harvest_1.createContainedGuarantor)(accountGuarantor, (_b = newPatient1.id) !== null && _b !== void 0 ? _b : '');
        var guarantor = [
            {
                party: {
                    reference: "#".concat(containedGuarantorResource.id),
                    type: 'RelatedPerson',
                },
            },
        ];
        var account = (0, harvest_1.createAccount)({
            patientId: (_c = newPatient1.id) !== null && _c !== void 0 ? _c : '',
            guarantor: guarantor,
            coverage: accountCoverage,
            contained: [containedGuarantorResource],
        });
        (0, vitest_1.expect)(account).toBeDefined();
        (0, vitest_1.expect)(account.resourceType).toBe('Account');
        (0, vitest_1.expect)(account.status).toBe('active');
        (0, vitest_1.expect)((_e = (_d = account.subject) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.reference).toBe("Patient/".concat(newPatient1.id));
        (0, vitest_1.expect)((_f = account.contained) === null || _f === void 0 ? void 0 : _f.length).toBe(1);
        (0, vitest_1.expect)((_g = account.coverage) === null || _g === void 0 ? void 0 : _g.length).toBe(2);
        var primaryCoverage = (_h = account.coverage) === null || _h === void 0 ? void 0 : _h[0];
        var secondaryCoverage = (_j = account.coverage) === null || _j === void 0 ? void 0 : _j[1];
        (0, vitest_1.assert)(primaryCoverage && secondaryCoverage);
        (0, vitest_1.expect)((_k = primaryCoverage === null || primaryCoverage === void 0 ? void 0 : primaryCoverage.coverage) === null || _k === void 0 ? void 0 : _k.reference).toBe(primary.id);
        (0, vitest_1.expect)((_l = secondaryCoverage === null || secondaryCoverage === void 0 ? void 0 : secondaryCoverage.coverage) === null || _l === void 0 ? void 0 : _l.reference).toBe(secondary.id);
        (0, vitest_1.expect)(primaryCoverage === null || primaryCoverage === void 0 ? void 0 : primaryCoverage.priority).toBe(1);
        (0, vitest_1.expect)(secondaryCoverage === null || secondaryCoverage === void 0 ? void 0 : secondaryCoverage.priority).toBe(2);
        (0, vitest_1.expect)(account.description).toBe('Patient account');
        var containedGuarantor = (_m = account.contained) === null || _m === void 0 ? void 0 : _m[0];
        (0, vitest_1.assert)(containedGuarantor);
        (0, vitest_1.expect)(containedGuarantor).toEqual((_o = expectedAccount.contained) === null || _o === void 0 ? void 0 : _o[0]);
        (0, vitest_1.expect)(account).toEqual(expectedAccount);
    });
    (0, vitest_1.describe)('should generate the right output when comparing resources from form with existing resources', function () {
        var _a, _b, _c, _d;
        var flattened = (0, utils_1.flattenItems)((_a = questionnaireResponse1.item) !== null && _a !== void 0 ? _a : []);
        var accountGuarantor = (0, harvest_1.extractAccountGuarantor)(flattened);
        (0, vitest_1.assert)(accountGuarantor);
        var _e = (0, harvest_1.getCoverageResources)({
            questionnaireResponse: questionnaireResponse1,
            patientId: (_b = newPatient1.id) !== null && _b !== void 0 ? _b : '',
            organizationResources: organizations1,
        }), coverages = _e.orderedCoverages, accountCoverage = _e.accountCoverage;
        var containedGuarantor = (0, harvest_1.createContainedGuarantor)(accountGuarantor, (_c = newPatient1.id) !== null && _c !== void 0 ? _c : '');
        var guarantor = [
            {
                party: {
                    reference: "#".concat(containedGuarantor.id),
                    type: 'RelatedPerson',
                },
            },
        ];
        var account = (0, harvest_1.createAccount)({
            patientId: (_d = newPatient1.id) !== null && _d !== void 0 ? _d : '',
            guarantor: guarantor,
            coverage: accountCoverage,
            contained: [containedGuarantor],
        });
        (0, vitest_1.assert)(account);
        var primary = {
            resourceType: 'Coverage',
            id: (0, uuid_1.v4)(),
            status: 'active',
            beneficiary: { reference: 'Patient/36ef99c2-43fa-40f6-bf9c-d9ea12c2bf61', type: 'Patient' },
            payor: [{ reference: 'Organization/db875d9d-5726-4c45-a689-e11a7bbdf176' }],
            subscriberId: 'FafOneJwgNdkOetWwe6',
            subscriber: { reference: 'RelatedPerson/36ef99c3-43fb-50f4-bf9d-d9ea12c2bf62' },
            order: 1,
            identifier: [
                __assign(__assign({}, utils_1.COVERAGE_MEMBER_IDENTIFIER_BASE), { value: 'FafOneJwgNdkOetWwe6', assigner: {
                        reference: 'Organization/db875d9d-5726-4c45-a689-e11a7bbdf176',
                        display: 'Aetna',
                    } }),
            ],
            relationship: {
                coding: [
                    {
                        system: 'http://terminology.hl7.org/CodeSystem/subscriber-relationship',
                        code: 'child',
                        display: 'Child',
                    },
                ],
            },
            class: [
                {
                    name: 'Aetna',
                    type: {
                        coding: [
                            {
                                code: 'plan',
                                system: 'http://terminology.hl7.org/CodeSystem/coverage-class',
                            },
                        ],
                    },
                    value: '60054',
                },
            ],
            type: {
                coding: [
                    {
                        code: '09',
                        system: 'https://fhir.ottehr.com/CodeSystem/candid-plan-type',
                    },
                    {
                        code: 'pay',
                        system: 'http://terminology.hl7.org/CodeSystem/coverage-selfpay',
                    },
                ],
            },
            extension: [
                {
                    url: 'https://fhir.zapehr.com/r4/StructureDefinitions/additional-information',
                    valueString: 'Additional info to primary insurance',
                },
            ],
        };
        var primarySubscriber = {
            resourceType: 'RelatedPerson',
            id: (0, uuid_1.v4)(),
            name: [
                {
                    given: ['Barnabas', 'Thaddeus'],
                    family: 'PicklesWorth',
                },
            ],
            birthDate: '1982-02-23',
            gender: 'male',
            patient: { reference: 'Patient/36ef99c2-43fa-40f6-bf9c-d9ea12c2bf61' },
            relationship: [
                {
                    coding: [
                        {
                            system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
                            code: 'child',
                            display: 'Child',
                        },
                    ],
                },
            ],
            address: [
                {
                    line: ['317 Mustard Street', 'Unit 2'],
                    city: 'DeliciousVilla',
                    state: 'DE',
                    postalCode: '20001',
                },
            ],
        };
        var secondary = {
            resourceType: 'Coverage',
            id: (0, uuid_1.v4)(),
            status: 'active',
            beneficiary: { reference: 'Patient/36ef99c2-43fa-40f6-bf9c-d9ea12c2bf61', type: 'Patient' },
            payor: [{ reference: 'Organization/a9bada42-935a-45fa-ba8e-aa3b29478884' }],
            subscriberId: 'FdfDfdFdfDfh7897',
            subscriber: { reference: 'RelatedPerson/36ef99c3-43fa-40f4-bf9c-d9ea12c2bf63' },
            order: 1,
            identifier: [
                __assign(__assign({}, utils_1.COVERAGE_MEMBER_IDENTIFIER_BASE), { value: 'FdfDfdFdfDfh7897', assigner: {
                        reference: 'Organization/a9bada42-935a-45fa-ba8e-aa3b29478884',
                        display: 'United Heartland',
                    } }),
            ],
            relationship: {
                coding: [
                    {
                        system: 'http://terminology.hl7.org/CodeSystem/subscriber-relationship',
                        code: 'child',
                        display: 'Child',
                    },
                ],
            },
            class: [
                {
                    name: 'United Heartland',
                    type: {
                        coding: [
                            {
                                code: 'plan',
                                system: 'http://terminology.hl7.org/CodeSystem/coverage-class',
                            },
                        ],
                    },
                    value: 'J1859',
                },
            ],
            type: {
                coding: [
                    {
                        code: '12',
                        system: 'https://fhir.ottehr.com/CodeSystem/candid-plan-type',
                    },
                    {
                        code: 'PPO',
                        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
                    },
                ],
            },
            extension: [
                {
                    url: 'https://fhir.zapehr.com/r4/StructureDefinitions/additional-information',
                    valueString: 'Additional info to secondary insurance',
                },
            ],
        };
        var secondarySubscriber = {
            resourceType: 'RelatedPerson',
            id: (0, uuid_1.v4)(),
            name: [
                {
                    given: ['Jennifer', 'Celeste'],
                    family: 'PicklesWorth',
                },
            ],
            birthDate: '1983-02-23',
            gender: 'female',
            patient: { reference: 'Patient/36ef99c2-43fa-40f6-bf9c-d9ea12c2bf61' },
            relationship: [
                {
                    coding: [
                        {
                            system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
                            code: 'child',
                            display: 'Child',
                        },
                    ],
                },
            ],
            address: [
                {
                    line: ['317 R St NW Unit 2', 'conditional-filter-test-1234'],
                    city: 'Washington',
                    state: 'DC',
                    postalCode: '20001',
                },
            ],
        };
        (0, vitest_1.describe)('should generate the right output when comparing new coverages against existing primary coverage', function () {
            (0, vitest_1.it)('should return no patches when subscriber and coverage match new values exactly', function () {
                var existingCoverages = {
                    primary: primary,
                    primarySubscriber: primarySubscriber,
                };
                var result = (0, harvest_1.resolveCoverageUpdates)({
                    existingCoverages: existingCoverages,
                    newCoverages: coverages,
                    patient: newPatient1,
                });
                var suggestedNewCoverageObject = result.suggestedNewCoverageObject, deactivatedCoverages = result.deactivatedCoverages, coverageUpdates = result.coverageUpdates, relatedPersonUpdates = result.relatedPersonUpdates;
                (0, vitest_1.expect)(suggestedNewCoverageObject).toBeDefined();
                (0, vitest_1.expect)(suggestedNewCoverageObject === null || suggestedNewCoverageObject === void 0 ? void 0 : suggestedNewCoverageObject.length).toBe(2);
                (0, vitest_1.assert)(suggestedNewCoverageObject);
                (0, vitest_1.expect)(suggestedNewCoverageObject.find(function (c) { return c.priority === 1; })).toBeDefined();
                (0, vitest_1.expect)(suggestedNewCoverageObject.find(function (c) { return c.priority === 2; })).toBeDefined();
                (0, vitest_1.expect)(deactivatedCoverages).toBeDefined();
                (0, vitest_1.expect)(deactivatedCoverages === null || deactivatedCoverages === void 0 ? void 0 : deactivatedCoverages.length).toBe(0);
                (0, vitest_1.expect)(coverageUpdates).toBeDefined();
                (0, vitest_1.expect)(Object.keys(coverageUpdates).length).toBe(0);
                (0, vitest_1.expect)(relatedPersonUpdates).toBeDefined();
                // there can be entries with empty arrays here. the important thing is that the length of all actual operations is 0
                (0, vitest_1.expect)(Object.values(relatedPersonUpdates).flatMap(function (v) { return v; }).length).toBe(0);
            });
            (0, vitest_1.it)('should return no patches when subscribers match and existing value has data not found in input', function () {
                var existingSubscriber = __assign(__assign({}, primarySubscriber), { telecom: [
                        {
                            value: 'is.aol.still.cool@aol.com',
                            system: 'email',
                        },
                    ] });
                var existingCoverages = {
                    primary: primary,
                    primarySubscriber: existingSubscriber,
                };
                var result = (0, harvest_1.resolveCoverageUpdates)({ patient: newPatient1, existingCoverages: existingCoverages, newCoverages: coverages });
                var suggestedNewCoverageObject = result.suggestedNewCoverageObject, deactivatedCoverages = result.deactivatedCoverages, coverageUpdates = result.coverageUpdates, relatedPersonUpdates = result.relatedPersonUpdates;
                (0, vitest_1.expect)(suggestedNewCoverageObject).toBeDefined();
                (0, vitest_1.expect)(suggestedNewCoverageObject === null || suggestedNewCoverageObject === void 0 ? void 0 : suggestedNewCoverageObject.length).toBe(2);
                (0, vitest_1.expect)(deactivatedCoverages).toBeDefined();
                (0, vitest_1.expect)(deactivatedCoverages === null || deactivatedCoverages === void 0 ? void 0 : deactivatedCoverages.length).toBe(0);
                (0, vitest_1.expect)(coverageUpdates).toBeDefined();
                (0, vitest_1.expect)(Object.keys(coverageUpdates).length).toBe(0);
                (0, vitest_1.expect)(relatedPersonUpdates).toBeDefined();
                // there can be entries with empty arrays here. the important thing is that the length of all actual operations is 0
                (0, vitest_1.expect)(Object.values(relatedPersonUpdates).flatMap(function (v) { return v; }).length).toBe(0);
            });
            (0, vitest_1.it)('should return patches when subscribers match and existing value is changed by input', function () {
                var _a;
                var existingSubscriber = __assign(__assign({}, primarySubscriber), { relationship: [
                        {
                            coding: [
                                {
                                    system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
                                    code: 'parent',
                                    display: 'Parent',
                                },
                            ],
                        },
                    ] });
                var existingCoverages = {
                    primary: primary,
                    primarySubscriber: existingSubscriber,
                };
                var result = (0, harvest_1.resolveCoverageUpdates)({ patient: newPatient1, existingCoverages: existingCoverages, newCoverages: coverages });
                var suggestedNewCoverageObject = result.suggestedNewCoverageObject, deactivatedCoverages = result.deactivatedCoverages, coverageUpdates = result.coverageUpdates, relatedPersonUpdates = result.relatedPersonUpdates;
                (0, vitest_1.expect)(suggestedNewCoverageObject).toBeDefined();
                (0, vitest_1.expect)(suggestedNewCoverageObject === null || suggestedNewCoverageObject === void 0 ? void 0 : suggestedNewCoverageObject.length).toBe(2);
                (0, vitest_1.assert)(suggestedNewCoverageObject);
                (0, vitest_1.expect)(suggestedNewCoverageObject.find(function (c) { return c.priority === 1; })).toBeDefined();
                (0, vitest_1.expect)(suggestedNewCoverageObject.find(function (c) { return c.priority === 2; })).toBeDefined();
                (0, vitest_1.expect)(deactivatedCoverages).toBeDefined();
                (0, vitest_1.expect)(deactivatedCoverages === null || deactivatedCoverages === void 0 ? void 0 : deactivatedCoverages.length).toBe(0);
                (0, vitest_1.expect)(coverageUpdates).toBeDefined();
                (0, vitest_1.expect)(Object.keys(coverageUpdates).length).toBe(0);
                (0, vitest_1.expect)(relatedPersonUpdates).toBeDefined();
                (0, vitest_1.expect)(Object.values(relatedPersonUpdates).flatMap(function (v) { return v; }).length).toBe(1);
                var update = (_a = Object.values(relatedPersonUpdates)[0]) === null || _a === void 0 ? void 0 : _a[0];
                (0, vitest_1.assert)(update);
                (0, vitest_1.expect)(update.op).toBe('replace');
                (0, vitest_1.expect)(update.path).toBe('/relationship');
                (0, vitest_1.expect)(update.value).toEqual([
                    {
                        coding: [
                            {
                                system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
                                code: 'child',
                                display: 'Child',
                            },
                        ],
                    },
                ]);
            });
            (0, vitest_1.it)('should combine a new address rather than overwriting existing address when a new address is sent in input', function () {
                var _a;
                var existingSubscriber = __assign(__assign({}, primarySubscriber), { address: [
                        {
                            line: ['456 Bluegrass Lane', 'Suite 300'],
                            city: 'Lexington',
                            state: 'KY',
                            postalCode: '40507',
                        },
                    ] });
                var existingCoverages = {
                    primary: primary,
                    primarySubscriber: existingSubscriber,
                };
                var result = (0, harvest_1.resolveCoverageUpdates)({ patient: newPatient1, existingCoverages: existingCoverages, newCoverages: coverages });
                var suggestedNewCoverageObject = result.suggestedNewCoverageObject, deactivatedCoverages = result.deactivatedCoverages, coverageUpdates = result.coverageUpdates, relatedPersonUpdates = result.relatedPersonUpdates;
                (0, vitest_1.expect)(suggestedNewCoverageObject).toBeDefined();
                (0, vitest_1.assert)(suggestedNewCoverageObject);
                (0, vitest_1.expect)(suggestedNewCoverageObject.find(function (c) { return c.priority === 1; })).toBeDefined();
                (0, vitest_1.expect)(suggestedNewCoverageObject.find(function (c) { return c.priority === 2; })).toBeDefined();
                (0, vitest_1.expect)(suggestedNewCoverageObject === null || suggestedNewCoverageObject === void 0 ? void 0 : suggestedNewCoverageObject.length).toBe(2);
                (0, vitest_1.expect)(deactivatedCoverages).toBeDefined();
                (0, vitest_1.expect)(deactivatedCoverages === null || deactivatedCoverages === void 0 ? void 0 : deactivatedCoverages.length).toBe(0);
                (0, vitest_1.expect)(coverageUpdates).toBeDefined();
                (0, vitest_1.expect)(Object.keys(coverageUpdates).length).toBe(0);
                (0, vitest_1.expect)(relatedPersonUpdates).toBeDefined();
                (0, vitest_1.expect)(Object.values(relatedPersonUpdates).flatMap(function (v) { return v; }).length).toBe(1);
                var update = (_a = Object.values(relatedPersonUpdates)[0]) === null || _a === void 0 ? void 0 : _a[0];
                (0, vitest_1.assert)(update);
                (0, vitest_1.expect)(update.op).toBe('replace');
                (0, vitest_1.expect)(update.path).toBe('/address');
                (0, vitest_1.expect)(update.value).toEqual([
                    {
                        line: ['317 Mustard Street', 'Unit 2'],
                        city: 'DeliciousVilla',
                        state: 'DE',
                        postalCode: '20001',
                    },
                    {
                        line: ['456 Bluegrass Lane', 'Suite 300'],
                        city: 'Lexington',
                        state: 'KY',
                        postalCode: '40507',
                    },
                ]);
            });
            (0, vitest_1.it)('should use a new contained RelatedPerson on Coverage when matching data differs between old and new subscriber, but coverage should be reused if it already exists', function () {
                var _a;
                var existingSubscriber = __assign(__assign({}, primarySubscriber), { birthDate: '1999-09-09' });
                var existingCoverages = {
                    primary: primary,
                    primarySubscriber: existingSubscriber,
                };
                var result = (0, harvest_1.resolveCoverageUpdates)({ patient: newPatient1, existingCoverages: existingCoverages, newCoverages: coverages });
                var suggestedNewCoverageObject = result.suggestedNewCoverageObject, deactivatedCoverages = result.deactivatedCoverages, coverageUpdates = result.coverageUpdates, relatedPersonUpdates = result.relatedPersonUpdates;
                (0, vitest_1.expect)(suggestedNewCoverageObject).toBeDefined();
                (0, vitest_1.assert)(suggestedNewCoverageObject);
                (0, vitest_1.expect)(suggestedNewCoverageObject.find(function (c) { return c.priority === 1; })).toBeDefined();
                (0, vitest_1.expect)(suggestedNewCoverageObject.find(function (c) { return c.priority === 2; })).toBeDefined();
                (0, vitest_1.expect)(suggestedNewCoverageObject === null || suggestedNewCoverageObject === void 0 ? void 0 : suggestedNewCoverageObject.length).toBe(2);
                (0, vitest_1.expect)(deactivatedCoverages).toBeDefined();
                (0, vitest_1.expect)(deactivatedCoverages === null || deactivatedCoverages === void 0 ? void 0 : deactivatedCoverages.length).toBe(0);
                (0, vitest_1.expect)(coverageUpdates).toBeDefined();
                (0, vitest_1.expect)(Object.keys(coverageUpdates).length).toBe(1);
                (0, vitest_1.expect)(relatedPersonUpdates).toBeDefined();
                (0, vitest_1.expect)(Object.values(relatedPersonUpdates).flatMap(function (v) { return v; }).length).toBe(0);
                (0, vitest_1.expect)(Object.values(coverageUpdates).flatMap(function (v) { return v; }).length).toBe(2);
                var coverageUpdate1 = Object.values(coverageUpdates).flatMap(function (v) { return v; })[0];
                var coverageUpdate2 = Object.values(coverageUpdates).flatMap(function (v) { return v; })[1];
                (0, vitest_1.assert)(coverageUpdate1);
                (0, vitest_1.assert)(coverageUpdate2);
                (0, vitest_1.expect)(coverageUpdate1.op).toBe('add');
                (0, vitest_1.expect)(coverageUpdate1.path).toBe('/contained');
                (0, vitest_1.expect)(coverageUpdate1.value).toEqual([expectedPrimaryPolicyHolderFromQR1]);
                (0, vitest_1.expect)(coverageUpdate2.op).toBe('replace');
                (0, vitest_1.expect)(coverageUpdate2.path).toBe('/subscriber');
                (0, vitest_1.expect)(coverageUpdate2.value).toEqual({
                    reference: "#".concat(expectedPrimaryPolicyHolderFromQR1.id),
                });
                (0, vitest_1.expect)(suggestedNewCoverageObject === null || suggestedNewCoverageObject === void 0 ? void 0 : suggestedNewCoverageObject[0].coverage).toBeDefined();
                (0, vitest_1.expect)(suggestedNewCoverageObject === null || suggestedNewCoverageObject === void 0 ? void 0 : suggestedNewCoverageObject[1].coverage).toBeDefined();
                var newPrimaryCoverage = suggestedNewCoverageObject === null || suggestedNewCoverageObject === void 0 ? void 0 : suggestedNewCoverageObject[0].coverage;
                var newSecondaryCoverage = suggestedNewCoverageObject === null || suggestedNewCoverageObject === void 0 ? void 0 : suggestedNewCoverageObject[1].coverage;
                (0, vitest_1.assert)(newPrimaryCoverage);
                (0, vitest_1.assert)(newSecondaryCoverage);
                (0, vitest_1.expect)(newPrimaryCoverage.reference).toBe("Coverage/".concat(existingCoverages.primary.id));
                (0, vitest_1.expect)(newSecondaryCoverage.reference).toBe("".concat((_a = coverages.secondary) === null || _a === void 0 ? void 0 : _a.id));
            });
        });
        (0, vitest_1.describe)('should generate the right output when comparing Account against existing secondary coverage', function () {
            (0, vitest_1.it)('should return no patches when subscriber and coverage match new values exactly', function () {
                var existingCoverages = {
                    secondary: secondary,
                    secondarySubscriber: secondarySubscriber,
                };
                var result = (0, harvest_1.resolveCoverageUpdates)({ patient: newPatient1, existingCoverages: existingCoverages, newCoverages: coverages });
                var suggestedNewCoverageObject = result.suggestedNewCoverageObject, deactivatedCoverages = result.deactivatedCoverages, coverageUpdates = result.coverageUpdates, relatedPersonUpdates = result.relatedPersonUpdates;
                (0, vitest_1.expect)(suggestedNewCoverageObject).toBeDefined();
                (0, vitest_1.assert)(suggestedNewCoverageObject);
                (0, vitest_1.expect)(suggestedNewCoverageObject.find(function (c) { return c.priority === 1; })).toBeDefined();
                (0, vitest_1.expect)(suggestedNewCoverageObject.find(function (c) { return c.priority === 2; })).toBeDefined();
                (0, vitest_1.expect)(suggestedNewCoverageObject === null || suggestedNewCoverageObject === void 0 ? void 0 : suggestedNewCoverageObject.length).toBe(2);
                (0, vitest_1.expect)(deactivatedCoverages).toBeDefined();
                (0, vitest_1.expect)(deactivatedCoverages === null || deactivatedCoverages === void 0 ? void 0 : deactivatedCoverages.length).toBe(0);
                (0, vitest_1.expect)(coverageUpdates).toBeDefined();
                (0, vitest_1.expect)(Object.keys(coverageUpdates).length).toBe(0);
                (0, vitest_1.expect)(relatedPersonUpdates).toBeDefined();
                // there can be entries with empty arrays here. the important thing is that the length of all actual operations is 0
                (0, vitest_1.expect)(Object.values(relatedPersonUpdates).flatMap(function (v) { return v; }).length).toBe(0);
            });
            (0, vitest_1.it)('should return no patches when subscribers match and existing value has data not found in input', function () {
                var existingSubscriber = __assign(__assign({}, secondarySubscriber), { telecom: [
                        {
                            value: 'is_aol_still_cool@aol.com',
                            system: 'email',
                        },
                    ] });
                var existingCoverages = {
                    secondary: secondary,
                    secondarySubscriber: existingSubscriber,
                };
                var result = (0, harvest_1.resolveCoverageUpdates)({ patient: newPatient1, existingCoverages: existingCoverages, newCoverages: coverages });
                var suggestedNewCoverageObject = result.suggestedNewCoverageObject, deactivatedCoverages = result.deactivatedCoverages, coverageUpdates = result.coverageUpdates, relatedPersonUpdates = result.relatedPersonUpdates;
                (0, vitest_1.expect)(suggestedNewCoverageObject).toBeDefined();
                (0, vitest_1.assert)(suggestedNewCoverageObject);
                (0, vitest_1.expect)(suggestedNewCoverageObject.find(function (c) { return c.priority === 1; })).toBeDefined();
                (0, vitest_1.expect)(suggestedNewCoverageObject.find(function (c) { return c.priority === 2; })).toBeDefined();
                (0, vitest_1.expect)(suggestedNewCoverageObject === null || suggestedNewCoverageObject === void 0 ? void 0 : suggestedNewCoverageObject.length).toBe(2);
                (0, vitest_1.expect)(deactivatedCoverages).toBeDefined();
                (0, vitest_1.expect)(deactivatedCoverages === null || deactivatedCoverages === void 0 ? void 0 : deactivatedCoverages.length).toBe(0);
                (0, vitest_1.expect)(coverageUpdates).toBeDefined();
                (0, vitest_1.expect)(Object.keys(coverageUpdates).length).toBe(0);
                (0, vitest_1.expect)(relatedPersonUpdates).toBeDefined();
                // there can be entries with empty arrays here. the important thing is that the length of all actual operations is 0
                (0, vitest_1.expect)(Object.values(relatedPersonUpdates).flatMap(function (v) { return v; }).length).toBe(0);
            });
            (0, vitest_1.it)('should return patches when subscribers match and existing value is changed by input', function () {
                var _a;
                var existingSubscriber = __assign(__assign({}, secondarySubscriber), { relationship: [
                        {
                            coding: [
                                {
                                    system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
                                    code: 'spouse',
                                    display: 'Spouse',
                                },
                            ],
                        },
                    ] });
                var existingCoverages = {
                    secondary: secondary,
                    secondarySubscriber: existingSubscriber,
                };
                var result = (0, harvest_1.resolveCoverageUpdates)({ patient: newPatient1, existingCoverages: existingCoverages, newCoverages: coverages });
                var suggestedNewCoverageObject = result.suggestedNewCoverageObject, deactivatedCoverages = result.deactivatedCoverages, coverageUpdates = result.coverageUpdates, relatedPersonUpdates = result.relatedPersonUpdates;
                (0, vitest_1.expect)(suggestedNewCoverageObject).toBeDefined();
                (0, vitest_1.assert)(suggestedNewCoverageObject);
                (0, vitest_1.expect)(suggestedNewCoverageObject.find(function (c) { return c.priority === 1; })).toBeDefined();
                (0, vitest_1.expect)(suggestedNewCoverageObject.find(function (c) { return c.priority === 2; })).toBeDefined();
                (0, vitest_1.expect)(suggestedNewCoverageObject === null || suggestedNewCoverageObject === void 0 ? void 0 : suggestedNewCoverageObject.length).toBe(2);
                (0, vitest_1.expect)(deactivatedCoverages).toBeDefined();
                (0, vitest_1.expect)(deactivatedCoverages === null || deactivatedCoverages === void 0 ? void 0 : deactivatedCoverages.length).toBe(0);
                (0, vitest_1.expect)(coverageUpdates).toBeDefined();
                (0, vitest_1.expect)(Object.keys(coverageUpdates).length).toBe(0);
                (0, vitest_1.expect)(relatedPersonUpdates).toBeDefined();
                (0, vitest_1.expect)(Object.values(relatedPersonUpdates).flatMap(function (v) { return v; }).length).toBe(1);
                var update = (_a = Object.values(relatedPersonUpdates)[0]) === null || _a === void 0 ? void 0 : _a[0];
                (0, vitest_1.assert)(update);
                (0, vitest_1.expect)(update.op).toBe('replace');
                (0, vitest_1.expect)(update.path).toBe('/relationship');
                (0, vitest_1.expect)(update.value).toEqual([
                    {
                        coding: [
                            {
                                system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
                                code: 'child',
                                display: 'Child',
                            },
                        ],
                    },
                ]);
            });
            (0, vitest_1.it)('should combine a new address rather than overwriting existing address when a new address is sent in input', function () {
                var _a;
                var existingSubscriber = __assign(__assign({}, secondarySubscriber), { address: [
                        {
                            line: ['456 Bluegrass Lane', 'Suite 300'],
                            city: 'Lexington',
                            state: 'KY',
                            postalCode: '40507',
                        },
                    ] });
                var existingCoverages = {
                    secondary: secondary,
                    secondarySubscriber: existingSubscriber,
                };
                var result = (0, harvest_1.resolveCoverageUpdates)({ patient: newPatient1, existingCoverages: existingCoverages, newCoverages: coverages });
                var suggestedNewCoverageObject = result.suggestedNewCoverageObject, deactivatedCoverages = result.deactivatedCoverages, coverageUpdates = result.coverageUpdates, relatedPersonUpdates = result.relatedPersonUpdates;
                (0, vitest_1.expect)(suggestedNewCoverageObject).toBeDefined();
                (0, vitest_1.assert)(suggestedNewCoverageObject);
                (0, vitest_1.expect)(suggestedNewCoverageObject.find(function (c) { return c.priority === 1; })).toBeDefined();
                (0, vitest_1.expect)(suggestedNewCoverageObject.find(function (c) { return c.priority === 2; })).toBeDefined();
                (0, vitest_1.expect)(suggestedNewCoverageObject === null || suggestedNewCoverageObject === void 0 ? void 0 : suggestedNewCoverageObject.length).toBe(2);
                (0, vitest_1.expect)(deactivatedCoverages).toBeDefined();
                (0, vitest_1.expect)(deactivatedCoverages === null || deactivatedCoverages === void 0 ? void 0 : deactivatedCoverages.length).toBe(0);
                (0, vitest_1.expect)(coverageUpdates).toBeDefined();
                (0, vitest_1.expect)(Object.keys(coverageUpdates).length).toBe(0);
                (0, vitest_1.expect)(relatedPersonUpdates).toBeDefined();
                (0, vitest_1.expect)(Object.values(relatedPersonUpdates).flatMap(function (v) { return v; }).length).toBe(1);
                var update = (_a = Object.values(relatedPersonUpdates)[0]) === null || _a === void 0 ? void 0 : _a[0];
                (0, vitest_1.assert)(update);
                (0, vitest_1.expect)(update.op).toBe('replace');
                (0, vitest_1.expect)(update.path).toBe('/address');
                (0, vitest_1.expect)(update.value).toEqual([
                    {
                        line: ['317 R St NW Unit 2', 'conditional-filter-test-1234'],
                        city: 'Washington',
                        state: 'DC',
                        postalCode: '20001',
                    },
                    {
                        line: ['456 Bluegrass Lane', 'Suite 300'],
                        city: 'Lexington',
                        state: 'KY',
                        postalCode: '40507',
                    },
                ]);
            });
            (0, vitest_1.it)('should use a new contained RelatedPerson on Coverage when matching data differs between old and new subscriber, but coverage should be reused if it already exists', function () {
                var existingSubscriber = __assign(__assign({}, secondarySubscriber), { birthDate: '1999-09-09' });
                var existingCoverages = {
                    secondary: secondary,
                    secondarySubscriber: existingSubscriber,
                };
                var result = (0, harvest_1.resolveCoverageUpdates)({ patient: newPatient1, existingCoverages: existingCoverages, newCoverages: coverages });
                var suggestedNewCoverageObject = result.suggestedNewCoverageObject, deactivatedCoverages = result.deactivatedCoverages, coverageUpdates = result.coverageUpdates, relatedPersonUpdates = result.relatedPersonUpdates;
                (0, vitest_1.expect)(suggestedNewCoverageObject).toBeDefined();
                (0, vitest_1.assert)(suggestedNewCoverageObject);
                (0, vitest_1.expect)(suggestedNewCoverageObject.find(function (c) { return c.priority === 1; })).toBeDefined();
                (0, vitest_1.expect)(suggestedNewCoverageObject.find(function (c) { return c.priority === 2; })).toBeDefined();
                (0, vitest_1.expect)(suggestedNewCoverageObject === null || suggestedNewCoverageObject === void 0 ? void 0 : suggestedNewCoverageObject.length).toBe(2);
                (0, vitest_1.expect)(deactivatedCoverages).toBeDefined();
                (0, vitest_1.expect)(deactivatedCoverages === null || deactivatedCoverages === void 0 ? void 0 : deactivatedCoverages.length).toBe(0);
                (0, vitest_1.expect)(coverageUpdates).toBeDefined();
                (0, vitest_1.expect)(Object.keys(coverageUpdates).length).toBe(1);
                (0, vitest_1.expect)(relatedPersonUpdates).toBeDefined();
                (0, vitest_1.expect)(Object.values(relatedPersonUpdates).flatMap(function (v) { return v; }).length).toBe(0);
                (0, vitest_1.expect)(Object.values(coverageUpdates).flatMap(function (v) { return v; }).length).toBe(2);
                var coverageUpdate1 = Object.values(coverageUpdates).flatMap(function (v) { return v; })[0];
                var coverageUpdate2 = Object.values(coverageUpdates).flatMap(function (v) { return v; })[1];
                (0, vitest_1.assert)(coverageUpdate1);
                (0, vitest_1.assert)(coverageUpdate2);
                (0, vitest_1.expect)(coverageUpdate1.op).toBe('add');
                (0, vitest_1.expect)(coverageUpdate1.path).toBe('/contained');
                (0, vitest_1.expect)(coverageUpdate1.value).toEqual([expectedSecondaryPolicyHolderFromQR1]);
                (0, vitest_1.expect)(coverageUpdate2.op).toBe('replace');
                (0, vitest_1.expect)(coverageUpdate2.path).toBe('/subscriber');
                (0, vitest_1.expect)(coverageUpdate2.value).toEqual({
                    reference: "#".concat(expectedSecondaryPolicyHolderFromQR1.id),
                });
            });
        });
        (0, vitest_1.describe)('should generate the right output when comparing Account against existing primary and secondary coverage', function () {
            (0, vitest_1.it)('should return no patches when subscribers and coverage match new values exactly', function () {
                var existingCoverages = {
                    primary: primary,
                    primarySubscriber: primarySubscriber,
                    secondary: secondary,
                    secondarySubscriber: secondarySubscriber,
                };
                var result = (0, harvest_1.resolveCoverageUpdates)({ patient: newPatient1, existingCoverages: existingCoverages, newCoverages: coverages });
                var suggestedNewCoverageObject = result.suggestedNewCoverageObject, deactivatedCoverages = result.deactivatedCoverages, coverageUpdates = result.coverageUpdates, relatedPersonUpdates = result.relatedPersonUpdates;
                (0, vitest_1.expect)(suggestedNewCoverageObject).toBeDefined();
                (0, vitest_1.assert)(suggestedNewCoverageObject);
                (0, vitest_1.expect)(suggestedNewCoverageObject.find(function (c) { return c.priority === 1; })).toBeDefined();
                (0, vitest_1.expect)(suggestedNewCoverageObject.find(function (c) { return c.priority === 2; })).toBeDefined();
                (0, vitest_1.expect)(suggestedNewCoverageObject === null || suggestedNewCoverageObject === void 0 ? void 0 : suggestedNewCoverageObject.length).toBe(2);
                (0, vitest_1.expect)(deactivatedCoverages).toBeDefined();
                (0, vitest_1.expect)(deactivatedCoverages === null || deactivatedCoverages === void 0 ? void 0 : deactivatedCoverages.length).toBe(0);
                (0, vitest_1.expect)(coverageUpdates).toBeDefined();
                (0, vitest_1.expect)(Object.keys(coverageUpdates).length).toBe(0);
                (0, vitest_1.expect)(relatedPersonUpdates).toBeDefined();
                // there can be entries with empty arrays here. the important thing is that the length of all actual operations is 0
                (0, vitest_1.expect)(Object.values(relatedPersonUpdates).flatMap(function (v) { return v; }).length).toBe(0);
            });
            (0, vitest_1.it)('should return no patches when subscribers match and existing value has data not found in input', function () {
                var existingPrimarySubscriber = __assign(__assign({}, primarySubscriber), { telecom: [
                        {
                            value: 'is_hotmail_in_still@hotmail.com',
                            system: 'email',
                        },
                    ] });
                var existingSecondarySubscriber = __assign(__assign({}, secondarySubscriber), { telecom: [
                        {
                            value: 'im_cooler_than_all_my_boomer_friends@yahoo.com',
                            system: 'email',
                        },
                    ] });
                var existingCoverages = {
                    primary: primary,
                    primarySubscriber: existingPrimarySubscriber,
                    secondary: secondary,
                    secondarySubscriber: existingSecondarySubscriber,
                };
                var result = (0, harvest_1.resolveCoverageUpdates)({ patient: newPatient1, existingCoverages: existingCoverages, newCoverages: coverages });
                var suggestedNewCoverageObject = result.suggestedNewCoverageObject, deactivatedCoverages = result.deactivatedCoverages, coverageUpdates = result.coverageUpdates, relatedPersonUpdates = result.relatedPersonUpdates;
                (0, vitest_1.expect)(suggestedNewCoverageObject).toBeDefined();
                (0, vitest_1.assert)(suggestedNewCoverageObject);
                (0, vitest_1.expect)(suggestedNewCoverageObject.find(function (c) { return c.priority === 1; })).toBeDefined();
                (0, vitest_1.expect)(suggestedNewCoverageObject.find(function (c) { return c.priority === 2; })).toBeDefined();
                (0, vitest_1.expect)(suggestedNewCoverageObject === null || suggestedNewCoverageObject === void 0 ? void 0 : suggestedNewCoverageObject.length).toBe(2);
                (0, vitest_1.expect)(deactivatedCoverages).toBeDefined();
                (0, vitest_1.expect)(deactivatedCoverages === null || deactivatedCoverages === void 0 ? void 0 : deactivatedCoverages.length).toBe(0);
                (0, vitest_1.expect)(coverageUpdates).toBeDefined();
                (0, vitest_1.expect)(Object.keys(coverageUpdates).length).toBe(0);
                (0, vitest_1.expect)(relatedPersonUpdates).toBeDefined();
                // there can be entries with empty arrays here. the important thing is that the length of all actual operations is 0
                (0, vitest_1.expect)(Object.values(relatedPersonUpdates).flatMap(function (v) { return v; }).length).toBe(0);
            });
            (0, vitest_1.it)('should return patches when subscribers match and existing value is changed by input', function () {
                var _a, _b, _c, _d, _e, _f;
                var existingPrimarySubscriber = __assign(__assign({}, primarySubscriber), { relationship: [
                        {
                            coding: [
                                {
                                    system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
                                    code: 'parent',
                                    display: 'Parent',
                                },
                            ],
                        },
                    ] });
                var existingSecondarySubscriber = __assign(__assign({}, secondarySubscriber), { relationship: [
                        {
                            coding: [
                                {
                                    system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
                                    code: 'parent',
                                    display: 'Parent',
                                },
                            ],
                        },
                    ] });
                var existingCoverages = {
                    primary: primary,
                    primarySubscriber: existingPrimarySubscriber,
                    secondary: secondary,
                    secondarySubscriber: existingSecondarySubscriber,
                };
                var result = (0, harvest_1.resolveCoverageUpdates)({ patient: newPatient1, existingCoverages: existingCoverages, newCoverages: coverages });
                var suggestedNewCoverageObject = result.suggestedNewCoverageObject, deactivatedCoverages = result.deactivatedCoverages, coverageUpdates = result.coverageUpdates, relatedPersonUpdates = result.relatedPersonUpdates;
                (0, vitest_1.expect)(suggestedNewCoverageObject).toBeDefined();
                (0, vitest_1.expect)(suggestedNewCoverageObject === null || suggestedNewCoverageObject === void 0 ? void 0 : suggestedNewCoverageObject.length).toBe(2);
                (0, vitest_1.assert)(suggestedNewCoverageObject);
                var primaryCoverageObject = suggestedNewCoverageObject.find(function (c) { return c.priority === 1; });
                (0, vitest_1.expect)(primaryCoverageObject).toBeDefined();
                var secondaryCoverageObject = suggestedNewCoverageObject.find(function (c) { return c.priority === 2; });
                (0, vitest_1.expect)(secondaryCoverageObject).toBeDefined();
                (0, vitest_1.expect)((_a = primaryCoverageObject === null || primaryCoverageObject === void 0 ? void 0 : primaryCoverageObject.coverage) === null || _a === void 0 ? void 0 : _a.reference).toBeDefined();
                (0, vitest_1.expect)((_b = secondaryCoverageObject === null || secondaryCoverageObject === void 0 ? void 0 : secondaryCoverageObject.coverage) === null || _b === void 0 ? void 0 : _b.reference).toBeDefined();
                (0, vitest_1.expect)((_c = primaryCoverageObject === null || primaryCoverageObject === void 0 ? void 0 : primaryCoverageObject.coverage) === null || _c === void 0 ? void 0 : _c.reference).toBe("Coverage/".concat(existingCoverages.primary.id));
                (0, vitest_1.expect)((_d = secondaryCoverageObject === null || secondaryCoverageObject === void 0 ? void 0 : secondaryCoverageObject.coverage) === null || _d === void 0 ? void 0 : _d.reference).toBe("Coverage/".concat(existingCoverages.secondary.id));
                (0, vitest_1.expect)(deactivatedCoverages).toBeDefined();
                (0, vitest_1.expect)(deactivatedCoverages).toBeDefined();
                (0, vitest_1.expect)(deactivatedCoverages === null || deactivatedCoverages === void 0 ? void 0 : deactivatedCoverages.length).toBe(0);
                (0, vitest_1.expect)(coverageUpdates).toBeDefined();
                (0, vitest_1.expect)(Object.keys(coverageUpdates).length).toBe(0);
                (0, vitest_1.expect)(relatedPersonUpdates).toBeDefined();
                (0, vitest_1.expect)(Object.keys(relatedPersonUpdates).length).toBe(2);
                (0, vitest_1.expect)(Object.values(relatedPersonUpdates).flatMap(function (v) { return v; }).length).toBe(2);
                var update1 = (_e = Object.values(relatedPersonUpdates)[0]) === null || _e === void 0 ? void 0 : _e[0];
                var update2 = (_f = Object.values(relatedPersonUpdates)[1]) === null || _f === void 0 ? void 0 : _f[0];
                (0, vitest_1.assert)(update1);
                (0, vitest_1.assert)(update2);
                (0, vitest_1.expect)(update1.op).toBe('replace');
                (0, vitest_1.expect)(update1.path).toBe('/relationship');
                (0, vitest_1.expect)(update1.value).toEqual([
                    {
                        coding: [
                            {
                                system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
                                code: 'child',
                                display: 'Child',
                            },
                        ],
                    },
                ]);
                (0, vitest_1.expect)(update2.op).toBe('replace');
                (0, vitest_1.expect)(update2.path).toBe('/relationship');
                (0, vitest_1.expect)(update2.value).toEqual([
                    {
                        coding: [
                            {
                                system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
                                code: 'child',
                                display: 'Child',
                            },
                        ],
                    },
                ]);
            });
            (0, vitest_1.it)('should combine a new address rather than overwriting existing address when a new address is sent in input', function () {
                var _a, _b;
                var existingPrimarySubscriber = __assign(__assign({}, primarySubscriber), { address: [
                        {
                            line: ['456 Bluegrass Lane', 'Suite 300'],
                            city: 'Lexington',
                            state: 'KY',
                            postalCode: '40507',
                        },
                    ] });
                var existingSecondarySubscriber = __assign(__assign({}, secondarySubscriber), { address: [
                        {
                            line: ['789 Potato Lane', 'Suite 300'],
                            city: 'Boise',
                            state: 'ID',
                            postalCode: '83701',
                        },
                    ] });
                var existingCoverages = {
                    primary: primary,
                    primarySubscriber: existingPrimarySubscriber,
                    secondary: secondary,
                    secondarySubscriber: existingSecondarySubscriber,
                };
                var result = (0, harvest_1.resolveCoverageUpdates)({ patient: newPatient1, existingCoverages: existingCoverages, newCoverages: coverages });
                var suggestedNewCoverageObject = result.suggestedNewCoverageObject, deactivatedCoverages = result.deactivatedCoverages, coverageUpdates = result.coverageUpdates, relatedPersonUpdates = result.relatedPersonUpdates;
                (0, vitest_1.expect)(suggestedNewCoverageObject).toBeDefined();
                (0, vitest_1.assert)(suggestedNewCoverageObject);
                (0, vitest_1.expect)(suggestedNewCoverageObject.find(function (c) { return c.priority === 1; })).toBeDefined();
                (0, vitest_1.expect)(suggestedNewCoverageObject.find(function (c) { return c.priority === 2; })).toBeDefined();
                (0, vitest_1.expect)(suggestedNewCoverageObject === null || suggestedNewCoverageObject === void 0 ? void 0 : suggestedNewCoverageObject.length).toBe(2);
                (0, vitest_1.expect)(deactivatedCoverages).toBeDefined();
                (0, vitest_1.expect)(deactivatedCoverages === null || deactivatedCoverages === void 0 ? void 0 : deactivatedCoverages.length).toBe(0);
                (0, vitest_1.expect)(coverageUpdates).toBeDefined();
                (0, vitest_1.expect)(Object.keys(coverageUpdates).length).toBe(0);
                (0, vitest_1.expect)(relatedPersonUpdates).toBeDefined();
                (0, vitest_1.expect)(Object.values(relatedPersonUpdates).flatMap(function (v) { return v; }).length).toBe(2);
                var update1 = (_a = Object.values(relatedPersonUpdates)[0]) === null || _a === void 0 ? void 0 : _a[0];
                var update2 = (_b = Object.values(relatedPersonUpdates)[1]) === null || _b === void 0 ? void 0 : _b[0];
                (0, vitest_1.assert)(update1);
                (0, vitest_1.assert)(update2);
                (0, vitest_1.expect)(update1.op).toBe('replace');
                (0, vitest_1.expect)(update1.path).toBe('/address');
                (0, vitest_1.expect)(update1.value).toEqual([
                    {
                        line: ['317 Mustard Street', 'Unit 2'],
                        city: 'DeliciousVilla',
                        state: 'DE',
                        postalCode: '20001',
                    },
                    {
                        line: ['456 Bluegrass Lane', 'Suite 300'],
                        city: 'Lexington',
                        state: 'KY',
                        postalCode: '40507',
                    },
                ]);
                (0, vitest_1.expect)(update2.op).toBe('replace');
                (0, vitest_1.expect)(update2.path).toBe('/address');
                (0, vitest_1.expect)(update2.value).toEqual([
                    {
                        line: ['317 R St NW Unit 2', 'conditional-filter-test-1234'],
                        city: 'Washington',
                        state: 'DC',
                        postalCode: '20001',
                    },
                    {
                        line: ['789 Potato Lane', 'Suite 300'],
                        city: 'Boise',
                        state: 'ID',
                        postalCode: '83701',
                    },
                ]);
            });
            (0, vitest_1.it)('should use a new contained RelatedPerson on Coverage when matching data differs between old and new subscriber, but coverage should be reused if it already exists', function () {
                var existingPrimarySubscriber = __assign(__assign({}, primarySubscriber), { birthDate: '1999-09-09' });
                var existingSecondarySubscriber = __assign(__assign({}, secondarySubscriber), { birthDate: '1999-09-09' });
                var existingCoverages = {
                    primary: primary,
                    primarySubscriber: existingPrimarySubscriber,
                    secondary: secondary,
                    secondarySubscriber: existingSecondarySubscriber,
                };
                var result = (0, harvest_1.resolveCoverageUpdates)({ patient: newPatient1, existingCoverages: existingCoverages, newCoverages: coverages });
                var suggestedNewCoverageObject = result.suggestedNewCoverageObject, deactivatedCoverages = result.deactivatedCoverages, coverageUpdates = result.coverageUpdates, relatedPersonUpdates = result.relatedPersonUpdates;
                (0, vitest_1.expect)(suggestedNewCoverageObject).toBeDefined();
                (0, vitest_1.assert)(suggestedNewCoverageObject);
                (0, vitest_1.expect)(suggestedNewCoverageObject.find(function (c) { return c.priority === 1; })).toBeDefined();
                (0, vitest_1.expect)(suggestedNewCoverageObject.find(function (c) { return c.priority === 2; })).toBeDefined();
                (0, vitest_1.expect)(suggestedNewCoverageObject === null || suggestedNewCoverageObject === void 0 ? void 0 : suggestedNewCoverageObject.length).toBe(2);
                (0, vitest_1.expect)(deactivatedCoverages).toBeDefined();
                (0, vitest_1.expect)(deactivatedCoverages === null || deactivatedCoverages === void 0 ? void 0 : deactivatedCoverages.length).toBe(0);
                (0, vitest_1.expect)(coverageUpdates).toBeDefined();
                (0, vitest_1.expect)(Object.keys(coverageUpdates).length).toBe(2);
                (0, vitest_1.expect)(relatedPersonUpdates).toBeDefined();
                (0, vitest_1.expect)(Object.values(relatedPersonUpdates).flatMap(function (v) { return v; }).length).toBe(0);
                (0, vitest_1.expect)(Object.values(coverageUpdates).flatMap(function (v) { return v; }).length).toBe(4);
            });
            (0, vitest_1.it)('should use a new contained RelatedPerson on Coverage when matching data differs between old and new subscriber, but coverage should be reused if it already exists', function () {
                var _a, _b;
                var existingPrimarySubscriber = __assign(__assign({}, primarySubscriber), { birthDate: '1999-09-09' });
                var existingSecondarySubscriber = __assign(__assign({}, secondarySubscriber), { birthDate: '1999-07-08' });
                var existingCoverages = {
                    primary: primary,
                    primarySubscriber: existingPrimarySubscriber,
                    secondary: secondary,
                    secondarySubscriber: existingSecondarySubscriber,
                };
                var result = (0, harvest_1.resolveCoverageUpdates)({ patient: newPatient1, existingCoverages: existingCoverages, newCoverages: coverages });
                var suggestedNewCoverageObject = result.suggestedNewCoverageObject, deactivatedCoverages = result.deactivatedCoverages, coverageUpdates = result.coverageUpdates, relatedPersonUpdates = result.relatedPersonUpdates;
                (0, vitest_1.expect)(suggestedNewCoverageObject).toBeDefined();
                (0, vitest_1.assert)(suggestedNewCoverageObject);
                (0, vitest_1.expect)(suggestedNewCoverageObject.find(function (c) { return c.priority === 1; })).toBeDefined();
                (0, vitest_1.expect)(suggestedNewCoverageObject.find(function (c) { return c.priority === 2; })).toBeDefined();
                (0, vitest_1.expect)(suggestedNewCoverageObject === null || suggestedNewCoverageObject === void 0 ? void 0 : suggestedNewCoverageObject.length).toBe(2);
                (0, vitest_1.expect)(deactivatedCoverages).toBeDefined();
                (0, vitest_1.expect)(deactivatedCoverages === null || deactivatedCoverages === void 0 ? void 0 : deactivatedCoverages.length).toBe(0);
                (0, vitest_1.expect)(coverageUpdates).toBeDefined();
                (0, vitest_1.expect)(Object.keys(coverageUpdates).length).toBe(2);
                (0, vitest_1.expect)(relatedPersonUpdates).toBeDefined();
                (0, vitest_1.expect)(Object.values(relatedPersonUpdates).flatMap(function (v) { return v; }).length).toBe(0);
                (0, vitest_1.expect)(Object.values(coverageUpdates).flatMap(function (v) { return v; }).length).toBe(4);
                var coverageUpdateList = Object.values(coverageUpdates).flatMap(function (v) { return v; });
                var coverageUpdate1 = coverageUpdateList[0];
                var coverageUpdate2 = coverageUpdateList[1];
                var coverageUpdate3 = coverageUpdateList[2];
                var coverageUpdate4 = coverageUpdateList[3];
                (0, vitest_1.assert)(coverageUpdate1);
                (0, vitest_1.assert)(coverageUpdate2);
                (0, vitest_1.assert)(coverageUpdate3);
                (0, vitest_1.assert)(coverageUpdate4);
                (0, vitest_1.expect)(coverageUpdate1.op).toBe('add');
                (0, vitest_1.expect)(coverageUpdate1.path).toBe('/contained');
                (0, vitest_1.expect)(coverageUpdate1.value).toEqual([expectedPrimaryPolicyHolderFromQR1]);
                (0, vitest_1.expect)(coverageUpdate2.op).toBe('replace');
                (0, vitest_1.expect)(coverageUpdate2.path).toBe('/subscriber');
                (0, vitest_1.expect)(coverageUpdate2.value).toEqual({
                    reference: "#".concat(expectedPrimaryPolicyHolderFromQR1.id),
                });
                (0, vitest_1.expect)(coverageUpdate3.op).toBe('add');
                (0, vitest_1.expect)(coverageUpdate3.path).toBe('/contained');
                (0, vitest_1.expect)(coverageUpdate3.value).toEqual([expectedSecondaryPolicyHolderFromQR1]);
                (0, vitest_1.expect)(coverageUpdate4.op).toBe('replace');
                (0, vitest_1.expect)(coverageUpdate4.path).toBe('/subscriber');
                (0, vitest_1.expect)(coverageUpdate4.value).toEqual({
                    reference: "#".concat(expectedSecondaryPolicyHolderFromQR1.id),
                });
                var newPrimaryCoverage = (_a = suggestedNewCoverageObject.find(function (c) { return c.priority === 1; })) === null || _a === void 0 ? void 0 : _a.coverage;
                var newSecondaryCoverage = (_b = suggestedNewCoverageObject.find(function (c) { return c.priority === 2; })) === null || _b === void 0 ? void 0 : _b.coverage;
                (0, vitest_1.assert)(newPrimaryCoverage);
                (0, vitest_1.assert)(newSecondaryCoverage);
                (0, vitest_1.expect)(newPrimaryCoverage === null || newPrimaryCoverage === void 0 ? void 0 : newPrimaryCoverage.reference).toBe("Coverage/".concat(existingCoverages.primary.id));
                (0, vitest_1.expect)(newSecondaryCoverage.reference).toBe("Coverage/".concat(existingCoverages.secondary.id));
            });
        });
        (0, vitest_1.describe)('should generate the right output when comparing Account with existing primary and secondary coverages flip-flopped', function () {
            (0, vitest_1.it)('should return no patches when subscribers and coverage match new values exactly, but suggest coverage priority should be correct', function () {
                var _a, _b;
                var existingCoverages = {
                    secondary: primary,
                    secondarySubscriber: primarySubscriber,
                    primary: secondary,
                    primarySubscriber: secondarySubscriber,
                };
                var result = (0, harvest_1.resolveCoverageUpdates)({ patient: newPatient1, existingCoverages: existingCoverages, newCoverages: coverages });
                var suggestedNewCoverageObject = result.suggestedNewCoverageObject, deactivatedCoverages = result.deactivatedCoverages, coverageUpdates = result.coverageUpdates, relatedPersonUpdates = result.relatedPersonUpdates;
                (0, vitest_1.expect)(suggestedNewCoverageObject).toBeDefined();
                (0, vitest_1.assert)(suggestedNewCoverageObject);
                (0, vitest_1.expect)(suggestedNewCoverageObject.find(function (c) { return c.priority === 1; })).toBeDefined();
                (0, vitest_1.expect)(suggestedNewCoverageObject.find(function (c) { return c.priority === 2; })).toBeDefined();
                (0, vitest_1.expect)(suggestedNewCoverageObject === null || suggestedNewCoverageObject === void 0 ? void 0 : suggestedNewCoverageObject.length).toBe(2);
                (0, vitest_1.expect)(deactivatedCoverages).toBeDefined();
                (0, vitest_1.expect)(deactivatedCoverages === null || deactivatedCoverages === void 0 ? void 0 : deactivatedCoverages.length).toBe(0);
                (0, vitest_1.expect)(coverageUpdates).toBeDefined();
                (0, vitest_1.expect)(Object.keys(coverageUpdates).length).toBe(0);
                (0, vitest_1.expect)(relatedPersonUpdates).toBeDefined();
                // there can be entries with empty arrays here. the important thing is that the length of all actual operations is 0
                (0, vitest_1.expect)(Object.values(relatedPersonUpdates).flatMap(function (v) { return v; }).length).toBe(0);
                var newPrimaryCoverage = (_a = suggestedNewCoverageObject.find(function (c) { return c.priority === 1; })) === null || _a === void 0 ? void 0 : _a.coverage;
                var newSecondaryCoverage = (_b = suggestedNewCoverageObject.find(function (c) { return c.priority === 2; })) === null || _b === void 0 ? void 0 : _b.coverage;
                (0, vitest_1.assert)(newPrimaryCoverage);
                (0, vitest_1.assert)(newSecondaryCoverage);
                (0, vitest_1.expect)(newPrimaryCoverage === null || newPrimaryCoverage === void 0 ? void 0 : newPrimaryCoverage.reference).toBe("Coverage/".concat(existingCoverages.secondary.id));
                (0, vitest_1.expect)(newSecondaryCoverage.reference).toBe("Coverage/".concat(existingCoverages.primary.id));
            });
            (0, vitest_1.it)('should return no patches when subscribers match and existing value has data not found in input', function () {
                var _a, _b;
                var existingPrimarySubscriber = __assign(__assign({}, primarySubscriber), { telecom: [
                        {
                            value: 'is_aol_still_cool@aol.com',
                            system: 'email',
                        },
                    ] });
                var existingSecondarySubscriber = __assign(__assign({}, secondarySubscriber), { telecom: [
                        {
                            value: 'gmailIsAlwaysCoolJustLikeCamelCase@gmail.com',
                            system: 'email',
                        },
                    ] });
                var existingCoverages = {
                    secondary: primary,
                    secondarySubscriber: existingPrimarySubscriber,
                    primary: secondary,
                    primarySubscriber: existingSecondarySubscriber,
                };
                var result = (0, harvest_1.resolveCoverageUpdates)({ patient: newPatient1, existingCoverages: existingCoverages, newCoverages: coverages });
                var suggestedNewCoverageObject = result.suggestedNewCoverageObject, deactivatedCoverages = result.deactivatedCoverages, coverageUpdates = result.coverageUpdates, relatedPersonUpdates = result.relatedPersonUpdates;
                (0, vitest_1.expect)(suggestedNewCoverageObject).toBeDefined();
                (0, vitest_1.assert)(suggestedNewCoverageObject);
                (0, vitest_1.expect)(suggestedNewCoverageObject.find(function (c) { return c.priority === 1; })).toBeDefined();
                (0, vitest_1.expect)(suggestedNewCoverageObject.find(function (c) { return c.priority === 2; })).toBeDefined();
                (0, vitest_1.expect)(suggestedNewCoverageObject === null || suggestedNewCoverageObject === void 0 ? void 0 : suggestedNewCoverageObject.length).toBe(2);
                (0, vitest_1.expect)(deactivatedCoverages).toBeDefined();
                (0, vitest_1.expect)(deactivatedCoverages === null || deactivatedCoverages === void 0 ? void 0 : deactivatedCoverages.length).toBe(0);
                (0, vitest_1.expect)(coverageUpdates).toBeDefined();
                (0, vitest_1.expect)(Object.keys(coverageUpdates).length).toBe(0);
                (0, vitest_1.expect)(relatedPersonUpdates).toBeDefined();
                // there can be entries with empty arrays here. the important thing is that the length of all actual operations is 0
                (0, vitest_1.expect)(Object.values(relatedPersonUpdates).flatMap(function (v) { return v; }).length).toBe(0);
                var newPrimaryCoverage = (_a = suggestedNewCoverageObject.find(function (c) { return c.priority === 1; })) === null || _a === void 0 ? void 0 : _a.coverage;
                var newSecondaryCoverage = (_b = suggestedNewCoverageObject.find(function (c) { return c.priority === 2; })) === null || _b === void 0 ? void 0 : _b.coverage;
                (0, vitest_1.assert)(newPrimaryCoverage);
                (0, vitest_1.assert)(newSecondaryCoverage);
                (0, vitest_1.expect)(newPrimaryCoverage === null || newPrimaryCoverage === void 0 ? void 0 : newPrimaryCoverage.reference).toBe("Coverage/".concat(existingCoverages.secondary.id));
                (0, vitest_1.expect)(newSecondaryCoverage.reference).toBe("Coverage/".concat(existingCoverages.primary.id));
            });
            (0, vitest_1.it)('should return patches when subscribers match and existing value is changed by input', function () {
                var _a, _b, _c, _d;
                var existingPrimarySubscriber = __assign(__assign({}, primarySubscriber), { relationship: [
                        {
                            coding: [
                                {
                                    system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
                                    code: 'parent',
                                    display: 'Parent',
                                },
                            ],
                        },
                    ] });
                var existingSecondarySubscriber = __assign(__assign({}, secondarySubscriber), { relationship: [
                        {
                            coding: [
                                {
                                    system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
                                    code: 'parent',
                                    display: 'Parent',
                                },
                            ],
                        },
                    ] });
                var existingCoverages = {
                    secondary: primary,
                    secondarySubscriber: existingPrimarySubscriber,
                    primary: secondary,
                    primarySubscriber: existingSecondarySubscriber,
                };
                var result = (0, harvest_1.resolveCoverageUpdates)({ patient: newPatient1, existingCoverages: existingCoverages, newCoverages: coverages });
                var suggestedNewCoverageObject = result.suggestedNewCoverageObject, deactivatedCoverages = result.deactivatedCoverages, coverageUpdates = result.coverageUpdates, relatedPersonUpdates = result.relatedPersonUpdates;
                (0, vitest_1.expect)(suggestedNewCoverageObject).toBeDefined();
                (0, vitest_1.assert)(suggestedNewCoverageObject);
                (0, vitest_1.expect)(suggestedNewCoverageObject.find(function (c) { return c.priority === 1; })).toBeDefined();
                (0, vitest_1.expect)(suggestedNewCoverageObject.find(function (c) { return c.priority === 2; })).toBeDefined();
                (0, vitest_1.expect)(suggestedNewCoverageObject === null || suggestedNewCoverageObject === void 0 ? void 0 : suggestedNewCoverageObject.length).toBe(2);
                (0, vitest_1.expect)(deactivatedCoverages).toBeDefined();
                (0, vitest_1.expect)(deactivatedCoverages === null || deactivatedCoverages === void 0 ? void 0 : deactivatedCoverages.length).toBe(0);
                (0, vitest_1.expect)(coverageUpdates).toBeDefined();
                (0, vitest_1.expect)(Object.keys(coverageUpdates).length).toBe(0);
                (0, vitest_1.expect)(relatedPersonUpdates).toBeDefined();
                (0, vitest_1.expect)(Object.keys(relatedPersonUpdates).length).toBe(2);
                (0, vitest_1.expect)(Object.values(relatedPersonUpdates).flatMap(function (v) { return v; }).length).toBe(2);
                var update1 = (_a = Object.values(relatedPersonUpdates)[0]) === null || _a === void 0 ? void 0 : _a[0];
                var update2 = (_b = Object.values(relatedPersonUpdates)[1]) === null || _b === void 0 ? void 0 : _b[0];
                (0, vitest_1.assert)(update1);
                (0, vitest_1.assert)(update2);
                (0, vitest_1.expect)(update1.op).toBe('replace');
                (0, vitest_1.expect)(update1.path).toBe('/relationship');
                (0, vitest_1.expect)(update1.value).toEqual([
                    {
                        coding: [
                            {
                                system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
                                code: 'child',
                                display: 'Child',
                            },
                        ],
                    },
                ]);
                (0, vitest_1.expect)(update2.op).toBe('replace');
                (0, vitest_1.expect)(update2.path).toBe('/relationship');
                (0, vitest_1.expect)(update2.value).toEqual([
                    {
                        coding: [
                            {
                                system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
                                code: 'child',
                                display: 'Child',
                            },
                        ],
                    },
                ]);
                var newPrimaryCoverage = (_c = suggestedNewCoverageObject.find(function (c) { return c.priority === 1; })) === null || _c === void 0 ? void 0 : _c.coverage;
                var newSecondaryCoverage = (_d = suggestedNewCoverageObject.find(function (c) { return c.priority === 2; })) === null || _d === void 0 ? void 0 : _d.coverage;
                (0, vitest_1.assert)(newPrimaryCoverage);
                (0, vitest_1.assert)(newSecondaryCoverage);
                (0, vitest_1.expect)(newPrimaryCoverage === null || newPrimaryCoverage === void 0 ? void 0 : newPrimaryCoverage.reference).toBe("Coverage/".concat(existingCoverages.secondary.id));
                (0, vitest_1.expect)(newSecondaryCoverage.reference).toBe("Coverage/".concat(existingCoverages.primary.id));
            });
            (0, vitest_1.it)('should combine a new address rather than overwriting existing address when a new address is sent in input', function () {
                var _a, _b, _c, _d;
                var existingPrimarySubscriber = __assign(__assign({}, primarySubscriber), { address: [
                        {
                            line: ['456 Bluegrass Lane', 'Suite 300'],
                            city: 'Lexington',
                            state: 'KY',
                            postalCode: '40507',
                        },
                    ] });
                var existingSecondarySubscriber = __assign(__assign({}, secondarySubscriber), { address: [
                        {
                            line: ['789 Potato Lane', 'Suite 300'],
                            city: 'Boise',
                            state: 'ID',
                            postalCode: '83701',
                        },
                    ] });
                var existingCoverages = {
                    secondary: primary,
                    secondarySubscriber: existingPrimarySubscriber,
                    primary: secondary,
                    primarySubscriber: existingSecondarySubscriber,
                };
                var result = (0, harvest_1.resolveCoverageUpdates)({ patient: newPatient1, existingCoverages: existingCoverages, newCoverages: coverages });
                var suggestedNewCoverageObject = result.suggestedNewCoverageObject, deactivatedCoverages = result.deactivatedCoverages, coverageUpdates = result.coverageUpdates, relatedPersonUpdates = result.relatedPersonUpdates;
                (0, vitest_1.expect)(suggestedNewCoverageObject).toBeDefined();
                (0, vitest_1.assert)(suggestedNewCoverageObject);
                (0, vitest_1.expect)(suggestedNewCoverageObject.find(function (c) { return c.priority === 1; })).toBeDefined();
                (0, vitest_1.expect)(suggestedNewCoverageObject.find(function (c) { return c.priority === 2; })).toBeDefined();
                (0, vitest_1.expect)(suggestedNewCoverageObject === null || suggestedNewCoverageObject === void 0 ? void 0 : suggestedNewCoverageObject.length).toBe(2);
                (0, vitest_1.expect)(deactivatedCoverages).toBeDefined();
                (0, vitest_1.expect)(deactivatedCoverages === null || deactivatedCoverages === void 0 ? void 0 : deactivatedCoverages.length).toBe(0);
                (0, vitest_1.expect)(coverageUpdates).toBeDefined();
                (0, vitest_1.expect)(Object.keys(coverageUpdates).length).toBe(0);
                (0, vitest_1.expect)(relatedPersonUpdates).toBeDefined();
                (0, vitest_1.expect)(Object.values(relatedPersonUpdates).flatMap(function (v) { return v; }).length).toBe(2);
                var update1 = (_a = Object.values(relatedPersonUpdates)[0]) === null || _a === void 0 ? void 0 : _a[0];
                var update2 = (_b = Object.values(relatedPersonUpdates)[1]) === null || _b === void 0 ? void 0 : _b[0];
                (0, vitest_1.assert)(update1);
                (0, vitest_1.assert)(update2);
                (0, vitest_1.expect)(update1.op).toBe('replace');
                (0, vitest_1.expect)(update1.path).toBe('/address');
                (0, vitest_1.expect)(update1.value).toEqual([
                    {
                        line: ['317 Mustard Street', 'Unit 2'],
                        city: 'DeliciousVilla',
                        state: 'DE',
                        postalCode: '20001',
                    },
                    {
                        line: ['456 Bluegrass Lane', 'Suite 300'],
                        city: 'Lexington',
                        state: 'KY',
                        postalCode: '40507',
                    },
                ]);
                (0, vitest_1.expect)(update2.op).toBe('replace');
                (0, vitest_1.expect)(update2.path).toBe('/address');
                (0, vitest_1.expect)(update2.value).toEqual([
                    {
                        line: ['317 R St NW Unit 2', 'conditional-filter-test-1234'],
                        city: 'Washington',
                        state: 'DC',
                        postalCode: '20001',
                    },
                    {
                        line: ['789 Potato Lane', 'Suite 300'],
                        city: 'Boise',
                        state: 'ID',
                        postalCode: '83701',
                    },
                ]);
                var newPrimaryCoverage = (_c = suggestedNewCoverageObject.find(function (c) { return c.priority === 1; })) === null || _c === void 0 ? void 0 : _c.coverage;
                var newSecondaryCoverage = (_d = suggestedNewCoverageObject.find(function (c) { return c.priority === 2; })) === null || _d === void 0 ? void 0 : _d.coverage;
                (0, vitest_1.assert)(newPrimaryCoverage);
                (0, vitest_1.assert)(newSecondaryCoverage);
                (0, vitest_1.expect)(newPrimaryCoverage === null || newPrimaryCoverage === void 0 ? void 0 : newPrimaryCoverage.reference).toBe("Coverage/".concat(existingCoverages.secondary.id));
                (0, vitest_1.expect)(newSecondaryCoverage.reference).toBe("Coverage/".concat(existingCoverages.primary.id));
            });
            (0, vitest_1.it)('should use a new contained RelatedPerson on Coverage when matching data differs between old and new subscriber, but coverage should be reused if it already exists', function () {
                var _a, _b;
                var existingPrimarySubscriber = __assign(__assign({}, primarySubscriber), { birthDate: '1999-09-09' });
                var existingSecondarySubscriber = __assign(__assign({}, secondarySubscriber), { birthDate: '1999-07-08' });
                var existingCoverages = {
                    secondary: primary,
                    secondarySubscriber: existingPrimarySubscriber,
                    primary: secondary,
                    primarySubscriber: existingSecondarySubscriber,
                };
                var result = (0, harvest_1.resolveCoverageUpdates)({ patient: newPatient1, existingCoverages: existingCoverages, newCoverages: coverages });
                var suggestedNewCoverageObject = result.suggestedNewCoverageObject, deactivatedCoverages = result.deactivatedCoverages, coverageUpdates = result.coverageUpdates, relatedPersonUpdates = result.relatedPersonUpdates;
                (0, vitest_1.expect)(suggestedNewCoverageObject).toBeDefined();
                (0, vitest_1.assert)(suggestedNewCoverageObject);
                (0, vitest_1.expect)(suggestedNewCoverageObject.find(function (c) { return c.priority === 1; })).toBeDefined();
                (0, vitest_1.expect)(suggestedNewCoverageObject.find(function (c) { return c.priority === 2; })).toBeDefined();
                (0, vitest_1.expect)(suggestedNewCoverageObject === null || suggestedNewCoverageObject === void 0 ? void 0 : suggestedNewCoverageObject.length).toBe(2);
                (0, vitest_1.expect)(deactivatedCoverages).toBeDefined();
                (0, vitest_1.expect)(deactivatedCoverages === null || deactivatedCoverages === void 0 ? void 0 : deactivatedCoverages.length).toBe(0);
                (0, vitest_1.expect)(coverageUpdates).toBeDefined();
                (0, vitest_1.expect)(Object.keys(coverageUpdates).length).toBe(2);
                (0, vitest_1.expect)(relatedPersonUpdates).toBeDefined();
                (0, vitest_1.expect)(Object.values(relatedPersonUpdates).flatMap(function (v) { return v; }).length).toBe(0);
                (0, vitest_1.expect)(Object.values(coverageUpdates).flatMap(function (v) { return v; }).length).toBe(4);
                var coverageUpdateList = Object.values(coverageUpdates).flatMap(function (v) { return v; });
                var coverageUpdate1 = coverageUpdateList[0];
                var coverageUpdate2 = coverageUpdateList[1];
                var coverageUpdate3 = coverageUpdateList[2];
                var coverageUpdate4 = coverageUpdateList[3];
                (0, vitest_1.assert)(coverageUpdate1);
                (0, vitest_1.assert)(coverageUpdate2);
                (0, vitest_1.assert)(coverageUpdate3);
                (0, vitest_1.assert)(coverageUpdate4);
                (0, vitest_1.expect)(coverageUpdate1.op).toBe('add');
                (0, vitest_1.expect)(coverageUpdate1.path).toBe('/contained');
                (0, vitest_1.expect)(coverageUpdate1.value).toEqual([expectedPrimaryPolicyHolderFromQR1]);
                (0, vitest_1.expect)(coverageUpdate2.op).toBe('replace');
                (0, vitest_1.expect)(coverageUpdate2.path).toBe('/subscriber');
                (0, vitest_1.expect)(coverageUpdate2.value).toEqual({
                    reference: "#".concat(expectedPrimaryPolicyHolderFromQR1.id),
                });
                (0, vitest_1.expect)(coverageUpdate3.op).toBe('add');
                (0, vitest_1.expect)(coverageUpdate3.path).toBe('/contained');
                (0, vitest_1.expect)(coverageUpdate3.value).toEqual([expectedSecondaryPolicyHolderFromQR1]);
                (0, vitest_1.expect)(coverageUpdate4.op).toBe('replace');
                (0, vitest_1.expect)(coverageUpdate4.path).toBe('/subscriber');
                (0, vitest_1.expect)(coverageUpdate4.value).toEqual({
                    reference: "#".concat(expectedSecondaryPolicyHolderFromQR1.id),
                });
                var newPrimaryCoverage = (_a = suggestedNewCoverageObject.find(function (c) { return c.priority === 1; })) === null || _a === void 0 ? void 0 : _a.coverage;
                var newSecondaryCoverage = (_b = suggestedNewCoverageObject.find(function (c) { return c.priority === 2; })) === null || _b === void 0 ? void 0 : _b.coverage;
                (0, vitest_1.assert)(newPrimaryCoverage);
                (0, vitest_1.assert)(newSecondaryCoverage);
                (0, vitest_1.expect)(newPrimaryCoverage === null || newPrimaryCoverage === void 0 ? void 0 : newPrimaryCoverage.reference).toBe("Coverage/".concat(existingCoverages.secondary.id));
                (0, vitest_1.expect)(newSecondaryCoverage.reference).toBe("Coverage/".concat(existingCoverages.primary.id));
            });
        });
        (0, vitest_1.describe)('and correctly handle the self-pay case', function () {
            (0, vitest_1.it)('should deactivate both existing coverages when no coverages are input in the paperwork', function () {
                var _a;
                var existingCoverages = {
                    primary: primary,
                    primarySubscriber: primarySubscriber,
                    secondary: secondary,
                    secondarySubscriber: secondarySubscriber,
                };
                var result = (0, harvest_1.resolveCoverageUpdates)({ patient: newPatient1, existingCoverages: existingCoverages, newCoverages: {} });
                (0, vitest_1.expect)(result).toBeDefined();
                (0, vitest_1.assert)(result);
                (0, vitest_1.expect)(result.deactivatedCoverages).toBeDefined();
                (0, vitest_1.expect)((_a = result.deactivatedCoverages) === null || _a === void 0 ? void 0 : _a.length).toBe(2);
                (0, vitest_1.expect)(result.coverageUpdates).toBeDefined();
                (0, vitest_1.expect)(Object.keys(result.coverageUpdates).length).toBe(0);
                (0, vitest_1.expect)(result.relatedPersonUpdates).toBeDefined();
                (0, vitest_1.expect)(Object.keys(result.relatedPersonUpdates).length).toBe(0);
            });
        });
        (0, vitest_1.describe)('should generate the right output when comparing guarantor from questionnaire with existing guarantor', function () {
            (0, vitest_1.it)('should make no changes when existing account and new account both use Patient as guarantor', function () {
                var existingGuarantor = {
                    party: {
                        reference: "Patient/".concat(newPatient1.id),
                    },
                };
                var result = (0, harvest_1.resolveGuarantor)({
                    patientId: newPatient1.id,
                    guarantorFromQuestionnaire: __assign(__assign({}, accountGuarantor), { relationship: 'Self' }),
                    existingGuarantorResource: newPatient1,
                    existingGuarantorReferences: [existingGuarantor],
                });
                (0, vitest_1.expect)(result).toBeDefined();
                (0, vitest_1.assert)(result);
                var contained = result.contained, guarantors = result.guarantors;
                (0, vitest_1.expect)(contained).toBeUndefined();
                (0, vitest_1.expect)(guarantors).toBeDefined();
                (0, vitest_1.expect)(guarantors === null || guarantors === void 0 ? void 0 : guarantors.length).toBe(1);
                (0, vitest_1.expect)(guarantors).toEqual([existingGuarantor]);
            });
            (0, vitest_1.it)('should make no changes when existing account guarantor is a persisted RelatedPerson that matches the questionnaire responsible party', function () {
                var existingGuarantorId = (0, uuid_1.v4)();
                var existingGuarantorReference = {
                    party: {
                        reference: "RelatedPerson/".concat(existingGuarantorId),
                    },
                };
                var existingGuarantorResource = __assign(__assign({}, expectedAccountGuarantorFromQR1), { telecom: [
                        {
                            value: '555-555-5555',
                            type: 'phone',
                        },
                    ], id: existingGuarantorId });
                var result = (0, harvest_1.resolveGuarantor)({
                    patientId: newPatient1.id,
                    guarantorFromQuestionnaire: accountGuarantor,
                    existingGuarantorResource: existingGuarantorResource,
                    existingGuarantorReferences: [existingGuarantorReference],
                });
                (0, vitest_1.expect)(result).toBeDefined();
                (0, vitest_1.assert)(result);
                var contained = result.contained, guarantors = result.guarantors;
                (0, vitest_1.expect)(contained).toBeUndefined();
                (0, vitest_1.expect)(guarantors).toBeDefined();
                (0, vitest_1.expect)(guarantors === null || guarantors === void 0 ? void 0 : guarantors.length).toBe(1);
                (0, vitest_1.expect)(guarantors).toEqual([existingGuarantorReference]);
            });
            (0, vitest_1.it)('should create a new contained RelatedPerson when existing account guarantor is a persisted RelatedPerson that does not match the questionnaire responsible party', function () {
                var existingGuarantorId = (0, uuid_1.v4)();
                var existingGuarantorReference = {
                    party: {
                        reference: "RelatedPerson/".concat(existingGuarantorId),
                    },
                };
                var existingGuarantorResource = __assign(__assign({}, expectedAccountGuarantorFromQR1), { birthDate: '1999-09-09', id: existingGuarantorId });
                var timestamp = luxon_1.DateTime.now().toISO();
                var expectedGuarantorArray = [
                    {
                        party: {
                            reference: "#".concat(expectedAccountGuarantorFromQR1.id),
                            type: 'RelatedPerson',
                        },
                    },
                    {
                        party: {
                            reference: "RelatedPerson/".concat(existingGuarantorId),
                        },
                        period: { end: timestamp },
                    },
                ];
                var result = (0, harvest_1.resolveGuarantor)({
                    patientId: newPatient1.id,
                    guarantorFromQuestionnaire: accountGuarantor,
                    existingGuarantorResource: existingGuarantorResource,
                    existingGuarantorReferences: [existingGuarantorReference],
                    timestamp: timestamp,
                });
                (0, vitest_1.expect)(result).toBeDefined();
                (0, vitest_1.assert)(result);
                var contained = result.contained, guarantors = result.guarantors;
                (0, vitest_1.expect)(contained).toBeDefined();
                (0, vitest_1.expect)(guarantors).toBeDefined();
                (0, vitest_1.expect)(guarantors === null || guarantors === void 0 ? void 0 : guarantors.length).toBe(2);
                (0, vitest_1.expect)(guarantors).toEqual(expectedGuarantorArray);
                (0, vitest_1.expect)(contained).toEqual([expectedAccountGuarantorFromQR1]);
            });
            (0, vitest_1.it)('should create a new contained RelatedPerson when existing account guarantor is a Patient and questionnaire guarantor relationship != "Self"', function () {
                var existingGuarantorReference = {
                    party: {
                        reference: "Patient/".concat(newPatient1.id),
                    },
                };
                var timestamp = luxon_1.DateTime.now().toISO();
                var expectedGuarantorArray = [
                    {
                        party: {
                            reference: "#".concat(expectedAccountGuarantorFromQR1.id),
                            type: 'RelatedPerson',
                        },
                    },
                    {
                        party: {
                            reference: "Patient/".concat(newPatient1.id),
                        },
                        period: { end: timestamp },
                    },
                ];
                var result = (0, harvest_1.resolveGuarantor)({
                    patientId: newPatient1.id,
                    guarantorFromQuestionnaire: accountGuarantor,
                    existingGuarantorResource: newPatient1,
                    existingGuarantorReferences: [existingGuarantorReference],
                    timestamp: timestamp,
                });
                (0, vitest_1.expect)(result).toBeDefined();
                (0, vitest_1.assert)(result);
                var contained = result.contained, guarantors = result.guarantors;
                (0, vitest_1.expect)(contained).toBeDefined();
                (0, vitest_1.expect)(guarantors).toBeDefined();
                (0, vitest_1.expect)(guarantors === null || guarantors === void 0 ? void 0 : guarantors.length).toBe(2);
                (0, vitest_1.expect)(guarantors).toEqual(expectedGuarantorArray);
                (0, vitest_1.expect)(contained).toEqual([expectedAccountGuarantorFromQR1]);
            });
            (0, vitest_1.it)('should use the data from the form for the contained guarantor RP whenever the existing guarantor is also a contained guarantor RP', function () {
                var existingGuarantorReference = {
                    party: {
                        reference: "#".concat(expectedAccountGuarantorFromQR1.id),
                        type: 'RelatedPerson',
                    },
                };
                var existingGuarantorResource = __assign(__assign({}, expectedAccountGuarantorFromQR1), { telecom: [
                        {
                            value: '555-555-5555',
                            type: 'phone',
                        },
                    ] });
                var timestamp = luxon_1.DateTime.now().toISO();
                var expectedGuarantorArray = [
                    {
                        party: {
                            reference: "#".concat(expectedAccountGuarantorFromQR1.id),
                            type: 'RelatedPerson',
                        },
                    },
                ];
                var result = (0, harvest_1.resolveGuarantor)({
                    patientId: newPatient1.id,
                    guarantorFromQuestionnaire: accountGuarantor,
                    existingGuarantorResource: existingGuarantorResource,
                    existingGuarantorReferences: [existingGuarantorReference],
                    existingContained: [existingGuarantorResource],
                    timestamp: timestamp,
                    // choke: true,
                });
                (0, vitest_1.expect)(result).toBeDefined();
                (0, vitest_1.assert)(result);
                var contained = result.contained, guarantors = result.guarantors;
                (0, vitest_1.expect)(contained).toBeDefined();
                (0, vitest_1.expect)(guarantors).toBeDefined();
                (0, vitest_1.expect)(guarantors === null || guarantors === void 0 ? void 0 : guarantors.length).toBe(1);
                (0, vitest_1.expect)(guarantors).toEqual(expectedGuarantorArray);
                (0, vitest_1.expect)(contained).toEqual([expectedAccountGuarantorFromQR1]);
            });
            (0, vitest_1.it)('it should leave period.end untouched when there is a long list of old guarantors', function () {
                var existingGuarantorId = (0, uuid_1.v4)();
                var oldExistingGuarantorId1 = (0, uuid_1.v4)();
                var oldExistingGuarantorId2 = (0, uuid_1.v4)();
                var timestamp = luxon_1.DateTime.now().toISO();
                var timestamp2 = luxon_1.DateTime.now().minus({ years: 1 }).toISO();
                var timestamp3 = luxon_1.DateTime.now().minus({ years: 2, days: 21 }).toISO();
                var existingGuarantorReferences = [
                    {
                        party: {
                            reference: "RelatedPerson/".concat(existingGuarantorId),
                            type: 'RelatedPerson',
                        },
                    },
                    {
                        party: {
                            reference: "RelatedPerson/".concat(oldExistingGuarantorId1),
                            type: 'RelatedPerson',
                        },
                        period: { end: timestamp2 },
                    },
                    {
                        party: {
                            reference: "Patient/".concat(oldExistingGuarantorId2),
                            type: 'Patient',
                        },
                        period: { end: timestamp3 },
                    },
                ];
                var existingGuarantorResource = __assign(__assign({}, expectedAccountGuarantorFromQR1), { birthDate: '1999-09-09', id: existingGuarantorId });
                var expectedGuarantorArray = [
                    {
                        party: {
                            reference: "#".concat(expectedAccountGuarantorFromQR1.id),
                            type: 'RelatedPerson',
                        },
                    },
                    {
                        party: {
                            reference: "RelatedPerson/".concat(existingGuarantorId),
                            type: 'RelatedPerson',
                        },
                        period: { end: timestamp },
                    },
                    {
                        party: {
                            reference: "RelatedPerson/".concat(oldExistingGuarantorId1),
                            type: 'RelatedPerson',
                        },
                        period: { end: timestamp2 },
                    },
                    {
                        party: {
                            reference: "Patient/".concat(oldExistingGuarantorId2),
                            type: 'Patient',
                        },
                        period: { end: timestamp3 },
                    },
                ];
                var result = (0, harvest_1.resolveGuarantor)({
                    patientId: newPatient1.id,
                    guarantorFromQuestionnaire: accountGuarantor,
                    existingGuarantorResource: existingGuarantorResource,
                    existingGuarantorReferences: existingGuarantorReferences,
                    timestamp: timestamp,
                });
                (0, vitest_1.expect)(result).toBeDefined();
                (0, vitest_1.assert)(result);
                var contained = result.contained, guarantors = result.guarantors;
                (0, vitest_1.expect)(contained).toBeDefined();
                (0, vitest_1.expect)(guarantors).toBeDefined();
                (0, vitest_1.expect)(guarantors === null || guarantors === void 0 ? void 0 : guarantors.length).toBe(4);
                (0, vitest_1.expect)(guarantors).toEqual(expectedGuarantorArray);
                (0, vitest_1.expect)(contained).toEqual([expectedAccountGuarantorFromQR1]);
            });
        });
    });
    (0, vitest_1.describe)('getAccountOperations', function () {
        var questionnaireResponseItem = questionnaireResponse1.item;
        /*
        these optional params will be specified in each test:
    
        existingCoverages: { primary?: Coverage; secondary?: Coverage };
        existingGuarantorResource?: RelatedPerson | Patient;
        existingAccount?: Account;
        */
        var patient = __assign({}, newPatient1);
        (0, vitest_1.it)('returns a well formulated post request for the new Account case', function () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
            var result = (0, harvest_1.getAccountOperations)({
                patient: patient,
                questionnaireResponseItem: questionnaireResponseItem,
                organizationResources: organizations1,
                existingCoverages: {
                    primary: undefined,
                    secondary: undefined,
                },
            });
            (0, vitest_1.expect)(result).toBeDefined();
            (0, vitest_1.assert)(result);
            var post = result.accountPost;
            checkAccountOperations(result, expectedAccount);
            (0, vitest_1.expect)(post).toBeDefined();
            (0, vitest_1.expect)(post === null || post === void 0 ? void 0 : post.resourceType).toBe('Account');
            (0, vitest_1.expect)(post === null || post === void 0 ? void 0 : post.status).toBe('active');
            (0, vitest_1.expect)(post === null || post === void 0 ? void 0 : post.type).toBeDefined();
            (0, vitest_1.expect)((_a = post === null || post === void 0 ? void 0 : post.type) === null || _a === void 0 ? void 0 : _a.coding).toBeDefined();
            (0, vitest_1.expect)((_c = (_b = post === null || post === void 0 ? void 0 : post.type) === null || _b === void 0 ? void 0 : _b.coding) === null || _c === void 0 ? void 0 : _c.length).toBe(1);
            (0, vitest_1.expect)((_e = (_d = post === null || post === void 0 ? void 0 : post.type) === null || _d === void 0 ? void 0 : _d.coding) === null || _e === void 0 ? void 0 : _e[0].system).toBe('http://terminology.hl7.org/CodeSystem/account-type');
            (0, vitest_1.expect)((_g = (_f = post === null || post === void 0 ? void 0 : post.type) === null || _f === void 0 ? void 0 : _f.coding) === null || _g === void 0 ? void 0 : _g[0].code).toBe('PBILLACCT');
            (0, vitest_1.expect)((_j = (_h = post === null || post === void 0 ? void 0 : post.type) === null || _h === void 0 ? void 0 : _h.coding) === null || _j === void 0 ? void 0 : _j[0].display).toBe('patient billing account');
            (0, vitest_1.expect)(post === null || post === void 0 ? void 0 : post.subject).toBeDefined();
            (0, vitest_1.expect)((_l = (_k = post === null || post === void 0 ? void 0 : post.subject) === null || _k === void 0 ? void 0 : _k[0]) === null || _l === void 0 ? void 0 : _l.reference).toBe("Patient/".concat(patient.id));
        });
        (0, vitest_1.it)('should return a well formulated post request for new Account and patch operations for Coverage updates', function () {
            var primary = {
                resourceType: 'Coverage',
                id: (0, uuid_1.v4)(),
                status: 'active',
                beneficiary: { reference: 'Patient/36ef99c2-43fa-40f6-bf9c-d9ea12c2bf61', type: 'Patient' },
                payor: [{ reference: 'Organization/db875d9d-5726-4c45-a689-e11a7bbdf176' }],
                subscriberId: 'FafOneJwgNdkOetWwe6',
                subscriber: { reference: 'RelatedPerson/36ef99c3-43fb-50f4-bf9d-d9ea12c2bf62' },
                order: 1,
                identifier: [
                    __assign(__assign({}, utils_1.COVERAGE_MEMBER_IDENTIFIER_BASE), { value: 'FafOneJwgNdkOetWwe6', assigner: {
                            reference: 'Organization/db875d9d-5726-4c45-a689-e11a7bbdf176',
                            display: 'Aetna',
                        } }),
                ],
                relationship: {
                    coding: [
                        {
                            system: 'http://terminology.hl7.org/CodeSystem/subscriber-relationship',
                            code: 'child',
                            display: 'Child',
                        },
                    ],
                },
                class: [
                    {
                        name: 'Aetna',
                        type: {
                            coding: [
                                {
                                    code: 'plan',
                                    system: 'http://terminology.hl7.org/CodeSystem/coverage-class',
                                },
                            ],
                        },
                        value: '60054',
                    },
                ],
                type: {
                    coding: [
                        {
                            code: '09',
                            system: 'https://fhir.ottehr.com/CodeSystem/candid-plan-type',
                        },
                        {
                            code: 'pay',
                            system: 'http://terminology.hl7.org/CodeSystem/coverage-selfpay',
                        },
                    ],
                },
            };
            var primarySubscriber = {
                resourceType: 'RelatedPerson',
                id: (0, uuid_1.v4)(),
                name: [
                    {
                        given: ['Barnabas', 'Thaddeus'],
                        family: 'PicklesWorth',
                    },
                ],
                birthDate: '1984-02-23',
                gender: 'male',
                patient: { reference: 'Patient/36ef99c2-43fa-40f6-bf9c-d9ea12c2bf61' },
                relationship: [
                    {
                        coding: [
                            {
                                system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
                                code: 'child',
                                display: 'Child',
                            },
                        ],
                    },
                ],
                address: [
                    {
                        line: ['317 Mustard Street', 'Unit 2'],
                        city: 'DeliciousVilla',
                        state: 'DE',
                        postalCode: '20001',
                    },
                ],
            };
            var accountExpectation = __assign(__assign({}, expectedAccount), { coverage: [
                    {
                        coverage: { reference: "Coverage/".concat(primary.id) },
                        priority: 1,
                    },
                    expectedAccount.coverage[1],
                ] });
            var result = (0, harvest_1.getAccountOperations)({
                patient: patient,
                questionnaireResponseItem: questionnaireResponseItem,
                organizationResources: organizations1,
                existingCoverages: {
                    primary: primary,
                    primarySubscriber: primarySubscriber,
                },
            });
            (0, vitest_1.expect)(result).toBeDefined();
            (0, vitest_1.assert)(result);
            var patch = result.patch;
            checkAccountOperations(result, accountExpectation);
            (0, vitest_1.expect)(patch).toBeDefined();
            (0, vitest_1.assert)(patch);
            (0, vitest_1.expect)(patch === null || patch === void 0 ? void 0 : patch.length).toBe(1);
            var patchObj = patch === null || patch === void 0 ? void 0 : patch[0];
            (0, vitest_1.assert)(patchObj);
            var patchOperations = patchObj.operations;
            (0, vitest_1.expect)(patchOperations.length).toBe(3);
            (0, vitest_1.expect)(patchObj.url).toBe("Coverage/".concat(primary.id));
            var patch1 = patchOperations[0], patch2 = patchOperations[1];
            (0, vitest_1.assert)(patch1 && patch2);
            (0, vitest_1.expect)(patch1.op).toBe('add');
            (0, vitest_1.expect)(patch1.path).toBe('/contained');
            (0, vitest_1.expect)(patch1.value).toEqual([expectedPrimaryPolicyHolderFromQR1]);
            (0, vitest_1.expect)(patch2.op).toBe('replace');
            (0, vitest_1.expect)(patch2.path).toBe('/subscriber');
            (0, vitest_1.expect)(patch2.value).toEqual({
                reference: "#coverageSubscriber",
            });
        });
        (0, vitest_1.it)('should return a well formulated post request for new Account and patch operations to mark deactivated Coverages as inactive', function () {
            var primary = {
                resourceType: 'Coverage',
                id: (0, uuid_1.v4)(),
                status: 'active',
                beneficiary: { reference: 'Patient/36ef99c2-43fa-40f6-bf9c-d9ea12c2bf61', type: 'Patient' },
                payor: [{ reference: 'Organization/db875d9d-5726-4c45-a689-e11a7bbdf176' }],
                subscriberId: 'FafOneJwgDdkOet1234',
                subscriber: { reference: 'RelatedPerson/36ef99c3-43fb-50f4-bf9d-d9ea12c2bf62' },
                order: 1,
                identifier: [
                    __assign(__assign({}, utils_1.COVERAGE_MEMBER_IDENTIFIER_BASE), { value: 'FafOneJwgDdkOet1234', assigner: {
                            reference: 'Organization/db875d9d-5726-4c45-a689-e11a7bbdf176',
                            display: 'Aetna',
                        } }),
                ],
                relationship: {
                    coding: [
                        {
                            system: 'http://terminology.hl7.org/CodeSystem/subscriber-relationship',
                            code: 'child',
                            display: 'Child',
                        },
                    ],
                },
                class: [
                    {
                        name: 'Aetna',
                        type: {
                            coding: [
                                {
                                    code: 'plan',
                                    system: 'http://terminology.hl7.org/CodeSystem/coverage-class',
                                },
                            ],
                        },
                        value: 'Organization/45ae21d2-12a3-4727-b915-896f7dc57dbd',
                    },
                ],
                type: {
                    coding: [
                        {
                            code: '09',
                            system: 'https://fhir.ottehr.com/CodeSystem/candid-plan-type',
                        },
                        {
                            code: 'pay',
                            system: 'http://terminology.hl7.org/CodeSystem/coverage-selfpay',
                        },
                    ],
                },
            };
            var primarySubscriber = {
                resourceType: 'RelatedPerson',
                id: (0, uuid_1.v4)(),
                name: [
                    {
                        given: ['Barnabas', 'Thaddeus'],
                        family: 'PicklesWorth',
                    },
                ],
                birthDate: '1984-02-26',
                gender: 'male',
                patient: { reference: 'Patient/36ef99c2-43fa-40f6-bf9c-d9ea12c2bf61' },
                relationship: [
                    {
                        coding: [
                            {
                                system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
                                code: 'child',
                                display: 'Child',
                            },
                        ],
                    },
                ],
                address: [
                    {
                        line: ['317 Mustard Street', 'Unit 2'],
                        city: 'DeliciousVilla',
                        state: 'DE',
                        postalCode: '20001',
                    },
                ],
            };
            var result = (0, harvest_1.getAccountOperations)({
                patient: patient,
                questionnaireResponseItem: questionnaireResponseItem,
                organizationResources: organizations1,
                existingCoverages: {
                    primary: primary,
                    primarySubscriber: primarySubscriber,
                },
            });
            (0, vitest_1.expect)(result).toBeDefined();
            (0, vitest_1.assert)(result);
            var post = result.accountPost, patch = result.patch;
            (0, vitest_1.expect)(post).toBeDefined();
            (0, vitest_1.expect)(post === null || post === void 0 ? void 0 : post.resourceType).toBe('Account');
            (0, vitest_1.expect)(post === null || post === void 0 ? void 0 : post.status).toBe('active');
            checkAccountOperations(result, expectedAccount);
            (0, vitest_1.expect)(patch).toBeDefined();
            (0, vitest_1.assert)(patch);
            (0, vitest_1.expect)(patch === null || patch === void 0 ? void 0 : patch.length).toBe(1);
            var patchObj = patch === null || patch === void 0 ? void 0 : patch[0];
            (0, vitest_1.assert)(patchObj);
            var patchOperations = patchObj.operations;
            (0, vitest_1.expect)(patchOperations.length).toBe(1);
            var patch1 = patchOperations[0];
            (0, vitest_1.expect)(patch1.op).toBe('replace');
            (0, vitest_1.expect)(patch1.path).toBe('/status');
            (0, vitest_1.expect)(patch1.value).toBe('cancelled');
        });
        (0, vitest_1.it)("should patch an existing Account when one exists and shouldn't post a new one", function () {
            var primary = {
                resourceType: 'Coverage',
                id: (0, uuid_1.v4)(),
                status: 'active',
                beneficiary: { reference: 'Patient/36ef99c2-43fa-40f6-bf9c-d9ea12c2bf61', type: 'Patient' },
                payor: [{ reference: 'Organization/db875d9d-5726-4c45-a689-e11a7bbdf176' }],
                subscriberId: 'FafOneJwgDdkOet1234',
                subscriber: { reference: 'RelatedPerson/36ef99c3-43fb-50f4-bf9d-d9ea12c2bf62' },
                order: 1,
                identifier: [
                    __assign(__assign({}, utils_1.COVERAGE_MEMBER_IDENTIFIER_BASE), { value: 'FafOneJwgDdkOet1234', assigner: {
                            reference: 'Organization/db875d9d-5726-4c45-a689-e11a7bbdf176',
                            display: 'Aetna',
                        } }),
                ],
                relationship: {
                    coding: [
                        {
                            system: 'http://terminology.hl7.org/CodeSystem/subscriber-relationship',
                            code: 'child',
                            display: 'Child',
                        },
                    ],
                },
                class: [
                    {
                        name: 'Aetna',
                        type: {
                            coding: [
                                {
                                    code: 'plan',
                                    system: 'http://terminology.hl7.org/CodeSystem/coverage-class',
                                },
                            ],
                        },
                        value: '46320',
                    },
                ],
                type: {
                    coding: [
                        {
                            code: '09',
                            system: 'https://fhir.ottehr.com/CodeSystem/candid-plan-type',
                        },
                        {
                            code: 'pay',
                            system: 'http://terminology.hl7.org/CodeSystem/coverage-selfpay',
                        },
                    ],
                },
            };
            var primarySubscriber = {
                resourceType: 'RelatedPerson',
                id: (0, uuid_1.v4)(),
                name: [
                    {
                        given: ['Barnabas', 'Thaddeus'],
                        family: 'PicklesWorth',
                    },
                ],
                birthDate: '1984-02-26',
                gender: 'male',
                patient: { reference: 'Patient/36ef99c2-43fa-40f6-bf9c-d9ea12c2bf61' },
                relationship: [
                    {
                        coding: [
                            {
                                system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
                                code: 'child',
                                display: 'Child',
                            },
                        ],
                    },
                ],
                address: [
                    {
                        line: ['317 Mustard Street', 'Unit 2'],
                        city: 'DeliciousVilla',
                        state: 'DE',
                        postalCode: '20001',
                    },
                ],
            };
            var existingAccount = __assign(__assign({}, expectedAccount), { status: 'active', id: (0, uuid_1.v4)(), guarantor: [{ party: { reference: "Patient/".concat(newPatient1.id), type: 'Patient' } }] });
            existingAccount.contained = undefined;
            var result = (0, harvest_1.getAccountOperations)({
                patient: patient,
                questionnaireResponseItem: questionnaireResponseItem,
                organizationResources: organizations1,
                existingCoverages: {
                    primary: primary,
                    primarySubscriber: primarySubscriber,
                },
                existingGuarantorResource: newPatient1,
                existingAccount: existingAccount,
            });
            (0, vitest_1.expect)(result).toBeDefined();
            (0, vitest_1.assert)(result);
            var post = result.accountPost, patch = result.patch, put = result.put;
            checkAccountOperations(result, expectedAccount);
            (0, vitest_1.expect)(post).toBeUndefined();
            (0, vitest_1.expect)(patch).toBeDefined();
            (0, vitest_1.assert)(patch);
            (0, vitest_1.expect)(patch.length).toBe(1);
            var accountPut = put.find(function (p) { return p.url === "Account/".concat(existingAccount.id); });
            var updatedAccount = accountPut === null || accountPut === void 0 ? void 0 : accountPut.resource;
            (0, vitest_1.expect)(updatedAccount).toBeDefined();
            (0, vitest_1.assert)(updatedAccount);
            (0, vitest_1.expect)(updatedAccount.contained).toEqual([expectedAccountGuarantorFromQR1]);
            (0, vitest_1.expect)(updatedAccount.guarantor).toContainEqual({
                party: {
                    reference: "#".concat(expectedAccountGuarantorFromQR1.id),
                    type: 'RelatedPerson',
                },
            });
        });
        var employerQuestionnaireItems = [
            {
                linkId: 'workers-comp-insurance-name',
                answer: [
                    {
                        valueReference: {
                            reference: 'Organization/868091c6-c176-448f-8790-cb4566a57a9b',
                            display: 'MassLight',
                        },
                    },
                ],
            },
            {
                linkId: 'workers-comp-insurance-member-id',
                answer: [{ valueString: '1' }],
            },
            {
                linkId: 'employer-name',
                answer: [{ valueString: 'Wayne Enterprises' }],
            },
            {
                linkId: 'employer-address',
                answer: [{ valueString: '1007 Mountain Drive' }],
            },
            {
                linkId: 'employer-city',
                answer: [{ valueString: 'Gotham' }],
            },
            {
                linkId: 'employer-state',
                answer: [{ valueString: 'NJ' }],
            },
            {
                linkId: 'employer-zip',
                answer: [{ valueString: '07001' }],
            },
            {
                linkId: 'employer-contact-first-name',
                answer: [{ valueString: 'Lucius' }],
            },
            {
                linkId: 'employer-contact-last-name',
                answer: [{ valueString: 'Fox' }],
            },
            {
                linkId: 'employer-contact-phone',
                answer: [{ valueString: '5551239876' }],
            },
        ];
        var workersCompEmployerOrganization = {
            active: true,
            address: [
                {
                    city: 'Example',
                    line: ['Example'],
                    postalCode: '12345',
                    state: 'DC',
                    use: 'billing',
                },
            ],
            extension: [
                {
                    url: 'https://fhir.zapehr.com/r4/StructureDefinitions/eligibility',
                    valueString: 'yes',
                },
                {
                    url: 'https://fhir.zapehr.com/r4/StructureDefinitions/era',
                    valueString: 'enrollment',
                },
                {
                    url: 'https://fhir.zapehr.com/r4/StructureDefinitions/payer-type',
                    valueString: 'workerscomp',
                },
            ],
            identifier: [
                {
                    type: {
                        coding: [
                            {
                                code: '12345',
                                system: 'payer-id',
                            },
                        ],
                    },
                },
                {
                    type: {
                        coding: [
                            {
                                code: 'XX',
                                system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                            },
                        ],
                    },
                    value: '12345',
                },
            ],
            name: 'MassLight',
            resourceType: 'Organization',
            telecom: [
                {
                    system: 'phone',
                    value: '123-456-7890',
                },
            ],
            type: [
                {
                    coding: [
                        {
                            code: 'pay',
                            system: 'http://terminology.hl7.org/CodeSystem/organization-type',
                        },
                    ],
                },
            ],
            id: '868091c6-c176-448f-8790-cb4566a57a9b',
            meta: {
                versionId: '53467db8-3445-46ee-8300-5f12043bf0f0',
                lastUpdated: '2025-11-05T15:57:52.067Z',
            },
        };
        (0, vitest_1.it)('creates employer organization, workers comp account, and coverage operations when employer data exists', function () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
            var result = (0, harvest_1.getAccountOperations)({
                patient: patient,
                questionnaireResponseItem: employerQuestionnaireItems,
                organizationResources: [workersCompEmployerOrganization],
                existingCoverages: {},
            });
            (0, vitest_1.expect)(result.employerOrganizationPost).toBeDefined();
            (0, vitest_1.expect)((_b = (_a = result.employerOrganizationPost) === null || _a === void 0 ? void 0 : _a.resource) === null || _b === void 0 ? void 0 : _b.name).toBe('Wayne Enterprises');
            (0, vitest_1.expect)(result.workersCompAccountPost).toBeDefined();
            var employerReference = (_c = result.employerOrganizationPost) === null || _c === void 0 ? void 0 : _c.fullUrl;
            (0, vitest_1.expect)((_e = (_d = result.workersCompAccountPost) === null || _d === void 0 ? void 0 : _d.owner) === null || _e === void 0 ? void 0 : _e.reference).toBe(employerReference);
            (0, vitest_1.expect)((_j = (_h = (_g = (_f = result.workersCompAccountPost) === null || _f === void 0 ? void 0 : _f.guarantor) === null || _g === void 0 ? void 0 : _g[0]) === null || _h === void 0 ? void 0 : _h.party) === null || _j === void 0 ? void 0 : _j.reference).toBe(employerReference);
            var workersCompCoveragePost = result.coveragePosts.find(function (coverage) { var _a, _b; return (_b = (_a = coverage.resource.type) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.some(function (coding) { return coding.code === 'WC'; }); });
            (0, vitest_1.expect)(workersCompCoveragePost).toBeDefined();
            (0, vitest_1.expect)((_k = workersCompCoveragePost === null || workersCompCoveragePost === void 0 ? void 0 : workersCompCoveragePost.resource.payor) === null || _k === void 0 ? void 0 : _k[0].reference).toBe('Organization/868091c6-c176-448f-8790-cb4566a57a9b');
            (0, vitest_1.expect)((_l = workersCompCoveragePost === null || workersCompCoveragePost === void 0 ? void 0 : workersCompCoveragePost.resource.class) === null || _l === void 0 ? void 0 : _l[0].name).toBe('MassLight');
            (0, vitest_1.expect)((_m = workersCompCoveragePost === null || workersCompCoveragePost === void 0 ? void 0 : workersCompCoveragePost.resource.class) === null || _m === void 0 ? void 0 : _m[0].value).toBe('12345');
            (0, vitest_1.expect)((_p = (_o = workersCompCoveragePost === null || workersCompCoveragePost === void 0 ? void 0 : workersCompCoveragePost.resource.identifier) === null || _o === void 0 ? void 0 : _o[0]) === null || _p === void 0 ? void 0 : _p.value).toBe('1');
        });
        (0, vitest_1.it)('updates employer organization and workers comp account when resources already exist', function () {
            var _a, _b, _c, _d, _e, _f;
            var employerOrg = {
                resourceType: 'Organization',
                id: (0, uuid_1.v4)(),
                name: 'Wayne Enterprises',
            };
            var result = (0, harvest_1.getAccountOperations)({
                patient: patient,
                questionnaireResponseItem: employerQuestionnaireItems,
                organizationResources: [],
                existingCoverages: {},
                existingWorkersCompAccount: workersCompAccountResource,
                existingEmployerOrganization: employerOrg,
            });
            (0, vitest_1.expect)((_a = result.employerOrganizationPut) === null || _a === void 0 ? void 0 : _a.url).toBe("Organization/".concat(employerOrg.id));
            (0, vitest_1.expect)((_b = result.workersCompAccountPut) === null || _b === void 0 ? void 0 : _b.url).toBe("Account/".concat(workersCompAccountResource.id));
            var updatedAccount = (_c = result.workersCompAccountPut) === null || _c === void 0 ? void 0 : _c.resource;
            (0, vitest_1.expect)((_f = (_e = (_d = updatedAccount === null || updatedAccount === void 0 ? void 0 : updatedAccount.guarantor) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.party) === null || _f === void 0 ? void 0 : _f.reference).toBe("Organization/".concat(employerOrg.id));
        });
    });
    (0, vitest_1.describe)('translating query results into input for the account operations', function () {
        var stubSecondaryCoverage = {
            resourceType: 'Coverage',
            identifier: [
                __assign(__assign({}, utils_1.COVERAGE_MEMBER_IDENTIFIER_BASE), { value: 'FdfDfdFdfDfh7897', assigner: {
                        reference: 'Organization/a9bada42-935a-45fa-ba8e-aa3b29478884',
                        display: 'United Heartland',
                    } }),
            ],
            // contained: [expectedSecondaryPolicyHolderFromQR1],
            status: 'active',
            beneficiary: { reference: "Patient/".concat(bundle1Patient), type: 'Patient' },
            payor: [{ reference: 'Organization/a9bada42-935a-45fa-ba8e-aa3b29478884' }],
            subscriberId: 'FdfDfdFdfDfh7897',
            subscriber: { reference: "RelatedPerson/".concat(bundle1RP1.id) },
            relationship: {
                coding: [
                    {
                        system: 'http://terminology.hl7.org/CodeSystem/subscriber-relationship',
                        code: 'child',
                        display: 'Child',
                    },
                ],
            },
            class: [
                {
                    name: 'United Heartland',
                    type: {
                        coding: [
                            {
                                code: 'plan',
                                system: 'http://terminology.hl7.org/CodeSystem/coverage-class',
                            },
                        ],
                    },
                    value: 'J1859',
                },
            ],
            type: {
                coding: [
                    {
                        code: '12',
                        system: 'https://fhir.ottehr.com/CodeSystem/candid-plan-type',
                    },
                    {
                        code: 'PPO',
                        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
                    },
                ],
            },
        };
        (0, vitest_1.it)('should have one existing coverage resource for an existing Account case with one primary coverage associated, and all the other stuff should be right too', function () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x;
            var inputs = (0, harvest_1.getCoverageUpdateResourcesFromUnbundled)({ patient: bundle1Patient, resources: bundle1 });
            (0, vitest_1.expect)(inputs).toBeDefined();
            (0, vitest_1.expect)(inputs.account).toBeDefined();
            (0, vitest_1.expect)((_a = inputs.account) === null || _a === void 0 ? void 0 : _a.id).toBe(bundle1Account.id);
            (0, vitest_1.expect)((_b = inputs.account) === null || _b === void 0 ? void 0 : _b.coverage).toBeDefined();
            (0, vitest_1.expect)((_d = (_c = inputs.account) === null || _c === void 0 ? void 0 : _c.coverage) === null || _d === void 0 ? void 0 : _d.length).toBe(1);
            (0, vitest_1.expect)(inputs.coverages).toBeDefined();
            (0, vitest_1.expect)((_e = inputs.coverages) === null || _e === void 0 ? void 0 : _e.primary).toBeDefined();
            (0, vitest_1.expect)((_g = (_f = inputs.coverages) === null || _f === void 0 ? void 0 : _f.primary) === null || _g === void 0 ? void 0 : _g.id).toBe(bundle1Coverage.id);
            (0, vitest_1.expect)((_j = (_h = inputs.coverages) === null || _h === void 0 ? void 0 : _h.primary) === null || _j === void 0 ? void 0 : _j.subscriber).toBeDefined();
            (0, vitest_1.expect)((_m = (_l = (_k = inputs.coverages) === null || _k === void 0 ? void 0 : _k.primary) === null || _l === void 0 ? void 0 : _l.subscriber) === null || _m === void 0 ? void 0 : _m.reference).toBe("RelatedPerson/".concat(bundle1RP1.id));
            (0, vitest_1.expect)((_o = inputs.coverages) === null || _o === void 0 ? void 0 : _o.primarySubscriber).toBeDefined();
            (0, vitest_1.expect)((_q = (_p = inputs.coverages) === null || _p === void 0 ? void 0 : _p.primarySubscriber) === null || _q === void 0 ? void 0 : _q.id).toBe(bundle1RP1.id);
            (0, vitest_1.expect)(inputs.coverages.secondary).toBeUndefined();
            (0, vitest_1.expect)(inputs.coverages.secondarySubscriber).toBeUndefined();
            (0, vitest_1.expect)(inputs.guarantorResource).toBeDefined();
            (0, vitest_1.expect)(bundle1.some(function (r) { var _a; return r.id === ((_a = inputs.guarantorResource) === null || _a === void 0 ? void 0 : _a.id); })).toBe(false);
            (0, vitest_1.expect)("#".concat((_r = inputs.guarantorResource) === null || _r === void 0 ? void 0 : _r.id)).toBe((_v = (_u = (_t = (_s = inputs.account) === null || _s === void 0 ? void 0 : _s.guarantor) === null || _t === void 0 ? void 0 : _t[0]) === null || _u === void 0 ? void 0 : _u.party) === null || _v === void 0 ? void 0 : _v.reference);
            (0, vitest_1.expect)(inputs.guarantorResource).toEqual((_x = (_w = inputs.account) === null || _w === void 0 ? void 0 : _w.contained) === null || _x === void 0 ? void 0 : _x[0]);
        });
        (0, vitest_1.it)('it should have primary and no secondary coverage when secondary coverage is added but is not associated with existing account', function () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x;
            var secondaryCvg = __assign(__assign({}, stubSecondaryCoverage), { order: 2 });
            var resources = __spreadArray(__spreadArray([], bundle1, true), [secondaryCvg], false);
            var inputs = (0, harvest_1.getCoverageUpdateResourcesFromUnbundled)({ patient: bundle1Patient, resources: resources });
            (0, vitest_1.expect)(inputs).toBeDefined();
            (0, vitest_1.expect)(inputs.account).toBeDefined();
            (0, vitest_1.expect)((_a = inputs.account) === null || _a === void 0 ? void 0 : _a.id).toBe(bundle1Account.id);
            (0, vitest_1.expect)((_b = inputs.account) === null || _b === void 0 ? void 0 : _b.coverage).toBeDefined();
            (0, vitest_1.expect)((_d = (_c = inputs.account) === null || _c === void 0 ? void 0 : _c.coverage) === null || _d === void 0 ? void 0 : _d.length).toBe(1);
            (0, vitest_1.expect)(inputs.coverages).toBeDefined();
            (0, vitest_1.expect)((_e = inputs.coverages) === null || _e === void 0 ? void 0 : _e.primary).toBeDefined();
            (0, vitest_1.expect)((_g = (_f = inputs.coverages) === null || _f === void 0 ? void 0 : _f.primary) === null || _g === void 0 ? void 0 : _g.id).toBe(bundle1Coverage.id);
            (0, vitest_1.expect)((_j = (_h = inputs.coverages) === null || _h === void 0 ? void 0 : _h.primary) === null || _j === void 0 ? void 0 : _j.subscriber).toBeDefined();
            (0, vitest_1.expect)((_m = (_l = (_k = inputs.coverages) === null || _k === void 0 ? void 0 : _k.primary) === null || _l === void 0 ? void 0 : _l.subscriber) === null || _m === void 0 ? void 0 : _m.reference).toBe("RelatedPerson/".concat(bundle1RP1.id));
            (0, vitest_1.expect)((_o = inputs.coverages) === null || _o === void 0 ? void 0 : _o.primarySubscriber).toBeDefined();
            (0, vitest_1.expect)((_q = (_p = inputs.coverages) === null || _p === void 0 ? void 0 : _p.primarySubscriber) === null || _q === void 0 ? void 0 : _q.id).toBe(bundle1RP1.id);
            (0, vitest_1.expect)(inputs.guarantorResource).toBeDefined();
            (0, vitest_1.expect)(bundle1.some(function (r) { var _a; return r.id === ((_a = inputs.guarantorResource) === null || _a === void 0 ? void 0 : _a.id); })).toBe(false);
            (0, vitest_1.expect)("#".concat((_r = inputs.guarantorResource) === null || _r === void 0 ? void 0 : _r.id)).toBe((_v = (_u = (_t = (_s = inputs.account) === null || _s === void 0 ? void 0 : _s.guarantor) === null || _t === void 0 ? void 0 : _t[0]) === null || _u === void 0 ? void 0 : _u.party) === null || _v === void 0 ? void 0 : _v.reference);
            (0, vitest_1.expect)(inputs.guarantorResource).toEqual((_x = (_w = inputs.account) === null || _w === void 0 ? void 0 : _w.contained) === null || _x === void 0 ? void 0 : _x[0]);
            (0, vitest_1.expect)(inputs.coverages.secondary).toBeUndefined();
            (0, vitest_1.expect)(inputs.coverages.secondarySubscriber).toBeUndefined();
        });
        (0, vitest_1.it)('should differentiate workers comp account from patient billing account', function () {
            var _a, _b;
            var resources = __spreadArray(__spreadArray([], bundle1, true), [workersCompAccountResource], false);
            var inputs = (0, harvest_1.getCoverageUpdateResourcesFromUnbundled)({ patient: bundle1Patient, resources: resources });
            (0, vitest_1.expect)((_a = inputs.account) === null || _a === void 0 ? void 0 : _a.id).toBe(bundle1Account.id);
            (0, vitest_1.expect)((_b = inputs.workersCompAccount) === null || _b === void 0 ? void 0 : _b.id).toBe(workersCompAccountResource.id);
        });
        (0, vitest_1.it)('it should have primary and secondary coverage when secondary coverage is added and there is no existing account', function () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x;
            var secondaryCvg = __assign(__assign({}, stubSecondaryCoverage), { order: 2 });
            var resources = __spreadArray(__spreadArray([], bundle1, true), [secondaryCvg], false).filter(function (r) { return r.id !== bundle1Account.id; });
            var inputs = (0, harvest_1.getCoverageUpdateResourcesFromUnbundled)({ patient: bundle1Patient, resources: resources });
            (0, vitest_1.expect)(inputs).toBeDefined();
            (0, vitest_1.expect)(inputs.coverages).toBeDefined();
            (0, vitest_1.expect)((_a = inputs.coverages) === null || _a === void 0 ? void 0 : _a.primary).toBeDefined();
            (0, vitest_1.expect)((_c = (_b = inputs.coverages) === null || _b === void 0 ? void 0 : _b.primary) === null || _c === void 0 ? void 0 : _c.id).toBe(bundle1Coverage.id);
            (0, vitest_1.expect)((_e = (_d = inputs.coverages) === null || _d === void 0 ? void 0 : _d.primary) === null || _e === void 0 ? void 0 : _e.subscriber).toBeDefined();
            (0, vitest_1.expect)((_h = (_g = (_f = inputs.coverages) === null || _f === void 0 ? void 0 : _f.primary) === null || _g === void 0 ? void 0 : _g.subscriber) === null || _h === void 0 ? void 0 : _h.reference).toBe("RelatedPerson/".concat(bundle1RP1.id));
            (0, vitest_1.expect)((_j = inputs.coverages) === null || _j === void 0 ? void 0 : _j.primarySubscriber).toBeDefined();
            (0, vitest_1.expect)((_l = (_k = inputs.coverages) === null || _k === void 0 ? void 0 : _k.primarySubscriber) === null || _l === void 0 ? void 0 : _l.id).toBe(bundle1RP1.id);
            (0, vitest_1.expect)(inputs.coverages.secondary).toBeDefined();
            (0, vitest_1.expect)(inputs.coverages.secondarySubscriber).toBeDefined();
            // the same result basic result should obtain with primary/secondary flipped if the order is flipped on the Coverage resources
            resources = resources.map(function (r) {
                var asAny = r;
                if (asAny.order !== undefined && asAny.resourceType === 'Coverage') {
                    return __assign(__assign({}, asAny), { order: asAny.order === 2 ? 1 : 2 });
                }
                return asAny;
            });
            inputs = (0, harvest_1.getCoverageUpdateResourcesFromUnbundled)({ patient: bundle1Patient, resources: resources });
            (0, vitest_1.expect)(inputs).toBeDefined();
            (0, vitest_1.expect)(inputs.coverages).toBeDefined();
            (0, vitest_1.expect)((_m = inputs.coverages) === null || _m === void 0 ? void 0 : _m.primary).toBeDefined();
            (0, vitest_1.expect)((_p = (_o = inputs.coverages) === null || _o === void 0 ? void 0 : _o.primary) === null || _p === void 0 ? void 0 : _p.id).toBe(secondaryCvg.id);
            (0, vitest_1.expect)((_r = (_q = inputs.coverages) === null || _q === void 0 ? void 0 : _q.primary) === null || _r === void 0 ? void 0 : _r.subscriber).toBeDefined();
            (0, vitest_1.expect)((_u = (_t = (_s = inputs.coverages) === null || _s === void 0 ? void 0 : _s.primary) === null || _t === void 0 ? void 0 : _t.subscriber) === null || _u === void 0 ? void 0 : _u.reference).toBe("RelatedPerson/".concat(bundle1RP1.id));
            (0, vitest_1.expect)((_v = inputs.coverages) === null || _v === void 0 ? void 0 : _v.primarySubscriber).toBeDefined();
            (0, vitest_1.expect)((_x = (_w = inputs.coverages) === null || _w === void 0 ? void 0 : _w.primarySubscriber) === null || _x === void 0 ? void 0 : _x.id).toBe(bundle1RP1.id);
            (0, vitest_1.expect)(inputs.coverages.secondary).toBeDefined();
            (0, vitest_1.expect)(inputs.coverages.secondarySubscriber).toBeDefined();
        });
        (0, vitest_1.it)('it should have primary and secondary coverage when secondary coverage is added and there is no existing account and secondary coverage has a contained RP', function () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x;
            var secondaryCvg = __assign(__assign({}, stubSecondaryCoverage), { subscriber: { reference: "#".concat(expectedSecondaryPolicyHolderFromQR1.id) }, contained: [expectedSecondaryPolicyHolderFromQR1], order: 2 });
            var resources = __spreadArray(__spreadArray([], bundle1, true), [secondaryCvg], false).filter(function (r) { return r.id !== bundle1Account.id; });
            var inputs = (0, harvest_1.getCoverageUpdateResourcesFromUnbundled)({ patient: bundle1Patient, resources: resources });
            (0, vitest_1.expect)(inputs).toBeDefined();
            (0, vitest_1.expect)(inputs.coverages).toBeDefined();
            (0, vitest_1.expect)((_a = inputs.coverages) === null || _a === void 0 ? void 0 : _a.primary).toBeDefined();
            (0, vitest_1.expect)((_c = (_b = inputs.coverages) === null || _b === void 0 ? void 0 : _b.primary) === null || _c === void 0 ? void 0 : _c.id).toBe(bundle1Coverage.id);
            (0, vitest_1.expect)((_e = (_d = inputs.coverages) === null || _d === void 0 ? void 0 : _d.primary) === null || _e === void 0 ? void 0 : _e.subscriber).toBeDefined();
            (0, vitest_1.expect)((_h = (_g = (_f = inputs.coverages) === null || _f === void 0 ? void 0 : _f.primary) === null || _g === void 0 ? void 0 : _g.subscriber) === null || _h === void 0 ? void 0 : _h.reference).toBe("RelatedPerson/".concat(bundle1RP1.id));
            (0, vitest_1.expect)((_j = inputs.coverages) === null || _j === void 0 ? void 0 : _j.primarySubscriber).toBeDefined();
            (0, vitest_1.expect)((_l = (_k = inputs.coverages) === null || _k === void 0 ? void 0 : _k.primarySubscriber) === null || _l === void 0 ? void 0 : _l.id).toBe(bundle1RP1.id);
            (0, vitest_1.expect)(inputs.coverages.secondary).toBeDefined();
            (0, vitest_1.expect)(inputs.coverages.secondarySubscriber).toBeDefined();
            // the same result basic result should obtain with primary/secondary flipped if the order is flipped on the Coverage resources
            resources = resources.map(function (r) {
                var asAny = r;
                if (asAny.order !== undefined && asAny.resourceType === 'Coverage') {
                    return __assign(__assign({}, asAny), { order: asAny.order === 2 ? 1 : 2 });
                }
                return asAny;
            });
            inputs = (0, harvest_1.getCoverageUpdateResourcesFromUnbundled)({ patient: bundle1Patient, resources: resources });
            (0, vitest_1.expect)(inputs).toBeDefined();
            (0, vitest_1.expect)(inputs.coverages).toBeDefined();
            (0, vitest_1.expect)((_m = inputs.coverages) === null || _m === void 0 ? void 0 : _m.primary).toBeDefined();
            (0, vitest_1.expect)((_p = (_o = inputs.coverages) === null || _o === void 0 ? void 0 : _o.primary) === null || _p === void 0 ? void 0 : _p.id).toBe(secondaryCvg.id);
            (0, vitest_1.expect)((_r = (_q = inputs.coverages) === null || _q === void 0 ? void 0 : _q.primary) === null || _r === void 0 ? void 0 : _r.subscriber).toBeDefined();
            (0, vitest_1.expect)((_u = (_t = (_s = inputs.coverages) === null || _s === void 0 ? void 0 : _s.primary) === null || _t === void 0 ? void 0 : _t.subscriber) === null || _u === void 0 ? void 0 : _u.reference).toBe("#".concat(expectedSecondaryPolicyHolderFromQR1.id));
            (0, vitest_1.expect)((_v = inputs.coverages) === null || _v === void 0 ? void 0 : _v.primarySubscriber).toBeDefined();
            (0, vitest_1.expect)((_x = (_w = inputs.coverages) === null || _w === void 0 ? void 0 : _w.primarySubscriber) === null || _x === void 0 ? void 0 : _x.id).toBe(expectedSecondaryPolicyHolderFromQR1.id);
            (0, vitest_1.expect)(inputs.coverages.secondary).toBeDefined();
            (0, vitest_1.expect)(inputs.coverages.secondarySubscriber).toBeDefined();
        });
    });
});
var checkAccountOperations = function (accountOps, expectedAccount) {
    var adjustExpectedAccount = function (account, coveragePosts) {
        var _a;
        var adjustedAccount = __assign({}, account);
        var idx = 0;
        adjustedAccount.coverage = (_a = adjustedAccount.coverage) === null || _a === void 0 ? void 0 : _a.map(function (coverage) {
            var _a;
            var base = __assign({}, coverage);
            if (base.coverage.reference && !base.coverage.reference.startsWith('Coverage/')) {
                base.coverage.reference = (_a = coveragePosts[idx]) === null || _a === void 0 ? void 0 : _a.fullUrl;
                idx += 1;
            }
            return base;
        });
        return adjustedAccount;
    };
    (0, vitest_1.expect)(accountOps).toBeDefined();
    (0, vitest_1.assert)(accountOps);
    var post = accountOps.accountPost, coveragePosts = accountOps.coveragePosts, put = accountOps.put;
    if (post) {
        (0, vitest_1.expect)(post === null || post === void 0 ? void 0 : post.resourceType).toBe('Account');
        (0, vitest_1.expect)(post === null || post === void 0 ? void 0 : post.status).toBe('active');
        var adjustedAccount = adjustExpectedAccount(expectedAccount, coveragePosts);
        (0, vitest_1.expect)(post).toEqual(adjustedAccount);
        coveragePosts === null || coveragePosts === void 0 ? void 0 : coveragePosts.forEach(function (coveragePost) {
            var _a;
            var someMatch = (_a = post.coverage) === null || _a === void 0 ? void 0 : _a.some(function (c) { return c.coverage.reference === coveragePost.fullUrl; });
            (0, vitest_1.expect)(someMatch).toBe(true);
        });
    }
    else {
        if (coveragePosts.length) {
            coveragePosts === null || coveragePosts === void 0 ? void 0 : coveragePosts.forEach(function (coveragePost) {
                var _a;
                var accountPut = put.find(function (p) { return p.url.startsWith('Account/'); });
                (0, vitest_1.expect)(accountPut).toBeDefined();
                var updatedAccount = accountPut === null || accountPut === void 0 ? void 0 : accountPut.resource;
                (0, vitest_1.expect)(updatedAccount).toBeDefined();
                (0, vitest_1.assert)(updatedAccount);
                var someMatch = (_a = updatedAccount.coverage) === null || _a === void 0 ? void 0 : _a.some(function (c) { return c.coverage.reference === coveragePost.fullUrl; });
                (0, vitest_1.expect)(someMatch).toBe(true);
            });
        }
    }
};
// supporting resources
var newPatient1 = {
    id: '36ef99c2-43fa-40f6-bf9c-d9ea12c2bf61',
    meta: {
        versionId: 'df82db58-cd5b-4585-86cd-d59dcd7ffab9',
        lastUpdated: '2025-02-21T21:41:16.238Z',
    },
    name: [
        {
            given: ['John', 'Wesley'],
            family: 'Harding',
        },
    ],
    active: true,
    gender: 'male',
    telecom: [
        {
            value: 'ibenham+jwh@masslight.com',
            system: 'email',
        },
    ],
    birthDate: '1984-06-12',
    resourceType: 'Patient',
};
var questionnaireResponse1 = {
    resourceType: 'QuestionnaireResponse',
    questionnaire: "".concat(InPersonQuestionnaire.url, "|").concat(InPersonQuestionnaire.version),
    status: 'completed',
    item: [
        {
            linkId: 'contact-information-page',
            item: [
                {
                    linkId: 'patient-first-name',
                    answer: [
                        {
                            valueString: 'John',
                        },
                    ],
                },
                {
                    linkId: 'patient-last-name',
                    answer: [
                        {
                            valueString: 'Harding',
                        },
                    ],
                },
                {
                    linkId: 'patient-birthdate',
                    answer: [
                        {
                            valueString: '1984-06-12',
                        },
                    ],
                },
                {
                    linkId: 'patient-birth-sex',
                    answer: [
                        {
                            valueString: 'Male',
                        },
                    ],
                },
                {
                    linkId: 'patient-street-address',
                    answer: [
                        {
                            valueString: '123 Main St',
                        },
                    ],
                },
                {
                    linkId: 'patient-street-address-2',
                    answer: [
                        {
                            valueString: 'Apt 4B',
                        },
                    ],
                },
                {
                    linkId: 'patient-city',
                    answer: [
                        {
                            valueString: 'Springfield',
                        },
                    ],
                },
                {
                    linkId: 'patient-state',
                    answer: [
                        {
                            valueString: 'IL',
                        },
                    ],
                },
                {
                    linkId: 'patient-zip',
                    answer: [
                        {
                            valueString: '62701',
                        },
                    ],
                },
                {
                    linkId: 'patient-will-be-18',
                    answer: [
                        {
                            valueBoolean: true,
                        },
                    ],
                },
                {
                    linkId: 'is-new-qrs-patient',
                    answer: [
                        {
                            valueBoolean: true,
                        },
                    ],
                },
                {
                    linkId: 'patient-email',
                    answer: [
                        {
                            valueString: 'ibenham+jwh@masslight.com',
                        },
                    ],
                },
                {
                    linkId: 'patient-number',
                    answer: [
                        {
                            valueString: '(313) 482-5424',
                        },
                    ],
                },
                {
                    linkId: 'mobile-opt-in',
                },
                {
                    linkId: 'patient-birth-sex-missing',
                },
                {
                    linkId: 'patient-contact-additional-caption',
                },
            ],
        },
        {
            linkId: 'patient-details-page',
            item: [
                {
                    linkId: 'patient-ethnicity',
                    answer: [
                        {
                            valueString: 'Not Hispanic or Latino',
                        },
                    ],
                },
                {
                    linkId: 'patient-race',
                    answer: [
                        {
                            valueString: 'White',
                        },
                    ],
                },
                {
                    linkId: 'patient-pronouns',
                    answer: [
                        {
                            valueString: 'He/Him',
                        },
                    ],
                },
                {
                    linkId: 'patient-pronouns-custom',
                },
                {
                    linkId: 'patient-details-additional-text',
                },
                {
                    linkId: 'patient-point-of-discovery',
                    answer: [
                        {
                            valueString: 'Internet Search',
                        },
                    ],
                },
                {
                    linkId: 'preferred-language',
                    answer: [
                        {
                            valueString: 'English',
                        },
                    ],
                },
            ],
        },
        {
            linkId: 'primary-care-physician-page',
            item: [
                {
                    linkId: 'pcp-name',
                    answer: [
                        {
                            valueString: 'Dr. Smith',
                        },
                    ],
                },
                {
                    linkId: 'pcp-phone',
                    answer: [
                        {
                            valueString: '(555) 123-4567',
                        },
                    ],
                },
                {
                    linkId: 'pcp-fax',
                    answer: [
                        {
                            valueString: '(555) 765-4321',
                        },
                    ],
                },
                {
                    linkId: 'pcp-address',
                    answer: [
                        {
                            valueString: '456 Elm St, Springfield, IL 62701',
                        },
                    ],
                },
                {
                    linkId: 'pcp-email',
                    answer: [
                        {
                            valueString: 'dr.smith@example.com',
                        },
                    ],
                },
            ],
        },
        {
            linkId: 'payment-option-page',
            item: [
                {
                    linkId: 'payment-option',
                    answer: [
                        {
                            valueString: utils_1.INSURANCE_PAY_OPTION,
                        },
                    ],
                },
                {
                    linkId: 'card-payment-data',
                },
                {
                    linkId: 'insurance-carrier',
                    answer: [
                        {
                            valueReference: {
                                reference: 'Organization/db875d9d-5726-4c45-a689-e11a7bbdf176',
                                display: 'Aetna',
                            },
                        },
                    ],
                },
                {
                    linkId: 'insurance-plan-type',
                    answer: [{ valueString: '09' }],
                },
                {
                    linkId: 'insurance-member-id',
                    answer: [
                        {
                            valueString: 'FafOneJwgNdkOetWwe6',
                        },
                    ],
                },
                {
                    linkId: 'policy-holder-first-name',
                    answer: [
                        {
                            valueString: 'Barnabas',
                        },
                    ],
                },
                {
                    linkId: 'policy-holder-middle-name',
                    answer: [
                        {
                            valueString: 'Thaddeus',
                        },
                    ],
                },
                {
                    linkId: 'policy-holder-last-name',
                    answer: [
                        {
                            valueString: 'PicklesWorth',
                        },
                    ],
                },
                {
                    linkId: 'policy-holder-date-of-birth',
                    answer: [
                        {
                            valueString: '1982-02-23',
                        },
                    ],
                },
                {
                    linkId: 'policy-holder-birth-sex',
                    answer: [
                        {
                            valueString: 'Male',
                        },
                    ],
                },
                {
                    linkId: 'policy-holder-address-as-patient',
                },
                {
                    linkId: 'policy-holder-address',
                    answer: [
                        {
                            valueString: '317 Mustard Street',
                        },
                    ],
                },
                {
                    linkId: 'policy-holder-address-additional-line',
                    answer: [
                        {
                            valueString: 'Unit 2',
                        },
                    ],
                },
                {
                    linkId: 'policy-holder-city',
                    answer: [
                        {
                            valueString: 'DeliciousVilla',
                        },
                    ],
                },
                {
                    linkId: 'policy-holder-state',
                    answer: [
                        {
                            valueString: 'DE',
                        },
                    ],
                },
                {
                    linkId: 'policy-holder-zip',
                    answer: [
                        {
                            valueString: '20001',
                        },
                    ],
                },
                {
                    linkId: 'patient-relationship-to-insured',
                    answer: [
                        {
                            valueString: 'Child',
                        },
                    ],
                },
                {
                    linkId: 'insurance-additional-information',
                    answer: [
                        {
                            valueString: 'Additional info to primary insurance',
                        },
                    ],
                },
                {
                    linkId: 'insurance-card-front',
                    answer: [
                        {
                            valueAttachment: {
                                url: 'https://project-api.zapehr.com/v1/z3/0ba6d7a5-a5a6-4c16-a6d9-ce91f300acb4-insurance-cards/099639e6-c89c-4bad-becf-ce15ce010f21/2025-02-23-1740344290487-insurance-card-front.png',
                                title: 'insurance-card-front',
                                creation: '2025-02-23T15:58:10.979-05:00',
                                contentType: 'image/png',
                            },
                        },
                    ],
                },
                {
                    linkId: 'insurance-card-back',
                    answer: [
                        {
                            valueAttachment: {
                                url: 'https://project-api.zapehr.com/v1/z3/0ba6d7a5-a5a6-4c16-a6d9-ce91f300acb4-insurance-cards/099639e6-c89c-4bad-becf-ce15ce010f21/2025-02-23-1740344301743-insurance-card-back.png',
                                title: 'insurance-card-back',
                                creation: '2025-02-23T15:58:22.405-05:00',
                                contentType: 'image/png',
                            },
                        },
                    ],
                },
                {
                    linkId: 'insurance-eligibility-verification-status',
                    answer: [
                        {
                            valueString: 'eligibility-confirmed',
                        },
                        {
                            valueString: 'eligibility-check-not-supported',
                        },
                    ],
                },
                {
                    linkId: 'display-secondary-insurance',
                    answer: [
                        {
                            valueBoolean: true,
                        },
                    ],
                },
                {
                    item: [
                        {
                            linkId: 'insurance-carrier-2',
                            answer: [
                                {
                                    valueReference: {
                                        reference: 'Organization/a9bada42-935a-45fa-ba8e-aa3b29478884',
                                        display: 'United Heartland',
                                    },
                                },
                            ],
                        },
                        {
                            linkId: 'insurance-plan-type-2',
                            answer: [{ valueString: '12' }],
                        },
                        {
                            linkId: 'insurance-member-id-2',
                            answer: [
                                {
                                    valueString: 'FdfDfdFdfDfh7897',
                                },
                            ],
                        },
                        {
                            linkId: 'policy-holder-first-name-2',
                            answer: [
                                {
                                    valueString: 'Jennifer',
                                },
                            ],
                        },
                        {
                            linkId: 'policy-holder-middle-name-2',
                            answer: [
                                {
                                    valueString: 'Celeste',
                                },
                            ],
                        },
                        {
                            linkId: 'policy-holder-last-name-2',
                            answer: [
                                {
                                    valueString: 'PicklesWorth',
                                },
                            ],
                        },
                        {
                            linkId: 'policy-holder-date-of-birth-2',
                            answer: [
                                {
                                    valueString: '1983-02-23',
                                },
                            ],
                        },
                        {
                            linkId: 'policy-holder-birth-sex-2',
                            answer: [
                                {
                                    valueString: 'Female',
                                },
                            ],
                        },
                        {
                            linkId: 'policy-holder-address-as-patient-2',
                            answer: [
                                {
                                    valueBoolean: true,
                                },
                            ],
                        },
                        {
                            linkId: 'policy-holder-address-2',
                            answer: [
                                {
                                    valueString: '317 R St NW Unit 2',
                                },
                            ],
                        },
                        {
                            linkId: 'policy-holder-address-additional-line-2',
                            answer: [
                                {
                                    valueString: 'conditional-filter-test-1234',
                                },
                            ],
                        },
                        {
                            linkId: 'policy-holder-city-2',
                            answer: [
                                {
                                    valueString: 'Washington',
                                },
                            ],
                        },
                        {
                            linkId: 'policy-holder-state-2',
                            answer: [
                                {
                                    valueString: 'DC',
                                },
                            ],
                        },
                        {
                            linkId: 'policy-holder-zip-2',
                            answer: [
                                {
                                    valueString: '20001',
                                },
                            ],
                        },
                        {
                            linkId: 'patient-relationship-to-insured-2',
                            answer: [
                                {
                                    valueString: 'Child',
                                },
                            ],
                        },
                        {
                            linkId: 'insurance-additional-information-2',
                            answer: [
                                {
                                    valueString: 'Additional info to secondary insurance',
                                },
                            ],
                        },
                        {
                            linkId: 'insurance-card-front-2',
                        },
                        {
                            linkId: 'insurance-card-back-2',
                        },
                    ],
                    linkId: 'secondary-insurance',
                },
            ],
        },
        {
            linkId: 'responsible-party-page',
            item: [
                {
                    linkId: 'responsible-party-first-name',
                    answer: [
                        {
                            valueString: 'Jane',
                        },
                    ],
                },
                {
                    linkId: 'responsible-party-last-name',
                    answer: [
                        {
                            valueString: 'Doe',
                        },
                    ],
                },
                {
                    linkId: 'responsible-party-birth-sex',
                    answer: [
                        {
                            valueString: 'Female',
                        },
                    ],
                },
                {
                    linkId: 'responsible-party-date-of-birth',
                    answer: [
                        {
                            valueString: '1983-02-23',
                        },
                    ],
                },
                {
                    linkId: 'responsible-party-relationship',
                    answer: [
                        {
                            valueString: 'Parent',
                        },
                    ],
                },
                {
                    linkId: 'responsible-party-address',
                    answer: [
                        {
                            valueString: '123 test lane',
                        },
                    ],
                },
                {
                    linkId: 'responsible-party-address-2',
                },
                {
                    linkId: 'responsible-party-city',
                    answer: [
                        {
                            valueString: 'fakePlace',
                        },
                    ],
                },
                {
                    linkId: 'responsible-party-state',
                    answer: [
                        {
                            valueString: 'NY',
                        },
                    ],
                },
                {
                    linkId: 'responsible-party-zip',
                    answer: [
                        {
                            valueString: '11111',
                        },
                    ],
                },
                {
                    linkId: 'responsible-party-number',
                    answer: [
                        {
                            valueString: '(989) 555-6543',
                        },
                    ],
                },
                {
                    linkId: 'responsible-party-email',
                    answer: [
                        {
                            valueString: 'rowdyroddypiper@hotmail.com',
                        },
                    ],
                },
            ],
        },
        {
            linkId: 'photo-id-page',
        },
        {
            linkId: 'consent-forms-page',
        },
    ],
};
/*
const insurancePlans1: InsurancePlan[] = [
  {
    resourceType: 'InsurancePlan',
    name: 'United Heartland',
    meta: {
      tag: [
        {
          code: INSURANCE_PLAN_PAYER_META_TAG_CODE,
        },
      ],
      versionId: 'dd91938c-7dac-4713-80bf-d813e4e798e5',
      lastUpdated: '2024-12-12T10:02:42.725Z',
    },
    ownedBy: {
      reference: 'Organization/a9bada42-935a-45fa-ba8e-aa3b29478884',
    },
    status: 'active',
    extension: [
      {
        url: INSURANCE_REQ_EXTENSION_URL,
        extension: [
          {
            url: 'requiresSubscriberId',
            valueBoolean: true,
          },
          {
            url: 'requiresSubscriberName',
            valueBoolean: false,
          },
          {
            url: 'requiresRelationshipToSubscriber',
            valueBoolean: true,
          },
          {
            url: 'requiresInsuranceName',
            valueBoolean: true,
          },
          {
            url: 'requiresInsuranceCardImage',
            valueBoolean: true,
          },
          {
            url: 'requiresSubscriberDOB',
            valueBoolean: false,
          },
          {
            url: 'requiresFacilityNPI',
            valueBoolean: false,
          },
          {
            url: 'requiresStateUID',
            valueBoolean: false,
          },
          {
            url: 'enabledEligibilityCheck',
            valueBoolean: true,
          },
        ],
      },
    ],
    id: '217badd9-ded4-4efa-91b9-10ab7cdcb8b8',
  },
  {
    resourceType: 'InsurancePlan',
    name: 'Aetna',
    meta: {
      tag: [
        {
          code: INSURANCE_PLAN_PAYER_META_TAG_CODE,
        },
      ],
      versionId: 'b8833d6b-9530-4db2-af23-ed18ede74c56',
      lastUpdated: '2024-12-12T10:01:13.104Z',
    },
    ownedBy: {
      reference: 'Organization/db875d9d-5726-4c45-a689-e11a7bbdf176',
    },
    status: 'active',
    extension: [
      {
        url: INSURANCE_REQ_EXTENSION_URL,
        extension: [
          {
            url: 'requiresSubscriberId',
            valueBoolean: true,
          },
          {
            url: 'requiresSubscriberName',
            valueBoolean: false,
          },
          {
            url: 'requiresRelationshipToSubscriber',
            valueBoolean: true,
          },
          {
            url: 'requiresInsuranceName',
            valueBoolean: true,
          },
          {
            url: 'requiresInsuranceCardImage',
            valueBoolean: true,
          },
          {
            url: 'requiresSubscriberDOB',
            valueBoolean: false,
          },
          {
            url: 'requiresFacilityNPI',
            valueBoolean: false,
          },
          {
            url: 'requiresStateUID',
            valueBoolean: false,
          },
          {
            url: 'enabledEligibilityCheck',
            valueBoolean: true,
          },
        ],
      },
    ],
    id: '45ae21d2-12a3-4727-b915-896f7dc57dbd',
  },
];
*/
var organizations1 = [
    {
        resourceType: 'Organization',
        active: true,
        name: 'United Heartland',
        type: [
            {
                coding: [
                    {
                        system: "".concat(utils_1.ORG_TYPE_CODE_SYSTEM),
                        code: utils_1.ORG_TYPE_PAYER_CODE,
                    },
                ],
            },
        ],
        identifier: [
            {
                type: {
                    coding: [
                        {
                            code: 'XX',
                            system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                        },
                    ],
                },
                value: 'J1859',
            },
        ],
        extension: [
            {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/eligibility',
                valueString: 'no',
            },
            {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/era',
                valueString: 'enrollment',
            },
            {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/payer-type',
                // cSpell:disable-next workerscomp
                valueString: 'workerscomp',
            },
        ],
        id: 'a9bada42-935a-45fa-ba8e-aa3b29478884',
        meta: {
            versionId: 'adc6c2ad-26e6-4ca1-b053-b0f4bf60ae04',
            lastUpdated: '2024-12-12T10:02:42.483Z',
        },
    },
    {
        resourceType: 'Organization',
        active: true,
        name: 'Aetna',
        type: [
            {
                coding: [
                    {
                        system: "".concat(utils_1.ORG_TYPE_CODE_SYSTEM),
                        code: utils_1.ORG_TYPE_PAYER_CODE,
                    },
                ],
            },
        ],
        identifier: [
            {
                type: {
                    coding: [
                        {
                            code: 'XX',
                            system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                        },
                    ],
                },
                value: '60054',
            },
        ],
        extension: [
            {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/eligibility',
                valueString: 'yes',
            },
            {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/era',
                valueString: 'enrollment',
            },
            {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/payer-type',
                valueString: 'commercial',
            },
        ],
        id: 'db875d9d-5726-4c45-a689-e11a7bbdf176',
        meta: {
            versionId: '7bd10109-093f-413a-978d-d97d146ddc95',
            lastUpdated: '2024-12-12T10:01:12.820Z',
        },
    },
];
// Resource bundles
var bundle1Patient = {
    id: '36ef99c2-43fa-40f6-bf9c-d9ea12c2bf61',
    meta: {
        versionId: 'df82db58-cd5b-4585-86cd-d59dcd7ffab9',
        lastUpdated: '2025-02-21T21:41:16.238Z',
    },
    name: [
        {
            given: ['John', 'Wesley'],
            family: 'Harding',
        },
    ],
    active: true,
    gender: 'male',
    telecom: [
        {
            value: 'ibenham+jwh@masslight.com',
            system: 'email',
        },
    ],
    birthDate: '1984-06-12',
    resourceType: 'Patient',
};
var bundle1Account = {
    id: '3d6c331b-ed16-40ec-a7ab-9935c7699f09',
    resourceType: 'Account',
    status: 'active',
    contained: [
        {
            resourceType: 'RelatedPerson',
            id: 'accountGuarantorId',
            name: [
                {
                    given: ['Jane'],
                    family: 'Doe',
                },
            ],
            birthDate: '1983-02-23',
            gender: 'female',
            patient: {
                reference: 'Patient/36ef99c2-43fa-40f6-bf9c-d9ea12c2bf61',
            },
            relationship: [
                {
                    coding: [
                        {
                            system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
                            code: 'parent',
                            display: 'Parent',
                        },
                    ],
                },
            ],
        },
    ],
    type: {
        coding: [
            {
                system: 'http://terminology.hl7.org/CodeSystem/account-type',
                code: 'PBILLACCT',
                display: 'patient billing account',
            },
        ],
    },
    subject: [
        {
            type: 'Patient',
            reference: 'Patient/36ef99c2-43fa-40f6-bf9c-d9ea12c2bf61',
        },
    ],
    guarantor: [
        {
            party: {
                reference: '#accountGuarantorId',
            },
        },
    ],
    coverage: [
        {
            coverage: {
                type: 'Coverage',
                reference: 'Coverage/4a3d4bd6-6c1a-422a-a26f-71b967f3b00c',
            },
            priority: 1,
        },
    ],
    meta: {
        versionId: '3728b10d-4f4d-4401-9be4-f4f7f43aa488',
        lastUpdated: '2025-03-01T03:03:27.796Z',
    },
};
var workersCompAccountResource = {
    id: '8a733a57-42d8-4b67-9f56-3b6448169b05',
    resourceType: 'Account',
    status: 'active',
    type: {
        coding: [
            {
                system: 'http://terminology.hl7.org/CodeSystem/account-type',
                code: 'WCOMPACCT',
                display: 'worker compensation account',
            },
        ],
    },
    subject: [
        {
            reference: 'Patient/36ef99c2-43fa-40f6-bf9c-d9ea12c2bf61',
            type: 'Patient',
        },
    ],
};
var bundle1RP1 = {
    id: '90ad77cd-ff76-426a-951a-b35f5ef8b302',
    meta: {
        versionId: '144b3d41-b149-49af-875a-998335101384',
        lastUpdated: '2025-02-21T21:41:19.721Z',
    },
    patient: {
        reference: 'Patient/36ef99c2-43fa-40f6-bf9c-d9ea12c2bf61',
    },
    telecom: [
        {
            value: '+13134825424',
            system: 'phone',
        },
        {
            value: '+13134825424',
            system: 'sms',
        },
    ],
    relationship: [
        {
            coding: [
                {
                    code: 'user-relatedperson',
                    system: 'https://fhir.zapehr.com/r4/StructureDefinitions/relationship',
                },
            ],
        },
    ],
    resourceType: 'RelatedPerson',
};
var bundle1RP2 = {
    id: '90ad77cd-ff76-426a-951a-b35f5ef8b302',
    meta: {
        versionId: '144b3d41-b149-49af-875a-998335101384',
        lastUpdated: '2025-02-21T21:41:19.721Z',
    },
    patient: {
        reference: 'Patient/36ef99c2-43fa-40f6-bf9c-d9ea12c2bf61',
    },
    telecom: [
        {
            value: '+13134825424',
            system: 'phone',
        },
        {
            value: '+13134825424',
            system: 'sms',
        },
    ],
    relationship: [
        {
            coding: [
                {
                    code: 'user-relatedperson',
                    system: 'https://fhir.zapehr.com/r4/StructureDefinitions/relationship',
                },
            ],
        },
    ],
    resourceType: 'RelatedPerson',
};
var bundle1Coverage = {
    id: '4a3d4bd6-6c1a-422a-a26f-71b967f3b00c',
    resourceType: 'Coverage',
    status: 'active',
    type: {
        coding: [
            {
                code: '09',
                system: 'https://fhir.ottehr.com/CodeSystem/candid-plan-type',
            },
            {
                code: 'pay',
                system: 'http://terminology.hl7.org/CodeSystem/coverage-selfpay',
            },
        ],
    },
    order: 1,
    subscriber: {
        type: 'RelatedPerson',
        reference: 'RelatedPerson/90ad77cd-ff76-426a-951a-b35f5ef8b302',
    },
    subscriberId: 'FafOneJwgNdkOetWwe6',
    beneficiary: {
        type: 'Patient',
        reference: 'Patient/36ef99c2-43fa-40f6-bf9c-d9ea12c2bf61',
    },
    relationship: {
        coding: [
            {
                system: 'http://terminology.hl7.org/CodeSystem/subscriber-relationship',
                code: 'child',
                display: 'Child',
            },
        ],
    },
    payor: [
        {
            type: 'Organization',
            reference: 'Organization/a9bada42-935a-45fa-ba8e-aa3b29478884',
        },
    ],
    meta: {
        versionId: '4ed8910a-c056-450d-ad5d-ad5f477645a3',
        lastUpdated: '2025-03-01T02:46:02.698Z',
    },
};
var bundle1 = [
    bundle1Account,
    bundle1RP1,
    bundle1RP2,
    bundle1Patient,
    bundle1Coverage,
];
