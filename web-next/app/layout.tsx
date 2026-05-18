import type { Metadata } from "next";
import { Open_Sans } from "next/font/google";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";
import { AuthProvider } from "@/lib/context/AuthContext";
import { ThemeProvider } from "@/lib/context/ThemeContext";
import QueryProvider from "@/components/QueryProvider";
import GoogleAnalytics from "@/components/analytics/GoogleAnalytics";

// Match the CRA's font (loaded via Google Fonts in CRA's index.html). The
// design tokens in globals.css reference 'Open Sans' as --font-sans, so the
// body MUST actually load Open Sans or every screen falls back to system-ui.
const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ManchQ - Recital Management",
  description: "Manage recitals, invitations, and RSVPs with ManchQ",
  icons: {
    icon: "/ManchQ-Logo.png",
    shortcut: "/ManchQ-Logo.png",
    apple: "/ManchQ-Logo.png",
  },
  openGraph: {
    siteName: "ManchQ",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Trim defensively — Vercel env vars have shipped with trailing \n which
  // silently breaks Google sign-in (Google rejects the malformed client_id).
  const googleClientId = (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '').trim();

  return (
    <html
      lang="en"
      className={`${openSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <GoogleAnalytics />
        <GoogleOAuthProvider clientId={googleClientId}>
          <QueryProvider>
            <AuthProvider>
              <ThemeProvider>
                {children}
                <Toaster position="top-right" />
              </ThemeProvider>
            </AuthProvider>
          </QueryProvider>
        </GoogleOAuthProvider>
      </body>
    </html>
  );
}
