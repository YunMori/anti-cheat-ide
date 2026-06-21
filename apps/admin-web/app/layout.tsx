import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ThemeProvider, ThemeScript } from "@ide/ui";
import "./globals.css";

export const metadata: Metadata = {
  title: "Session Review",
  description: "Coding assessment risk evidence review",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
