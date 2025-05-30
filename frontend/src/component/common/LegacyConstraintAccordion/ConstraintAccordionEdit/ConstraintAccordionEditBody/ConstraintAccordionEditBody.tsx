import { Button, styled } from '@mui/material';
import type { IConstraint } from 'interfaces/strategy';
import { CANCEL } from '../ConstraintAccordionEdit.tsx';

import type React from 'react';

interface IConstraintAccordionBody {
    localConstraint: IConstraint;
    setValues: (values: string[]) => void;
    triggerTransition: () => void;
    setValue: (value: string) => void;
    setAction: React.Dispatch<React.SetStateAction<string>>;
    onSubmit: () => void;
    children?: React.ReactNode;
}

const StyledInputContainer = styled('div')(({ theme }) => ({
    padding: theme.spacing(2),
}));

const StyledButtonContainer = styled('div')(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    marginTop: theme.spacing(2),
    borderTop: `1px solid ${theme.palette.divider}`,
    width: '100%',
    padding: theme.spacing(2),
}));

const StyledInputButtonContainer = styled('div')({
    marginLeft: 'auto',
});

const StyledLeftButton = styled(Button)(({ theme }) => ({
    marginRight: theme.spacing(1),
    minWidth: '125px',
}));

const StyledRightButton = styled(Button)(({ theme }) => ({
    marginLeft: theme.spacing(1),
    minWidth: '125px',
}));

/**
 * @deprecated use NewConstraintAccordion components
 */
export const ConstraintAccordionEditBody: React.FC<
    IConstraintAccordionBody
> = ({ localConstraint, children, triggerTransition, setAction, onSubmit }) => {
    return (
        <>
            <StyledInputContainer>{children}</StyledInputContainer>
            <StyledButtonContainer>
                <StyledInputButtonContainer>
                    <StyledLeftButton
                        type='button'
                        onClick={onSubmit}
                        variant='outlined'
                        color='primary'
                        data-testid='CONSTRAINT_SAVE_BUTTON'
                    >
                        Done
                    </StyledLeftButton>
                    <StyledRightButton
                        onClick={() => {
                            setAction(CANCEL);
                            triggerTransition();
                        }}
                    >
                        Cancel
                    </StyledRightButton>
                </StyledInputButtonContainer>
            </StyledButtonContainer>
        </>
    );
};
