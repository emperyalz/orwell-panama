import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { AuthProvider } from "./AuthProvider";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ORWELL | POLÍTICA",
  description:
    "Directorio de políticos panameños con perfiles de redes sociales verificados. 74 políticos, 186 cuentas verificadas.",
  openGraph: {
    title: "ORWELL | POLÍTICA",
    description:
      "Directorio de políticos panameños con perfiles de redes sociales verificados.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.className} antialiased`} suppressHydrationWarning>
        <AuthProvider>
          <ConvexClientProvider>
            <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
              <Header />
              <main className="min-h-screen">{children}</main>
              <Footer />
            </ThemeProvider>
          </ConvexClientProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
