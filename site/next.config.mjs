/** @type {import('next').NextConfig} */
const nextConfig = {
  // Vercel 정적 배포. 런타임 서버 없이 HTML/JSON 만 서빙한다.
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
