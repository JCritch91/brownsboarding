"use client";

import { ReactNode } from "react";
import CustomerHeader from "@/components/CustomerHeader";

type CustomerPageLayoutProps = {
  children: ReactNode;
};

export default function CustomerPageLayout({
  children,
}: CustomerPageLayoutProps) {
  return (
    <main className="min-h-screen bg-[#8B6A4E]">
      <div className="max-w-6xl mx-auto px-4 py-4 md:p-8 md:pt-12">
        <CustomerHeader />
        {children}
      </div>
    </main>
  );
}
