"use client";

import PublicPageLayout from "@/components/PublicPageLayout";
import PublicHero from "@/components/PublicHero";
import SectionHeading from "@/components/SectionHeading";
import InfoCard from "@/components/InfoCard";
import Button from "@/components/Buttons";

export default function AboutPage() {
  return (
    <PublicPageLayout>
      <PublicHero
        title="About Browns Boarding"
        subtitle="A safe, loving home-from-home experience for your dog while you're away."
      />

      {/* Our Story */}
      <section className="py-12 md:py-20 bg-[#F5EFE6]">
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <SectionHeading
            title="Our Story"
            subtitle="Browns Boarding was created to give dogs a comfortable, caring and trusted place to stay."
          />

          <div className="max-w-4xl mx-auto bg-[#FFFDF9] p-5 md:p-8 rounded-lg shadow border border-[#D9CBB8]">
            <p className="text-[#8B6A4E] text-base md:text-lg leading-relaxed">
              At Browns Boarding, we believe dogs deserve more than just a place
              to sleep while their owners are away. We aim to provide a true
              home-from-home environment where every dog feels safe, cared for
              and part of the family.
            </p>

            <p className="text-[#8B6A4E] text-lg leading-relaxed mt-4 md:mt-6">
              Whether your dog is staying overnight, visiting for day care or
              coming along for their first meet and greet, our focus is always on
              comfort, trust and personal care.
            </p>

            <p className="text-[#8B6A4E] text-lg leading-relaxed mt-4 md:mt-6">
              We understand how important it is to know your dog is in safe
              hands. That is why we take the time to get to know each dog
              individually, including their routine, personality, needs and
              preferences.
            </p>
          </div>
        </div>
      </section>

      {/* Why Browns Boarding */}
      <section className="py-12 md:py-[#D9CBB820 bg-[#E8DDCF]">
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <SectionHeading
            title="What We Offer"
            subtitle="A personal dog boarding experience built around care, comfort and trust."
          />

          <div className="grid gap-3 md:grid-cols-3 md:gap-8">
            <InfoCard title="Home From Home">
              Your dog stays in a warm and welcoming home environment rather
              than a kennel setting.
            </InfoCard>

            <InfoCard title="Personal Care">
              Every dog is treated as an individual, with attention given to
              their routine, personality and needs.
            </InfoCard>

            <InfoCard title="Safe & Secure">
              We aim to provide a calm, safe and comfortable space where your dog
              can settle and enjoy their stay.
            </InfoCard>

            <InfoCard title="Meet & Greet First">
              Before a first stay, we arrange a meet and greet so everyone feels
              comfortable and confident.
            </InfoCard>

            <InfoCard title="Regular Updates">
              We know how reassuring updates can be, so we keep owners informed
              while their dog is staying with us.
            </InfoCard>

            <InfoCard title="Easy Online Booking">
              Customers can request bookings, manage their details and view
              upcoming stays through the online portal.
            </InfoCard>
          </div>
        </div>
      </section>

      {/* What To Expect */}
      <section className="py-12 md:py-20 bg-[#F5EFE6]">
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <SectionHeading
            title="What To Expect"
            subtitle="A simple process designed to make everything clear and easy from the start."
          />

          <div className="grid gap-3 md:grid-cols-5 md:gap-6">
            <InfoCard title="1. Create Account">
              Sign up online so we can securely manage your booking details.
            </InfoCard>

            <InfoCard title="2. Add Dog Details">
              Tell us about your dog, including their routine, needs and
              important information.
            </InfoCard>

            <InfoCard title="3. Meet & Greet">
              Arrange a meet and greet before your dog's first stay with Browns
              Boarding.
            </InfoCard>

            <InfoCard title="4. Request Booking">
              Choose the dates you need and submit your booking request online.
            </InfoCard>

            <InfoCard title="5. Enjoy Peace of Mind">
              Relax knowing your dog is staying in a caring home-from-home
              environment.
            </InfoCard>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 md:py-20 bg-[#8B6A4E] text-white">
        <div className="max-w-4xl mx-auto px-4 md:px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-[#F5EFE6]">
            Ready To Arrange A Stay?
          </h2>

          <p className="mt-3 md:mt-4 text-base md:text-lg text-[#F5EFE6]/90">
            Create an account, add your dog's details and request a booking with
            Browns Boarding.
          </p>

          <div className="mt-6 md:mt-8">
            <Button variant="light" href="/signup">
              Get Started
            </Button>
          </div>
        </div>
      </section>
    </PublicPageLayout>
  );
}