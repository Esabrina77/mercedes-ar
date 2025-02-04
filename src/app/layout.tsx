// app/layout.js
import "./globals.css";

export const metadata = {
  title: "Application AR",
  description: "Application AR utilisant Next.js, Three.js et WebXR",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js"></script>
      </head>
      <body>{children}</body>
    </html>
  );
}
