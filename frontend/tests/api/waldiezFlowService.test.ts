import axiosInstance from "@waldiez/studio/api/axiosInstance";
import { convertFlow, getFlowContents, saveFlow } from "@waldiez/studio/api/waldiezFlowService";
import { describe, expect, it, vi } from "vitest";

vi.mock("@waldiez/studio/api/axiosInstance", () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        delete: vi.fn(),
    },
}));

describe("getFlowContents", () => {
    it("should fetch the contents of a flow", async () => {
        const mockResponse = { data: "flow contents" };
        (axiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);

        const path = "/example/flow";
        const result = await getFlowContents(path);

        expect(axiosInstance.get).toHaveBeenCalledWith("/flow", { params: { path } });
        expect(result).toBe(mockResponse.data);
    });
});

describe("saveFlow", () => {
    it("should save a flow to a file", async () => {
        const mockResponse = { data: { path: "/example/flow" } };
        (axiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);

        const path = "/example/flow";
        const flow = "flow data";
        const result = await saveFlow(path, flow);

        expect(axiosInstance.post).toHaveBeenCalledWith("/flow", { contents: flow }, { params: { path } });
        expect(result).toEqual(mockResponse.data);
    });
});

describe("convertFlow", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    it("should save and convert a flow to the specified format", async () => {
        const mockSaveResponse = { data: { path: "/example/flow" } };
        const mockConvertResponse = { data: { path: "/example/flow.py" } };

        // Mock the first call (saveFlow) and the second call (convertFlow)
        (axiosInstance.post as ReturnType<typeof vi.fn>)
            .mockResolvedValueOnce(mockSaveResponse) // First call: saveFlow
            .mockResolvedValueOnce(mockConvertResponse); // Second call: convertFlow

        const path = "/example/flow";
        const flow = "flow data";
        const to = "py";

        const result = await convertFlow(path, flow, to);

        // Validate the first call (saveFlow)
        expect(axiosInstance.post).toHaveBeenNthCalledWith(
            1,
            "/flow",
            { contents: flow },
            { params: { path } },
        );

        // Validate the second call (convertFlow)
        expect(axiosInstance.post).toHaveBeenNthCalledWith(2, "/flow/export", null, {
            params: {
                path,
                extension: to,
            },
        });

        // Validate the result
        expect(result).toEqual(mockConvertResponse.data);
    });

    it("should handle conversion to .ipynb", async () => {
        const mockSaveResponse = { data: { path: "/example/flow" } };
        const mockConvertResponse = { data: { path: "/example/flow.ipynb" } };

        (axiosInstance.post as ReturnType<typeof vi.fn>)
            .mockResolvedValueOnce(mockSaveResponse) // Mock saveFlow
            .mockResolvedValueOnce(mockConvertResponse); // Mock conversion

        const path = "/example/flow";
        const flow = "flow data";
        const to = "ipynb";

        const result = await convertFlow(path, flow, to);

        expect(axiosInstance.post).toHaveBeenNthCalledWith(
            1,
            "/flow",
            { contents: flow },
            { params: { path } },
        );
        expect(axiosInstance.post).toHaveBeenNthCalledWith(2, "/flow/export", null, {
            params: {
                path,
                extension: to,
            },
        });
        expect(result).toEqual(mockConvertResponse.data);
    });
});
