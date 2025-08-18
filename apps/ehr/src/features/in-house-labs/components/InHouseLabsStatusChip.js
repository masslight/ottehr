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
exports.InHouseLabsStatusChip = exports.getStatusColor = void 0;
var material_1 = require("@mui/material");
var getStatusColor = function (status) {
    switch (status.toLowerCase()) {
        case 'final':
            return {
                backgroundColor: '#e6f4ff',
                color: '#1976d2',
            };
        case 'collected':
            return {
                backgroundColor: '#e8deff',
                color: '#5e35b1',
            };
        case 'pending':
            return {
                backgroundColor: '#fff4e5',
                color: '#ed6c02',
            };
        default:
            return {
                backgroundColor: '#f5f5f5',
                color: '#757575',
            };
    }
};
exports.getStatusColor = getStatusColor;
var InHouseLabsStatusChip = function (_a) {
    var status = _a.status, additionalStyling = _a.additionalStyling;
    var getChipProps = function () {
        var colors = (0, exports.getStatusColor)(status);
        switch (status.toLowerCase()) {
            case 'final':
                return {
                    label: 'FINAL',
                    sx: __assign(__assign(__assign({}, colors), { fontWeight: 'bold', borderRadius: '4px' }), additionalStyling),
                };
            case 'collected':
                return {
                    label: 'COLLECTED',
                    sx: __assign(__assign({}, colors), { fontWeight: 'bold', borderRadius: '4px' }),
                };
            case 'pending':
                return {
                    label: 'ORDERED',
                    sx: __assign(__assign({}, colors), { fontWeight: 'bold', borderRadius: '4px' }),
                };
            default:
                return {
                    label: (status.toUpperCase() || 'UNKNOWN'), // todo: clarify possible statuses
                    sx: __assign(__assign({}, colors), { fontWeight: 'bold', borderRadius: '4px' }),
                };
        }
    };
    var chipProps = getChipProps();
    return <material_1.Chip size="small" {...chipProps}/>;
};
exports.InHouseLabsStatusChip = InHouseLabsStatusChip;
//# sourceMappingURL=InHouseLabsStatusChip.js.map