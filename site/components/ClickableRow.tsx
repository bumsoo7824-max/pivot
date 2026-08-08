"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/** 테이블 구조(열 정렬)를 그대로 유지하면서 행 전체를 클릭 가능하게 만든다. */
export default function ClickableRow({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const router = useRouter();
  return (
    <tr
      onClick={() => router.push(href)}
      className={`cursor-pointer transition hover:bg-white/5 ${className}`}
    >
      {children}
    </tr>
  );
}
