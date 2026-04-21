// src/frontend/frontend.tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";
import { AuthGate } from "./AuthGate";
import { LoginPage } from "./pages/LoginPage";
import { InstallPage } from "./pages/InstallPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { UsersPage } from "./pages/UsersPage";
import { UserDetailPage } from "./pages/UserDetailPage";
import { ServersPage } from "./pages/ServersPage";
import { ThreeXUiPage } from "./pages/ThreeXUiPage";
import { ExtSubPage } from "./pages/ExtSubPage";
import { ToastProvider } from "./components/terminal/Toasts";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/install/:token" element={<InstallPage />} />
          <Route path="/sub/:token" element={<InstallPage />} />
          <Route element={<AuthGate />}>
            <Route path="/" element={<Navigate to="/users" replace />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/users/:id" element={<UserDetailPage />} />
            <Route path="/servers" element={<ServersPage />} />
            <Route path="/three-x-ui" element={<ThreeXUiPage />} />
            <Route path="/ext-sub" element={<ExtSubPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  </React.StrictMode>
);
