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
exports.CompletedFormsContainer = void 0;
var auth0_react_1 = require("@auth0/auth0-react");
var colors_1 = require("@ehrTheme/colors");
var material_1 = require("@mui/material");
var react_1 = require("react");
var utils_1 = require("utils");
var files_helper_1 = require("../../../../helpers/files.helper");
var getSelectors_1 = require("../../../../shared/store/getSelectors");
var state_1 = require("../../../state");
var InformationCard_1 = require("./InformationCard");
var PdfButton = function (_a) {
    var pdfUrl = _a.pdfUrl;
    return (<material_1.Button variant="outlined" sx={{
            borderColor: colors_1.otherColors.consentBorder,
            borderRadius: 100,
            textTransform: 'none',
            fontWeight: 500,
            fontSize: 14,
            minWidth: 'max-content',
        }} href={pdfUrl || ''} target="_blank" disabled={!pdfUrl}>
      Get PDF
    </material_1.Button>);
};
var CompletedFormsContainer = function () {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
    var getAccessTokenSilently = (0, auth0_react_1.useAuth0)().getAccessTokenSilently;
    var _r = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, [
        'patient',
        'appointment',
        'questionnaireResponse',
    ]), patient = _r.patient, appointment = _r.appointment, questionnaireResponse = _r.questionnaireResponse;
    var _s = (0, react_1.useState)(), consentPdfUrl = _s[0], setConsentPdfUrl = _s[1];
    var _t = (0, react_1.useState)(), hipaaPdfUrl = _t[0], setHipaaPdfUrl = _t[1];
    (0, state_1.useGetDocumentReferences)({ appointmentId: appointment === null || appointment === void 0 ? void 0 : appointment.id, patientId: patient === null || patient === void 0 ? void 0 : patient.id }, function (data) { return __awaiter(void 0, void 0, void 0, function () {
        var authToken, documentReferenceResources, bundleEntries, _i, documentReferenceResources_1, docRef, docRefCode, _a, _b, content, title, z3Url, presignedUrl, _c;
        var _d, _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0: return [4 /*yield*/, getAccessTokenSilently()];
                case 1:
                    authToken = _f.sent();
                    documentReferenceResources = [];
                    bundleEntries = data.entry;
                    bundleEntries === null || bundleEntries === void 0 ? void 0 : bundleEntries.forEach(function (bundleEntry) {
                        var _a;
                        var bundleResource = bundleEntry.resource;
                        (_a = bundleResource.entry) === null || _a === void 0 ? void 0 : _a.forEach(function (entry) {
                            var docRefResource = entry.resource;
                            if (docRefResource) {
                                documentReferenceResources.push(docRefResource);
                            }
                        });
                    });
                    _i = 0, documentReferenceResources_1 = documentReferenceResources;
                    _f.label = 2;
                case 2:
                    if (!(_i < documentReferenceResources_1.length)) return [3 /*break*/, 8];
                    docRef = documentReferenceResources_1[_i];
                    docRefCode = (_e = (_d = docRef.type) === null || _d === void 0 ? void 0 : _d.coding) === null || _e === void 0 ? void 0 : _e[0].code;
                    if (!(docRefCode === utils_1.CONSENT_CODE)) return [3 /*break*/, 7];
                    _a = 0, _b = docRef.content;
                    _f.label = 3;
                case 3:
                    if (!(_a < _b.length)) return [3 /*break*/, 7];
                    content = _b[_a];
                    title = content.attachment.title;
                    z3Url = content.attachment.url;
                    _c = z3Url;
                    if (!_c) return [3 /*break*/, 5];
                    return [4 /*yield*/, (0, files_helper_1.getPresignedFileUrl)(z3Url, authToken)];
                case 4:
                    _c = (_f.sent());
                    _f.label = 5;
                case 5:
                    presignedUrl = _c;
                    if (title === 'Consent forms') {
                        setConsentPdfUrl(presignedUrl);
                    }
                    else if (title === 'HIPAA forms') {
                        setHipaaPdfUrl(presignedUrl);
                    }
                    _f.label = 6;
                case 6:
                    _a++;
                    return [3 /*break*/, 3];
                case 7:
                    _i++;
                    return [3 /*break*/, 2];
                case 8: return [2 /*return*/];
            }
        });
    }); });
    var hipaaAcknowledgement = (_c = (_b = (_a = (0, utils_1.getQuestionnaireResponseByLinkId)('hipaa-acknowledgement', questionnaireResponse)) === null || _a === void 0 ? void 0 : _a.answer) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.valueBoolean;
    var consentToTreat = (_f = (_e = (_d = (0, utils_1.getQuestionnaireResponseByLinkId)('consent-to-treat', questionnaireResponse)) === null || _d === void 0 ? void 0 : _d.answer) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.valueBoolean;
    var signature = (_j = (_h = (_g = (0, utils_1.getQuestionnaireResponseByLinkId)('signature', questionnaireResponse)) === null || _g === void 0 ? void 0 : _g.answer) === null || _h === void 0 ? void 0 : _h[0]) === null || _j === void 0 ? void 0 : _j.valueString;
    var fullName = (_m = (_l = (_k = (0, utils_1.getQuestionnaireResponseByLinkId)('full-name', questionnaireResponse)) === null || _k === void 0 ? void 0 : _k.answer) === null || _l === void 0 ? void 0 : _l[0]) === null || _m === void 0 ? void 0 : _m.valueString;
    var relationship = (_q = (_p = (_o = (0, utils_1.getQuestionnaireResponseByLinkId)('consent-form-signer-relationship', questionnaireResponse)) === null || _o === void 0 ? void 0 : _o.answer) === null || _p === void 0 ? void 0 : _p[0]) === null || _q === void 0 ? void 0 : _q.valueString;
    var signDate = (questionnaireResponse === null || questionnaireResponse === void 0 ? void 0 : questionnaireResponse.authored) && (0, utils_1.mdyStringFromISOString)(questionnaireResponse === null || questionnaireResponse === void 0 ? void 0 : questionnaireResponse.authored);
    var ipAddress = (0, utils_1.getIpAddress)(questionnaireResponse);
    return (<InformationCard_1.InformationCard title="Completed consent forms" fields={[
            {
                label: 'I have reviewed and accept HIPAA Acknowledgement',
                value: hipaaAcknowledgement ? 'Signed' : 'Not signed',
                button: <PdfButton pdfUrl={hipaaPdfUrl}/>,
            },
            {
                label: 'I have reviewed and accept Consent to Treat, Guarantee of Payment & Card on File Agreement',
                value: consentToTreat ? 'Signed' : 'Not signed',
                button: <PdfButton pdfUrl={consentPdfUrl}/>,
            },
            {
                label: 'Signature',
                value: signature,
            },
            {
                label: 'Full name',
                value: fullName,
            },
            {
                label: 'Relationship to the patient',
                value: relationship,
            },
            {
                label: 'Date',
                value: signDate,
            },
            {
                label: 'IP',
                value: ipAddress,
            },
        ]}/>);
};
exports.CompletedFormsContainer = CompletedFormsContainer;
//# sourceMappingURL=CompletedFormsContainer.js.map