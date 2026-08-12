import { ReactNode } from "react";

type InfoCardProps = {
  title: string;
  children: ReactNode;
};

export default function InfoCard({
  title,
  children,
}: InfoCardProps) {
  return (
    <div className="bg-[#FFFDF9] p-5 md:p-8 rounded-md md:rounded-lg shadow border border-[#D9CBB8] hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
      <h3 className="text-xl md:text-2xl font-semibold text-[#5C4033] mb-1 md:mb-3">
        {title}
      </h3>

      <p className="text-sm md:text-base leading-relaxed text-[#8B6A4E]">
        {children}
      </p>
    </div>
  );
}