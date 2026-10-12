import { styled } from '@linaria/react';
import { useState } from 'react';
import { isDefined } from 'twenty-shared/utils';

import { type FieldMetadataItemOption } from '@/object-metadata/types/FieldMetadataItem';
import { IconCheck } from 'twenty-ui/icon';
import { Button } from 'twenty-ui/primitives/input';
import { themeCssVariables } from 'twenty-ui/theme';

const StyledContainer = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[3]};
  min-width: 0;
`;

const StyledLabel = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  flex-shrink: 0;
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
  width: 48px;
`;

const StyledSteps = styled.ol`
  display: flex;
  flex: 1;
  gap: 2px;
  list-style: none;
  margin: 0;
  min-width: 0;
  padding: 0;
`;

type StepState = 'completed' | 'current' | 'selected' | 'upcoming';

const STEP_BACKGROUND: Record<StepState, string> = {
  completed: themeCssVariables.color.green,
  current: themeCssVariables.color.blue,
  selected: themeCssVariables.font.color.secondary,
  upcoming: themeCssVariables.background.tertiary,
};

const StyledStep = styled.li<{ state: StepState; isFirst: boolean }>`
  align-items: center;
  background-color: ${({ state }) => STEP_BACKGROUND[state]};
  clip-path: ${({ isFirst }) =>
    isFirst
      ? 'polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%)'
      : 'polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%, 10px 50%)'};
  color: ${({ state }) =>
    state === 'upcoming'
      ? themeCssVariables.font.color.secondary
      : themeCssVariables.font.color.inverted};
  cursor: pointer;
  display: flex;
  flex: 1;
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${({ state }) =>
    state === 'current'
      ? themeCssVariables.font.weight.semiBold
      : themeCssVariables.font.weight.medium};
  gap: ${themeCssVariables.spacing[1]};
  height: 32px;
  justify-content: center;
  min-width: 0;
  padding: 0 ${themeCssVariables.spacing[3]} 0
    ${({ isFirst }) =>
      isFirst ? themeCssVariables.spacing[3] : themeCssVariables.spacing[4]};

  &:hover {
    filter: brightness(0.92);
  }
`;

const StyledStepLabel = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledAction = styled.div`
  flex-shrink: 0;
  width: 210px;
`;

type TargetPathBarProps = {
  label: string;
  options: FieldMetadataItemOption[];
  currentValue: string | null;
  isSequential: boolean;
  advanceLabel: string;
  selectLabel: string;
  onChange: (value: string) => void;
};

export const TargetPathBar = ({
  label,
  options,
  currentValue,
  isSequential,
  advanceLabel,
  selectLabel,
  onChange,
}: TargetPathBarProps) => {
  const [selectedValue, setSelectedValue] = useState<string | null>(null);

  const sortedOptions = [...options].sort(
    (first, second) => first.position - second.position,
  );

  const currentIndex = sortedOptions.findIndex(
    (option) => option.value === currentValue,
  );

  const pendingValue =
    isDefined(selectedValue) && selectedValue !== currentValue
      ? selectedValue
      : null;

  const nextOption = isSequential ? sortedOptions[currentIndex + 1] : undefined;

  const getStepState = (index: number, value: string): StepState => {
    if (value === pendingValue) {
      return 'selected';
    }
    if (index === currentIndex) {
      return 'current';
    }
    if (isSequential && currentIndex >= 0 && index < currentIndex) {
      return 'completed';
    }
    return 'upcoming';
  };

  const handleStepClick = (value: string) => {
    setSelectedValue(value === currentValue ? null : value);
  };

  const handleActionClick = () => {
    if (isDefined(pendingValue)) {
      onChange(pendingValue);
      setSelectedValue(null);
      return;
    }
    if (isDefined(nextOption)) {
      onChange(nextOption.value);
    }
  };

  const isActionAvailable = isDefined(pendingValue) || isDefined(nextOption);

  return (
    <StyledContainer>
      <StyledLabel>{label}</StyledLabel>
      <StyledSteps aria-label={label}>
        {sortedOptions.map((option, index) => {
          const state = getStepState(index, option.value);

          return (
            <StyledStep
              key={option.value}
              state={state}
              isFirst={index === 0}
              title={option.label}
              aria-current={state === 'current' ? 'step' : undefined}
              onClick={() => handleStepClick(option.value)}
            >
              {state === 'completed' && <IconCheck size={14} />}
              <StyledStepLabel>{option.label}</StyledStepLabel>
            </StyledStep>
          );
        })}
      </StyledSteps>
      <StyledAction>
        {isActionAvailable && (
          <Button
            variant="solid"
            color="accent"
            size="sm"
            fullWidth
            startIcon={<IconCheck size={14} />}
            onClick={handleActionClick}
          >
            {isDefined(pendingValue) ? selectLabel : advanceLabel}
          </Button>
        )}
      </StyledAction>
    </StyledContainer>
  );
};
