"use client";

import Link from "next/link";
import { ReactNode } from "react";
import AuthHeader from "@/components/AuthHeader";

type AuthLayoutProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  maxWidth?: string;
};

export default function AuthLayout({
  title,
  subtitle,
  children,
  maxWidth = "max-w-lg",
}: AuthLayoutProps) {
  return (
    <main className="min-h-screen bg-[#8B6A4E] flex items-start md:items-center justify-center px-4 py-4 md:px-6 md:py-12">
      <div className={`w-full ${maxWidth}`}>
        <AuthHeader />

        <div className="bg-[#FFFDF9] rounded-2xl shadow-xl border border-[#D9CBB8] p-5 md:p-8">
          <div className="text-center mb-6 md:mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-[#5C4033]">
              {title}
            </h1>

            {subtitle && (
              <p className="mt-2 md:mt-3 text-sm md:text-base text-[#8B6A4E]">
                {subtitle}
              </p>
            )}
          </div>

          {children}
        </div>
      </div>
    </main>
  );
}
