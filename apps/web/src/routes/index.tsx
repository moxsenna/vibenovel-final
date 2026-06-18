import { Navigate, createBrowserRouter } from "react-router-dom";
import { AppShell } from "@/components/layout";
import { StartProjectPage } from "@/pages/StartProjectPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { IntakePage } from "@/pages/IntakePage";
import { DraftImportPage } from "@/pages/DraftImportPage";
import { ConceptsPage } from "@/pages/ConceptsPage";
import { FoundationPage } from "@/pages/FoundationPage";
import { OutlinePage } from "@/pages/OutlinePage";
import { WritePage } from "@/pages/WritePage";
import { SummaryPage } from "@/pages/SummaryPage";
import { PublishPage } from "@/pages/PublishPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { CreditTopupPage } from "@/pages/CreditTopupPage";
import { CreditTopupReturnPage } from "@/pages/CreditTopupReturnPage";
import { LoginPage } from "@/pages/LoginPage";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminOverviewPage } from "@/pages/admin/AdminOverviewPage";
import { AdminUsersPage } from "@/pages/admin/AdminUsersPage";
import { AdminUserDetailPage } from "@/pages/admin/AdminUserDetailPage";
import { AdminProjectsPage } from "@/pages/admin/AdminProjectsPage";
import { AdminProjectDetailPage } from "@/pages/admin/AdminProjectDetailPage";
import { AdminProposalsPage } from "@/pages/admin/AdminProposalsPage";
import { AdminProposalDetailPage } from "@/pages/admin/AdminProposalDetailPage";
import { AdminGenerationAttemptsPage } from "@/pages/admin/AdminGenerationAttemptsPage";

import { AdminSystemPage } from "@/pages/admin/AdminSystemPage";
import { AdminAuditLogsPage } from "@/pages/admin/AdminAuditLogsPage";
import { ROUTES } from "@/routes/paths";


export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/login" replace /> },
  { path: "/login", element: <LoginPage /> },
  {
    element: <AppShell />,
    children: [
      { path: "/start", element: <StartProjectPage /> },
      { path: "/dashboard", element: <DashboardPage /> },
      { path: "/projects/:id/intake", element: <IntakePage /> },
      { path: "/projects/:id/import-draft", element: <DraftImportPage /> },
      { path: "/projects/:id/concepts", element: <ConceptsPage /> },
      { path: "/projects/:id/foundation", element: <FoundationPage /> },
      { path: "/projects/:id/outline", element: <OutlinePage /> },
      { path: "/projects/:id/write", element: <WritePage /> },
      { path: "/projects/:id/summary", element: <SummaryPage /> },
      { path: "/projects/:id/publish", element: <PublishPage /> },
      { path: "/settings", element: <SettingsPage /> },
      { path: "/credits/topup", element: <CreditTopupPage /> },
      { path: "/credits/topup/mock-return", element: <CreditTopupReturnPage /> },
      { path: "/credits/topup/return", element: <CreditTopupReturnPage /> },
    ],
  },
  {
    path: ROUTES.admin.root,
    element: (
      <AdminGuard>
        <AdminShell />
      </AdminGuard>
    ),
    children: [
      { index: true, element: <AdminOverviewPage /> },
      { path: "users", element: <AdminUsersPage /> },
      { path: "users/:userId", element: <AdminUserDetailPage /> },
      { path: "projects", element: <AdminProjectsPage /> },
      { path: "projects/:projectId", element: <AdminProjectDetailPage /> },
      { path: "proposals", element: <AdminProposalsPage /> },
      { path: "proposals/:proposalId", element: <AdminProposalDetailPage /> },
      { path: "generation-attempts", element: <AdminGenerationAttemptsPage /> },
      { path: "system", element: <AdminSystemPage /> },
      { path: "audit-logs", element: <AdminAuditLogsPage /> },
    ],
  },
]);
