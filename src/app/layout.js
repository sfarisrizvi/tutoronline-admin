import "./globals.css";
import AdminLayout from "../components/AdminLayout";

export const metadata = {
  title: "Admin Control Center - Tutor Online",
  description: "Admin console for Tutor Online platform. NO GO AREA",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AdminLayout>
          {children}
        </AdminLayout>
      </body>
    </html>
  );
}
