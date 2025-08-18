"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingCard = void 0;
var colors_1 = require("@ehrTheme/colors");
var material_1 = require("@mui/material");
var getSelectors_1 = require("../../../shared/store/getSelectors");
var state_1 = require("../../state");
var ClaimCard_1 = require("./ClaimCard");
var modals_1 = require("./modals");
var BillingCard = function () {
    var _a, _b, _c;
    var _d = (0, getSelectors_1.getSelectors)(state_1.useClaimStore, [
        'organizations',
        'facilities',
        'claimData',
        'coverageData',
    ]), organizations = _d.organizations, facilities = _d.facilities, claimData = _d.claimData, coverageData = _d.coverageData;
    var currencyFormatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    });
    var provider = ((_a = organizations === null || organizations === void 0 ? void 0 : organizations.find(function (organization) { return organization.id === (coverageData === null || coverageData === void 0 ? void 0 : coverageData.organizationId); })) === null || _a === void 0 ? void 0 : _a.name) || '';
    var facility = ((_b = facilities === null || facilities === void 0 ? void 0 : facilities.find(function (facility) { return facility.id === (claimData === null || claimData === void 0 ? void 0 : claimData.facilityId); })) === null || _b === void 0 ? void 0 : _b.name) || '';
    return (<ClaimCard_1.ClaimCard title="24. Billing" editButton={<modals_1.BillingModal />}>
      <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {(claimData === null || claimData === void 0 ? void 0 : claimData.billingItems) && ((_c = claimData.billingItems) === null || _c === void 0 ? void 0 : _c.length) > 0 && (<material_1.Table sx={{
                '& .MuiTableCell-head': {
                    fontWeight: 500,
                },
            }}>
            <material_1.TableHead>
              <material_1.TableRow>
                <material_1.TableCell>A. Date</material_1.TableCell>
                <material_1.TableCell>B. Place</material_1.TableCell>
                {/* cSpell:disable-next Emerg-(enc)y */}
                <material_1.TableCell>C. Emerg-y</material_1.TableCell>
                <material_1.TableCell>D. Code & Modifiers</material_1.TableCell>
                {/* cSpell:disable-next Diagn.(ostic) */}
                <material_1.TableCell>E. Diagn. pointers</material_1.TableCell>
                <material_1.TableCell>F. Charges, $</material_1.TableCell>
                <material_1.TableCell>G. Units / Days</material_1.TableCell>
                <material_1.TableCell>H. EPSDT</material_1.TableCell>
                <material_1.TableCell>J. Rendering Provider ID </material_1.TableCell>
              </material_1.TableRow>
            </material_1.TableHead>
            <material_1.TableBody>
              {claimData.billingItems.map(function (item, i) {
                var _a, _b, _c, _d;
                return (<material_1.TableRow key={i}>
                  <material_1.TableCell>
                    {(_b = (_a = item.date) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.toFormat('MM.dd.yyyy')} - {(_d = (_c = item.date) === null || _c === void 0 ? void 0 : _c[1]) === null || _d === void 0 ? void 0 : _d.toFormat('MM.dd.yyyy')}
                  </material_1.TableCell>
                  <material_1.TableCell>{facility}</material_1.TableCell>
                  <material_1.TableCell>{item.emergency ? 'Yes' : 'No'}</material_1.TableCell>
                  <material_1.TableCell>
                    <material_1.Typography>{item.code}</material_1.Typography>
                    <material_1.Typography>{item.modifiers}</material_1.Typography>
                  </material_1.TableCell>
                  <material_1.TableCell>
                    {/*{item.pointerA && <Typography>A</Typography>}*/}
                    {/*{item.pointerB && <Typography>B</Typography>}*/}
                  </material_1.TableCell>
                  <material_1.TableCell>{item.charges}</material_1.TableCell>
                  <material_1.TableCell>{item.units}</material_1.TableCell>
                  <material_1.TableCell></material_1.TableCell>
                  <material_1.TableCell>{provider}</material_1.TableCell>
                </material_1.TableRow>);
            })}
            </material_1.TableBody>
          </material_1.Table>)}

        <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: '500px' }}>
          <material_1.Card elevation={0} sx={{
            backgroundColor: colors_1.otherColors.lightIconButton,
            px: 2,
            py: '10px',
            display: 'flex',
            justifyContent: 'space-between',
        }}>
            <material_1.Typography variant="h5" color="primary.dark">
              28. Total charge:
            </material_1.Typography>
            <material_1.Typography variant="h5" color="primary.main">
              {typeof (claimData === null || claimData === void 0 ? void 0 : claimData.totalCharge) === 'number' ? currencyFormatter.format(claimData.totalCharge) : '-'}
            </material_1.Typography>
          </material_1.Card>

          <material_1.Box sx={{
            display: 'flex',
            justifyContent: 'space-between',
        }}>
            <material_1.Typography color="primary.dark">29.Patient Payment</material_1.Typography>
            <material_1.Typography>
              {typeof (claimData === null || claimData === void 0 ? void 0 : claimData.patientPaid) === 'number' ? currencyFormatter.format(claimData.patientPaid) : '-'}
            </material_1.Typography>
          </material_1.Box>

          {/*<Divider flexItem />*/}

          {/*<Box*/}
          {/*  sx={{*/}
          {/*    display: 'flex',*/}
          {/*    justifyContent: 'space-between',*/}
          {/*  }}*/}
          {/*>*/}
          {/*  <Typography color="primary.dark">30.Reserved for NUCC use</Typography>*/}
          {/*  <Typography>TODO</Typography>*/}
          {/*</Box>*/}
        </material_1.Box>
      </material_1.Box>
    </ClaimCard_1.ClaimCard>);
};
exports.BillingCard = BillingCard;
//# sourceMappingURL=BillingCard.js.map