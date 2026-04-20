import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";

export const metadata: Metadata = {
  title: "VisualPlacemat — Build diagrams from data",
  description:
    "Upload Excel, pick a template, or describe what you need. VisualPlacemat turns your data into beautiful diagrams instantly.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 antialiased">
        <Navbar />
        <main>{children}</main>
      </body>
    </html>
  );
}