import { FC } from 'react';
import { useFormContext } from 'react-hook-form';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useOystehrAPIClient } from 'src/features/visits/shared/hooks/useOystehrAPIClient';
import { PharmacyDisplay, PharmacySearch } from 'ui-components';
import {
  PHARMACY_COLLECTION_LINK_IDS,
  PharmacyCollectionAnswerSetInput,
  SearchPlacesInput,
  SearchPlacesOutput,
} from 'utils';

export const FormGroupPharmacyCollection: FC = () => {
  const { setValue, watch, register } = useFormContext();
  const apiClient = useOystehrAPIClient();

  const values = watch([
    PHARMACY_COLLECTION_LINK_IDS.placesName,
    PHARMACY_COLLECTION_LINK_IDS.placesAddress,
    PHARMACY_COLLECTION_LINK_IDS.placesId,
    PHARMACY_COLLECTION_LINK_IDS.placesPhone,
  ]);

  const [placesName, placesAddress, placesId, placesPhone] = values;

  const hasSelectedPlace = !!placesName && !!placesAddress && !!placesId;

  const handleSearchPlaces = async (input: SearchPlacesInput): Promise<SearchPlacesOutput> => {
    if (!apiClient) throw new Error('error searching, api client is undefined');
    return await apiClient.searchPlaces(input);
  };

  const clearPharmacyData = (): void => {
    setValue(PHARMACY_COLLECTION_LINK_IDS.erxPharmacyId, '', { shouldDirty: true });
    setValue(PHARMACY_COLLECTION_LINK_IDS.placesAddress, '', { shouldDirty: true });
    setValue(PHARMACY_COLLECTION_LINK_IDS.placesId, '', { shouldDirty: true });
    setValue(PHARMACY_COLLECTION_LINK_IDS.placesName, '', { shouldDirty: true });
    setValue(PHARMACY_COLLECTION_LINK_IDS.placesPhone, '', { shouldDirty: true });
    setValue(PHARMACY_COLLECTION_LINK_IDS.placesDataSaved, false, { shouldDirty: true });
  };

  const handlePlacesPharmacySelection = (input: PharmacyCollectionAnswerSetInput): void => {
    setValue(PHARMACY_COLLECTION_LINK_IDS.manualPharmacyName, '', { shouldDirty: true });
    setValue(PHARMACY_COLLECTION_LINK_IDS.manualPharmacyAddress, '', { shouldDirty: true });
    setValue(PHARMACY_COLLECTION_LINK_IDS.erxPharmacyId, input.erxPharmacyId, { shouldDirty: true });
    setValue(PHARMACY_COLLECTION_LINK_IDS.placesAddress, input.placesAddress, { shouldDirty: true });
    setValue(PHARMACY_COLLECTION_LINK_IDS.placesId, input.placesId, { shouldDirty: true });
    setValue(PHARMACY_COLLECTION_LINK_IDS.placesName, input.placesName, { shouldDirty: true });
    setValue(PHARMACY_COLLECTION_LINK_IDS.placesPhone, input.placesPhone ?? '', { shouldDirty: true });
    setValue(PHARMACY_COLLECTION_LINK_IDS.placesDataSaved, true, { shouldDirty: true });
  };

  return (
    <>
      {/*
        These fields are written only via setValue, never bound to a visible input.
        Registering them is what lets resetField() clear their dirty state after a save
        (resetField is a no-op on unregistered fields), so the Save button can disappear.
      */}
      <input type="hidden" {...register(PHARMACY_COLLECTION_LINK_IDS.placesId)} />
      <input type="hidden" {...register(PHARMACY_COLLECTION_LINK_IDS.placesName)} />
      <input type="hidden" {...register(PHARMACY_COLLECTION_LINK_IDS.placesAddress)} />
      <input type="hidden" {...register(PHARMACY_COLLECTION_LINK_IDS.placesPhone)} />
      <input type="hidden" {...register(PHARMACY_COLLECTION_LINK_IDS.placesDataSaved)} />
      <input type="hidden" {...register(PHARMACY_COLLECTION_LINK_IDS.erxPharmacyId)} />
      {hasSelectedPlace ? (
        <PharmacyDisplay
          selectedPlace={{
            name: placesName!,
            address: placesAddress!,
            placesId: placesId!,
            phone: placesPhone || undefined,
          }}
          clearPharmacyData={clearPharmacyData}
          dataTestIds={dataTestIds.patientInformationPage.pharmacySearchDisplay}
        ></PharmacyDisplay>
      ) : (
        <PharmacySearch
          handlePharmacySelection={handlePlacesPharmacySelection}
          searchPlaces={handleSearchPlaces}
          dataTestId={dataTestIds.patientInformationPage.pharmacySearch}
        ></PharmacySearch>
      )}
    </>
  );
};
