// 정적 배포 전용 설정. 런타임 서버 없이 HTML/JSON 만 서빙한다.
//
// 배포 위치에 따라 경로 접두사가 달라진다.
//   - 도메인 루트 (Vercel 등)      : NEXT_PUBLIC_BASE_PATH 를 비워 둔다
//   - GitHub Pages 프로젝트 페이지 : NEXT_PUBLIC_BASE_PATH=/pivot
//     (https://<user>.github.io/pivot/ 처럼 저장소명이 경로에 붙기 때문에
//      이 값을 주지 않으면 CSS·JS·내부 링크가 전부 404 가 된다)
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  basePath,
  // basePath 가 있으면 정적 자산도 같은 접두사로 내보낸다.
  assetPrefix: basePath || undefined,
};

export default nextConfig;
