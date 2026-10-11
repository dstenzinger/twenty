import { styled } from '@linaria/react';
import { plural, t } from '@lingui/core/macro';
import { useState } from 'react';

import { OpenTaskRow } from '@/activities/tasks/components/OpenTaskRow';
import { useOpenTasks } from '@/activities/tasks/hooks/useOpenTasks';
import { TextInput } from '@/ui/input/components/TextInput';
import { IconCheckbox, IconSearch } from 'twenty-ui/icon';
import { Loader } from 'twenty-ui/primitives/feedback';
import { LightButton } from 'twenty-ui/components/input';
import { MOBILE_VIEWPORT, themeCssVariables } from 'twenty-ui/theme';

const StyledPanel = styled.aside`
  background-color: ${themeCssVariables.background.primary};
  border-left: 1px solid ${themeCssVariables.border.color.medium};
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  height: 100%;
  width: 380px;

  @media (max-width: ${MOBILE_VIEWPORT}px) {
    display: none;
  }
`;

const StyledHeader = styled.div`
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
  padding: ${themeCssVariables.spacing[4]};
`;

const StyledTitleRow = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[3]};
`;

const StyledIconBadge = styled.div`
  align-items: center;
  background-color: ${themeCssVariables.color.green};
  border-radius: 50%;
  color: ${themeCssVariables.font.color.inverted};
  display: flex;
  flex-shrink: 0;
  height: 32px;
  justify-content: center;
  width: 32px;
`;

const StyledTitleBlock = styled.div`
  display: flex;
  flex-direction: column;
`;

const StyledTitle = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.lg};
  font-weight: ${themeCssVariables.font.weight.semiBold};
`;

const StyledSubtitle = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
`;

const StyledList = styled.div`
  flex: 1;
  overflow-y: auto;
`;

const StyledState = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  justify-content: center;
  padding: ${themeCssVariables.spacing[6]} ${themeCssVariables.spacing[4]};
`;

const StyledFooter = styled.div`
  display: flex;
  justify-content: center;
  padding: ${themeCssVariables.spacing[3]};
`;

export const OpenTasksPanel = () => {
  const [searchText, setSearchText] = useState('');

  const {
    openTasks,
    openTasksLoading,
    totalCountOpenTasks,
    fetchMoreOpenTasks,
    hasNextPage,
  } = useOpenTasks();

  const normalizedSearchText = searchText.trim().toLowerCase();

  const visibleTasks =
    normalizedSearchText.length === 0
      ? openTasks
      : openTasks.filter((task) =>
          (task.title ?? '').toLowerCase().includes(normalizedSearchText),
        );

  const itemCountLabel = plural(totalCountOpenTasks, {
    one: '# item',
    other: '# items',
  });

  const handleLoadMore = () => {
    void fetchMoreOpenTasks();
  };

  return (
    <StyledPanel aria-label={t`Open tasks`}>
      <StyledHeader>
        <StyledTitleRow>
          <StyledIconBadge>
            <IconCheckbox size={18} />
          </StyledIconBadge>
          <StyledTitleBlock>
            <StyledTitle>{t`Open Tasks`}</StyledTitle>
            <StyledSubtitle>{itemCountLabel}</StyledSubtitle>
          </StyledTitleBlock>
        </StyledTitleRow>
        <TextInput
          aria-label={t`Search open tasks`}
          placeholder={t`Search this list...`}
          value={searchText}
          onChange={setSearchText}
          LeftIcon={IconSearch}
          fullWidth
        />
      </StyledHeader>
      <StyledList>
        {openTasksLoading && openTasks.length === 0 ? (
          <StyledState>
            <Loader />
          </StyledState>
        ) : visibleTasks.length === 0 ? (
          <StyledState>
            {normalizedSearchText.length > 0
              ? t`No matching tasks`
              : t`No open tasks`}
          </StyledState>
        ) : (
          <>
            {visibleTasks.map((task) => (
              <OpenTaskRow key={task.id} task={task} />
            ))}
            {hasNextPage && (
              <StyledFooter>
                <LightButton
                  onClick={handleLoadMore}
                >{t`Load more`}</LightButton>
              </StyledFooter>
            )}
          </>
        )}
      </StyledList>
    </StyledPanel>
  );
};
