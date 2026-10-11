"use client";

import {
  usePathname,
} from "next/navigation";

import Navbar from "@/components/common/Navbar";
import Footer from "@/components/common/Footer";
import GlobalLoader from "@/components/common/GlobalLoader";
import AuthModal from "@/components/common/AuthModal";
import ToastHost from "@/components/common/ToastHost";

export default function RouteShell({
  children,
}: {
  children:
    React.ReactNode;
}) {
  const pathname =
    usePathname();

  const isAdminRoute =
    pathname ===
      "/admin" ||
    pathname.startsWith(
      "/admin/"
    );

  /*
   * Admin is intentionally treated as
   * a separate application experience.
   *
   * Do not render the normal buyer /
   * seller Navbar, Footer, bottom nav,
   * authentication modal or public-site
   * spacing around Admin routes.
   */
  if (isAdminRoute) {
    return (
      <div className="min-h-screen bg-slate-100 text-slate-950">
        {children}
      </div>
    );
  }

  return (
    <>
      <div className="flex min-h-screen flex-col bg-white">
        <GlobalLoader />

        <Navbar />

        <div className="flex-1 bg-white pb-20 md:pb-0">
          {children}
        </div>

        <Footer />
      </div>

      <AuthModal />

      <ToastHost />
    </>
  );
}