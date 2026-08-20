type PublicHeroProps = {
  title: string;
  subtitle: string;
};

export default function PublicHero({ title, subtitle }: PublicHeroProps) {
  return (
    <section className="bg-[#8B6A4E] text-white py-12 md:py-24">
      <div className="max-w-6xl mx-auto px-6 text-center">
        <h1 className="text-3xl md:text-6xl font-bold text-[#F5EFE6]">
          {title}
        </h1>

        <p className="text-base md:text-xl mt-3 md:mt-4 text-[#F5EFE6]/90">
          {subtitle}
        </p>
      </div>
    </section>
  );
}
