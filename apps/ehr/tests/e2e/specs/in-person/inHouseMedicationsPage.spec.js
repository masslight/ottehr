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
var test_1 = require("@playwright/test");
var luxon_1 = require("luxon");
var CssHeader_1 = require("tests/e2e/page/CssHeader");
var SideMenu_1 = require("tests/e2e/page/SideMenu");
var resource_handler_1 = require("../../../e2e-utils/resource-handler");
var EditMedicationCard_1 = require("../../page/EditMedicationCard");
var InPersonAssessmentPage_1 = require("../../page/in-person/InPersonAssessmentPage");
var OrderMedicationPage_1 = require("../../page/OrderMedicationPage");
var PROCESS_ID = "inHouseMedicationsPage.spec.ts-".concat(luxon_1.DateTime.now().toMillis());
var resourceHandler = new resource_handler_1.ResourceHandler(PROCESS_ID, 'in-person');
// cSpell:disable-next inversus
var DIAGNOSIS = 'Situs inversus';
var MEDICATION = 'Acetaminophen (80mg Suppository)';
var DOSE = '2';
var UNITS = 'mg';
var MANUFACTURER = 'Test';
var ROUTE = 'Route of administration values';
var INSTRUCTIONS = 'Instructions';
var NEW_DIAGNOSIS = 'Situational type phobia';
var NEW_MEDICATION = 'Acetaminophen (325mg Suppository)';
var NEW_DOSE = '1';
var NEW_UNITS = 'g';
var NEW_MANUFACTURER = 'Edited test';
var NEW_ROUTE = 'Topical route';
var NEW_INSTRUCTIONS = 'Edited instructions';
var STATUS = 'pending';
test_1.test.beforeEach(function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!(process.env.INTEGRATION_TEST === 'true')) return [3 /*break*/, 2];
                return [4 /*yield*/, resourceHandler.setResourcesFast()];
            case 1:
                _a.sent();
                return [3 /*break*/, 5];
            case 2: return [4 /*yield*/, resourceHandler.setResources()];
            case 3:
                _a.sent();
                return [4 /*yield*/, resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id)];
            case 4:
                _a.sent();
                _a.label = 5;
            case 5: return [2 /*return*/];
        }
    });
}); });
test_1.test.afterEach(function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, resourceHandler.cleanupResources()];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, test_1.test)('Open Order Medication screen, check required fields', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var orderMedicationPage;
    var page = _b.page;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, prepareAndOpenOrderMedicationPage(page)];
            case 1:
                orderMedicationPage = _c.sent();
                // we have selected dx by default now so we can proceed to verification
                return [4 /*yield*/, orderMedicationPage.clickOrderMedicationButton()];
            case 2:
                // we have selected dx by default now so we can proceed to verification
                _c.sent();
                return [4 /*yield*/, orderMedicationPage.editMedicationCard.verifyValidationErrorShown(EditMedicationCard_1.Field.MEDICATION)];
            case 3:
                _c.sent();
                return [4 /*yield*/, orderMedicationPage.editMedicationCard.selectAssociatedDx('Select Associated Dx')];
            case 4:
                _c.sent();
                return [4 /*yield*/, orderMedicationPage.editMedicationCard.selectMedication(MEDICATION)];
            case 5:
                _c.sent();
                return [4 /*yield*/, orderMedicationPage.clickOrderMedicationButton()];
            case 6:
                _c.sent();
                return [4 /*yield*/, orderMedicationPage.editMedicationCard.verifyValidationErrorShown(EditMedicationCard_1.Field.DOSE)];
            case 7:
                _c.sent();
                return [4 /*yield*/, orderMedicationPage.editMedicationCard.enterDose(DOSE)];
            case 8:
                _c.sent();
                return [4 /*yield*/, orderMedicationPage.clickOrderMedicationButton()];
            case 9:
                _c.sent();
                return [4 /*yield*/, orderMedicationPage.editMedicationCard.verifyValidationErrorShown(EditMedicationCard_1.Field.UNITS)];
            case 10:
                _c.sent();
                return [4 /*yield*/, orderMedicationPage.editMedicationCard.selectUnits(UNITS)];
            case 11:
                _c.sent();
                return [4 /*yield*/, orderMedicationPage.clickOrderMedicationButton()];
            case 12:
                _c.sent();
                return [4 /*yield*/, orderMedicationPage.editMedicationCard.verifyValidationErrorShown(EditMedicationCard_1.Field.ROUTE)];
            case 13:
                _c.sent();
                return [4 /*yield*/, orderMedicationPage.editMedicationCard.selectRoute(ROUTE)];
            case 14:
                _c.sent();
                return [4 /*yield*/, orderMedicationPage.clickOrderMedicationButton()];
            case 15:
                _c.sent();
                return [4 /*yield*/, orderMedicationPage.editMedicationCard.verifyValidationErrorNotShown(EditMedicationCard_1.Field.ASSOCIATED_DX)];
            case 16:
                _c.sent();
                return [4 /*yield*/, orderMedicationPage.editMedicationCard.verifyValidationErrorNotShown(EditMedicationCard_1.Field.MANUFACTURER)];
            case 17:
                _c.sent();
                return [4 /*yield*/, orderMedicationPage.editMedicationCard.verifyValidationErrorNotShown(EditMedicationCard_1.Field.INSTRUCTIONS)];
            case 18:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, test_1.test)('"Order" button is disabled when all fields are empty', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var orderMedicationPage;
    var page = _b.page;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, prepareAndOpenOrderMedicationPage(page)];
            case 1:
                orderMedicationPage = _c.sent();
                return [4 /*yield*/, orderMedicationPage.editMedicationCard.selectAssociatedDx('Select Associated Dx')];
            case 2:
                _c.sent();
                return [4 /*yield*/, orderMedicationPage.editMedicationCard.selectOrderedBy('Select Ordered By')];
            case 3:
                _c.sent();
                return [4 /*yield*/, orderMedicationPage.verifyFillOrderToSaveButtonDisabled()];
            case 4:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, test_1.test)('Non-selected diagnosis on Assessment page is not present in Order Medication screen on associatedDx dropdown', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var orderMedicationPage;
    var page = _b.page;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, prepareAndOpenOrderMedicationPage(page)];
            case 1:
                orderMedicationPage = _c.sent();
                // cSpell:disable-next Loiasis
                return [4 /*yield*/, orderMedicationPage.editMedicationCard.verifyDiagnosisNotAllowed('Loiasis')];
            case 2:
                // cSpell:disable-next Loiasis
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, test_1.test)('Non-numeric values can not be entered into "Dose" field', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var orderMedicationPage;
    var page = _b.page;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, prepareAndOpenOrderMedicationPage(page)];
            case 1:
                orderMedicationPage = _c.sent();
                return [4 /*yield*/, orderMedicationPage.editMedicationCard.enterDose('abc1dfg')];
            case 2:
                _c.sent();
                return [4 /*yield*/, orderMedicationPage.editMedicationCard.verifyDose('1')];
            case 3:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, test_1.test)('Order medication, order is submitted successfully and entered data are displayed correctly', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var createOrderPage, editOrderPage, medicationsPage;
    var page = _b.page;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, prepareAndOpenOrderMedicationPage(page)];
            case 1:
                createOrderPage = _c.sent();
                return [4 /*yield*/, createOrderPage.editMedicationCard.selectAssociatedDx(DIAGNOSIS)];
            case 2:
                _c.sent();
                return [4 /*yield*/, createOrderPage.editMedicationCard.selectMedication(MEDICATION)];
            case 3:
                _c.sent();
                return [4 /*yield*/, createOrderPage.editMedicationCard.enterDose(DOSE)];
            case 4:
                _c.sent();
                return [4 /*yield*/, createOrderPage.editMedicationCard.selectUnits(UNITS)];
            case 5:
                _c.sent();
                return [4 /*yield*/, createOrderPage.editMedicationCard.enterManufacturer(MANUFACTURER)];
            case 6:
                _c.sent();
                return [4 /*yield*/, createOrderPage.editMedicationCard.selectRoute(ROUTE)];
            case 7:
                _c.sent();
                return [4 /*yield*/, createOrderPage.editMedicationCard.enterInstructions(INSTRUCTIONS)];
            case 8:
                _c.sent();
                return [4 /*yield*/, createOrderPage.clickOrderMedicationButton()];
            case 9:
                _c.sent();
                return [4 /*yield*/, (0, OrderMedicationPage_1.expectEditOrderPage)(page)];
            case 10:
                editOrderPage = _c.sent();
                return [4 /*yield*/, editOrderPage.editMedicationCard.verifyAssociatedDx(DIAGNOSIS)];
            case 11:
                _c.sent();
                return [4 /*yield*/, editOrderPage.editMedicationCard.verifyMedication(MEDICATION)];
            case 12:
                _c.sent();
                return [4 /*yield*/, editOrderPage.editMedicationCard.verifyDose(DOSE)];
            case 13:
                _c.sent();
                return [4 /*yield*/, editOrderPage.editMedicationCard.verifyUnits(UNITS)];
            case 14:
                _c.sent();
                return [4 /*yield*/, editOrderPage.editMedicationCard.verifyManufacturer(MANUFACTURER)];
            case 15:
                _c.sent();
                return [4 /*yield*/, editOrderPage.editMedicationCard.verifyRoute(ROUTE)];
            case 16:
                _c.sent();
                return [4 /*yield*/, editOrderPage.editMedicationCard.verifyInstructions(INSTRUCTIONS)];
            case 17:
                _c.sent();
                return [4 /*yield*/, editOrderPage.clickBackButton()];
            case 18:
                medicationsPage = _c.sent();
                return [4 /*yield*/, medicationsPage.verifyMedicationPresent({
                        medicationName: MEDICATION,
                        dose: DOSE,
                        route: ROUTE,
                        instructions: INSTRUCTIONS,
                        status: STATUS,
                    })];
            case 19:
                _c.sent();
                return [4 /*yield*/, medicationsPage.clickMedicationDetailsTab()];
            case 20:
                _c.sent();
                return [4 /*yield*/, medicationsPage.medicationDetails().verifyAssociatedDx(DIAGNOSIS)];
            case 21:
                _c.sent();
                return [4 /*yield*/, medicationsPage.medicationDetails().verifyMedication(MEDICATION)];
            case 22:
                _c.sent();
                return [4 /*yield*/, medicationsPage.medicationDetails().verifyDose(DOSE)];
            case 23:
                _c.sent();
                return [4 /*yield*/, medicationsPage.medicationDetails().verifyUnits(UNITS)];
            case 24:
                _c.sent();
                return [4 /*yield*/, medicationsPage.medicationDetails().verifyManufacturer(MANUFACTURER)];
            case 25:
                _c.sent();
                return [4 /*yield*/, medicationsPage.medicationDetails().verifyRoute(ROUTE)];
            case 26:
                _c.sent();
                return [4 /*yield*/, medicationsPage.medicationDetails().verifyInstructions(INSTRUCTIONS)];
            case 27:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, test_1.test)('Edit order page is opened after clicking on pencil icon for order in "pending" status', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var createOrderPage, editOrderPage, medicationsPage;
    var page = _b.page;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, prepareAndOpenOrderMedicationPage(page)];
            case 1:
                createOrderPage = _c.sent();
                return [4 /*yield*/, test_1.test.step('Create order', function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, createOrderPage.editMedicationCard.selectAssociatedDx(DIAGNOSIS)];
                                case 1:
                                    _a.sent();
                                    return [4 /*yield*/, createOrderPage.editMedicationCard.selectMedication(MEDICATION)];
                                case 2:
                                    _a.sent();
                                    return [4 /*yield*/, createOrderPage.editMedicationCard.enterDose(DOSE)];
                                case 3:
                                    _a.sent();
                                    return [4 /*yield*/, createOrderPage.editMedicationCard.selectUnits(UNITS)];
                                case 4:
                                    _a.sent();
                                    return [4 /*yield*/, createOrderPage.editMedicationCard.enterManufacturer(MANUFACTURER)];
                                case 5:
                                    _a.sent();
                                    return [4 /*yield*/, createOrderPage.editMedicationCard.selectRoute(ROUTE)];
                                case 6:
                                    _a.sent();
                                    return [4 /*yield*/, createOrderPage.editMedicationCard.enterInstructions(INSTRUCTIONS)];
                                case 7:
                                    _a.sent();
                                    return [4 /*yield*/, createOrderPage.clickOrderMedicationButton()];
                                case 8:
                                    _a.sent();
                                    return [4 /*yield*/, (0, OrderMedicationPage_1.expectEditOrderPage)(page)];
                                case 9:
                                    editOrderPage = _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
            case 2:
                _c.sent();
                return [4 /*yield*/, test_1.test.step('Click on pencil icon opens Edit order page', function () { return __awaiter(void 0, void 0, void 0, function () {
                        var medicationsPage;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, editOrderPage.clickBackButton()];
                                case 1:
                                    medicationsPage = _a.sent();
                                    return [4 /*yield*/, medicationsPage.clickPencilIcon()];
                                case 2:
                                    _a.sent();
                                    return [4 /*yield*/, (0, OrderMedicationPage_1.expectEditOrderPage)(page)];
                                case 3:
                                    editOrderPage = _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
            case 3:
                _c.sent();
                return [4 /*yield*/, test_1.test.step('Update fields to empty values and click on [Save] - Validation errors appears', function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, editOrderPage.editMedicationCard.selectMedication('Select Medication')];
                                case 1:
                                    _a.sent();
                                    return [4 /*yield*/, editOrderPage.editMedicationCard.selectAssociatedDx('Select Associated Dx')];
                                case 2:
                                    _a.sent();
                                    return [4 /*yield*/, editOrderPage.editMedicationCard.clearDose()];
                                case 3:
                                    _a.sent();
                                    return [4 /*yield*/, editOrderPage.editMedicationCard.selectUnits('Select Units')];
                                case 4:
                                    _a.sent();
                                    return [4 /*yield*/, editOrderPage.editMedicationCard.clearManufacturer()];
                                case 5:
                                    _a.sent();
                                    return [4 /*yield*/, editOrderPage.editMedicationCard.selectRoute('Select Route')];
                                case 6:
                                    _a.sent();
                                    return [4 /*yield*/, editOrderPage.editMedicationCard.clearInstructions()];
                                case 7:
                                    _a.sent();
                                    return [4 /*yield*/, editOrderPage.clickOrderMedicationButton()];
                                case 8:
                                    _a.sent();
                                    return [4 /*yield*/, editOrderPage.editMedicationCard.verifyValidationErrorShown(EditMedicationCard_1.Field.MEDICATION)];
                                case 9:
                                    _a.sent();
                                    return [4 /*yield*/, editOrderPage.editMedicationCard.verifyValidationErrorShown(EditMedicationCard_1.Field.DOSE, false)];
                                case 10:
                                    _a.sent();
                                    return [4 /*yield*/, editOrderPage.editMedicationCard.verifyValidationErrorShown(EditMedicationCard_1.Field.UNITS, false)];
                                case 11:
                                    _a.sent();
                                    return [4 /*yield*/, editOrderPage.editMedicationCard.verifyValidationErrorNotShown(EditMedicationCard_1.Field.MANUFACTURER)];
                                case 12:
                                    _a.sent();
                                    return [4 /*yield*/, editOrderPage.editMedicationCard.verifyValidationErrorShown(EditMedicationCard_1.Field.ROUTE, false)];
                                case 13:
                                    _a.sent();
                                    return [4 /*yield*/, editOrderPage.editMedicationCard.verifyValidationErrorNotShown(EditMedicationCard_1.Field.INSTRUCTIONS)];
                                case 14:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
            case 4:
                _c.sent();
                return [4 /*yield*/, test_1.test.step('Edit order page is opened after clicking on pencil icon for order in "pending" status', function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, editOrderPage.clickBackButton()];
                                case 1:
                                    medicationsPage = _a.sent();
                                    return [4 /*yield*/, medicationsPage.clickPencilIcon()];
                                case 2:
                                    _a.sent();
                                    return [4 /*yield*/, (0, OrderMedicationPage_1.expectEditOrderPage)(page)];
                                case 3:
                                    //click on pencil icon opens Edit order page
                                    editOrderPage = _a.sent();
                                    //Updated values are saved successfully and Order is updated on the "MAR" tab
                                    return [4 /*yield*/, editOrderPage.editMedicationCard.selectMedication(NEW_MEDICATION)];
                                case 4:
                                    //Updated values are saved successfully and Order is updated on the "MAR" tab
                                    _a.sent();
                                    return [4 /*yield*/, editOrderPage.editMedicationCard.enterDose(NEW_DOSE)];
                                case 5:
                                    _a.sent();
                                    // TODO: investigate why this is not working in playwright
                                    // await editOrderPage.editMedicationCard.selectAssociatedDx(NEW_DIAGNOSIS);
                                    return [4 /*yield*/, editOrderPage.editMedicationCard.selectUnits(NEW_UNITS)];
                                case 6:
                                    // TODO: investigate why this is not working in playwright
                                    // await editOrderPage.editMedicationCard.selectAssociatedDx(NEW_DIAGNOSIS);
                                    _a.sent();
                                    return [4 /*yield*/, editOrderPage.editMedicationCard.enterManufacturer(NEW_MANUFACTURER)];
                                case 7:
                                    _a.sent();
                                    return [4 /*yield*/, editOrderPage.editMedicationCard.selectRoute(NEW_ROUTE)];
                                case 8:
                                    _a.sent();
                                    return [4 /*yield*/, editOrderPage.editMedicationCard.enterInstructions(NEW_INSTRUCTIONS)];
                                case 9:
                                    _a.sent();
                                    return [4 /*yield*/, editOrderPage.clickOrderMedicationButton()];
                                case 10:
                                    _a.sent();
                                    return [4 /*yield*/, editOrderPage.editMedicationCard.verifyMedication(NEW_MEDICATION)];
                                case 11:
                                    _a.sent();
                                    return [4 /*yield*/, editOrderPage.editMedicationCard.verifyDose(NEW_DOSE)];
                                case 12:
                                    _a.sent();
                                    return [4 /*yield*/, editOrderPage.editMedicationCard.verifyUnits(NEW_UNITS)];
                                case 13:
                                    _a.sent();
                                    return [4 /*yield*/, editOrderPage.editMedicationCard.verifyManufacturer(NEW_MANUFACTURER)];
                                case 14:
                                    _a.sent();
                                    return [4 /*yield*/, editOrderPage.editMedicationCard.verifyRoute(NEW_ROUTE)];
                                case 15:
                                    _a.sent();
                                    return [4 /*yield*/, editOrderPage.editMedicationCard.verifyInstructions(NEW_INSTRUCTIONS)];
                                case 16:
                                    _a.sent();
                                    return [4 /*yield*/, editOrderPage.clickBackButton()];
                                case 17:
                                    medicationsPage = _a.sent();
                                    return [4 /*yield*/, medicationsPage.verifyMedicationPresent({
                                            medicationName: NEW_MEDICATION,
                                            dose: NEW_DOSE,
                                            route: NEW_ROUTE,
                                            instructions: NEW_INSTRUCTIONS,
                                            status: STATUS,
                                        })];
                                case 18:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
            case 5:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
function prepareAndOpenOrderMedicationPage(page) {
    return __awaiter(this, void 0, void 0, function () {
        var cssHeader, sideMenu, assessmentPage, inHouseMedicationsPage;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, page.goto("in-person/".concat(resourceHandler.appointment.id))];
                case 1:
                    _a.sent();
                    cssHeader = new CssHeader_1.CssHeader(page);
                    return [4 /*yield*/, cssHeader.selectIntakePractitioner()];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, cssHeader.selectProviderPractitioner()];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, cssHeader.clickSwitchModeButton('provider')];
                case 4:
                    _a.sent();
                    sideMenu = new SideMenu_1.SideMenu(page);
                    return [4 /*yield*/, sideMenu.clickAssessment()];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, (0, InPersonAssessmentPage_1.expectAssessmentPage)(page)];
                case 6:
                    assessmentPage = _a.sent();
                    return [4 /*yield*/, assessmentPage.selectDiagnosis({ diagnosisNamePart: DIAGNOSIS })];
                case 7:
                    _a.sent();
                    return [4 /*yield*/, assessmentPage.selectDiagnosis({ diagnosisNamePart: NEW_DIAGNOSIS })];
                case 8:
                    _a.sent();
                    return [4 /*yield*/, sideMenu.clickInHouseMedications()];
                case 9:
                    inHouseMedicationsPage = _a.sent();
                    return [4 /*yield*/, inHouseMedicationsPage.clickOrderButton()];
                case 10: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
//# sourceMappingURL=inHouseMedicationsPage.spec.js.map