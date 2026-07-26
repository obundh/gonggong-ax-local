import type { Metadata } from "next";
import { headers } from "next/headers";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const imageUrl = `${origin}/og.png`;

  return {
    title: "문서살림 | 공공 AX 로컬 시리즈 2",
    description:
      "HWP, HWPX, DOCX, TXT를 외부로 보내지 않고 페이지별로 미리 보고 맞춤법·띄어쓰기·공공언어 규칙으로 검사합니다.",
    applicationName: "공공 AX 로컬 시리즈 2 · 문서살림",
    alternates: {
      canonical: `${origin}/series2`,
    },
    openGraph: {
      title: "문서살림 | 공공 AX 로컬 시리즈 2",
      description: "공공문서를 로컬 규칙으로 읽고, 근거와 함께 고칩니다.",
      type: "website",
      url: `${origin}/series2`,
      images: [
        {
          url: imageUrl,
          width: 1536,
          height: 1024,
          alt: "공공문서 로컬 검수기 문서살림",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "문서살림 | 공공 AX 로컬 시리즈 2",
      description: "외부 전송 없이 공공문서를 검사하는 로컬 규칙 엔진",
      images: [imageUrl],
    },
  };
}

export default function SeriesTwoLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
