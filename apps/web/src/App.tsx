import { RouterProvider } from "react-router-dom";
import { DevAuthPanel } from "@/components/dev/DevAuthPanel";
import { AuthProvider } from "@/context/AuthContext";
import { router } from "@/routes";

export function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
      <DevAuthPanel />
    </AuthProvider>
  );
}