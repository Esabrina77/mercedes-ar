// app/layout.js
import "./globals.css";

export const metadata = {
  title: "Application AR",
  description: "Application AR utilisant Next.js, Three.js et WebXR",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
