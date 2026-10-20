import "@/styles/globals.css";

import RouteShell from "@/components/common/RouteShell";
import { CampusMartConfirmProvider } from "@/components/common/CampusMartConfirm";

import {
  AuthProvider,
} from "@/components/common/AuthContext";

import {
  CartProvider,
} from "@/components/common/CartContext";

import {
  SavedProvider,
} from "@/components/common/SavedContext";

export const metadata = {
  title:
    "CampusMart",

  description:
    "A responsive marketplace for buyers, vendors, and administrators built with a modern design system.",
};

export default function RootLayout({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-white text-slate-900">
        <CampusMartConfirmProvider>
        <AuthProvider>
          <CartProvider>
            <SavedProvider>
              <RouteShell>
                {children}
              </RouteShell>
            </SavedProvider>
          </CartProvider>
        </AuthProvider>
        </CampusMartConfirmProvider>
      </body>
    </html>
  );
}