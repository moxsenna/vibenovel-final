import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "@/components/layout";
import { LandingPage } from "@/pages/LandingPage";
import { StartProjectPage } from "@/pages/StartProjectPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { IntakePage } from "@/pages/IntakePage";
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

export const router = createBrowserRouter([
  { path: "/", element: <LandingPage /> },
  { path: "/login", element: <LoginPage /> },
  {
    element: <AppShell />,
    children: [
      { path: "/start", element: <StartProjectPage /> },
      { path: "/dashboard", element: <DashboardPage /> },
      { path: "/projects/:id/intake", element: <IntakePage /> },
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
]);