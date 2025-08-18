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
exports.usePatientProvidedExcusePresignedFiles = void 0;
var auth0_react_1 = require("@auth0/auth0-react");
var react_1 = require("react");
var utils_1 = require("utils");
var files_helper_1 = require("../../helpers/files.helper");
var getSelectors_1 = require("../../shared/store/getSelectors");
var state_1 = require("../state");
var usePatientProvidedExcusePresignedFiles = function () {
    var getAccessTokenSilently = (0, auth0_react_1.useAuth0)().getAccessTokenSilently;
    var _a = (0, react_1.useState)(undefined), patientSchoolPresignedUrl = _a[0], setPatientSchoolPresignedUrl = _a[1];
    var _b = (0, react_1.useState)(undefined), patientWorkPresignedUrl = _b[0], setPatientWorkPresignedUrl = _b[1];
    var schoolWorkNoteUrls = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['schoolWorkNoteUrls']).schoolWorkNoteUrls;
    (0, react_1.useEffect)(function () {
        function getPresignedTemplateUrls() {
            return __awaiter(this, void 0, void 0, function () {
                var authToken, schoolZ3Url, schoolPresignedUrl, workZ3Url, workPresignedUrl, _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 6, , 7]);
                            return [4 /*yield*/, getAccessTokenSilently()];
                        case 1:
                            authToken = _b.sent();
                            schoolZ3Url = schoolWorkNoteUrls.find(function (name) { return name.includes("".concat(utils_1.SCHOOL_WORK_NOTE, "-template-school")); });
                            if (!schoolZ3Url) return [3 /*break*/, 3];
                            return [4 /*yield*/, (0, files_helper_1.getPresignedFileUrl)(schoolZ3Url, authToken)];
                        case 2:
                            schoolPresignedUrl = _b.sent();
                            setPatientSchoolPresignedUrl(schoolPresignedUrl);
                            _b.label = 3;
                        case 3:
                            workZ3Url = schoolWorkNoteUrls.find(function (name) { return name.includes("".concat(utils_1.SCHOOL_WORK_NOTE, "-template-work")); });
                            if (!workZ3Url) return [3 /*break*/, 5];
                            return [4 /*yield*/, (0, files_helper_1.getPresignedFileUrl)(workZ3Url, authToken)];
                        case 4:
                            workPresignedUrl = _b.sent();
                            setPatientWorkPresignedUrl(workPresignedUrl);
                            _b.label = 5;
                        case 5: return [3 /*break*/, 7];
                        case 6:
                            _a = _b.sent();
                            console.error('Error while trying to get template presigned urls');
                            return [3 /*break*/, 7];
                        case 7: return [2 /*return*/];
                    }
                });
            });
        }
        if ((schoolWorkNoteUrls === null || schoolWorkNoteUrls === void 0 ? void 0 : schoolWorkNoteUrls.length) > 0) {
            void getPresignedTemplateUrls();
        }
    }, [getAccessTokenSilently, schoolWorkNoteUrls]);
    return { patientSchoolPresignedUrl: patientSchoolPresignedUrl, patientWorkPresignedUrl: patientWorkPresignedUrl };
};
exports.usePatientProvidedExcusePresignedFiles = usePatientProvidedExcusePresignedFiles;
//# sourceMappingURL=usePatientProvidedExcusePresignedFiles.js.map