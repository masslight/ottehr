"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InHouseLabOrderHistory = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var utils_1 = require("utils");
var InHouseLabsStatusChip_1 = require("../InHouseLabsStatusChip");
var InHouseLabOrderHistory = function (_a) {
    var testDetails = _a.testDetails;
    return (<material_1.Table sx={{
            p: '8px 16px',
            mt: 3,
            borderCollapse: 'separate',
            backgroundColor: '#F8F9FA',
            borderRadius: '8px',
        }}>
      <material_1.TableBody>
        {testDetails.orderHistory.map(function (_a) {
            var date = _a.date, providerName = _a.providerName, status = _a.status;
            return (<material_1.TableRow key={date + providerName + status} sx={{
                    borderRadius: '8px',
                    '&:last-of-type td': {
                        borderBottom: 'none',
                    },
                }}>
            <material_1.TableCell sx={{
                    p: '8px 0',
                    width: '33%',
                    verticalAlign: 'middle',
                }}>
              <InHouseLabsStatusChip_1.InHouseLabsStatusChip status={status}/>
            </material_1.TableCell>
            <material_1.TableCell sx={{
                    p: '8px 0',
                    width: '33%',
                    verticalAlign: 'middle',
                }}>
              <material_1.Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                {providerName ? "by ".concat(providerName) : ''}
              </material_1.Typography>
            </material_1.TableCell>
            <material_1.TableCell sx={{
                    p: '8px 0',
                    width: '33%',
                    verticalAlign: 'middle',
                    textAlign: 'right',
                }}>
              <material_1.Typography variant="body2">{(0, utils_1.formatDateForLabs)(date, testDetails.timezone)}</material_1.Typography>
            </material_1.TableCell>
          </material_1.TableRow>);
        })}
      </material_1.TableBody>
    </material_1.Table>);
};
exports.InHouseLabOrderHistory = InHouseLabOrderHistory;
//# sourceMappingURL=InHouseLabOrderHistory.js.map