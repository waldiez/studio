import '@waldiez/studio/components/Snackbar/Snackbar.css';

/**
 * Shows a snackbar message for a given flow view.
 * @param flowId The id of the flow to show the snackbar for.
 * @param message The message to show in the snackbar.
 * @param level The level of the snackbar. Can be 'info', 'warning', 'error' or 'success'. Defaults to 'info'.
 * @param details The details of the snackbar. Can be a string or an Error object. Defaults to null.
 * @param duration The duration in milliseconds to show the snackbar for. If not provided, the snackbar will be shown indefinitely (until manually closed).
 */
export const showSnackbar = (
    flowId: string,
    message: string,
    level: 'info' | 'warning' | 'error' | 'success' = 'info',
    details: string | Error | null = null,
    duration: number | undefined = undefined,
    includeCloseButton: boolean = false
) => {
    if (isSnackbarLocked(flowId)) {
        setTimeout(() => showSnackbar(flowId, message, level, details, duration, includeCloseButton), 200);
        return;
    }

    setSnackbarLock(flowId, true);
    // if no duration is provided, let's add a close button
    // to manually close the snackbar
    let includeCloseBtn = typeof duration !== 'number';
    if (includeCloseButton) {
        includeCloseBtn = true;
    }
    createOrUpdateSnackbar(flowId, message, level, details, includeCloseBtn);

    if (!includeCloseBtn) {
        scheduleSnackbarRemoval(flowId, duration);
    } else {
        setSnackbarLock(flowId, false);
    }
};

const getFlowRoot = (flowId: string, fallbackToBody = false) => {
    return document.getElementById(`rf-root-${flowId}`) || (fallbackToBody ? document.body : null);
};

const scheduleSnackbarRemoval = (flowId: string, duration: number | undefined) => {
    const rootDiv = getFlowRoot(flowId, true);
    if (!rootDiv || !duration) {
        return;
    }
    setTimeout(() => {
        setSnackbarLock(flowId, false);
        rootDiv.querySelector(`#${flowId}-snackbar`)?.remove();
    }, duration);
};

const isSnackbarLocked = (flowId: string): boolean =>
    Boolean(window.localStorage.getItem(`snackbar-${flowId}.lock`));

const setSnackbarLock = (flowId: string, locked: boolean) => {
    locked
        ? window.localStorage.setItem(`snackbar-${flowId}.lock`, '1')
        : window.localStorage.removeItem(`snackbar-${flowId}.lock`);
};
const createOrUpdateSnackbar = (
    flowId: string,
    message: string,
    level: string,
    details: string | Error | null,
    includeCloseButton: boolean
) => {
    const rootDiv = getFlowRoot(flowId, true);
    if (!rootDiv) {
        return;
    }
    const snackbar = getOrCreateSnackbarElement(flowId, rootDiv);
    snackbar.className = `show snackbar ${level} ${details ? 'with-details' : ''}`;

    snackbar.textContent = '';
    appendSnackbarMessage(snackbar, message);
    appendSnackbarDetails(snackbar, details);

    if (includeCloseButton) {
        addSnackbarCloseButton(snackbar, level, flowId);
    }
};

const getOrCreateSnackbarElement = (flowId: string, rootDiv: HTMLElement): HTMLElement => {
    let snackbar = rootDiv.querySelector(`#${flowId}-snackbar`) as HTMLElement;
    if (!snackbar) {
        snackbar = document.createElement('div');
        snackbar.id = `${flowId}-snackbar`;
        rootDiv.appendChild(snackbar);
    }
    return snackbar;
};

const appendSnackbarMessage = (snackbar: HTMLElement, message: string) => {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    messageDiv.textContent = message;
    snackbar.appendChild(messageDiv);
};

const appendSnackbarDetails = (snackbar: HTMLElement, details: string | Error | null) => {
    if (!details) {
        return;
    }

    const detailsElement = document.createElement('details');
    const summaryElement = document.createElement('summary');
    summaryElement.textContent = 'Details';
    detailsElement.appendChild(summaryElement);

    const detailsContent = document.createElement('div');
    detailsContent.textContent = typeof details === 'string' ? details : getErrorMessage(details);
    detailsElement.appendChild(detailsContent);

    snackbar.appendChild(detailsElement);
};

const getErrorMessage = (error: any): string => {
    if (typeof error === 'string') {
        return error;
    }
    if (error.detail) {
        return error.detail;
    }
    if (error.message) {
        return error.message;
    }
    if (error.statusText) {
        return `Error: ${error.statusText}`;
    }
    return 'An unexpected error occurred.';
};

const addSnackbarCloseButton = (snackbar: HTMLElement, level: string, flowId: string) => {
    const closeButton = document.createElement('div');
    closeButton.className = 'close clickable';
    closeButton.innerHTML = '&times;';
    closeButton.onclick = () => {
        snackbar.className = `hide snackbar ${level}`;
        setTimeout(() => {
            snackbar.remove();
            setSnackbarLock(flowId, false);
        }, 300);
    };
    snackbar.appendChild(closeButton);
};
