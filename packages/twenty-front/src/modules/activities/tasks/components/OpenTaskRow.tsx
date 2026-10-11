import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { isNonEmptyString } from '@sniptt/guards';
import { CoreObjectNameSingular } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

import { useCompleteTask } from '@/activities/tasks/hooks/useCompleteTask';
import { type Task } from '@/activities/types/Task';
import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { RecordChip } from '@/object-record/components/RecordChip';
import { useObjectMorphJunctionConfigOrThrow } from '@/object-record/record-field/ui/hooks/useObjectMorphJunctionConfigOrThrow';
import { extractTargetRecordsFromJunction } from '@/object-record/record-field/ui/utils/junction/extractTargetRecordsFromJunction';
import { getJunctionRecordsFromRecord } from '@/object-record/record-field/ui/utils/junction/getJunctionRecordsFromRecord';
import { useOpenRecordInSidePanel } from '@/side-panel/hooks/useOpenRecordInSidePanel';
import { Checkbox } from 'twenty-ui/primitives/input';
import { themeCssVariables } from 'twenty-ui/theme';
import { beautifyExactDate, hasDatePassed } from '~/utils/date-utils';

const StyledRow = styled.div`
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  cursor: pointer;
  display: flex;
  gap: ${themeCssVariables.spacing[3]};
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[4]};

  &:hover {
    background-color: ${themeCssVariables.background.transparent.lighter};
  }
`;

const StyledCheckboxContainer = styled.div`
  display: flex;
  padding-top: 2px;
`;

const StyledContent = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
  min-width: 0;
`;

const StyledLine = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: space-between;
  min-height: 20px;
  min-width: 0;
`;

const StyledTitle = styled.span`
  color: ${themeCssVariables.color.blue};
  font-weight: ${themeCssVariables.font.weight.medium};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledPlaceholder = styled.span`
  color: ${themeCssVariables.font.color.light};
`;

const StyledAssignee = styled.span`
  color: ${themeCssVariables.font.color.secondary};
  flex-shrink: 0;
  white-space: nowrap;
`;

const StyledTargets = styled.div`
  display: flex;
  flex: 1;
  gap: ${themeCssVariables.spacing[1]};
  min-width: 0;
  overflow: hidden;
`;

const StyledDueDate = styled.span<{ isPast: boolean }>`
  color: ${({ isPast }) =>
    isPast
      ? themeCssVariables.font.color.danger
      : themeCssVariables.font.color.tertiary};
  flex-shrink: 0;
  white-space: nowrap;
`;

type OpenTaskRowProps = {
  task: Task;
};

export const OpenTaskRow = ({ task }: OpenTaskRowProps) => {
  const { openRecordInSidePanel } = useOpenRecordInSidePanel();
  const { completeTask } = useCompleteTask(task);
  const { objectMetadataItems } = useObjectMetadataItems();

  const { junctionField, targetFields } = useObjectMorphJunctionConfigOrThrow({
    objectNameSingular: CoreObjectNameSingular.Task,
  });

  const targetRecords = extractTargetRecordsFromJunction({
    junctionRecords: getJunctionRecordsFromRecord({
      record: task,
      junctionFieldName: junctionField.name,
    }),
    targetFields,
    objectMetadataItems,
    includeRecord: true,
  }).flatMap((extractedRecord) => {
    const targetObjectMetadataItem = objectMetadataItems.find(
      (objectMetadataItem) =>
        objectMetadataItem.id === extractedRecord.objectMetadataId,
    );

    return isDefined(targetObjectMetadataItem) &&
      isDefined(extractedRecord.record)
      ? [
          {
            record: extractedRecord.record,
            objectNameSingular: targetObjectMetadataItem.nameSingular,
          },
        ]
      : [];
  });

  const assigneeName = isDefined(task.assignee)
    ? `${task.assignee.name.firstName} ${task.assignee.name.lastName}`.trim()
    : '';

  const handleRowClick = () => {
    openRecordInSidePanel({
      recordId: task.id,
      objectNameSingular: CoreObjectNameSingular.Task,
    });
  };

  return (
    <StyledRow onClick={handleRowClick}>
      <StyledCheckboxContainer onClick={(event) => event.stopPropagation()}>
        <Checkbox
          checked={task.status === 'DONE'}
          shape="round"
          onCheckedChange={completeTask}
        />
      </StyledCheckboxContainer>
      <StyledContent>
        <StyledLine>
          <StyledTitle>
            {isNonEmptyString(task.title) ? (
              task.title
            ) : (
              <StyledPlaceholder>{t`Untitled task`}</StyledPlaceholder>
            )}
          </StyledTitle>
          {isNonEmptyString(assigneeName) && (
            <StyledAssignee>{assigneeName}</StyledAssignee>
          )}
        </StyledLine>
        <StyledLine>
          <StyledTargets onClick={(event) => event.stopPropagation()}>
            {targetRecords.map(({ record, objectNameSingular }) => (
              <RecordChip
                key={record.id}
                objectNameSingular={objectNameSingular}
                record={record}
                variant="ghost"
                maxWidth={180}
              />
            ))}
          </StyledTargets>
          {isDefined(task.dueAt) && (
            <StyledDueDate isPast={hasDatePassed(task.dueAt)}>
              {beautifyExactDate(task.dueAt)}
            </StyledDueDate>
          )}
        </StyledLine>
      </StyledContent>
    </StyledRow>
  );
};
