import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './contexts/AuthContext.jsx';

import LoginPage from './components/Auth/LoginPage.jsx';
import ProtectedRoute from './components/Auth/ProtectedRoute.jsx';
import Layout from './components/Layout/Layout.jsx';

import AdminDashboard from './components/Admin/AdminDashboard.jsx';
import TemplateManagement from './components/Admin/TemplateManagement.jsx';
import NewMerge from './components/Admin/NewMerge.jsx';
import CouplesList from './components/Admin/CouplesList.jsx';
import AdminHistory from './components/Admin/AdminHistory.jsx';

import ClientDashboard from './components/Client/ClientDashboard.jsx';
import ClientCouples from './components/Client/ClientCouples.jsx';
import ClientResults from './components/Client/ClientResults.jsx';

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-10 h-10 rounded-full border-4 border-primary-700 border-t-transparent" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  return <Navigate to="/client" replace />;
}

export default function App() {
  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1a1a2e',
            color: '#e2e8f0',
            border: '1px solid #2a2a40',
            borderRadius: '10px',
            fontSize: '0.875rem',
          },
          success: {
            iconTheme: { primary: '#a855f7', secondary: '#e2e8f0' },
          },
          error: {
            iconTheme: { primary: '#f87171', secondary: '#e2e8f0' },
          },
        }}
      />
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Admin routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Layout role="admin" />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="templates" element={<TemplateManagement />} />
          <Route path="merge/new" element={<NewMerge />} />
          <Route path="couples" element={<CouplesList />} />
          <Route path="history" element={<AdminHistory />} />
        </Route>

        {/* Client routes */}
        <Route
          path="/client"
          element={
            <ProtectedRoute allowedRoles={['client']}>
              <Layout role="client" />
            </ProtectedRoute>
          }
        >
          <Route index element={<ClientDashboard />} />
          <Route path="couples" element={<ClientCouples />} />
          <Route path="results/:mergeId" element={<ClientResults />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
