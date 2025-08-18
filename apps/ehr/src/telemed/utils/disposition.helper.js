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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.reasonsForTransferOptions = exports.virusTestsOptions = exports.labServiceOptions = exports.SEND_OUT_VIRUS_TEST_LABEL = exports.followUpInOptions = exports.mapDispositionToForm = exports.mapFormToDisposition = exports.DEFAULT_DISPOSITION_VALUES = exports.dispositionFieldsPerType = void 0;
var utils_1 = require("utils");
Object.defineProperty(exports, "followUpInOptions", { enumerable: true, get: function () { return utils_1.followUpInOptions; } });
exports.dispositionFieldsPerType = {
    pcp: ['followUpIn', 'followUpType'],
    ip: ['bookVisit'],
    'ip-lab': ['labService', 'bookVisit', 'followUpType'],
    ed: [utils_1.NOTHING_TO_EAT_OR_DRINK_FIELD],
    'ip-oth': [],
    'pcp-no-type': ['followUpIn'],
    another: ['reason'],
    specialty: ['followUpIn'],
};
exports.DEFAULT_DISPOSITION_VALUES = (_a = {
        type: 'pcp-no-type',
        note: '',
        followUpIn: '',
        reason: '',
        labService: [],
        virusTest: [],
        dentistry: false,
        ent: false,
        ophthalmology: false,
        orthopedics: false,
        other: false,
        'lurie-ct': false,
        otherNote: ''
    },
    _a[utils_1.NOTHING_TO_EAT_OR_DRINK_FIELD] = false,
    _a);
