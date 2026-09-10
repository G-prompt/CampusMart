import "@/styles/globals.css";
import Navbar from "@/components/common/Navbar";
import Footer from "@/components/common/Footer";
import GlobalLoader from "@/components/common/GlobalLoader";
import AuthModal from "@/components/common/AuthModal";
import ToastHost from "@/components/common/ToastHost";
import { AuthProvider } from "@/components/common/AuthContext";
import { CartProvider } from "@/components/common/CartContext";

export const metadata = { title: "CampusMart", description: "A responsive marketplace for buyers, vendors, and administrators built with a modern design system." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white text-slate-900">
        <AuthProvider>
          <CartProvider>
            <div className="flex min-h-screen flex-col bg-white">
              <GlobalLoader />
              <Navbar />
              <div className="flex-1 bg-white pb-20 md:pb-0">{children}</div>
              <Footer />
            </div>
            <AuthModal />
            <ToastHost />
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
