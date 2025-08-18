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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MedicationCardView = void 0;
var colors_1 = require("@ehrTheme/colors");
var ArrowBack_1 = require("@mui/icons-material/ArrowBack");
var CheckCircleOutline_1 = require("@mui/icons-material/CheckCircleOutline");
var ErrorOutlineOutlined_1 = require("@mui/icons-material/ErrorOutlineOutlined");
var material_1 = require("@mui/material");
var system_1 = require("@mui/system");
var luxon_1 = require("luxon");
var react_router_dom_1 = require("react-router-dom");
var utils_1 = require("utils");
var data_test_ids_1 = require("../../../../../constants/data-test-ids");
var helpers_1 = require("../../../routing/helpers");
var CSSLoader_1 = require("../../CSSLoader");
var RoundedButton_1 = require("../../RoundedButton");
var MedicationStatusChip_1 = require("../statuses/MedicationStatusChip");
var fieldsConfig_1 = require("./fieldsConfig");
var MedicationCardField_1 = require("./MedicationCardField");
var MedicationCardView = function (_a) {
    var onSave = _a.onSave, medication = _a.medication, fieldsConfig = _a.fieldsConfig, localValues = _a.localValues, selectedStatus = _a.selectedStatus, isUpdating = _a.isUpdating, onFieldValueChange = _a.onFieldValueChange, onStatusSelect = _a.onStatusSelect, getFieldValue = _a.getFieldValue, type = _a.type, showErrors = _a.showErrors, fieldErrors = _a.fieldErrors, getFieldType = _a.getFieldType, isEditable = _a.isEditable, saveButtonText = _a.saveButtonText, isSaveButtonDisabled = _a.isSaveButtonDisabled, selectsOptions = _a.selectsOptions, interactionsMessage = _a.interactionsMessage, onInteractionsMessageClick = _a.onInteractionsMessageClick;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var appointmentId = (0, react_router_dom_1.useParams)().id;
    var theme = (0, material_1.useTheme)();
    var OrderFooter = function () {
        return (<material_1.Box sx={{ minHeight: '40px' }} display="flex" justifyContent="space-between" alignItems="center">
        <RoundedButton_1.ButtonRounded data-testid={data_test_ids_1.dataTestIds.orderMedicationPage.backButton} variant="outlined" onClick={function () { return navigate((0, helpers_1.getInHouseMedicationMARUrl)(appointmentId)); }} color="primary" size="large" startIcon={<ArrowBack_1.default />}>
          Back
        </RoundedButton_1.ButtonRounded>
        {isEditable && (<RoundedButton_1.ButtonRounded data-testid={data_test_ids_1.dataTestIds.orderMedicationPage.fillOrderToSaveButton} disabled={isSaveButtonDisabled} onClick={function () {
                    return onSave((0, utils_1.makeMedicationOrderUpdateRequestInput)({
                        id: medication === null || medication === void 0 ? void 0 : medication.id,
                        orderData: __assign({}, localValues),
                        newStatus: selectedStatus,
                    }));
                }} variant="contained" color="primary" size="large">
            {saveButtonText}
          </RoundedButton_1.ButtonRounded>)}
      </material_1.Box>);
    };
    var DispenseFooter = function () {
        return (<material_1.Box sx={{ minHeight: '40px' }} display="flex" justifyContent="space-between" alignItems="center">
        <MedicationStatusChip_1.MedicationStatusChip isEditable={false} medication={medication} onClick={onStatusSelect} status={selectedStatus}/>
        {isEditable && (<material_1.Box display="flex" flexDirection="row" gap={2}>
            <RoundedButton_1.ButtonRounded disabled={isSaveButtonDisabled} onClick={function () {
                    return onSave((0, utils_1.makeMedicationOrderUpdateRequestInput)({
                        id: medication === null || medication === void 0 ? void 0 : medication.id,
                        orderData: __assign({}, localValues),
                        newStatus: 'administered-not',
                    }));
                }} variant="outlined" color="primary" size="large">
              Not Administered
            </RoundedButton_1.ButtonRounded>
            <RoundedButton_1.ButtonRounded disabled={isSaveButtonDisabled} onClick={function () {
                    return onSave((0, utils_1.makeMedicationOrderUpdateRequestInput)({
                        id: medication === null || medication === void 0 ? void 0 : medication.id,
                        orderData: __assign({}, localValues),
                        newStatus: 'administered-partly',
                    }));
                }} variant="outlined" color="primary" size="large">
              Partly Administered
            </RoundedButton_1.ButtonRounded>
            <RoundedButton_1.ButtonRounded disabled={isSaveButtonDisabled} onClick={function () {
                    return onSave((0, utils_1.makeMedicationOrderUpdateRequestInput)({
                        id: medication === null || medication === void 0 ? void 0 : medication.id,
                        orderData: __assign({}, localValues),
                        newStatus: 'administered',
                    }));
                }} variant="contained" color="primary" size="large">
              Administered
            </RoundedButton_1.ButtonRounded>
          </material_1.Box>)}
      </material_1.Box>);
    };
    return (<material_1.Paper elevation={3} sx={{ p: 3, mb: 3 }}>
      <material_1.Grid container spacing={2}>
        <material_1.Grid item xs={12} sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          {type !== 'order-new' && (<material_1.Typography gutterBottom sx={{ height: '26px', display: 'flex', flexDirection: 'row', gap: 3 }}>
              <span>Order ID: {medication === null || medication === void 0 ? void 0 : medication.id}</span>
              <span>
                {(medication === null || medication === void 0 ? void 0 : medication.effectiveDateTime)
                ? luxon_1.DateTime.fromISO(medication.effectiveDateTime).toFormat('MM/dd/yyyy hh:mm a')
                : ''}
              </span>
            </material_1.Typography>)}
          {isUpdating && (<div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
              <CSSLoader_1.CSSLoader size={24} height={'30px'} width={'30px'}/>
              <material_1.Box ml={1}>Saving...</material_1.Box>
            </div>)}
        </material_1.Grid>
        {Object.entries(fieldsConfig).map(function (_a) {
            var field = _a[0], config = _a[1];
            var value = getFieldValue(field);
            var renderValue;
            // renderValue handles edge case when backend created new medication resource without id
            if (field === 'medicationId' && (medication === null || medication === void 0 ? void 0 : medication.medicationName) && value === utils_1.IN_HOUSE_CONTAINED_MEDICATION_ID) {
                renderValue = medication.medicationName;
            }
            return (<material_1.Grid item xs={config.xs} key={field}>
              <MedicationCardField_1.MedicationCardField isEditable={isEditable && !(type === 'dispense' && field === 'medicationId')} field={field} label={(0, fieldsConfig_1.getFieldLabel)(field, type)} type={getFieldType(field)} value={value} renderValue={renderValue} onChange={onFieldValueChange} required={config.isRequired} showError={showErrors || fieldErrors[field]} selectsOptions={selectsOptions}/>
            </material_1.Grid>);
        })}
        {interactionsMessage ? (<material_1.Grid item xs={12}>
            <system_1.Stack style={{
                background: interactionsMessage.style === 'warning'
                    ? colors_1.otherColors.lightErrorBg
                    : interactionsMessage.style === 'success'
                        ? colors_1.otherColors.lightGreen
                        : 'none',
                padding: '16px',
                borderRadius: '4px',
                width: '100%',
                cursor: 'pointer',
            }} alignItems="center" direction="row" onClick={onInteractionsMessageClick}>
              {interactionsMessage.style === 'warning' ? (<ErrorOutlineOutlined_1.default style={{ width: '20px', height: '20px', color: theme.palette.error.main }}/>) : interactionsMessage.style === 'success' ? (<CheckCircleOutline_1.default style={{ width: '20px', height: '20px', color: theme.palette.success.main }}/>) : (<material_1.CircularProgress size="16px"/>)}
              <material_1.Typography variant="body2" style={{
                color: interactionsMessage.style === 'warning'
                    ? colors_1.otherColors.lightErrorText
                    : interactionsMessage.style === 'success'
                        ? colors_1.otherColors.darkGreenText
                        : '#000',
                marginLeft: '12px',
            }} display="inline">
                <span style={{ fontWeight: '500' }}>Interaction: </span>
                {interactionsMessage.message}
              </material_1.Typography>
            </system_1.Stack>
          </material_1.Grid>) : null}
        <material_1.Grid item xs={12}>
          {type === 'dispense' || type === 'dispense-not-administered' ? <DispenseFooter /> : <OrderFooter />}
        </material_1.Grid>
      </material_1.Grid>
    </material_1.Paper>);
};
exports.MedicationCardView = MedicationCardView;
//# sourceMappingURL=MedicationCardView.js.map