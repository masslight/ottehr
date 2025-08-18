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
var _EditMedicationCard_page;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EditMedicationCard = exports.Field = void 0;
var test_1 = require("@playwright/test");
var data_test_ids_1 = require("../../../src/constants/data-test-ids");
var Field;
(function (Field) {
    Field[Field["MEDICATION"] = 0] = "MEDICATION";
    Field[Field["DOSE"] = 1] = "DOSE";
    Field[Field["ASSOCIATED_DX"] = 2] = "ASSOCIATED_DX";
    Field[Field["UNITS"] = 3] = "UNITS";
    Field[Field["MANUFACTURER"] = 4] = "MANUFACTURER";
    Field[Field["ROUTE"] = 5] = "ROUTE";
    Field[Field["INSTRUCTIONS"] = 6] = "INSTRUCTIONS";
    Field[Field["ORDERED_BY"] = 7] = "ORDERED_BY";
})(Field || (exports.Field = Field = {}));
var FIELD_TO_TEST_ID = new Map()
    .set(Field.MEDICATION, data_test_ids_1.dataTestIds.orderMedicationPage.inputField('medicationId'))
    .set(Field.DOSE, data_test_ids_1.dataTestIds.orderMedicationPage.inputField('dose'))
    .set(Field.ASSOCIATED_DX, data_test_ids_1.dataTestIds.orderMedicationPage.inputField('associatedDx'))
    .set(Field.UNITS, data_test_ids_1.dataTestIds.orderMedicationPage.inputField('units'))
    .set(Field.MANUFACTURER, data_test_ids_1.dataTestIds.orderMedicationPage.inputField('manufacturer'))
    .set(Field.ROUTE, data_test_ids_1.dataTestIds.orderMedicationPage.inputField('route'))
    .set(Field.INSTRUCTIONS, data_test_ids_1.dataTestIds.orderMedicationPage.inputField('instructions'))
    .set(Field.ORDERED_BY, data_test_ids_1.dataTestIds.orderMedicationPage.inputField('providerId'));
