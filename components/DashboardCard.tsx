import Link from "next/link";
import { ReactNode } from "react";

type DashboardCardProps = {
  href: string;
  title: string;
  children: ReactNode;
};

export default function DashboardCard({
  href,
  title,
  children,
}: DashboardCardProps) {
  return (
    <Link
      href={href}
      className="bg-white p-5 md:p-6 rounded-xl shadow hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
    >
      <h2 className="text-xl md:text-2xl font-semibold text-[#5C4033]">
        {title}
      </h2>

      <p className="mt-1 md:mt-2 text-sm md:text-base text-[#8B6A4E]">
        {children}
      </p>
    </Link>
  );
}
