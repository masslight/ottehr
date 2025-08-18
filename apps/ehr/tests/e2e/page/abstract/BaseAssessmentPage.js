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
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _BaseAssessmentPage_page;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseAssessmentPage = void 0;
var test_1 = require("@playwright/test");
var data_test_ids_1 = require("../../../../src/constants/data-test-ids");
var DEFAULT_TIMEOUT = { timeout: 15000 };
var BaseAssessmentPage = /** @class */ (function () {
    function BaseAssessmentPage(page) {
        _BaseAssessmentPage_page.set(this, void 0);
        __classPrivateFieldSet(this, _BaseAssessmentPage_page, page, "f");
    }
    BaseAssessmentPage.prototype.expectDiagnosisDropdown = function () {
        return __awaiter(this, void 0, void 0, function () {
            var diagnosisAutocomplete, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _BaseAssessmentPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.diagnosisContainer.diagnosisDropdown).locator('input').waitFor({
                            state: 'visible',
                        })];
                    case 1:
                        _b.sent();
                        diagnosisAutocomplete = __classPrivateFieldGet(this, _BaseAssessmentPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.diagnosisContainer.diagnosisDropdown);
                        _a = test_1.expect;
                        return [4 /*yield*/, diagnosisAutocomplete.locator('input')];
                    case 2: return [4 /*yield*/, _a.apply(void 0, [_b.sent()]).toBeVisible(DEFAULT_TIMEOUT)];
                    case 3:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    BaseAssessmentPage.prototype.expectMdmField = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            var text, mdmField, _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        text = (options !== null && options !== void 0 ? options : {}).text;
                        return [4 /*yield*/, __classPrivateFieldGet(this, _BaseAssessmentPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.assessmentCard.medicalDecisionField)];
                    case 1:
                        mdmField = _c.sent();
                        _a = test_1.expect;
                        return [4 /*yield*/, mdmField.locator('textarea:visible')];
                    case 2: return [4 /*yield*/, _a.apply(void 0, [_c.sent()]).toBeVisible(DEFAULT_TIMEOUT)];
                    case 3:
                        _c.sent();
                        if (!text) return [3 /*break*/, 6];
                        _b = test_1.expect;
                        return [4 /*yield*/, mdmField.locator('textarea:visible')];
                    case 4: return [4 /*yield*/, _b.apply(void 0, [_c.sent()]).toHaveText(text)];
                    case 5:
                        _c.sent();
                        _c.label = 6;
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    BaseAssessmentPage.prototype.fillMdmField = function (text) {
        return __awaiter(this, void 0, void 0, function () {
            var mdmField;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _BaseAssessmentPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.assessmentCard.medicalDecisionField)];
                    case 1:
                        mdmField = _a.sent();
                        return [4 /*yield*/, mdmField.locator('textarea:visible').fill(text)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    BaseAssessmentPage.prototype.selectDiagnosis = function (_a) {
        return __awaiter(this, arguments, void 0, function (_b) {
            var diagnosisAutocomplete, searchText;
            var _c;
            var diagnosisNamePart = _b.diagnosisNamePart, diagnosisCode = _b.diagnosisCode;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        if (!diagnosisCode && !diagnosisNamePart) {
                            throw new Error('Either diagnosisCode or diagnosisNamePart must be provided');
                        }
                        return [4 /*yield*/, __classPrivateFieldGet(this, _BaseAssessmentPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.diagnosisContainer.diagnosisDropdown)];
                    case 1:
                        diagnosisAutocomplete = _d.sent();
                        searchText = (_c = diagnosisCode !== null && diagnosisCode !== void 0 ? diagnosisCode : diagnosisNamePart) !== null && _c !== void 0 ? _c : '';
                        return [4 /*yield*/, diagnosisAutocomplete.click()];
                    case 2:
                        _d.sent();
                        return [4 /*yield*/, diagnosisAutocomplete.locator('input').fill(searchText)];
                    case 3:
                        _d.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _BaseAssessmentPage_page, "f")
                                .getByRole('option', { name: new RegExp(searchText, 'i') })
                                .first()
                                .waitFor()];
                    case 4:
                        _d.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _BaseAssessmentPage_page, "f")
                                .getByRole('option', { name: new RegExp(searchText, 'i') })
                                .first()
                                .click()];
                    case 5:
                        _d.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    BaseAssessmentPage.prototype.expectEmCodeDropdown = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _BaseAssessmentPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.assessmentCard.emCodeDropdown)).toBeVisible()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    BaseAssessmentPage.prototype.selectEmCode = function (code) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _BaseAssessmentPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.assessmentCard.emCodeDropdown).click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _BaseAssessmentPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.assessmentCard.emCodeDropdown).locator('input').fill(code)];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _BaseAssessmentPage_page, "f").getByRole('option').first().waitFor()];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _BaseAssessmentPage_page, "f").getByRole('option').first().click()];
                    case 4:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    return BaseAssessmentPage;
}());
exports.BaseAssessmentPage = BaseAssessmentPage;
_BaseAssessmentPage_page = new WeakMap();
//# sourceMappingURL=BaseAssessmentPage.js.map