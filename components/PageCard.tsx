import { ReactNode } from "react";

type PageCardProps = {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

export default function PageCard({
  title,
  subtitle,
  actions,
  children,
  className = "",
}: PageCardProps) {
  return (
    <div className={`bg-[#FFFDF9] p-5 md:p-8 rounded-xl shadow-lg ${className}`}>
      {(title || subtitle || actions) && (
        <>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 md:gap-4">
            <div>
              {title && (
                <h1 className="text-2xl md:text-4xl font-bold text-[#5C4033]">
                  {title}
                </h1>
              )}

              {subtitle && (
                <p className="mt-1 md:mt-2 text-sm md:text-base text-[#8B6A4E]">
                  {subtitle}
                </p>
              )}
            </div>

            {actions}
          </div>

          <div className="border-t border-[#D9CBB8] my-5 md:my-8" />
        </>
      )}

      {children}
    </div>
  );
}