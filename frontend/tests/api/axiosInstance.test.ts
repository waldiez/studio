/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import { AxiosError } from "axios";
import { describe, expect, it, vi } from "vitest";

import axiosInstance, { ApiError, ApiErrorDetail, getErrorMessage } from "@waldiez/studio/api/axiosInstance";

describe("axiosInstance", () => {
    describe("ApiError", () => {
        it("should create an instance with the correct properties", () => {
            const axiosError = new AxiosError("Test error");
            const apiError = new ApiError(404, "Not Found", axiosError);

            expect(apiError).toBeInstanceOf(ApiError);
            expect(apiError.name).toBe("ApiError");
            expect(apiError.status).toBe(404);
            expect(apiError.message).toBe("Not Found");
            expect(apiError.originalError).toBe(axiosError);
        });
    });
    describe("getErrorMessage", () => {
        it("should return the detail property if present in the error response", () => {
            const error: AxiosError = {
                response: {
                    data: { detail: "Detailed error message" } as ApiErrorDetail,
                } as any,
            } as AxiosError;

            const message = getErrorMessage(error);
            expect(message).toBe("Detailed error message");
        });

        it("should return the message property if detail is not present", () => {
            const error: AxiosError = {
                response: {
                    data: { message: "Error message" } as ApiErrorDetail,
                } as any,
            } as AxiosError;

            const message = getErrorMessage(error);
            expect(message).toBe("Error message");
        });

        it("should return the statusText if no detail or message is present", () => {
            const error: AxiosError = {
                response: { statusText: "Not Found" } as any,
            } as AxiosError;

            const message = getErrorMessage(error);
            expect(message).toBe("Error: Not Found");
        });

        it("should return a default message for unexpected error formats", () => {
            const error: AxiosError = {
                response: { data: {} } as any,
            } as AxiosError;

            const message = getErrorMessage(error);
            expect(message).toBe("An unexpected error occurred.");
        });

        it("should return a default message if response is undefined", () => {
            const error: AxiosError = {} as AxiosError;

            const message = getErrorMessage(error);
            expect(message).toBe("An unexpected error occurred.");
        });
    });
    describe("interceptors", () => {
        it("should pass through successful responses", async () => {
            // Mock the successful response
            const mockResponse = { data: "success" };
            vi.spyOn(axiosInstance, "get").mockResolvedValueOnce(mockResponse);

            const response = await axiosInstance.get("/test");
            expect(response).toEqual(mockResponse);
        });

        it("should handle ECONNABORTED errors with a timeout message", async () => {
            const axiosMock = axiosInstance as any;
            const axiosError = new AxiosError("Timeout error", "ECONNABORTED");
            axiosError.code = "ECONNABORTED";
            axiosError.response = { status: 408 } as any;

            const rejection = axiosMock._onRejected(axiosError);
            await expect(rejection).rejects.toThrowError(ApiError);
            await expect(rejection).rejects.toMatchObject({
                status: 408,
                message: "Request timed out.",
            });
        });

        it("should handle Axios errors and provide appropriate messages", async () => {
            const axiosError = new AxiosError("Server error");
            axiosError.response = {
                status: 500,
                data: { message: "Server failure" },
            } as any;

            const axiosMock = axiosInstance as any;
            const rejection = axiosMock._onRejected(axiosError);

            await expect(rejection).rejects.toThrowError(ApiError);
            await expect(rejection).rejects.toMatchObject({
                status: 500,
                message: "Server failure",
            });
        });

        it("should handle unknown errors with a default message", async () => {
            const error = new Error("Unknown error");

            const axiosMock = axiosInstance as any;
            const rejection = axiosMock._onRejected(error);

            await expect(rejection).rejects.toThrowError(ApiError);
            await expect(rejection).rejects.toMatchObject({
                status: 0,
                message: "An unexpected error occurred.",
            });
        });

        it("should log errors in development mode", async () => {
            process.env.NODE_ENV = "development";
            const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

            const axiosError = new AxiosError("Test error");
            const axiosMock = axiosInstance as any;

            const rejection = axiosMock._onRejected(axiosError);

            await expect(rejection).rejects.toThrowError(ApiError);
            expect(consoleErrorSpy).toHaveBeenCalledWith("[Axios Error]", axiosError);

            consoleErrorSpy.mockRestore();
        });
    });
});
