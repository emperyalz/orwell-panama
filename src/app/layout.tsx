import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { AuthProvider } from "./AuthProvider";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import {LanguageRuntime} from "@/components/i18n/LanguageRuntime";
import "./globals.css";
import {SITE_URL} from '@/lib/site';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  icons: {icon:[{url:'/icon.svg',type:'image/svg+xml'},{url:'/favicon.ico',sizes:'any'}],shortcut:'/favicon.ico'},
  title: "ORWELL | POLÍTICA",
  description:
    "Perfiles de la política panameña, documentos públicos, noticias y registros legislativos con sus fuentes.",
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
              <LanguageRuntime />
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
