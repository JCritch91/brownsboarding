"use client";

import PublicPageLayout from "@/components/PublicPageLayout";
import PublicHero from "@/components/PublicHero";
import SectionHeading from "@/components/SectionHeading";
import InfoCard from "@/components/InfoCard";

export default function ContactPage() {
  return (
    <PublicPageLayout>
        <PublicHero
            title="Contact Browns Boarding"
            subtitle="Whether you'd like to check availability, ask a question, or discuss
            your dog's individual needs, we'd love to hear from you."
        />
        <section className="py-12 md:py-20 bg-[#F5EFE6]">
            <div className="max-w-6xl mx-auto px-4 md:px-6">
                <div className="grid gap-3 md:grid-cols-3 md:gap-8">
                    <InfoCard title="Email">
                        <a href="mailto:brownsboarding@outlook.com"
                            className="break-all text-[#8B6A4E] hover:text-[#5C4033]"
                        >brownsboarding@outlook.com</a>
                    </InfoCard>

                    <InfoCard title="Phone">
                        07XXXXXXXXX
                    </InfoCard>

                    <InfoCard title="Location">
                        Bishopstoke, Eastleigh, Southampton
                    </InfoCard>
                </div>
            </div>
        </section>

        <section className="py-12 md:py-20 bg-[#E8DDCF]">
            <div className="max-w-4xl mx-auto px-4 md:px-6 space-y-3 md:space-y-6">
                <SectionHeading 
                    title="Frequently Asked Questions"
                />

                <InfoCard title="Do I need a meet and greet?">
                    First-time customers may be asked to attend a meet and greet
                    before boarding.
                </InfoCard>

                <InfoCard title="What vaccinations are required?">
                    All dogs must have up-to-date vaccinations before their stay.
                </InfoCard>

                <InfoCard title="How do I request a booking?">
                    Create an account, add your dog's details and submit a booking
                    request online.
                </InfoCard>
            </div>
        </section>
    </PublicPageLayout>
  )
}