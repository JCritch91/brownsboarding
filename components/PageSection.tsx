import { ReactNode } from "react";

type PageSectionProps = {
  children: ReactNode;
  background?: string;
};

export default function PageSection({
  children,
  background = "bg-[#F5EFE6]",
}: PageSectionProps) {
  return (
    <section className={background}>
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-10 md:py-16">
        {children}
      </div>
    </section>
  );
}