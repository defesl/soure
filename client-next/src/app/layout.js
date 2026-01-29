import "./globals.css";

export const metadata = {
  title: "Soure",
  description: "Roll dice. Lose friends. Gain empire.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
