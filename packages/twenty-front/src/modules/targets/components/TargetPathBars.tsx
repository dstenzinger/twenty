import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { isString } from '@sniptt/guards';
import { CoreObjectNameSingular } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { useUpdateOneRecord } from '@/object-record/hooks/useUpdateOneRecord';
import { recordStoreFamilySelector } from '@/object-record/record-store/states/selectors/recordStoreFamilySelector';
import { TargetPathBar } from '@/targets/components/TargetPathBar';
import { useAtomFamilySelectorValue } from '@/ui/utilities/state/jotai/hooks/useAtomFamilySelectorValue';
import { themeCssVariables } from 'twenty-ui/theme';

const STAGE_FIELD_NAME = 'stage';
const STATUS_FIELD_NAME = 'status';

const StyledContainer = styled.div`
  background: ${themeCssVariables.background.primary};
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[4]};
`;

type TargetPathBarsProps = {
  recordId: string;
};

export const TargetPathBars = ({ recordId }: TargetPathBarsProps) => {
  const { objectMetadataItem } = useObjectMetadataItem({
    objectNameSingular: CoreObjectNameSingular.Opportunity,
  });
  const { updateOneRecord } = useUpdateOneRecord();

  const stageValue = useAtomFamilySelectorValue(recordStoreFamilySelector, {
    recordId,
    fieldName: STAGE_FIELD_NAME,
  });
  const statusValue = useAtomFamilySelectorValue(recordStoreFamilySelector, {
    recordId,
    fieldName: STATUS_FIELD_NAME,
  });

  const stageOptions = objectMetadataItem.fields.find(
    (field) => field.name === STAGE_FIELD_NAME,
  )?.options;
  const statusOptions = objectMetadataItem.fields.find(
    (field) => field.name === STATUS_FIELD_NAME,
  )?.options;

  const updateField = (fieldName: string) => (value: string) => {
    void updateOneRecord({
      objectNameSingular: CoreObjectNameSingular.Opportunity,
      idToUpdate: recordId,
      updateOneRecordInput: { [fieldName]: value },
    });
  };

  return (
    <StyledContainer>
      {isDefined(stageOptions) && stageOptions.length > 0 && (
        <TargetPathBar
          label={t`Stage`}
          options={stageOptions}
          currentValue={isString(stageValue) ? stageValue : null}
          isSequential
          advanceLabel={t`Mark Stage as Complete`}
          selectLabel={t`Mark as Current Stage`}
          onChange={updateField(STAGE_FIELD_NAME)}
        />
      )}
      {isDefined(statusOptions) && statusOptions.length > 0 && (
        <TargetPathBar
          label={t`Status`}
          options={statusOptions}
          currentValue={isString(statusValue) ? statusValue : null}
          isSequential={false}
          advanceLabel={t`Mark as Current Status`}
          selectLabel={t`Mark as Current Status`}
          onChange={updateField(STATUS_FIELD_NAME)}
        />
      )}
    </StyledContainer>
  );
};
