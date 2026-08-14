// Prescriptions (eRx) in the easy-chart note. Mirrors Review & Sign's PrescribedMedicationsContainer
// in the easy-chart's compact visual language: meds grouped by pharmacy, each with name, a "Refill"
// chip for renewals, and the sig. The med list comes from chartData.prescribedMedications (already
// part of progressNoteChartDataRequestedFields — render-only here); only the pharmacy DETAILS need
// the eRx service, which may be unavailable on synth/local — those lookups fail silently
// (captureException, no snackbar) and the meds render without their pharmacy line.
import { Box, Chip, Stack, Typography } from '@mui/material';
import { ErxGetPharmacyResponse } from '@oystehr/sdk';
import { captureException } from '@sentry/react';
import { useEffect, useMemo, useState } from 'react';
import { useApiClients } from 'src/hooks/useAppClients';
import { formatPhoneNumberDisplay, formatZipcodeForDisplay } from 'utils/lib/helpers/helpers';
import { PrescribedMedicationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { Section } from './note-ui';

export function PrescriptionsSection({ prescriptions }: { prescriptions: PrescribedMedicationDTO[] }): JSX.Element {
  const { oystehr } = useApiClients();
  const [pharmacies, setPharmacies] = useState<Map<string, ErxGetPharmacyResponse>>(new Map());

  const pharmacyIds = useMemo(
    () => [...new Set(prescriptions.map((m) => m.pharmacyId).filter((id): id is string => !!id))],
    [prescriptions]
  );

  useEffect(() => {
    let cancelled = false;
    if (!oystehr || pharmacyIds.length === 0) return;
    void (async () => {
      const entries = await Promise.all(
        pharmacyIds.map(async (pharmacyId) => {
          try {
            return [pharmacyId, await oystehr.erx.getPharmacy({ pharmacyId })] as const;
          } catch (e) {
            // The eRx service can error or be absent (synth/local) — degrade to meds-without-pharmacy
            // rather than surfacing an error for a purely decorative detail.
            captureException(e);
            return null;
          }
        })
      );
      if (cancelled) return;
      setPharmacies(new Map(entries.filter((entry): entry is NonNullable<typeof entry> => entry !== null)));
    })();
    return () => {
      cancelled = true;
    };
  }, [oystehr, pharmacyIds]);

  // Group prescriptions by pharmacyId, like Review & Sign.
  const groups = new Map<string | undefined, PrescribedMedicationDTO[]>();
  for (const med of prescriptions) {
    const key = med.pharmacyId;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(med);
  }

  return (
    <Section title="Prescriptions">
      <Stack spacing={1}>
        {[...groups.entries()].map(([pharmacyId, meds]) => {
          const pharmacy = pharmacyId ? pharmacies.get(pharmacyId) : undefined;
          return (
            <Stack key={pharmacyId ?? 'no-pharmacy'} spacing={0.5}>
              {pharmacy && (
                <Typography variant="body2">
                  <strong>Pharmacy:</strong>{' '}
                  {[
                    pharmacy.name,
                    pharmacy.address1,
                    pharmacy.address2,
                    pharmacy.city,
                    pharmacy.state,
                    pharmacy.zipCode ? formatZipcodeForDisplay(pharmacy.zipCode) : undefined,
                    formatPhoneNumberDisplay(pharmacy.phone),
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </Typography>
              )}
              {meds.map((med, i) => (
                <Box key={med.resourceId ?? i}>
                  <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                    <Typography variant="body2" fontWeight={600}>
                      {med.name}
                    </Typography>
                    {med.isRenewal && <Chip label="Refill" size="small" color="primary" variant="outlined" />}
                  </Stack>
                  {med.instructions && (
                    <Typography variant="caption" color="text.secondary">
                      {med.instructions}
                    </Typography>
                  )}
                </Box>
              ))}
            </Stack>
          );
        })}
      </Stack>
    </Section>
  );
}
