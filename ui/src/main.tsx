import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./app/globals.css";
import { ThemeProvider } from "@/components/tinyhub/theme-provider";
import { Toaster } from "@/components/ui/sonner";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <App />
      <Toaster richColors closeButton position="bottom-right" />
    </ThemeProvider>
  </React.StrictMode>
);
