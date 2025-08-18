"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EligibilityStatusChip = void 0;
var material_1 = require("@mui/material");
var mapStatusToDisplay = {
    passed: { value: 'Passed', color: '#1B5E20', background: '#C8E6C9' },
    bypassed: { value: 'Bypassed', color: '#E65100', background: '#FFE0B2' },
    unsupported: { value: 'Unsupported', color: '#E65100', background: '#FFE0B2' },
    'api-down': { value: 'Api down', color: '#E65100', background: '#FFE0B2' },
    ineligible: { value: 'Ineligible', color: '#B71C1C', background: '#FECDD2' },
};
var ELIGIBILITY_BENEFIT_CODES = 'UC,86,30';
var getEligibilityStatus = function (_a) {
    var _b, _c, _d, _e, _f;
    var eligibilityResponse = _a.eligibilityResponse, appointment = _a.appointment;
    if (!eligibilityResponse) {
        return 'bypassed';
    }
    var failureReason = (_d = (_c = (_b = appointment.meta) === null || _b === void 0 ? void 0 : _b.tag) === null || _c === void 0 ? void 0 : _c.find(function (tag) { var _a; return (_a = tag.system) === null || _a === void 0 ? void 0 : _a.includes('eligibility-failed-reason'); })) === null || _d === void 0 ? void 0 : _d.code;
    if (failureReason === 'real-time-eligibility-unsupported') {
        return 'unsupported';
    }
    if (failureReason === 'api-failure') {
        return 'api-down';
    }
    var eligible = (_f = (_e = eligibilityResponse.insurance) === null || _e === void 0 ? void 0 : _e[0].item) === null || _f === void 0 ? void 0 : _f.some(function (item) {
        var _a, _b, _c;
        var code = (_b = (_a = item.category) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b[0].code;
        var isActive = ((_c = item.benefit) === null || _c === void 0 ? void 0 : _c.filter(function (benefit) { return benefit.type.text === 'Active Coverage'; }).length) !== 0;
        return isActive && code && ELIGIBILITY_BENEFIT_CODES.includes(code);
    });
    if (eligible) {
        return 'passed';
    }
    else {
        return 'ineligible';
    }
};
var EligibilityStatusChip = function (props) {
    var appointment = props.appointment, eligibilityResponse = props.eligibilityResponse;
    var status = getEligibilityStatus({ appointment: appointment, eligibilityResponse: eligibilityResponse });
    return (<material_1.Chip size="small" label={mapStatusToDisplay[status].value} sx={{
            borderRadius: '4px',
            border: 'none',
            background: mapStatusToDisplay[status].background,
            height: 'auto',
            '& .MuiChip-label': {
                display: 'block',
                whiteSpace: 'normal',
                fontWeight: 500,
                fontSize: '12px',
                color: mapStatusToDisplay[status].color,
                textTransform: 'uppercase',
            },
        }} variant="outlined"/>);
};
exports.EligibilityStatusChip = EligibilityStatusChip;
//# sourceMappingURL=EligibilityStatusChip.js.map