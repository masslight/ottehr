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
exports.InteractionAlertsDialog = void 0;
var colors_1 = require("@ehrTheme/colors");
var PriorityHighOutlined_1 = require("@mui/icons-material/PriorityHighOutlined");
var material_1 = require("@mui/material");
var system_1 = require("@mui/system");
var react_1 = require("react");
var RoundedButton_1 = require("src/components/RoundedButton");
var OTHER = 'Other';
var OVERRIDE_REASON = [
    'Will monitor or take precautions',
    'Not clinically significant',
    'Benefit Outweighs Risk',
    'Patient tolerated previously',
    'Dose adjusted',
    OTHER,
];
var SEVERITY_ORDER = ['high', 'moderate', 'low'];
var SEVERITY_TO_LABEL = {
    high: 'Severe',
    moderate: 'Moderate',
    low: 'Minor',
    unknown: 'Unknown',
};
var InteractionAlertsDialog = function (_a) {
    var medicationName = _a.medicationName, initialInteractions = _a.interactions, onCancel = _a.onCancel, onContinue = _a.onContinue, readonly = _a.readonly;
    var _b = (0, react_1.useState)(structuredClone(initialInteractions)), interactions = _b[0], setInteractions = _b[1];
    var allReasonsValid = __spreadArray(__spreadArray([], interactions.drugInteractions, true), interactions.allergyInteractions, true).reduce(function (acc, val) {
        var _a;
        return acc && ((_a = val.overrideReason) !== null && _a !== void 0 ? _a : '').trim().length > 0;
    }, true);
    var interactionTypeTitle = function (title) {
        return (<system_1.Stack direction="row" spacing="12px" alignItems="center" style={{ marginTop: '16px' }}>
        <system_1.Box style={{
                width: '19px',
                height: '19px',
                background: colors_1.otherColors.priorityHighIcon,
                borderRadius: '4px',
                padding: '1px 2px 1px 2px',
            }}>
          <PriorityHighOutlined_1.default style={{ width: '15px', height: '15px', color: '#FFF' }}/>
        </system_1.Box>
        <material_1.Typography style={{ fontSize: '18px', fontWeight: 600, color: colors_1.otherColors.priorityHighIcon }}>
          {title}
        </material_1.Typography>
      </system_1.Stack>);
    };
    var interactionSubtitleBox = function (text) {
        return (<system_1.Box style={{ background: colors_1.otherColors.lightErrorBg, marginTop: '16px', padding: '16px', borderRadius: '4px' }} display="flex" alignItems="center">
        <material_1.Typography variant="body2" style={{ color: colors_1.otherColors.lightErrorText }}>
          {text}
        </material_1.Typography>
      </system_1.Box>);
    };
    var overrideReasonDropdown = function (value, id, onChange) {
        if (readonly) {
            if (value && OVERRIDE_REASON.includes(value)) {
                return <>{value}</>;
            }
            else {
                return undefined;
            }
        }
        if (value != null && !OVERRIDE_REASON.includes(value)) {
            value = OTHER;
        }
        return (<material_1.FormControl fullWidth sx={{ backgroundColor: 'white' }} size="small">
        <material_1.InputLabel id={id}>Override reason</material_1.InputLabel>
        <material_1.Select label="Override reason" labelId={id} variant="outlined" value={value !== null && value !== void 0 ? value : ''} onChange={function (e) { return onChange(e.target.value); }}>
          {OVERRIDE_REASON.map(function (reason) {
                return (<material_1.MenuItem key={reason} value={reason}>
                <material_1.Typography color="textPrimary" sx={{ fontSize: '16px' }}>
                  {reason}
                </material_1.Typography>
              </material_1.MenuItem>);
            })}
        </material_1.Select>
      </material_1.FormControl>);
    };
    var otherTextInput = function (value, onChange) {
        if (value == null || OVERRIDE_REASON.includes(value)) {
            return undefined;
        }
        if (readonly) {
            return <>Other: {value}</>;
        }
        return (<material_1.TextField label="Please specify*" size="small" value={value !== null && value !== void 0 ? value : ''} fullWidth onChange={function (e) { return onChange(e.target.value); }} style={{ marginTop: '8px' }}/>);
    };
    var redCicrcle = function () {
        return (<system_1.Box style={{
                display: 'inline-block',
                width: '12px',
                height: '12px',
                border: '6px #F44336 solid',
                borderRadius: '6px',
            }}></system_1.Box>);
    };
    var emptyCicrcle = function () {
        return (<system_1.Box style={{
                display: 'inline-block',
                width: '12px',
                height: '12px',
                border: '1px #DFE5E9 solid',
                borderRadius: '6px',
            }}></system_1.Box>);
    };
    var severityWidget = function (severity) {
        var order = SEVERITY_ORDER.indexOf(severity !== null && severity !== void 0 ? severity : '');
        return (<system_1.Stack direction="row" spacing="2px" display="flex" alignItems="center">
        {order < 3 ? redCicrcle() : emptyCicrcle()}
        {order < 2 ? redCicrcle() : emptyCicrcle()}
        {order < 1 ? redCicrcle() : emptyCicrcle()}
        <material_1.Typography style={{ marginLeft: '8px' }}>{SEVERITY_TO_LABEL[severity !== null && severity !== void 0 ? severity : 'unknown']}</material_1.Typography>
      </system_1.Stack>);
    };
    var renderSource = function (source) {
        if (!source) {
            return <>Unknown</>;
        }
        var lines = source.split('\n');
        return (<system_1.Stack>
        <material_1.Typography variant="body2">{lines[0]}</material_1.Typography>
        <material_1.Typography color="secondary.light" variant="body2">
          {lines[1]}
        </material_1.Typography>
        <material_1.Typography color="secondary.light" variant="body2">
          {lines[2]}
        </material_1.Typography>
      </system_1.Stack>);
    };
    var medicationsInteractions = function () {
        if (interactions.drugInteractions.length === 0) {
            return undefined;
        }
        return (<system_1.Stack>
        {interactionTypeTitle('Drug Interaction')}
        {interactionSubtitleBox("According to the patient medication history, ordering \u201C".concat(medicationName, "\u201D may result in drug-drug interaction."))}
        <material_1.Table style={{ border: '1px solid #DFE5E9', marginTop: '16px' }}>
          <material_1.TableHead>
            <material_1.TableRow>
              <material_1.TableCell width="15%">Ordered</material_1.TableCell>
              <material_1.TableCell width="15%">Interaction</material_1.TableCell>
              <material_1.TableCell width="20%">Source</material_1.TableCell>
              <material_1.TableCell width="25%">Interaction Description</material_1.TableCell>
              <material_1.TableCell width="25%">Override reason</material_1.TableCell>
            </material_1.TableRow>
          </material_1.TableHead>
          <material_1.TableBody>
            {interactions.drugInteractions
                .sort(function (a, b) { var _a, _b; return SEVERITY_ORDER.indexOf((_a = a.severity) !== null && _a !== void 0 ? _a : '') - SEVERITY_ORDER.indexOf((_b = b.severity) !== null && _b !== void 0 ? _b : ''); })
                .map(function (interaction, index) {
                var _a;
                return (<>
                    {index === 0 ? (<material_1.TableRow key={interaction.severity}>
                        <material_1.TableCell colSpan={5} style={{ padding: '8px' }}>
                          {severityWidget(interaction.severity)}
                        </material_1.TableCell>
                      </material_1.TableRow>) : undefined}
                    <material_1.TableRow key={index}>
                      <material_1.TableCell>{medicationName}</material_1.TableCell>
                      <material_1.TableCell>{interaction.drugs.map(function (drug) { return drug.name; }).join(', ')}</material_1.TableCell>
                      <material_1.TableCell>{renderSource((_a = interaction.source) === null || _a === void 0 ? void 0 : _a.display)}</material_1.TableCell>
                      <material_1.TableCell style={{ verticalAlign: 'top' }}>{interaction.message}</material_1.TableCell>
                      <material_1.TableCell>
                        {overrideReasonDropdown(interaction.overrideReason, 'medication-' + index, function (newValue) {
                        if (newValue !== OTHER) {
                            interaction.overrideReason = newValue;
                        }
                        else {
                            interaction.overrideReason = '';
                        }
                        setInteractions(__assign({}, interactions));
                    })}
                        {otherTextInput(interaction.overrideReason, function (newValue) {
                        interaction.overrideReason = newValue;
                        setInteractions(__assign({}, interactions));
                    })}
                      </material_1.TableCell>
                    </material_1.TableRow>
                  </>);
            })}
          </material_1.TableBody>
        </material_1.Table>
      </system_1.Stack>);
    };
    var allergiesInteractions = function () {
        if (interactions.allergyInteractions.length === 0) {
            return undefined;
        }
        return (<system_1.Stack>
        {interactionTypeTitle('Allergy Interaction')}
        {interactionSubtitleBox("According to the patient's reported allergy, ordering \u201C".concat(medicationName, "\u201D may result in an allergic reaction."))}
        <material_1.Table style={{ border: '1px solid #DFE5E9', marginTop: '16px' }}>
          <material_1.TableHead>
            <material_1.TableRow>
              <material_1.TableCell width="70%">Allergy Description</material_1.TableCell>
              <material_1.TableCell width="30%">Override reason</material_1.TableCell>
            </material_1.TableRow>
          </material_1.TableHead>
          <material_1.TableBody>
            {interactions.allergyInteractions.map(function (interaction, index) {
                return (<material_1.TableRow key={index}>
                  <material_1.TableCell style={{ verticalAlign: 'top' }}>{interaction.message}</material_1.TableCell>
                  <material_1.TableCell>
                    {overrideReasonDropdown(interaction.overrideReason, 'allergy-' + index, function (newValue) {
                        if (newValue !== OTHER) {
                            interaction.overrideReason = newValue;
                        }
                        else {
                            interaction.overrideReason = '';
                        }
                        setInteractions(__assign({}, interactions));
                    })}
                    {otherTextInput(interaction.overrideReason, function (newValue) {
                        interaction.overrideReason = newValue;
                        setInteractions(__assign({}, interactions));
                    })}
                  </material_1.TableCell>
                </material_1.TableRow>);
            })}
          </material_1.TableBody>
        </material_1.Table>
      </system_1.Stack>);
    };
    return (<material_1.Dialog open={true} maxWidth="lg" fullWidth>
      <material_1.DialogContent style={{ padding: '8px 24px 24px 24px' }}>
        {medicationsInteractions()}
        {allergiesInteractions()}
        <system_1.Box style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
          <RoundedButton_1.RoundedButton variant="outlined" onClick={onCancel}>
            Cancel
          </RoundedButton_1.RoundedButton>
          {onContinue && !readonly ? (<RoundedButton_1.RoundedButton variant="contained" onClick={function () { return onContinue(interactions); }} disabled={!allReasonsValid}>
              Continue
            </RoundedButton_1.RoundedButton>) : null}
        </system_1.Box>
      </material_1.DialogContent>
    </material_1.Dialog>);
};
exports.InteractionAlertsDialog = InteractionAlertsDialog;
//# sourceMappingURL=InteractionAlertsDialog.js.map