import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Our Earth — Interaktiver Globus", description: "Entdecke die Erde interaktiv in 3D." };
export default function RootLayout({children}:{children:React.ReactNode}) {
 return <html lang="de"><body>{children}</body></html>;
}