var mapFormToDisposition = function (values) {
    var disposition = { type: values.type, note: values.note || 'N/A' };
    var fields = exports.dispositionFieldsPerType[disposition.type];
    if (fields.includes('labService')) {
        disposition.labService = values.labService || [];
        disposition.virusTest = values.virusTest || [];
    }
    if (fields.includes('followUpIn')) {
        disposition.followUpIn = values.followUpIn === '' ? undefined : values.followUpIn;
    }
    if (fields.includes('reason')) {
        disposition.reason = values.reason === '' ? undefined : values.reason;
    }
    if (fields.includes('followUpType')) {
        disposition.followUp = [];
        utils_1.dispositionCheckboxOptions.forEach(function (option) {
            var _a, _b;
            var isOtherOption = option.name === 'other';
            var otherOptionValue = option.name === 'other' ? (_b = (_a = values.otherNote) === null || _a === void 0 ? void 0 : _a.trim) === null || _b === void 0 ? void 0 : _b.call(_a) : undefined;
            var isOtherOptionWithValue = isOtherOption && otherOptionValue;
            if ((!isOtherOption && values[option.name]) || isOtherOptionWithValue) {
                disposition.followUp.push({
                    type: option.name,
                    note: option.name === 'other' ? otherOptionValue : undefined,
                });
            }
        });
        if (disposition.followUp.length === 0) {
            delete disposition.followUp;
        }
    }
    if (fields.includes(utils_1.NOTHING_TO_EAT_OR_DRINK_FIELD)) {
        disposition[utils_1.NOTHING_TO_EAT_OR_DRINK_FIELD] = values[utils_1.NOTHING_TO_EAT_OR_DRINK_FIELD];
    }
    return disposition;
};
exports.mapFormToDisposition = mapFormToDisposition;
var mapDispositionToForm = function (disposition) {
    var _a;
    var values = __assign({}, exports.DEFAULT_DISPOSITION_VALUES);
    values.type = disposition.type;
    values.note = disposition.note === 'N/A' ? '' : disposition.note;
    var fields = exports.dispositionFieldsPerType[disposition.type];
    if (fields.includes('labService')) {
        values.labService = disposition.labService || [];
        values.virusTest = disposition.virusTest || [];
    }
    if (fields.includes('followUpIn')) {
        values.followUpIn = typeof disposition.followUpIn === 'number' ? disposition.followUpIn : '';
    }
    if (fields.includes('reason')) {
        values.reason = disposition.reason || '';
    }
    if (fields.includes('followUpType')) {
        (_a = disposition.followUp) === null || _a === void 0 ? void 0 : _a.forEach(function (followUp) {
            values[followUp.type] = true;
            if (followUp.type === 'other') {
                values.otherNote = followUp.note || '';
            }
        });
    }
    if (fields.includes(utils_1.NOTHING_TO_EAT_OR_DRINK_FIELD)) {
        values[utils_1.NOTHING_TO_EAT_OR_DRINK_FIELD] = disposition[utils_1.NOTHING_TO_EAT_OR_DRINK_FIELD];
    }
    return values;
};
exports.mapDispositionToForm = mapDispositionToForm;
exports.SEND_OUT_VIRUS_TEST_LABEL = 'Send out virus test';
exports.labServiceOptions = [
    {
        label: 'COVID PCR',
        note: "Based on our medical evaluation, you will undergo COVID-19 PCR testing. You will be provided with additional instructions to access your patient portal and view test results during your in-person visit at our office. The ".concat(utils_1.PROJECT_NAME, " Telemedicine app is available daily beginning at 8AM to patients from birth through age 26 for all virtual urgent care needs. The Covid PCR test will be scheduled."),
    },
    {
        label: 'COVID Rapid Antigen only',
        note: "Based on our medical evaluation, you will undergo a COVID-19 Rapid Antigen test. You will be provided with additional instructions to access your patient portal and view test results during your in-person visit at our office. The ".concat(utils_1.PROJECT_NAME, " Telemedicine app is available daily beginning at 8AM to patients from birth through age 26 for all virtual urgent care needs. Your Covid Rapid Antigen test will be scheduled."),
    },
    {
        label: 'COVID Rapid Antigen & Reflex PCR',
        note: "Based on our medical evaluation, you will undergo a COVID-19 Rapid Antigen test. If this rapid test is negative, a more accurate confirmatory \u201CPCR\u201D will be sent to the lab. You will be provided with additional instructions to access your patient portal and view test results during your in-person visit at our office. The ".concat(utils_1.PROJECT_NAME, " Telemedicine app is available daily beginning at 8AM to patients from birth through age 26 for all virtual urgent care needs. The Covid Rapid Antigen Test will be scheduled."),
    },
    { label: 'Multiple Tests', note: "For the following tests, please proceed to ".concat(utils_1.PROJECT_NAME, ".") },
    {
        label: 'Rapid Strep/Throat Culture',
        note: "Based on our medical evaluation, you will undergo a rapid Strep test. If the rapid test is positive, a provider at ".concat(utils_1.PROJECT_NAME, " will be in contact with you within 2 hours and provide a prescription. If the rapid test is negative, a confirmatory test will be sent to the lab and we will notify you if the results indicate a need for treatment. Confirmatory lab results may take up to 5 days to return. All lab results and instructions from your child's provider can be found in your patient portal."),
    },
    {
        label: 'Rapid Strep/Throat Culture & COVID PCR',
        note: "Based on our medical evaluation, you will undergo a COVID-19 test. Based on our medical evaluation, you will ALSO undergo a rapid Strep test. If the rapid test is positive, a provider at ".concat(utils_1.PROJECT_NAME, " will be in contact with you within 2 hours and provide a prescription. If the rapid test is negative, a confirmatory test will be sent to the lab and we will notify you if the results indicate a need for treatment. Confirmatory lab results may take up to 5 days to return. All lab results and instructions from your child's provider can be found in your patient portal."),
    },
    {
        label: 'UA/UCX',
        note: "Based on our medical evaluation, you will undergo a rapid urine test (urinalysis). Please go to ".concat(utils_1.PROJECT_NAME, " to provide a urine sample. Be sure to drink plenty of fluids prior to coming to the office. The urine sample must be collected on site at ").concat(utils_1.PROJECT_NAME, " using a sterile urine cup. We are unable to accept urine samples taken at home. If the urinalysis is positive, a provider at ").concat(utils_1.PROJECT_NAME, " will be in contact with you within 2 hours and provide a prescription. If the urinalysis is negative, a confirmatory test (urine culture) will be sent to the lab and we will notify you if the results indicate a need for treatment. Urine culture results may take up to 5 days to return. All lab results and instructions from your child's provider can be found in your patient portal."),
    },
    { label: exports.SEND_OUT_VIRUS_TEST_LABEL },
];
exports.virusTestsOptions = ['Flu', 'RSV', 'COVID', 'Other'];
exports.reasonsForTransferOptions = ['Equipment availability', 'Procedure or advanced care', 'Xray'];
//# sourceMappingURL=disposition.helper.js.map