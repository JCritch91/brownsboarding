"use client";

import PublicPageLayout from "@/components/PublicPageLayout";
import PageSection from "@/components/PageSection";
import SectionHeading from "@/components/SectionHeading";
import InfoCard from "@/components/InfoCard";
import Button from "@/components/Buttons";

export default function Home() {
  return (
    <PublicPageLayout>
      {/* Hero */}
      <section className="bg-[#8B6A4E] text-white py-16 md:py-32">
        <div className="max-w-6xl mx-auto px-4 md:px-6 text-center">
          <div className="flex justify-center mb-6 md:mb-10">
            <div className="bg-[#F5EFE6] p-4 md:p-6 rounded-2xl shadow-lg">
              <img 
                src="/images/logo.jpg"
                alt="Browns Boarding Logo"
                className="h-28 md:h-50 w-auto">
              </img>
            </div>
          </div>

          <p className="uppercase tracking-[0.2em] text-sm md:text-base text-[#E8DDCF] mb-3 md:mb-4">
            Premium Dog Boarding
          </p>

          <h1 className="text-3xl md:text-7xl font-bold text-[#F5EFE6]">
            Browns Boarding
          </h1>

          <p className="text-base md:text-2xl mt-3 md:mt-6 text-[#F5EFE6]/90">
            Safe, loving home-from-home dog boarding
          </p>

          <p className="mt-2 mb-5 text-sm md:text-lg text-[#F5EFE6]/80">
            Giving your dog a comfortable and caring stay while you're away.
          </p>

          <Button variant="light" href="/bookings">
            Book a Stay
          </Button>
        </div>
      </section>

      {/* Services */}
      <PageSection background="bg-[#F5EFE6]">
        <SectionHeading
          title="Our Services"
          subtitle="A caring home-from-home experience designed around your dog's comfort and routine."
        />

        <div className="grid md:grid-cols-2 gap-4 md:gap-8 max-w-4xl mx-auto">
          <InfoCard title="Overnight Boarding">
            Comfortable overnight stays in a warm family environment, with care
            tailored to your dog's routine.
          </InfoCard>

          <InfoCard title="Day Care">
                Safe daytime care while you're at work.
          </InfoCard>
        </div>
      </PageSection>

      {/* Why Choose Browns Boarding */}
      <PageSection background="bg-[#E8DDCF]">
        <SectionHeading
          title="Why Choose Browns Boarding?"
          subtitle="A safe, personal and reliable boarding experience for dogs and their owners."
        />

        <div className="grid gap-3 md:grid-cols-4 md:gap-8">
          <InfoCard title="Safe & Secure">
            A safe, comfortable environment where your dog is treated like
            family.
          </InfoCard>

          <InfoCard title="Daily Updates">
            Regular photos and updates so you always know how your dog is doing.
          </InfoCard>

          <InfoCard title="Home From Home">
            Personal care and attention in a loving home environment.
          </InfoCard>

          <InfoCard title="Experienced Dog Owners">
            A genuine love of dogs and understanding of their individual
            personalities.
          </InfoCard>

          <InfoCard title="Meet & Greet First">
            Helping you and your dog feel comfortable before boarding.
          </InfoCard>

          <InfoCard title="Easy Online Booking">
            Request stays, view bookings and manage your account online.
          </InfoCard>
        </div>
      </PageSection>

      {/* How It Works */}
      <PageSection background="bg-[#F5EFE6]">
        <SectionHeading
          title="How It Works"
          subtitle="A simple process to help you get started with Browns Boarding."
        />

        <div className="grid gap-3 md:grid-cols-4 md:gap-8">
          <InfoCard title="1. Create Account">
            Sign up online so you can manage your details and request bookings.
          </InfoCard>

          <InfoCard title="2. Add Your Dog">
            Add your dog's information, including routine, health and care
            details.
          </InfoCard>

          <InfoCard title="3. Meet & Greet">
            Arrange a meet and greet before your dog's first boarding stay.
          </InfoCard>

          <InfoCard title="4. Request A Stay">
            Choose your dates and submit your booking request online.
          </InfoCard>
        </div>
      </PageSection>

      {/* CTA */}
      <section className="py-12 md:py-20 bg-[#8B6A4E] text-white">
        <div className="max-w-4xl mx-auto text-center px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-[#F5EFE6]">
            Ready To Book A Stay?
          </h2>

          <p className="mt-4 mb-8 text-lg text-[#F5EFE6]/90">
            Create an account, add your dog's details and request a stay with
            Browns Boarding.
          </p>

          <div className="flex flex-wrap gap-4 justify-center">
            <Button variant="light" href="/signup">
              Get Started
            </Button>

            <Button variant="light" href="/contact">
              Contact Us
            </Button>
          </div>
        </div>
      </section>
    </PublicPageLayout>
  );
}