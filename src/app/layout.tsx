import type { Metadata } from "next";
import "./globals.css";
import ClientProviders from "@/components/ClientProviders";
import Navbar from "@/components/nav/Navbar";
import SiteFooter from "@/components/footer/SiteFooter";

export const metadata: Metadata = {
  title: "Aloyon Optical",
  description: "Clinic & e-commerce platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen">
        <ClientProviders>
          <Navbar />
          <main className="container py-10">{children}</main>
          <SiteFooter />
        </ClientProviders>
      </body>
    </html>
  );
}
