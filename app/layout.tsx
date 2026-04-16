import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import {
  ClerkProvider,
} from "@clerk/nextjs";
import { shadcn } from "@clerk/themes";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
});

export const metadata: Metadata = {
  title: "ExecPilot - AI Executive Assistant",
  description: "Your autonomous AI assistant for email and calendar management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider appearance={{ theme: shadcn }}>
      <html lang="en">
        <body
          className={`${montserrat.className} antialiased`}
        >

          {children}
          <footer className="footer-wrapper">
            <div className="section-heading">
              <p className="text-center text-sm text-muted-foreground">
                © {new Date().getFullYear()} ExecPilot.
              </p>
            </div>
          </footer>
        </body>
      </html>
    </ClerkProvider>
  );
}