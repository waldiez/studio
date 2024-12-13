import { describe, expect, it, vi } from 'vitest';

import { debounce, debounceSync } from '@waldiez/studio/utils/debounce';

describe('debounceSync', () => {
    it('calls the function after the delay', async () => {
        const mockFunc = vi.fn();
        const debounced = debounceSync(mockFunc, 100);

        debounced();
        expect(mockFunc).not.toHaveBeenCalled();

        // Advance timers to trigger the debounced function
        vi.advanceTimersByTime(100);
        expect(mockFunc).toHaveBeenCalledTimes(1);
    });

    it('resets the delay if called again within the delay period', async () => {
        const mockFunc = vi.fn();
        const debounced = debounceSync(mockFunc, 100);

        debounced();
        vi.advanceTimersByTime(50);
        debounced();
        vi.advanceTimersByTime(50);
        expect(mockFunc).not.toHaveBeenCalled();

        vi.advanceTimersByTime(50);
        expect(mockFunc).toHaveBeenCalledTimes(1);
    });
});

describe('debounce', () => {
    it('calls the async function after the delay', async () => {
        const mockFunc = vi.fn().mockResolvedValue('result');
        const debounced = debounce(mockFunc, 100);

        const promise = debounced();
        expect(mockFunc).not.toHaveBeenCalled();

        // Advance timers to trigger the debounced function
        vi.advanceTimersByTime(100);
        await expect(promise).resolves.toBe('result');
        expect(mockFunc).toHaveBeenCalledTimes(1);
    });

    it('resets the delay if called again within the delay period', async () => {
        const mockFunc = vi.fn().mockResolvedValue('result');
        const debounced = debounce(mockFunc, 100);

        debounced();
        vi.advanceTimersByTime(50);
        const promise2 = debounced();

        vi.advanceTimersByTime(50);
        expect(mockFunc).not.toHaveBeenCalled();

        vi.advanceTimersByTime(50);
        await expect(promise2).resolves.toBe('result');
        expect(mockFunc).toHaveBeenCalledTimes(1);
    });

    it('handles async errors correctly', async () => {
        const mockFunc = vi.fn().mockRejectedValue(new Error('Test error'));
        const debounced = debounce(mockFunc, 100);

        const promise = debounced();
        vi.advanceTimersByTime(100);

        await expect(promise).rejects.toThrow('Test error');
        expect(mockFunc).toHaveBeenCalledTimes(1);
    });
});
