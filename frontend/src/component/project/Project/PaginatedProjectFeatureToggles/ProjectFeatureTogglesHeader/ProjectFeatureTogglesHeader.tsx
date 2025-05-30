import { type ReactNode, type FC, useState } from 'react';
import {
    Box,
    Button,
    IconButton,
    Tooltip,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import useLoading from 'hooks/useLoading';
import { PageHeader } from 'component/common/PageHeader/PageHeader';
import { ConditionallyRender } from 'component/common/ConditionallyRender/ConditionallyRender';
import { Search } from 'component/common/Search/Search';
import { useUiFlag } from 'hooks/useUiFlag';
import Add from '@mui/icons-material/Add';
import { styled } from '@mui/material';
import ResponsiveButton from 'component/common/ResponsiveButton/ResponsiveButton';
import { useSearchParams } from 'react-router-dom';
import { useRequiredPathParam } from 'hooks/useRequiredPathParam';
import { CREATE_FEATURE } from 'component/providers/AccessProvider/permissions';
import { ExportDialog } from 'component/feature/FeatureToggleList/ExportDialog';
import type { FeatureSchema } from 'openapi';
import { usePlausibleTracker } from 'hooks/usePlausibleTracker';
import ReviewsOutlined from '@mui/icons-material/ReviewsOutlined';
import { useFeedback } from 'component/feedbackNew/useFeedback';
import useUiConfig from 'hooks/api/getters/useUiConfig/useUiConfig';
import { CreateFeatureDialog } from './CreateFeatureDialog.tsx';
import IosShare from '@mui/icons-material/IosShare';
import type { OverridableStringUnion } from '@mui/types';
import type { ButtonPropsVariantOverrides } from '@mui/material/Button/Button';
import { NAVIGATE_TO_CREATE_FEATURE } from 'utils/testIds';

interface IProjectFeatureTogglesHeaderProps {
    isLoading?: boolean;
    totalItems?: number;
    searchQuery?: string;
    onChangeSearchQuery?: (query: string) => void;
    dataToExport?: Pick<FeatureSchema, 'name'>[];
    environmentsToExport?: string[];
    actions?: ReactNode;
}

interface IFlagCreationButtonProps {
    text?: string;
    variant?: OverridableStringUnion<
        'text' | 'outlined' | 'contained',
        ButtonPropsVariantOverrides
    >;
    skipNavigationOnComplete?: boolean;
    isLoading?: boolean;
    onSuccess?: () => void;
}

const StyledResponsiveButton = styled(ResponsiveButton)(() => ({
    whiteSpace: 'nowrap',
}));

export const FlagCreationButton = ({
    variant,
    text = 'New feature flag',
    skipNavigationOnComplete,
    isLoading,
    onSuccess,
}: IFlagCreationButtonProps) => {
    const { loading } = useUiConfig();
    const [searchParams] = useSearchParams();
    const projectId = useRequiredPathParam('projectId');
    const showCreateDialog = Boolean(searchParams.get('create'));
    const [openCreateDialog, setOpenCreateDialog] = useState(showCreateDialog);

    return (
        <>
            <StyledResponsiveButton
                onClick={() => setOpenCreateDialog(true)}
                maxWidth='960px'
                Icon={Add}
                projectId={projectId}
                disabled={loading || isLoading}
                variant={variant}
                permission={CREATE_FEATURE}
                data-testid={
                    loading || isLoading ? '' : NAVIGATE_TO_CREATE_FEATURE
                }
            >
                {text}
            </StyledResponsiveButton>
            <CreateFeatureDialog
                open={openCreateDialog}
                onClose={() => setOpenCreateDialog(false)}
                skipNavigationOnComplete={skipNavigationOnComplete}
                onSuccess={onSuccess}
            />
        </>
    );
};

export const ProjectFeatureTogglesHeader: FC<
    IProjectFeatureTogglesHeaderProps
> = ({
    isLoading,
    totalItems,
    searchQuery,
    onChangeSearchQuery,
    environmentsToExport,
    actions,
}) => {
    const projectId = useRequiredPathParam('projectId');
    const headerLoadingRef = useLoading(isLoading || false);
    const [showTitle, setShowTitle] = useState(true);
    const theme = useTheme();
    const isSmallScreen = useMediaQuery(theme.breakpoints.down('md'));
    const [showExportDialog, setShowExportDialog] = useState(false);
    const { trackEvent } = usePlausibleTracker();
    const projectOverviewRefactorFeedback = useUiFlag(
        'projectOverviewRefactorFeedback',
    );
    const { openFeedback } = useFeedback('newProjectOverview', 'automatic');
    const handleSearch = (query: string) => {
        onChangeSearchQuery?.(query);
        trackEvent('search-bar', {
            props: {
                screen: 'project',
                length: query.length,
            },
        });
    };

    const createFeedbackContext = () => {
        openFeedback({
            title: 'How easy was it to work with the project overview in Unleash?',
            positiveLabel:
                'What do you like most about the updated project overview?',
            areasForImprovementsLabel:
                'What improvements are needed in the project overview?',
        });
    };

    return (
        <Box
            ref={headerLoadingRef}
            aria-busy={isLoading}
            aria-live='polite'
            sx={(theme) => ({
                padding: `${theme.spacing(2.5)} ${theme.spacing(3.125)}`,
            })}
        >
            <PageHeader
                titleElement={
                    showTitle
                        ? `Feature flags ${
                              totalItems !== undefined ? `(${totalItems})` : ''
                          }`
                        : null
                }
                actions={
                    <>
                        <ConditionallyRender
                            condition={!isSmallScreen}
                            show={
                                <Search
                                    data-loading
                                    placeholder='Search and Filter'
                                    expandable
                                    initialValue={searchQuery || ''}
                                    onChange={handleSearch}
                                    onFocus={() => setShowTitle(false)}
                                    onBlur={() => setShowTitle(true)}
                                    hasFilters
                                    id='projectFeatureFlags'
                                />
                            }
                        />
                        {actions}
                        <PageHeader.Divider sx={{ marginLeft: 0 }} />
                        <Tooltip title='Export all project flags' arrow>
                            <IconButton
                                data-loading
                                onClick={() => setShowExportDialog(true)}
                                sx={(theme) => ({
                                    marginRight: theme.spacing(2),
                                })}
                            >
                                <IosShare />
                            </IconButton>
                        </Tooltip>

                        <ConditionallyRender
                            condition={!isLoading}
                            show={
                                <ExportDialog
                                    showExportDialog={showExportDialog}
                                    project={projectId}
                                    data={[]}
                                    onClose={() => setShowExportDialog(false)}
                                    environments={environmentsToExport || []}
                                />
                            }
                        />
                        <ConditionallyRender
                            condition={
                                projectOverviewRefactorFeedback &&
                                !isSmallScreen
                            }
                            show={
                                <Button
                                    startIcon={<ReviewsOutlined />}
                                    onClick={createFeedbackContext}
                                    variant='outlined'
                                    data-loading
                                >
                                    Provide feedback
                                </Button>
                            }
                        />
                        <FlagCreationButton isLoading={isLoading} />
                    </>
                }
            >
                <ConditionallyRender
                    condition={isSmallScreen}
                    show={
                        <Search
                            initialValue={searchQuery || ''}
                            onChange={handleSearch}
                            hasFilters
                            id='projectFeatureFlags'
                        />
                    }
                />
            </PageHeader>
        </Box>
    );
};
