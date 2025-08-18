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
Object.defineProperty(exports, "__esModule", { value: true });
exports.EditableMedicationCard = void 0;
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var useMedicationHistory_1 = require("src/features/css-module/hooks/useMedicationHistory");
var useAppClients_1 = require("src/hooks/useAppClients");
var ERX_1 = require("src/telemed/features/appointment/ERX");
var utils_1 = require("utils");
var useAppointment_1 = require("../../../hooks/useAppointment");
var useGetFieldOptions_1 = require("../../../hooks/useGetFieldOptions");
var useMedicationManagement_1 = require("../../../hooks/useMedicationManagement");
var useReactNavigationBlocker_1 = require("../../../hooks/useReactNavigationBlocker");
var helpers_1 = require("../../../routing/helpers");
var routesCSS_1 = require("../../../routing/routesCSS");
var CSSModal_1 = require("../../CSSModal");
var InteractionAlertsDialog_1 = require("../InteractionAlertsDialog");
var util_1 = require("../util");
var fieldsConfig_1 = require("./fieldsConfig");
var MedicationCardView_1 = require("./MedicationCardView");
var utils_2 = require("./utils");
var INTERACTIONS_CHECK_STATE_ERROR = {
    status: 'error',
    interactions: undefined,
};
var EditableMedicationCard = function (_a) {
    var _b, _c, _d, _e;
    var medication = _a.medication, typeFromProps = _a.type;
    var _f = (0, react_1.useState)(false), isOrderUpdating = _f[0], setIsOrderUpdating = _f[1];
    var appointmentId = (0, react_router_dom_1.useParams)().id;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var autoFilledFieldsRef = (0, react_1.useRef)({});
    var _g = (0, react_1.useState)(false), isConfirmSaveModalOpen = _g[0], setIsConfirmSaveModalOpen = _g[1];
    var confirmedMedicationUpdateRequestRef = (0, react_1.useRef)({});
    var _h = (0, react_1.useState)(null), confirmationModalConfig = _h[0], setConfirmationModalConfig = _h[1];
    var _j = (0, useAppointment_1.useAppointment)(appointmentId), mappedData = _j.mappedData, resources = _j.resources;
    var _k = (0, react_1.useState)(true), isReasonSelected = _k[0], setIsReasonSelected = _k[1];
    var selectsOptions = (0, useGetFieldOptions_1.useFieldsSelectsOptions)();
    var _l = (0, react_1.useState)(ERX_1.ERXStatus.LOADING), erxStatus = _l[0], setERXStatus = _l[1];
    var _m = (0, react_1.useState)({ status: 'done' }), interactionsCheckState = _m[0], setInteractionsCheckState = _m[1];
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    var _o = (0, react_1.useState)(false), showInteractionAlerts = _o[0], setShowInteractionAlerts = _o[1];
    var _p = (0, react_1.useState)(false), erxEnabled = _p[0], setErxEnabled = _p[1];
    var _q = (0, useMedicationHistory_1.useMedicationHistory)(), isMedicationHistoryLoading = _q.isLoading, medicationHistory = _q.medicationHistory, refetchHistory = _q.refetchHistory;
    // There are dynamic form config which depend on what button was clicked:
    // - If "administered" was clicked, then "dispense" form config should be used
    // - If "not-administered" was clicked, then "dispense-not-administered" form config will be used
    // See: https://github.com/masslight/ottehr/issues/2799
    var typeRef = (0, react_1.useRef)(typeFromProps);
    var _r = (0, react_1.useState)(medication
        ? __assign(__assign({}, (0, utils_1.medicationExtendedToMedicationData)(medication)), (0, utils_2.getInitialAutoFilledFields)(medication, autoFilledFieldsRef)) : {}), localValues = _r[0], setLocalValues = _r[1];
    var _s = (0, useMedicationManagement_1.useMedicationManagement)(), updateMedication = _s.updateMedication, getMedicationFieldValue = _s.getMedicationFieldValue, getIsMedicationEditable = _s.getIsMedicationEditable;
    var _t = (0, react_1.useState)((medication === null || medication === void 0 ? void 0 : medication.status) || 'pending'), currentStatus = _t[0], setCurrentStatus = _t[1];
    var _u = (0, react_1.useState)({}), fieldErrors = _u[0], setFieldErrors = _u[1];
    var _v = (0, react_1.useState)(false), isModalOpen = _v[0], setIsModalOpen = _v[1];
    var _w = (0, react_1.useState)([]), missingFields = _w[0], setMissingFields = _w[1];
    var _x = (0, react_1.useState)(false), showErrors = _x[0], setShowErrors = _x[1];
    var isSavedRef = (0, react_1.useRef)(false);
    var handleStatusChange = function (newStatus) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            isSavedRef.current = false;
            setCurrentStatus(newStatus);
            return [2 /*return*/];
        });
    }); };
    var handleFieldValueChange = function (field, value) {
        isSavedRef.current = false;
        if (field === 'dose') {
            setLocalValues(function (prev) {
                var _a;
                return (__assign(__assign({}, prev), (_a = {}, _a[field] = Number(value), _a)));
            });
        }
        else {
            setLocalValues(function (prev) {
                var _a;
                return (__assign(__assign({}, prev), (_a = {}, _a[field] = value, _a)));
            });
        }
        if (field === 'medicationId' && value !== '' && (typeFromProps === 'order-new' || typeFromProps === 'order-edit')) {
            setErxEnabled(true);
        }
    };
    var updateOrCreateOrder = function (updatedRequestInput) { return __awaiter(void 0, void 0, void 0, function () {
        var _a, isValid, missingFields, medicationName, routeName, confirmSaveModalConfigs;
        var _b, _c, _d, _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    // set type dynamically after user click corresponding button to use correct form config https://github.com/masslight/ottehr/issues/2799
                    if (updatedRequestInput.newStatus === 'administered' || updatedRequestInput.newStatus === 'administered-partly') {
                        typeRef.current = 'dispense';
                    }
                    else if (updatedRequestInput.newStatus === 'administered-not') {
                        typeRef.current = 'dispense-not-administered';
                    }
                    _a = (0, utils_2.validateAllMedicationFields)(localValues, medication, typeRef.current, setFieldErrors), isValid = _a.isValid, missingFields = _a.missingFields;
                    // we check that have not empty required fields
                    if (!isValid) {
                        setMissingFields(missingFields);
                        setIsModalOpen(true);
                        setShowErrors(true);
                        return [2 /*return*/];
                    }
                    /**
                     * Using ref to store data that will be:
                     * 1. Displayed in confirmation modal for user review
                     * 2. May be changed during confirmation process (the reason will be specified)
                     * 3. Used in save callback after user confirmation
                     *
                     * This approach ensures that the exact data shown to and confirmed by the user
                     * will be sent to the endpoint and saved.
                     * We can't use async useState value here, because we should save value synchronously after user confirmation.
                     */
                    confirmedMedicationUpdateRequestRef.current = __assign(__assign(__assign({}, (updatedRequestInput.orderId ? { orderId: updatedRequestInput.orderId } : {})), (updatedRequestInput.orderId && updatedRequestInput.newStatus && updatedRequestInput.newStatus !== 'pending'
                        ? { newStatus: updatedRequestInput.newStatus }
                        : {})), { orderData: __assign(__assign(__assign({}, (medication ? (0, utils_1.medicationExtendedToMedicationData)(medication) : {})), updatedRequestInput.orderData), { patient: ((_b = resources.patient) === null || _b === void 0 ? void 0 : _b.id) || '', encounterId: ((_c = resources.encounter) === null || _c === void 0 ? void 0 : _c.id) || '' }), interactions: interactionsCheckState.interactions });
                    if (!(typeRef.current === 'order-new' || typeRef.current === 'order-edit')) return [3 /*break*/, 2];
                    return [4 /*yield*/, handleConfirmSave(confirmedMedicationUpdateRequestRef)];
                case 1:
                    _f.sent();
                    return [2 /*return*/];
                case 2:
                    if ((typeRef.current === 'dispense' || typeRef.current === 'dispense-not-administered') &&
                        (updatedRequestInput.newStatus === 'administered' ||
                            updatedRequestInput.newStatus === 'administered-partly' ||
                            updatedRequestInput.newStatus === 'administered-not')) {
                        medicationName = (_d = medication === null || medication === void 0 ? void 0 : medication.medicationName) !== null && _d !== void 0 ? _d : '';
                        routeName = ((_e = selectsOptions.route.options.find(function (option) { var _a; return option.value === ((_a = updatedRequestInput === null || updatedRequestInput === void 0 ? void 0 : updatedRequestInput.orderData) === null || _a === void 0 ? void 0 : _a.route); })) === null || _e === void 0 ? void 0 : _e.label) ||
                            '';
                        confirmSaveModalConfigs = (0, utils_2.getConfirmSaveModalConfigs)({
                            medicationName: medicationName,
                            routeName: routeName,
                            patientName: mappedData.patientName || '',
                            newStatus: updatedRequestInput.newStatus,
                            updateRequestInputRef: confirmedMedicationUpdateRequestRef,
                            setIsReasonSelected: setIsReasonSelected,
                        });
                        setConfirmationModalConfig(confirmSaveModalConfigs[updatedRequestInput.newStatus]);
                        setIsConfirmSaveModalOpen(true);
                    }
                    return [2 /*return*/];
            }
        });
    }); };
    var handleConfirmSave = function (medicationUpdateRequestInputRefRef) { return __awaiter(void 0, void 0, void 0, function () {
        var newStatus, response, error_1;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!medicationUpdateRequestInputRefRef.current.orderData)
                        return [2 /*return*/];
                    newStatus = (_a = medicationUpdateRequestInputRefRef.current) === null || _a === void 0 ? void 0 : _a.newStatus;
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 5, 6, 7]);
                    setIsOrderUpdating(true);
                    return [4 /*yield*/, updateMedication(medicationUpdateRequestInputRefRef.current)];
                case 2:
                    response = _b.sent();
                    isSavedRef.current = true;
                    if (!newStatus) return [3 /*break*/, 4];
                    return [4 /*yield*/, handleStatusChange(newStatus)];
                case 3:
                    _b.sent();
                    _b.label = 4;
                case 4:
                    if (typeRef.current === 'order-new') {
                        if (response === null || response === void 0 ? void 0 : response.id) {
                            navigate((0, helpers_1.getEditOrderUrl)(appointmentId, response.id));
                        }
                    }
                    void refetchHistory();
                    return [3 /*break*/, 7];
                case 5:
                    error_1 = _b.sent();
                    console.error(error_1);
                    return [3 /*break*/, 7];
                case 6:
                    setIsOrderUpdating(false);
                    setShowErrors(false);
                    setLocalValues({});
                    setFieldErrors({});
                    setIsConfirmSaveModalOpen(false);
                    medicationUpdateRequestInputRefRef.current = {};
                    setConfirmationModalConfig(null);
                    return [7 /*endfinally*/];
                case 7: return [2 /*return*/];
            }
        });
    }); };
    var getFieldValue = (0, react_1.useCallback)(function (field, type) {
        var _a;
        if (type === void 0) { type = 'text'; }
        return (_a = localValues[field]) !== null && _a !== void 0 ? _a : (medication ? getMedicationFieldValue(medication || {}, field, type) : undefined);
    }, [localValues, medication, getMedicationFieldValue]);
    var isUnsavedData = (0, utils_2.isUnsavedMedicationData)(medication, localValues, currentStatus, getMedicationFieldValue, autoFilledFieldsRef, interactionsCheckState.interactions);
    var isEditOrderPage = location.pathname.includes(routesCSS_1.routesCSS[routesCSS_1.ROUTER_PATH.IN_HOUSE_ORDER_EDIT].activeCheckPath);
    var isOrderPage = location.pathname.includes(routesCSS_1.routesCSS[routesCSS_1.ROUTER_PATH.IN_HOUSE_ORDER_NEW].activeCheckPath);
    var shouldBlockNavigation = function () { return !isSavedRef.current && (isEditOrderPage || isOrderPage) && isUnsavedData; };
    var ConfirmationModalForLeavePage = (0, useReactNavigationBlocker_1.useReactNavigationBlocker)(shouldBlockNavigation).ConfirmationModal;
    var saveButtonText = (0, utils_2.getSaveButtonText)((medication === null || medication === void 0 ? void 0 : medication.status) || 'pending', typeRef.current, currentStatus, isUnsavedData);
    var hasNotEditableStatus = currentStatus !== 'pending';
    var isCreatingOrEditingOrder = typeRef.current === 'order-new' || typeRef.current === 'order-edit';
    var isCreatingOrEditingOrderAndNothingToSave = isCreatingOrEditingOrder && !isUnsavedData;
    var isErxLoading = erxEnabled && erxStatus === ERX_1.ERXStatus.LOADING;
    var hasInprogressOrUnresolvedInteractions = interactionsCheckState.status === 'in-progress' || (0, utils_2.interactionsUnresolved)(interactionsCheckState.interactions);
    var isCardSaveButtonDisabled = isOrderUpdating ||
        hasNotEditableStatus ||
        isCreatingOrEditingOrderAndNothingToSave ||
        isErxLoading ||
        hasInprogressOrUnresolvedInteractions;
    var isModalSaveButtonDisabled = confirmedMedicationUpdateRequestRef.current.newStatus === 'administered' ? false : isReasonSelected;
    (0, react_1.useEffect)(function () {
        if (typeRef.current === 'order-new') {
            Object.entries(fieldsConfig_1.fieldsConfig[typeRef.current]).map(function (_a) {
                var _b, _c;
                var field = _a[0];
                var defaultOption = (_c = (_b = selectsOptions[field]) === null || _b === void 0 ? void 0 : _b.defaultOption) === null || _c === void 0 ? void 0 : _c.value;
                if (defaultOption) {
                    var value = getFieldValue(field);
                    if (!value || (typeof value === 'number' && value < 0))
                        setLocalValues(function (prev) {
                            var _a;
                            return (__assign(__assign({}, prev), (_a = {}, _a[field] = defaultOption, _a)));
                        });
                }
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    var defaultProviderValue = (_b = selectsOptions.providerId.defaultOption) === null || _b === void 0 ? void 0 : _b.value;
    var currentProviderValue = getFieldValue('providerId');
    var wasProvidedByFieldTouched = (0, react_1.useRef)(false);
    if (currentProviderValue)
        wasProvidedByFieldTouched.current = true;
    (0, react_1.useEffect)(function () {
        if (!wasProvidedByFieldTouched.current && !currentProviderValue && defaultProviderValue) {
            setLocalValues(function (prev) { return (__assign(__assign({}, prev), { providerId: defaultProviderValue })); });
        }
    }, [defaultProviderValue, currentProviderValue]);
    var runInteractionsCheck = (0, react_1.useCallback)(function (medicationId, medicationHistory) { return __awaiter(void 0, void 0, void 0, function () {
        var patientId, medication_1, interactionsCheckResponse, prescriptions, e_1;
        var _a, _b, _c, _d, _e, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    if (oystehr == null) {
                        setInteractionsCheckState(INTERACTIONS_CHECK_STATE_ERROR);
                        console.error('oystehr is missing');
                        return [2 /*return*/];
                    }
                    patientId = (_a = resources.patient) === null || _a === void 0 ? void 0 : _a.id;
                    if (patientId == null) {
                        setInteractionsCheckState(INTERACTIONS_CHECK_STATE_ERROR);
                        console.error('patientId is missing');
                        return [2 /*return*/];
                    }
                    setInteractionsCheckState({
                        status: 'in-progress',
                        medicationId: medicationId,
                    });
                    _g.label = 1;
                case 1:
                    _g.trys.push([1, 5, , 6]);
                    return [4 /*yield*/, oystehr.fhir.get({
                            resourceType: 'Medication',
                            id: medicationId,
                        })];
                case 2:
                    medication_1 = _g.sent();
                    return [4 /*yield*/, oystehr.erx.checkPrecheckInteractions({
                            patientId: patientId,
                            drugId: (_e = (_d = (_c = (_b = medication_1.code) === null || _b === void 0 ? void 0 : _b.coding) === null || _c === void 0 ? void 0 : _c.find(function (coding) { return coding.system === utils_1.MEDISPAN_DISPENSABLE_DRUG_ID_CODE_SYSTEM; })) === null || _d === void 0 ? void 0 : _d.code) !== null && _e !== void 0 ? _e : '',
                        })];
                case 3:
                    interactionsCheckResponse = _g.sent();
                    return [4 /*yield*/, (0, utils_2.findPrescriptionsForInteractions)((_f = resources.patient) === null || _f === void 0 ? void 0 : _f.id, interactionsCheckResponse, oystehr)];
                case 4:
                    prescriptions = _g.sent();
                    setInteractionsCheckState({
                        status: 'done',
                        interactions: (0, utils_2.medicationInteractionsFromErxResponse)(interactionsCheckResponse, medicationHistory, prescriptions),
                        medicationId: medicationId,
                        medicationName: (0, utils_1.getMedicationName)(medication_1),
                    });
                    return [3 /*break*/, 6];
                case 5:
                    e_1 = _g.sent();
                    setInteractionsCheckState(INTERACTIONS_CHECK_STATE_ERROR);
                    console.error(e_1);
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/];
            }
        });
    }); }, [oystehr, (_c = resources.patient) === null || _c === void 0 ? void 0 : _c.id]);
    var medicationHistoryJson = JSON.stringify(medicationHistory);
    (0, react_1.useEffect)(function () {
        var medicationId = localValues.medicationId;
        if (medicationId && erxStatus === ERX_1.ERXStatus.READY && !isMedicationHistoryLoading) {
            void runInteractionsCheck(medicationId, JSON.parse(medicationHistoryJson));
        }
    }, [localValues.medicationId, runInteractionsCheck, erxStatus, isMedicationHistoryLoading, medicationHistoryJson]);
    (0, react_1.useEffect)(function () {
        if (medication) {
            if (medication.interactions != null) {
                setInteractionsCheckState({
                    status: 'done',
                    interactions: medication.interactions,
                    medicationId: medication.medicationId,
                    medicationName: medication.medicationName,
                });
            }
            else {
                setInteractionsCheckState({
                    status: 'error',
                    medicationId: medication.medicationId,
                    medicationName: medication.medicationName,
                });
            }
        }
    }, [medication]);
    var interactionsMessage = (0, react_1.useMemo)(function () {
        if ((!localValues.medicationId && !medication) ||
            (erxEnabled && erxStatus === ERX_1.ERXStatus.READY && interactionsCheckState.medicationId !== localValues.medicationId)) {
            return undefined;
        }
        if ((erxEnabled && erxStatus === ERX_1.ERXStatus.LOADING && (!medication || medication.id !== localValues.medicationId)) ||
            interactionsCheckState.status === 'in-progress' ||
            isMedicationHistoryLoading) {
            return {
                style: 'loading',
                message: 'checking...',
            };
        }
        else if (erxStatus === ERX_1.ERXStatus.ERROR || interactionsCheckState.status === 'error') {
            return {
                style: 'warning',
                message: 'Drug-to-Drug and Drug-Allergy interaction check failed. Please review manually.',
            };
        }
        else if (interactionsCheckState.status === 'done') {
            if (interactionsCheckState.interactions &&
                (interactionsCheckState.interactions.drugInteractions.length > 0 ||
                    interactionsCheckState.interactions.allergyInteractions.length > 0)) {
                return {
                    style: 'warning',
                    message: (0, util_1.interactionsSummary)(interactionsCheckState.interactions),
                };
            }
            return {
                style: 'success',
                message: 'not found',
            };
        }
        return undefined;
    }, [erxEnabled, erxStatus, interactionsCheckState, localValues.medicationId, medication, isMedicationHistoryLoading]);
    return (<>
      <MedicationCardView_1.MedicationCardView isEditable={getIsMedicationEditable(typeRef.current, medication)} type={typeRef.current} onSave={updateOrCreateOrder} medication={medication} fieldsConfig={fieldsConfig_1.fieldsConfig[typeRef.current]} localValues={localValues} selectedStatus={currentStatus} isUpdating={isOrderUpdating} onFieldValueChange={handleFieldValueChange} onStatusSelect={handleStatusChange} getFieldValue={getFieldValue} showErrors={showErrors} fieldErrors={fieldErrors} getFieldType={utils_2.getFieldType} saveButtonText={saveButtonText} isSaveButtonDisabled={isCardSaveButtonDisabled} selectsOptions={selectsOptions} interactionsMessage={interactionsMessage} onInteractionsMessageClick={function () {
            if (interactionsCheckState.status === 'done' &&
                interactionsCheckState.interactions &&
                (interactionsCheckState.interactions.drugInteractions.length > 0 ||
                    interactionsCheckState.interactions.allergyInteractions.length > 0)) {
                setShowInteractionAlerts(true);
            }
        }}/>
      <CSSModal_1.CSSModal icon={null} color="error.main" open={isModalOpen} handleClose={function () { return setIsModalOpen(false); }} title="Missing Required Fields" description={"Please fill in the following required fields: ".concat(missingFields.join(', '))} handleConfirm={function () { return setIsModalOpen(false); }} confirmText="OK" closeButtonText="Close"/>
      {confirmationModalConfig ? (<CSSModal_1.CSSModal entity={confirmedMedicationUpdateRequestRef} showEntityPreview={false} disabled={isModalSaveButtonDisabled} open={isConfirmSaveModalOpen} handleClose={function () {
                setIsConfirmSaveModalOpen(false);
                confirmedMedicationUpdateRequestRef.current = {};
            }} handleConfirm={handleConfirmSave} description={''} {...confirmationModalConfig}/>) : null}
      <ConfirmationModalForLeavePage />
      {showInteractionAlerts && interactionsCheckState.interactions ? (<InteractionAlertsDialog_1.InteractionAlertsDialog medicationName={(_e = (_d = interactionsCheckState.medicationName) !== null && _d !== void 0 ? _d : medication === null || medication === void 0 ? void 0 : medication.medicationName) !== null && _e !== void 0 ? _e : ''} interactions={interactionsCheckState.interactions} onCancel={function () { return setShowInteractionAlerts(false); }} onContinue={function (interactions) {
                setShowInteractionAlerts(false);
                setInteractionsCheckState({
                    status: 'done',
                    medicationId: localValues.medicationId,
                    interactions: interactions,
                });
            }} readonly={typeFromProps !== 'order-new' && typeFromProps !== 'order-edit'}/>) : null}
      {(typeFromProps === 'order-new' || typeFromProps === 'order-edit') && erxEnabled ? (<ERX_1.ERX onStatusChanged={setERXStatus} showDefaultAlert={false}/>) : null}
    </>);
};
exports.EditableMedicationCard = EditableMedicationCard;
//# sourceMappingURL=EditableMedicationCard.js.map