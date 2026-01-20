import { allDefined } from '@awesome.me/webawesome/dist/webawesome.js';

import Detail from '$components/detail';
import {
  // useQuery,
  // useMutation,
  // useQueryClient,
  QueryClient,
  QueryClientProvider
} from '@tanstack/react-query';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';

import MapComponent from './components/map';
import Sidebar from './components/sidebar';
import { StacProvider } from './context/StacContext';
import { AuthProvider } from './context/AuthContext';

// Import Web Awesome components needed by hanko-auth web component
import '@awesome.me/webawesome/dist/components/dropdown/dropdown.js';
import '@awesome.me/webawesome/dist/components/dropdown-item/dropdown-item.js';
import '@awesome.me/webawesome/dist/components/button/button.js';
import '@awesome.me/webawesome/dist/components/icon/icon.js';

// Import auth-libs web component
import '@hotosm/hanko-auth';

// If using a router add the public url to the base path.
// const publicUrl = process.env.BASE_URL || '';

// Ensure all WebAwesome components are loaded before rendering
await allDefined();

const queryClient = new QueryClient();

function Root() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function AppContent() {
  const [showDetailPane, setShowDetailPane] = useState(false);
  return (
    <StacProvider>
      <Sidebar
        isDetailPaneShown={showDetailPane}
        setShowDetailPane={setShowDetailPane}
      />
      <Detail
        isDetailPaneShown={showDetailPane}
        setShowDetailPane={setShowDetailPane}
      />
      <MapComponent />
    </StacProvider>
  );
}

const rootNode = document.querySelector('#app-container')!;
const root = createRoot(rootNode);
root.render(<Root />);
