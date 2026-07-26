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
  const imageUrl = `${origin}/series3-og.png`;

  return {
    title: "업무이어봄 | 공공 AX 로컬 시리즈 3",
    description:
      "폴더명과 파일명만으로 담당 업무의 가지와 상태 단서를 정리하는 로컬 인수인계 MVP",
    applicationName: "공공 AX 로컬 시리즈 3 · 업무이어봄",
    alternates: {
      canonical: `${origin}/series3`,
    },
    openGraph: {
      title: "업무이어봄 | 공공 AX 로컬 시리즈 3",
      description: "문서 본문을 열기 전에 만드는 근거 중심 1차 인수인계 지도",
      type: "website",
      url: `${origin}/series3`,
      images: [
        {
          url: imageUrl,
          width: 1536,
          height: 1024,
          alt: "폴더와 파일명을 업무 가지로 정리하는 업무이어봄",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "업무이어봄 | 공공 AX 로컬 시리즈 3",
      description: "폴더와 파일명만 분석하는 로컬 인수인계 MVP",
      images: [imageUrl],
    },
  };
}

export default function SeriesThreeLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
