"use client";

import { ReactNode } from "react";
import AdminHeader from "@/components/AdminHeader";

type AdminPageLayoutProps = {
  children: ReactNode;
};

export default function AdminPageLayout({
  children,
}: AdminPageLayoutProps) {
  return (
    <main className="min-h-screen bg-[#8B6A4E]">
      <div className="max-w-7xl mx-auto px-4 py-6 md:p-8 md:pt-12">
        <AdminHeader />
        {children}
      </div>
    </main>
  );
}