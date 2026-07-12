import "@/styles/globals.css";
import Navbar from "@/components/common/Navbar";
import Footer from "@/components/common/Footer";
import GlobalLoader from "@/components/common/GlobalLoader";

export const metadata = { title: "CampusMart", description: "A responsive marketplace for buyers, vendors, and administrators built with a modern design system." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900">
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(30,58,95,0.08),_transparent_35%)]">
          <GlobalLoader />
          <Navbar />
          {children}
          <Footer />
        </div>
      </body>
    </html>
  );
}
