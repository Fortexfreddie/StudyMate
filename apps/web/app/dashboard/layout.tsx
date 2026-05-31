import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { DashboardNav } from "./components/DashboardNav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-bg-main text-white flex flex-col md:flex-row pb-28 md:pb-0">
        <DashboardNav />
        <main className="flex-1 flex flex-col min-w-0">{children}</main>
      </div>
    </ProtectedRoute>
  );
}
