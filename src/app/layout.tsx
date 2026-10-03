import type { Metadata } from "next";
import "./globals.css";
import "./executive.css";
export const metadata: Metadata = {
  title: "KIMO OS — Your executive command center",
  description: "Priorities, decisions, and clarity across Double Deer Group.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
