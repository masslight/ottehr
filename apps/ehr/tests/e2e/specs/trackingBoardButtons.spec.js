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
var constants_1 = require("../../e2e-utils/resource/constants");
var resource_handler_1 = require("../../e2e-utils/resource-handler");
var AddPatientPage_1 = require("../page/AddPatientPage");
var VisitsPage_1 = require("../page/VisitsPage");
var PROCESS_ID = "trackingBoardButtons.spec.ts-".concat(luxon_1.DateTime.now().toMillis());
var resourceHandler = new resource_handler_1.ResourceHandler(PROCESS_ID, 'in-person');
test_1.test.beforeEach(function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!(process.env.INTEGRATION_TEST === 'true')) return [3 /*break*/, 2];
                return [4 /*yield*/, resourceHandler.setResourcesFast()];
            case 1:
                _a.sent();
                return [3 /*break*/, 4];
            case 2: return [4 /*yield*/, resourceHandler.setResources()];
            case 3:
                _a.sent();
                _a.label = 4;
            case 4: return [2 /*return*/];
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
(0, test_1.test)('Clicking on "Add patient" button  opens "Add patient" page ', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var visitsPage;
    var page = _b.page;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, VisitsPage_1.openVisitsPage)(page)];
            case 1:
                visitsPage = _c.sent();
                return [4 /*yield*/, visitsPage.clickAddPatientButton()];
            case 2:
                _c.sent();
                return [4 /*yield*/, (0, AddPatientPage_1.expectAddPatientPage)(page)];
            case 3:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, test_1.test)('Click on "Arrived" button, verify visit is moved to "In office" tab and  visit status is changed to "Arrived" ', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var visitsPage;
    var page = _b.page;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, VisitsPage_1.openVisitsPage)(page)];
            case 1:
                visitsPage = _c.sent();
                return [4 /*yield*/, visitsPage.selectLocation(constants_1.ENV_LOCATION_NAME)];
            case 2:
                _c.sent();
                return [4 /*yield*/, visitsPage.clickPrebookedTab()];
            case 3:
                _c.sent();
                return [4 /*yield*/, visitsPage.clickArrivedButton(resourceHandler.appointment.id)];
            case 4:
                _c.sent();
                return [4 /*yield*/, visitsPage.clickInOfficeTab()];
            case 5:
                _c.sent();
                return [4 /*yield*/, visitsPage.verifyVisitsStatus(resourceHandler.appointment.id, 'arrived')];
            case 6:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
test_1.test.skip('Check clicks on appointment row elements', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var visitsPage;
    var page = _b.page;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, VisitsPage_1.openVisitsPage)(page)];
            case 1:
                visitsPage = _c.sent();
                return [4 /*yield*/, visitsPage.selectLocation(constants_1.ENV_LOCATION_NAME)];
            case 2:
                _c.sent();
                return [4 /*yield*/, visitsPage.clickPrebookedTab()];
            case 3:
                _c.sent();
                return [4 /*yield*/, visitsPage.clickOnPatientName(resourceHandler.appointment.id)];
            case 4:
                _c.sent();
                return [4 /*yield*/, page.waitForURL(new RegExp('/patient/' + resourceHandler.patient.id))];
            case 5:
                _c.sent();
                return [4 /*yield*/, (0, VisitsPage_1.openVisitsPage)(page)];
            case 6:
                visitsPage = _c.sent();
                return [4 /*yield*/, visitsPage.selectLocation(constants_1.ENV_LOCATION_NAME)];
            case 7:
                _c.sent();
                return [4 /*yield*/, visitsPage.clickPrebookedTab()];
            case 8:
                _c.sent();
                return [4 /*yield*/, visitsPage.clickVisitDetailsButton(resourceHandler.appointment.id)];
            case 9:
                _c.sent();
                return [4 /*yield*/, page.waitForURL(new RegExp('/visit/' + resourceHandler.appointment.id))];
            case 10:
                _c.sent();
                return [4 /*yield*/, (0, VisitsPage_1.openVisitsPage)(page)];
            case 11:
                visitsPage = _c.sent();
                return [4 /*yield*/, visitsPage.clickDischargedTab()];
            case 12:
                _c.sent();
                return [4 /*yield*/, visitsPage.clickProgressNoteButton(resourceHandler.appointment.id)];
            case 13:
                _c.sent();
                return [4 /*yield*/, page.waitForURL(new RegExp("/in-person/".concat(resourceHandler.appointment.id, "/progress-note")), { timeout: 10000 })];
            case 14:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
//# sourceMappingURL=trackingBoardButtons.spec.js.map