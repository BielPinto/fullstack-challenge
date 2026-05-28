import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";

import App from "@/App";
import { QueryProvider } from "@/providers/query-provider";

import "@/index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryProvider>
      <App />
      <Toaster richColors theme="dark" position="bottom-right" toastOptions={{ className: "font-sans" }} />
    </QueryProvider>
  </StrictMode>,
);
