import { ProtectedRoute } from "@/components/layout/ProtectedRoute";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <div className="min-h-screen">
        {/* Sidebar / navigation will be added when screen images arrive */}
        <main>{children}</main>
      </div>
    </ProtectedRoute>
  );
}
