// The HTML shell. The page is never indexed; the lang attribute is set by
// the Form component once the language is known.
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Umfrage",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
