import React from 'react';
import ReactDOM from 'react-dom/client';

import '@waldiez/react/dist/@waldiez.css';

import { App } from '@waldiez/studio/App';
import '@waldiez/studio/index.css';

export const startApp = () => {
    ReactDOM.createRoot(document.getElementById('root')!).render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );
};

startApp();