var EditMedicationCard = /** @class */ (function () {
    function EditMedicationCard(page) {
        _EditMedicationCard_page.set(this, void 0);
        __classPrivateFieldSet(this, _EditMedicationCard_page, page, "f");
    }
    EditMedicationCard.prototype.getDataTestId = function (field) {
        var dataTestId = FIELD_TO_TEST_ID.get(field);
        if (!dataTestId) {
            throw new Error('Field is not found');
        }
        return dataTestId;
    };
    EditMedicationCard.prototype.selectMedication = function (medication) {
        return __awaiter(this, void 0, void 0, function () {
            var dataTestId;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        dataTestId = this.getDataTestId(Field.MEDICATION);
                        return [4 /*yield*/, __classPrivateFieldGet(this, _EditMedicationCard_page, "f").getByTestId(dataTestId).click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _EditMedicationCard_page, "f").getByText(medication, { exact: true }).click()];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    EditMedicationCard.prototype.verifyMedication = function (medication) {
        return __awaiter(this, void 0, void 0, function () {
            var dataTestId;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        dataTestId = this.getDataTestId(Field.MEDICATION);
                        return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _EditMedicationCard_page, "f").getByTestId(dataTestId).locator('input')).toHaveValue(medication)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    EditMedicationCard.prototype.selectAssociatedDx = function (diagnosis) {
        return __awaiter(this, void 0, void 0, function () {
            var dataTestId;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        dataTestId = this.getDataTestId(Field.ASSOCIATED_DX);
                        return [4 /*yield*/, __classPrivateFieldGet(this, _EditMedicationCard_page, "f").getByTestId(dataTestId).click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _EditMedicationCard_page, "f").getByRole('option', { name: diagnosis }).waitFor({ state: 'visible' })];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _EditMedicationCard_page, "f").getByRole('option', { name: diagnosis }).click()];
                    case 3:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    EditMedicationCard.prototype.selectOrderedBy = function (orderedBy) {
        return __awaiter(this, void 0, void 0, function () {
            var dataTestId;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        dataTestId = this.getDataTestId(Field.ORDERED_BY);
                        // mui set tabindex 0 to enabled element
                        return [4 /*yield*/, __classPrivateFieldGet(this, _EditMedicationCard_page, "f").locator("[data-testid=\"".concat(dataTestId, "\"] [role=\"combobox\"][tabindex=\"0\"]")).waitFor({
                                timeout: 30000,
                            })];
                    case 1:
                        // mui set tabindex 0 to enabled element
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _EditMedicationCard_page, "f").getByTestId(dataTestId).click()];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _EditMedicationCard_page, "f").getByRole('option', { name: orderedBy }).waitFor({ state: 'visible' })];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _EditMedicationCard_page, "f").getByRole('option', { name: orderedBy }).click()];
                    case 4:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    EditMedicationCard.prototype.verifyAssociatedDx = function (diagnosis) {
        return __awaiter(this, void 0, void 0, function () {
            var dataTestId;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        dataTestId = this.getDataTestId(Field.ASSOCIATED_DX);
                        return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _EditMedicationCard_page, "f").getByTestId(dataTestId).locator('div:text("' + diagnosis + '")')).toBeVisible()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    EditMedicationCard.prototype.verifyDiagnosisNotAllowed = function (diagnosis) {
        return __awaiter(this, void 0, void 0, function () {
            var dataTestId;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        dataTestId = this.getDataTestId(Field.ASSOCIATED_DX);
                        return [4 /*yield*/, __classPrivateFieldGet(this, _EditMedicationCard_page, "f").getByTestId(dataTestId).click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _EditMedicationCard_page, "f").getByText(diagnosis).locator('input').isHidden()];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    EditMedicationCard.prototype.enterDose = function (dose) {
        return __awaiter(this, void 0, void 0, function () {
            var dataTestId;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        dataTestId = this.getDataTestId(Field.DOSE);
                        return [4 /*yield*/, __classPrivateFieldGet(this, _EditMedicationCard_page, "f").getByTestId(dataTestId).locator('input').fill('')];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _EditMedicationCard_page, "f").getByTestId(dataTestId).locator('input').pressSequentially(dose)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    EditMedicationCard.prototype.clearDose = function () {
        return __awaiter(this, void 0, void 0, function () {
            var dataTestId;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        dataTestId = this.getDataTestId(Field.DOSE);
                        return [4 /*yield*/, __classPrivateFieldGet(this, _EditMedicationCard_page, "f").getByTestId(dataTestId).locator('input').clear()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    EditMedicationCard.prototype.verifyDose = function (dose) {
        return __awaiter(this, void 0, void 0, function () {
            var dataTestId;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        dataTestId = this.getDataTestId(Field.DOSE);
                        return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _EditMedicationCard_page, "f").getByTestId(dataTestId).locator('input')).toHaveValue(dose)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    EditMedicationCard.prototype.selectUnits = function (units) {
        return __awaiter(this, void 0, void 0, function () {
            var dataTestId;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        dataTestId = this.getDataTestId(Field.UNITS);
                        return [4 /*yield*/, __classPrivateFieldGet(this, _EditMedicationCard_page, "f").getByTestId(dataTestId).click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _EditMedicationCard_page, "f").getByText(units, { exact: true }).click()];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    EditMedicationCard.prototype.verifyUnits = function (units) {
        return __awaiter(this, void 0, void 0, function () {
            var dataTestId;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        dataTestId = this.getDataTestId(Field.UNITS);
                        return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _EditMedicationCard_page, "f").getByTestId(dataTestId).locator('div:text("' + units + '")')).toBeVisible()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    EditMedicationCard.prototype.enterManufacturer = function (manufacturer) {
        return __awaiter(this, void 0, void 0, function () {
            var dataTestId;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        dataTestId = this.getDataTestId(Field.MANUFACTURER);
                        return [4 /*yield*/, __classPrivateFieldGet(this, _EditMedicationCard_page, "f").getByTestId(dataTestId).locator('input').fill(manufacturer)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    EditMedicationCard.prototype.verifyManufacturer = function (manufacturer) {
        return __awaiter(this, void 0, void 0, function () {
            var dataTestId;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        dataTestId = this.getDataTestId(Field.MANUFACTURER);
                        return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _EditMedicationCard_page, "f").getByTestId(dataTestId).locator('input')).toHaveValue(manufacturer)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    EditMedicationCard.prototype.clearManufacturer = function () {
        return __awaiter(this, void 0, void 0, function () {
            var dataTestId;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        dataTestId = this.getDataTestId(Field.MANUFACTURER);
                        return [4 /*yield*/, __classPrivateFieldGet(this, _EditMedicationCard_page, "f").getByTestId(dataTestId).locator('input').clear()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    EditMedicationCard.prototype.selectRoute = function (route) {
        return __awaiter(this, void 0, void 0, function () {
            var dataTestId;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        dataTestId = this.getDataTestId(Field.ROUTE);
                        return [4 /*yield*/, __classPrivateFieldGet(this, _EditMedicationCard_page, "f").getByTestId(dataTestId).click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _EditMedicationCard_page, "f").getByText(route, { exact: true }).click()];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    EditMedicationCard.prototype.verifyRoute = function (route) {
        return __awaiter(this, void 0, void 0, function () {
            var dataTestId;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        dataTestId = this.getDataTestId(Field.ROUTE);
                        return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _EditMedicationCard_page, "f").getByTestId(dataTestId).locator('div:text("' + route + '")')).toBeVisible()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    EditMedicationCard.prototype.enterInstructions = function (instructions) {
        return __awaiter(this, void 0, void 0, function () {
            var dataTestId;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        dataTestId = this.getDataTestId(Field.INSTRUCTIONS);
                        return [4 /*yield*/, __classPrivateFieldGet(this, _EditMedicationCard_page, "f").getByTestId(dataTestId).locator('textarea:visible').fill(instructions)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    EditMedicationCard.prototype.verifyInstructions = function (instructions) {
        return __awaiter(this, void 0, void 0, function () {
            var dataTestId;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        dataTestId = this.getDataTestId(Field.INSTRUCTIONS);
                        return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _EditMedicationCard_page, "f").getByTestId(dataTestId).locator('textarea:visible')).toHaveText(instructions)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    EditMedicationCard.prototype.clearInstructions = function () {
        return __awaiter(this, void 0, void 0, function () {
            var dataTestId;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        dataTestId = this.getDataTestId(Field.INSTRUCTIONS);
                        return [4 /*yield*/, __classPrivateFieldGet(this, _EditMedicationCard_page, "f").getByTestId(dataTestId).locator('textarea:visible').clear()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    EditMedicationCard.prototype.verifyValidationErrorShown = function (field_1) {
        return __awaiter(this, arguments, void 0, function (field, closeErrorDialog) {
            var dataTestId;
            if (closeErrorDialog === void 0) { closeErrorDialog = true; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!closeErrorDialog) return [3 /*break*/, 2];
                        return [4 /*yield*/, __classPrivateFieldGet(this, _EditMedicationCard_page, "f").getByTestId(data_test_ids_1.dataTestIds.dialog.closeButton).click()];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2:
                        dataTestId = this.getDataTestId(field);
                        return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _EditMedicationCard_page, "f").getByTestId(dataTestId).locator('p:text("This field is required")')).toBeVisible()];
                    case 3:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    EditMedicationCard.prototype.verifyValidationErrorNotShown = function (field) {
        return __awaiter(this, void 0, void 0, function () {
            var dataTestId;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        dataTestId = this.getDataTestId(field);
                        return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _EditMedicationCard_page, "f").getByTestId(dataTestId).locator('p:text("This field is required")')).toBeHidden()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    return EditMedicationCard;
}());
exports.EditMedicationCard = EditMedicationCard;
_EditMedicationCard_page = new WeakMap();
//# sourceMappingURL=EditMedicationCard.js.map