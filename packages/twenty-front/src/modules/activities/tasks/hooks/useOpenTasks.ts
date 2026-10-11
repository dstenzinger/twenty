import { useMemo } from 'react';

import { type Task } from '@/activities/types/Task';
import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { objectMetadataItemsSelector } from '@/object-metadata/states/objectMetadataItemsSelector';
import { generateDepthRecordGqlFieldsFromObject } from '@/object-record/graphql/record-gql-fields/utils/generateDepthRecordGqlFieldsFromObject';
import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { useObjectMorphJunctionConfigOrThrow } from '@/object-record/record-field/ui/hooks/useObjectMorphJunctionConfigOrThrow';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import {
  CoreObjectNameSingular,
  type RecordGqlFields,
  type RecordGqlOperationFilter,
} from 'twenty-shared/types';

const OPEN_TASKS_LIMIT = 100;

const OPEN_TASKS_FILTER: RecordGqlOperationFilter = {
  or: [{ status: { in: ['TODO', 'IN_PROGRESS'] } }, { status: { is: 'NULL' } }],
};

export const useOpenTasks = () => {
  const objectMetadataItems = useAtomStateValue(objectMetadataItemsSelector);

  const { objectMetadataItem: taskObjectMetadataItem } = useObjectMetadataItem({
    objectNameSingular: CoreObjectNameSingular.Task,
  });

  const { junctionField, junctionObjectMetadata } =
    useObjectMorphJunctionConfigOrThrow({
      objectNameSingular: CoreObjectNameSingular.Task,
    });

  const recordGqlFields = useMemo<RecordGqlFields>(
    () => ({
      ...generateDepthRecordGqlFieldsFromObject({
        objectMetadataItems,
        objectMetadataItem: taskObjectMetadataItem,
        depth: 0,
      }),
      assignee: {
        id: true,
        name: true,
        avatarUrl: true,
        __typename: true,
      },
      [junctionField.name]: generateDepthRecordGqlFieldsFromObject({
        objectMetadataItems,
        objectMetadataItem: junctionObjectMetadata,
        depth: 1,
      }),
    }),
    [
      objectMetadataItems,
      taskObjectMetadataItem,
      junctionField.name,
      junctionObjectMetadata,
    ],
  );

  const { records, loading, totalCount, fetchMoreRecords, hasNextPage } =
    useFindManyRecords<Task>({
      objectNameSingular: CoreObjectNameSingular.Task,
      filter: OPEN_TASKS_FILTER,
      orderBy: [{ dueAt: 'AscNullsLast' }],
      recordGqlFields,
      limit: OPEN_TASKS_LIMIT,
    });

  const openTasks = records.filter((task) => task.status !== 'DONE');

  return {
    openTasks,
    openTasksLoading: loading,
    totalCountOpenTasks: totalCount ?? openTasks.length,
    fetchMoreOpenTasks: fetchMoreRecords,
    hasNextPage,
  };
};
