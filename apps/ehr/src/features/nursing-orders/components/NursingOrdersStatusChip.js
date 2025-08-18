"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NursingOrdersStatusChip = void 0;
var material_1 = require("@mui/material");
var utils_1 = require("utils");
var NursingOrdersStatusChip = function (_a) {
    var status = _a.status;
    var getChipProps = function () {
        switch (status.toLowerCase()) {
            case utils_1.NursingOrdersStatus.pending:
                return {
                    label: 'PENDING',
                    sx: {
                        backgroundColor: '#E6E8EE',
                        color: '#616161',
                        fontWeight: 'bold',
                        borderRadius: '4px',
                    },
                };
            case utils_1.NursingOrdersStatus.completed:
                return {
                    label: 'COMPLETED',
                    sx: {
                        backgroundColor: '#C8E6C9',
                        color: '#1B5E20',
                        fontWeight: 'bold',
                        borderRadius: '4px',
                    },
                };
            case utils_1.NursingOrdersStatus.cancelled:
                return {
                    label: 'CANCELLED',
                    sx: {
                        backgroundColor: '#ffffff',
                        color: '#616161',
                        fontWeight: 'bold',
                        borderRadius: '4px',
                        border: 1,
                        borderColor: '#BFC2C6',
                    },
                };
            default:
                return {
                    label: status.toUpperCase(),
                    sx: {
                        backgroundColor: '#f5f5f5',
                        color: '#757575',
                        fontWeight: 'bold',
                        borderRadius: '4px',
                    },
                };
        }
    };
    var chipProps = getChipProps();
    return <material_1.Chip size="small" {...chipProps}/>;
};
exports.NursingOrdersStatusChip = NursingOrdersStatusChip;
//# sourceMappingURL=NursingOrdersStatusChip.js.map