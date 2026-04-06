import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from '#app/store';
import '#app/styles/global.css';
import { DashboardPage } from '#pages/dashboard/ui/DashboardPage';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Provider store={store}>
        <DashboardPage />
      </Provider>
    </StrictMode>
  );
}
