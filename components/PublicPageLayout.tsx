"use client";

import { ReactNode } from "react";
import PublicHeader from "@/components/PublicHeader";

type PublicPageLayoutProps = {
  children: ReactNode;
};

export default function PublicPageLayout({
  children,
}: PublicPageLayoutProps) {
  return (
    <main className="min-h-screen bg-[#F5EFE6]">
      <PublicHeader />
      {children}
    </main>
  );
}