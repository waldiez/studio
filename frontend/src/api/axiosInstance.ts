import axios, { AxiosError } from 'axios';

export type ApiErrorDetail = {
    detail?: string;
    message?: string;
};

export class ApiError extends Error {
    constructor(
        public status: number,
        message: string,
        public originalError: AxiosError
    ) {
        super(message);
        this.name = 'ApiError';
    }
}
const axiosInstance = axios.create({
    baseURL: '/api',
    timeout: 30000
});

axiosInstance.interceptors.response.use(
    response => response,
    error => {
        if (error.code === 'ECONNABORTED') {
            return Promise.reject(new ApiError(error.response?.status || 0, 'Request timed out.', error));
        }
        let message = 'An unexpected error occurred.';
        let status = 0;
        if (axios.isAxiosError(error) && error.response) {
            status = error.response.status;
            message = getErrorMessage(error);
        }
        if (process.env.NODE_ENV === 'development') {
            console.error('[Axios Error]', error);
        }
        return Promise.reject(new ApiError(status, message, error));
    }
);

export const getErrorMessage = (error: AxiosError): string => {
    let message = 'An unexpected error occurred.';
    const errorData = error.response?.data as ApiErrorDetail;
    if (typeof errorData === 'string') {
        message = errorData;
    } else if (errorData?.detail) {
        message = errorData.detail;
    } else if (errorData?.message) {
        message = errorData.message;
    } else if (error.response?.statusText) {
        message = `Error: ${error.response.statusText}`;
    }
    return message;
};

export default axiosInstance;
