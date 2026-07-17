import "./globals.css";
import AdminLayout from "../components/AdminLayout";

export const metadata = {
  title: "Tutor Online - Admin Control Center",
  description: "Administrative console for Tutor Online platform",
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
