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
exports.validateSubmitInputs = exports.validatePatchInputs = exports.mapQuestionnaireResponsesToObject = void 0;
var utils_1 = require("utils");
var basicValidation = function (input) {
    var _a, _b;
    if (!input.body) {
        throw new Error('No request body provided');
    }
    var inputJSON = JSON.parse(input.body);
    var answers = inputJSON.answers, questionnaireResponseId = inputJSON.questionnaireResponseId, appointmentId = inputJSON.appointmentId;
    if (!answers) {
        throw new Error("\"answers\" is a required param");
    }
    if (questionnaireResponseId == undefined) {
        throw new Error("\"questionnaireResponseId\" is a required param");
    }
    if (typeof questionnaireResponseId !== 'string') {
        throw new Error("\"questionnaireResponseId\" must be a string");
    }
    if (appointmentId && typeof appointmentId !== 'string') {
        throw new Error("\"appointmentId\" must be a string");
    }
    var ipAddress = '';
    var environment = process.env.ENVIRONMENT || ((_a = input.secrets) === null || _a === void 0 ? void 0 : _a.ENVIRONMENT);
    console.log('Environment: ', environment);
    switch (environment) {
        case 'local':
            ipAddress = 'Unknown';
            break;
        case 'dev':
        case 'testing':
        case 'staging':
        case 'production':
            ipAddress = ((_b = input === null || input === void 0 ? void 0 : input.headers) === null || _b === void 0 ? void 0 : _b['cf-connecting-ip']) ? input.headers['cf-connecting-ip'] : 'Unknown';
            break;
        default:
            ipAddress = 'Unknown';
    }
    return { answers: answers, questionnaireResponseId: questionnaireResponseId, ipAddress: ipAddress, appointmentId: appointmentId };
};
var itemAnswerHasValue = function (item) {
    var _a, _b;
    if (item.answer === undefined || ((_a = item.answer) === null || _a === void 0 ? void 0 : _a.length) === 0) {
        return false;
    }
    return (_b = item.answer) === null || _b === void 0 ? void 0 : _b.every(function (obj) {
        if (typeof obj !== 'object') {
            return false;
        }
        return Object.values(obj).some(function (v) { return !!v; });
    });
};
var mapQuestionnaireResponsesToObject = function (answers) {
    return answers.reduce(function (accum, ans) {
        accum[ans.linkId] = ans.answer;
        return accum;
    }, {});
};
exports.mapQuestionnaireResponsesToObject = mapQuestionnaireResponsesToObject;
var complexSubmitValidation = function (input, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var prevalidationAnswers, questionnaireResponseId, qrAndQItems, items, fullQRResource, currentAnswers, submittedAnswers, updatedAnswers, validationSchema, e_1, validationErrors, errorPaths, pageAndFieldErrors, filteredAnswers;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                prevalidationAnswers = input.answers, questionnaireResponseId = input.questionnaireResponseId;
                return [4 /*yield*/, (0, utils_1.getQuestionnaireItemsAndProgress)(questionnaireResponseId, oystehr)];
            case 1:
                qrAndQItems = _b.sent();
                if (!qrAndQItems) {
                    throw new Error("Questionnaire could not be found for QuestionnaireResponse with id ".concat(questionnaireResponseId));
                }
                items = qrAndQItems.items, fullQRResource = qrAndQItems.fullQRResource;
                currentAnswers = (_a = fullQRResource.item) !== null && _a !== void 0 ? _a : [];
                console.log('validating updates for questionnaire response', questionnaireResponseId);
                submittedAnswers = prevalidationAnswers.filter(function (answerItem) {
                    var item = items.find(function (questionItem) {
                        return questionItem.linkId === answerItem.linkId;
                    });
                    if (!item) {
                        console.log('no item found', answerItem.linkId);
                        return false;
                    }
                    // because it may be more convenient to keep readOnly items in form state for purposes of front-end validation of dependent fields,
                    // we merely filter them out here so there inclusion is a no-op rather than an error
                    if (item.readOnly) {
                        return false;
                    }
                    return true;
                });
                updatedAnswers = currentAnswers ? __spreadArray([], currentAnswers, true) : [];
                submittedAnswers.forEach(function (sa) {
                    var idx = currentAnswers.findIndex(function (ua) {
                        return sa.linkId === ua.linkId && sa.answer !== undefined;
                    });
                    if (idx >= 0) {
                        // fhir api will throw an error if we submit, for instance { valueString: '' }
                        if (itemAnswerHasValue(sa)) {
                            updatedAnswers.splice(idx, 1, sa);
                        }
                        else {
                            updatedAnswers.splice(idx, 1);
                        }
                    }
                    else {
                        if (itemAnswerHasValue(sa)) {
                            updatedAnswers.push(sa);
                        }
                    }
                });
                validationSchema = (0, utils_1.makeValidationSchema)(items, undefined);
                console.log('answersToValidate', JSON.stringify(updatedAnswers));
                _b.label = 2;
            case 2:
                _b.trys.push([2, 4, , 5]);
                return [4 /*yield*/, validationSchema.validate(updatedAnswers, { abortEarly: false })];
            case 3:
                _b.sent();
                return [3 /*break*/, 5];
            case 4:
                e_1 = _b.sent();
                validationErrors = e_1.inner;
                if (Array.isArray(validationErrors)) {
                    errorPaths = validationErrors
                        .map(function (e) {
                        var _a, _b;
                        return (_b = (_a = e.path) === null || _a === void 0 ? void 0 : _a.split('.')) === null || _b === void 0 ? void 0 : _b[0];
                    })
                        .filter(function (i) { return !!i; });
                    console.log('errorPaths', JSON.stringify(errorPaths));
                    if (errorPaths.length === 0) {
                        // this will be a 500
                        throw validationErrors;
                    }
                    pageAndFieldErrors = errorPaths.reduce(function (accum, currentPath) {
                        var _a;
                        var pageName;
                        var fieldName;
                        items.forEach(function (page) {
                            var _a, _b;
                            var itemWithError = ((_a = page.item) !== null && _a !== void 0 ? _a : []).find(function (i) {
                                return i.linkId === currentPath;
                            });
                            if (itemWithError) {
                                pageName = page.linkId;
                                fieldName = (_b = itemWithError.text) !== null && _b !== void 0 ? _b : itemWithError.linkId;
                            }
                        });
                        if (pageName && fieldName) {
                            var currentErrorList = (_a = accum[pageName]) !== null && _a !== void 0 ? _a : [];
                            currentErrorList.push(fieldName);
                            accum[pageName] = currentErrorList;
                        }
                        return accum;
                    }, {});
                    if (Object.keys(pageAndFieldErrors).length === 0) {
                        throw validationErrors;
                    }
                    console.log('pages with errors: ', JSON.stringify(pageAndFieldErrors));
                    throw (0, utils_1.QUESTIONNAIRE_RESPONSE_INVALID_ERROR)(pageAndFieldErrors);
                }
                else {
                    console.log('guess its not an array', e_1);
                    throw validationErrors;
                }
                return [3 /*break*/, 5];
            case 5:
                console.log('validation succeeded');
                filteredAnswers = (0, utils_1.filterDisabledPages)(items, updatedAnswers, fullQRResource);
                console.log('filtered disabled pages', JSON.stringify(filteredAnswers));
                return [2 /*return*/, __assign(__assign({}, input), { questionnaireResponseId: questionnaireResponseId, updatedAnswers: filteredAnswers, currentQRStatus: fullQRResource.status })];
        }
    });
}); };
var complexPatchValidation = function (input, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var itemToPatch, questionnaireResponseId, qrAndQItems, items, fullQRResource, readOnlyItems, itemsForThisPage, currentAnswersForPage, currentAnswersToKeep, submittedAnswers, updatedAnswerIndex;
    var _a, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                itemToPatch = input.answers, questionnaireResponseId = input.questionnaireResponseId;
                return [4 /*yield*/, (0, utils_1.getQuestionnaireItemsAndProgress)(questionnaireResponseId, oystehr)];
            case 1:
                qrAndQItems = _e.sent();
                if (!qrAndQItems) {
                    throw new Error("Questionnaire could not be found for QuestionnaireResponse with id ".concat(questionnaireResponseId));
                }
                items = qrAndQItems.items, fullQRResource = qrAndQItems.fullQRResource;
                console.log('validating updates for questionnaire response', questionnaireResponseId);
                console.log('existing QR: ', JSON.stringify(fullQRResource));
                readOnlyItems = new Set();
                itemsForThisPage = (_b = (_a = items.find(function (i) { return i.linkId === itemToPatch.linkId; })) === null || _a === void 0 ? void 0 : _a.item) !== null && _b !== void 0 ? _b : [];
                console.log('items for this page', JSON.stringify(itemsForThisPage));
                itemsForThisPage.forEach(function (i) {
                    if (i.readOnly) {
                        readOnlyItems.add(i.linkId);
                    }
                });
                currentAnswersForPage = (_d = (_c = fullQRResource.item) === null || _c === void 0 ? void 0 : _c.find(function (i) { return i.linkId === itemToPatch.linkId; })) === null || _d === void 0 ? void 0 : _d.item;
                currentAnswersToKeep = (currentAnswersForPage !== null && currentAnswersForPage !== void 0 ? currentAnswersForPage : []).filter(function (ans) { return readOnlyItems.has(ans.linkId); });
                console.log('current answers to keep', JSON.stringify(currentAnswersToKeep));
                submittedAnswers = (0, utils_1.recursiveGroupTransform)(itemsForThisPage, itemToPatch.item);
                updatedAnswerIndex = items.findIndex(function (item) {
                    return item.linkId === itemToPatch.linkId;
                });
                console.log('submittedAnswers', JSON.stringify(submittedAnswers));
                console.log('validation succeeded');
                return [2 /*return*/, {
                        questionnaireResponseId: questionnaireResponseId,
                        submittedAnswer: itemToPatch,
                        updatedAnswers: __spreadArray(__spreadArray([], currentAnswersToKeep, true), submittedAnswers, true),
                        patchIndex: updatedAnswerIndex,
                        currentQRStatus: fullQRResource.status,
                    }];
        }
    });
}); };
var validatePatchInputs = function (input, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var basic, answers, ansObj;
    return __generator(this, function (_a) {
        basic = basicValidation(input);
        answers = basic.answers;
        ansObj = answers;
        if (typeof ansObj !== 'object' || ansObj.item === undefined || ansObj.linkId === undefined) {
            throw new Error("\"answers\" must be a questionnaire response item with defined \"item\" field");
        }
        console.log('answer object from body: ', JSON.stringify(ansObj), basic.questionnaireResponseId);
        return [2 /*return*/, complexPatchValidation(__assign(__assign({}, basic), { answers: ansObj }), oystehr)];
    });
}); };
exports.validatePatchInputs = validatePatchInputs;
var validateSubmitInputs = function (input, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var basic, answers, submitInput, complex;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                basic = basicValidation(input);
                answers = basic.answers;
                if (!Array.isArray(answers)) {
                    throw new Error("\"answers\" must be an array");
                }
                answers.forEach(function (ans) {
                    if (typeof ans !== 'object' || !ans.linkId || typeof ans.linkId !== 'string') {
                        throw new Error("\"answers\" must be an array of QuestionnaireResponseItems");
                    }
                });
                submitInput = __assign(__assign(__assign({}, basic), input), { answers: answers });
                return [4 /*yield*/, complexSubmitValidation(submitInput, oystehr)];
            case 1:
                complex = _a.sent();
                return [2 /*return*/, __assign(__assign(__assign({}, complex), input), { ipAddress: basic.ipAddress })];
        }
    });
}); };
exports.validateSubmitInputs = validateSubmitInputs;
