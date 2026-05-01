import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
import Script from "next/script";
import "./globals.css";
import Navbar from "@/components/shared/navbar";
import NotificationMonitor from "@/components/shared/NotificationMonitor";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FixLink | Quotes. Invoicing. Hire.",
  description: "Fix Link is a two-sided marketplace connecting customers with professional tradesmen for plumbing, electrical, and handyman services.",
  keywords: "fix link, plumbing, electrical, handyman, service marketplace, quotes, invoicing, south africa",
};

export const viewport: Viewport = {
  themeColor: "#1E4E79",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Script
          src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`}
          strategy="afterInteractive"
        />
        <AuthProvider>
          <Navbar />
          <NotificationMonitor />
          <main className="flex-1 pt-24">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
