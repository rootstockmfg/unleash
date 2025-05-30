import useAPI from '../useApi/useApi.js';

interface IChangePasswordPayload {
    password: string;
    confirmPassword: string;
    oldPassword: string;
}

export const usePasswordApi = () => {
    const { makeRequest, createRequest, errors, loading } = useAPI({
        propagateErrors: true,
    });

    const changePassword = async (payload: IChangePasswordPayload) => {
        const req = createRequest('api/admin/user/change-password', {
            method: 'POST',
            body: JSON.stringify(payload),
        });

        await makeRequest(req.caller, req.id);
    };

    return {
        changePassword,
        errors,
        loading,
    };
};
