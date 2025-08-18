"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MedicationHistoryEntity = void 0;
var material_1 = require("@mui/material");
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var MedicationHistoryEntity = function (_a) {
    var item = _a.item;
    var practitioner = 'resourceType' in (item.practitioner || {}) ? item.practitioner : undefined;
    var date = item.intakeInfo.date ? luxon_1.DateTime.fromISO(item.intakeInfo.date).toFormat('MM/dd/yyyy hh:mm a') : undefined;
    var isMedicationWithType = 'chartDataField' in item;
    var getTypeLabel = function () {
        if (isMedicationWithType) {
            if (item.chartDataField === 'inhouseMedications') {
                return 'In-house medication';
            }
            else if (item.chartDataField === 'medications') {
                if (item.type === 'scheduled') {
                    return 'Scheduled medication';
                }
                if (item.type === 'as-needed') {
                    return 'As-needed medication';
                }
            }
        }
        return '';
    };
    return (<material_1.TableRow>
      <material_1.TableCell>
        <material_1.Typography variant="body2" sx={{ fontWeight: 500 }}>
          {item.name} ({item.intakeInfo.dose})
        </material_1.Typography>
      </material_1.TableCell>
      <material_1.TableCell>
        <material_1.Typography variant="body2">{getTypeLabel()}</material_1.Typography>
      </material_1.TableCell>
      <material_1.TableCell>
        <material_1.Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {practitioner ? (0, utils_1.getProviderNameWithProfession)(practitioner) : ''}
        </material_1.Typography>
      </material_1.TableCell>
      <material_1.TableCell>
        <material_1.Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {date || 'No date available'}
        </material_1.Typography>
      </material_1.TableCell>
    </material_1.TableRow>);
};
exports.MedicationHistoryEntity = MedicationHistoryEntity;
//# sourceMappingURL=MedicationHistoryEntity.js.map