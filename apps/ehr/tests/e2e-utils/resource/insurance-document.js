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
exports.createDocumentReference = createDocumentReference;
function createDocumentReference(_a) {
    var _b = _a.status, status = _b === void 0 ? 'superseded' : _b, _c = _a.date, date = _c === void 0 ? new Date().toISOString() : _c, patientId = _a.patientId, appointmentId = _a.appointmentId, _d = _a.frontUrl, frontUrl = _d === void 0 ? 'https://testing.project-api.zapehr.com/v1/z3/local-insurance-cards/2bc5ab8d-c1c2-4ca3-804b-c61066a62cb4/1721330510132-insurance-card-front.jpeg' : _d, _e = _a.backUrl, backUrl = _e === void 0 ? 'https://testing.project-api.zapehr.com/v1/z3/local-insurance-cards/2bc5ab8d-c1c2-4ca3-804b-c61066a62cb4/1721330518576-insurance-card-back.jpeg' : _e, _f = _a.frontContentType, frontContentType = _f === void 0 ? 'image/jpeg' : _f, _g = _a.backContentType, backContentType = _g === void 0 ? 'image/jpeg' : _g, _h = _a.tagCode, tagCode = _h === void 0 ? 'IN-PERSON' : _h, _j = _a.type, type = _j === void 0 ? {
        system: 'http://loinc.org',
        code: '64290-0',
        display: 'Health insurance card',
        text: 'Insurance cards',
    } : _j;
    return {
        resourceType: 'DocumentReference',
        meta: {
            tag: [
                {
                    code: tagCode, // these are not module-scoped resources; this tag should be unnecessary
                },
            ],
        },
        status: status,
        type: {
            coding: [
                {
                    system: type.system,
                    code: type.code,
                    display: type.display,
                },
            ],
            text: type.text,
        },
        date: date,
        content: __spreadArray([
            {
                attachment: {
                    url: frontUrl,
                    contentType: frontContentType,
                    title: 'insurance-card-front',
                },
            }
        ], (backUrl
            ? [
                {
                    attachment: {
                        url: backUrl,
                        contentType: backContentType,
                        title: 'insurance-card-back',
                    },
                },
            ]
            : []), true),
        context: {
            related: [
                {
                    reference: "Patient/".concat(patientId),
                },
                {
                    reference: "Appointment/".concat(appointmentId),
                },
            ],
        },
    };
}
//# sourceMappingURL=insurance-document.js.map