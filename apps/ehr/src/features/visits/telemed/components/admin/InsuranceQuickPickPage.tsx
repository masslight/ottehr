import { ReactElement, useCallback } from 'react';
import { createInsuranceQuickPick, getInsuranceQuickPicks, removeInsuranceQuickPick } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { InsuranceQuickPickData } from 'utils';
import { InsuranceSearchField } from './InsuranceSearchField';
import QuickPickEditor from './QuickPickEditor';

export default function InsuranceQuickPickPage(): ReactElement {
  const { oystehrZambda } = useApiClients();

  const fetchInsurance = useCallback(async () => {
    if (!oystehrZambda) return [];
    const response = await getInsuranceQuickPicks(oystehrZambda);
    return response.quickPicks;
  }, [oystehrZambda]);

  const createInsurance = useCallback(
    async (data: Omit<InsuranceQuickPickData, 'id'>) => {
      if (!oystehrZambda) throw new Error('oystehrZambda was null');
      const response = await createInsuranceQuickPick(oystehrZambda, { quickPick: data });
      return response.quickPick;
    },
    [oystehrZambda]
  );

  const removeInsurance = useCallback(
    async (id: string) => {
      if (!oystehrZambda) throw new Error('oystehrZambda was null');
      await removeInsuranceQuickPick(oystehrZambda, id);
    },
    [oystehrZambda]
  );

  return (
    <QuickPickEditor<InsuranceQuickPickData>
      title="Insurance Quick Picks"
      description="Manage common insurance carriers that appear as quick picks when selecting a patient's insurance."
      columns={[{ label: 'Insurance Name', getValue: (item) => item.name }]}
      fields={[
        {
          key: 'name',
          label: 'Insurance',
          required: true,
          renderField: (value, onValueChange, onExtraData) => (
            <InsuranceSearchField value={value} onChange={onValueChange} onExtraData={onExtraData} />
          ),
        },
      ]}
      editable={false}
      fetchItems={fetchInsurance}
      createItem={createInsurance}
      removeItem={removeInsurance}
      buildItemFromFields={(values) => ({
        name: values.name.trim(),
        payerId: values.payerId ?? '',
        organizationReference: values.organizationReference ?? '',
      })}
    />
  );
}
