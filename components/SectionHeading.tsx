type SectionHeadingProps = {
  title: string;
  subtitle?: string;
  center?: boolean;
};

export default function SectionHeading({
  title,
  subtitle,
  center = true,
}: SectionHeadingProps) {
  return (
    <div className={center ? "text-center mb-8 md:mb-12" : "mb-8 md:mb-12"}>
      <h2 className="text-3xl md:text-4xl font-bold text-[#5C4033]">
        {title}
      </h2>

      {subtitle && (
        <p className="mt-3 md:mt-4 text-base md:text-lg text-[#8B6A4E] max-w-3xl mx-auto">
          {subtitle}
        </p>
      )}
    </div>
  );
}