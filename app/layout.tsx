import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "공공 AX 로컬 시리즈 1",
  description:
    "기관의 자료를 외부로 보내지 않고 사용하는 공공업무 특화 로컬 AI 워크스페이스",
  applicationName: "공공 AX 로컬 시리즈 1",
  openGraph: {
    title: "공공 AX 로컬 시리즈 1",
    description: "자료는 로컬에, 업무의 흐름은 더 빠르게.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#f7f8f5",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
