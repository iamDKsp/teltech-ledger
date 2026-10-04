import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./lib/auth-context";
import { LoginPage } from "./pages/login";
import { TeltechLedger } from "./TeltechLedger";
import { Loader } from "./components/Loader";
import { Router } from "wouter";
import { Toaster } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function AppInner() {
  const { isLoading, isAuthenticated } = useAuth();
  const [loaderFinished, setLoaderFinished] = useState(false);

  return (
    <AnimatePresence mode="wait">
      {isLoading || !loaderFinished ? (
        <motion.div
          key="loader-view"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", background: "#0d0d0d", zIndex: 999999 }}
        >
          <Loader isReady={!isLoading} onFinish={() => setLoaderFinished(true)} />
        </motion.div>
      ) : !isAuthenticated ? (
        <motion.div
          key="login-view"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          style={{ width: "100vw", height: "100vh" }}
        >
          <LoginPage />
        </motion.div>
      ) : (
        <motion.div
          key="ledger-view"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          style={{ width: "100%", height: "100%" }}
        >
          <TeltechLedger />
        </motion.div>
      )}
    </AnimatePresence>
  );
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
