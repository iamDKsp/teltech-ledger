import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./lib/auth-context";
import { LoginPage } from "./pages/login";
import { TeltechLedger } from "./TeltechLedger";
import { Loader } from "./components/Loader";
import { Router } from "wouter";
import { Toaster } from "sonner";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function AppInner() {
  const { isLoading, isAuthenticated } = useAuth();
  const [loaderFinished, setLoaderFinished] = useState(false);

  if (isLoading || !loaderFinished) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: '#0d0d0d' }}>
        <Loader isReady={!isLoading} onFinish={() => setLoaderFinished(true)} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <TeltechLedger />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <AppInner />
          <Toaster theme="dark" toastOptions={{ style: { background: '#1a1a1a', border: '1px solid #242424', color: '#e0e0e0' } }} />
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}
