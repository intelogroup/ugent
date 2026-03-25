import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ConvexClientProvider } from "@/lib/convex";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthKitProvider } from "@workos-inc/authkit-nextjs/components";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "U-Gent Medical Chatbot",
  description: "A medical chatbot for Pathoma and First Aid study assistance.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthKitProvider>
          <ConvexClientProvider>
            <ThemeProvider>
              <ServiceWorkerRegistrar />
              {children}
            </ThemeProvider>
          </ConvexClientProvider>
        </AuthKitProvider>
      </body>
    </html>
  );
}
