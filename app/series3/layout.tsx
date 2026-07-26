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
  const imageUrl = `${origin}/series3-og-v3.png`;

  return {
    title: "공공 AX 로컬 시리즈 - 인수인계",
    description:
      "폴더명과 파일명만 분석해 업무 가지·제목 후보·날짜 후보를 보여주고, 달력에서 실제 시행일을 확인하는 로컬 인수인계 MVP.",
    applicationName: "공공 AX 로컬 시리즈 - 인수인계",
    alternates: {
      canonical: `${origin}/series3`,
    },
    openGraph: {
      title: "공공 AX 로컬 시리즈 - 인수인계",
      description:
        "Windows 파일 탐색기형 화면에서 파일명 날짜 후보와 수정일을 비교하고 실제 시행일을 달력에 체크하는 1차 인수인계 도구",
      type: "website",
      url: `${origin}/series3`,
      images: [
        {
          url: imageUrl,
          width: 1536,
          height: 1024,
          alt: "공공 AX 로컬 시리즈 인수인계 파일 탐색기와 시행일 달력",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "공공 AX 로컬 시리즈 - 인수인계",
      description:
        "파일명 날짜 후보와 수정일을 비교해 실제 시행일을 달력에 체크하는 로컬 인수인계 MVP",
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
