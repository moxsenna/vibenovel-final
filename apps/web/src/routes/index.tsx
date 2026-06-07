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

export const router = createBrowserRouter([
  { path: "/", element: <LandingPage /> },
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
    ],
  },
]);