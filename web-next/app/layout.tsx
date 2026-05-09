import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";
import { AuthProvider } from "@/lib/context/AuthContext";
import { ThemeProvider } from "@/lib/context/ThemeContext";
import QueryProvider from "@/components/QueryProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
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
