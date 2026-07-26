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
  const imageUrl = `${origin}/document-review-hero.png`;
  const title = "공공AX 로컬 시리즈 2 - 문서 검수";
  const description =
    "HWP, HWPX, DOCX, TXT를 외부로 보내지 않고 페이지별로 미리 보며 맞춤법·띄어쓰기·공공언어를 검사하는 Windows 로컬 문서 검수 도구입니다.";

  return {
    title,
    description,
    applicationName: title,
    keywords: [
      "공공AX",
      "공공AX 로컬",
      "문서 검수",
      "한글 맞춤법 검사",
      "HWP 검사",
      "HWPX 검사",
      "공공언어",
      "로컬 AI",
      "오프라인 문서 검사",
    ],
    robots: {
      index: true,
      follow: true,
    },
    alternates: {
      canonical: `${origin}/series2`,
    },
    openGraph: {
      title,
      description,
      type: "website",
      url: `${origin}/series2`,
      images: [
        {
          url: imageUrl,
          width: 1747,
          height: 900,
          alt: "공공AX 로컬 시리즈 2 문서 검수 사용 화면 안내",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
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
