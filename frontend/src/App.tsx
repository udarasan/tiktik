import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/features/auth/session';
import { useThemeEffect } from '@/hooks/useThemeEffect';
import { routes } from './routes';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: true, retry: 1 },
  },
});

const router = createBrowserRouter(routes);

export function App() {
  useThemeEffect();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
        <Toaster position="bottom-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
