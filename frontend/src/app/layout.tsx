import { Geist_Mono, Inter } from "next/font/google";
import type { ReactNode } from "react";

import { Context } from "@/context";
import { AuthProvider } from "@/hooks/auth/useAuth";
import { Notifications } from "@/components/layout/Notifications";
import { LocaleProvider } from "@/hooks/i18n/LocaleProvider";

import "./globals.css";

// the design system's two faces, loaded the same way, so the copied components resolve the same
// font-sans and font-mono utilities they were written against.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata = {
  title: "Diagnostic Assist",
  description: "Root-cause diagnosis for field service",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  // Technicians use this outdoors on a phone. Pinch to zoom stays available.
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // the design system resolves the theme from a cookie on the server and passes it in as
  // initialTheme. A static export has no server, so the markup ships on "system" and
  // the library's own Context re-stamps data-theme from the cookie on mount. The cost is
  // one frame at the system theme for a user who chose otherwise, which is the price of
  // there being no server to ask.
  return (
    <html lang="en" data-theme="system">
      <body className={`${inter.variable} ${geistMono.variable} font-sans bg-background text-text`}>
        <Context>
          <LocaleProvider>
            <AuthProvider>{children}</AuthProvider>
            <Notifications />
          </LocaleProvider>
        </Context>
      </body>
    </html>
  );
}
