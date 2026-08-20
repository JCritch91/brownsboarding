"use client";

import { useEffect, useState } from "react";
import { getActivePricingSettings } from "@/lib/appActions";
import PublicPageLayout from "@/components/PublicPageLayout";
import PublicHero from "@/components/PublicHero";
import SectionHeading from "@/components/SectionHeading";
import InfoCard from "@/components/InfoCard";
import Button from "@/components/Buttons";
import { formatMoney } from "@/lib/helpers";

export default function PricesPage() {
  const [nightlyRate, setNightlyRate] = useState<number | null>(null);
  const [depositPercentage, setDepositPercentage] = useState<number | null>(
    null,
  );
  const [loadingPricing, setLoadingPricing] = useState(true);

  useEffect(() => {
    loadPricingSettings();
  }, []);

  async function loadPricingSettings() {
    setLoadingPricing(true);

    try {
      const pricingData = await getActivePricingSettings();

      if (pricingData) {
        setNightlyRate(Number(pricingData.nightly_rate));
        setDepositPercentage(Number(pricingData.deposit_percentage));
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error("Error loading pricing settings:", error.message);
      } else {
        console.error("Unexpected pricing error:", error);
      }
    } finally {
      setLoadingPricing(false);
    }
  }

  return (
    <PublicPageLayout>
      <PublicHero
        title="Our Prices"
        subtitle="Simple, transparent pricing for safe, loving home-from-home dog care."
      />

      {/* Main Pricing */}
      <section className="py-12 md:py-20 bg-[#F5EFE6]">
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <SectionHeading
            title="Simple Pricing"
            subtitle="Clear pricing so you know what to expect before requesting a booking."
          />

          <div className="grid gap-3 md:grid-cols-2 md:gap-8 max-w-4xl mx-auto">
            <InfoCard title="Boarding from">
              {loadingPricing ? (
                <span>Loading price...</span>
              ) : nightlyRate !== null ? (
                <>
                  <span className="block text-3xl md:text-4xl font-bold text-[#5C4033]">
                    {formatMoney(nightlyRate)}
                  </span>

                  <span className="block mt-2 text-[#8B6A4E]">per night</span>
                </>
              ) : (
                <span>Price coming soon</span>
              )}
            </InfoCard>

            <InfoCard title="Deposit">
              {loadingPricing ? (
                <span>Loading deposit...</span>
              ) : depositPercentage !== null ? (
                <>
                  <span className="block text-3xl md:text-4xl font-bold text-[#5C4033]">
                    {depositPercentage}%
                  </span>

                  <span className="block mt-2 text-[#8B6A4E]">
                    payable when your booking is confirmed.
                  </span>
                </>
              ) : (
                <span>Deposit information coming soon</span>
              )}
            </InfoCard>
          </div>
        </div>
      </section>

      {/* What's Included */}
      <section className="py-12 md:py-20 bg-[#E8DDCF]">
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <SectionHeading
            title="What's Included?"
            subtitle="Everything your dog needs for a safe, comfortable and caring stay."
          />

          <div className="grid gap-3 md:grid-cols-3 md:gap-8">
            <InfoCard title="Home-from-home boarding">
              A calm, comfortable home environment rather than a kennel setting.
            </InfoCard>

            <InfoCard title="Daily exercise">
              Regular activity, enrichment and care throughout your dog's stay.
            </InfoCard>

            <InfoCard title="Normal routine">
              Feeding and care based around your dog's usual routine where
              possible.
            </InfoCard>

            <InfoCard title="Individual attention">
              Personal care based on your dog's needs, personality and
              preferences.
            </InfoCard>

            <InfoCard title="Regular updates">
              Updates during your dog's stay so you know how they are getting
              on.
            </InfoCard>

            <InfoCard title="Meet & greet">
              A meet and greet before first bookings where required.
            </InfoCard>
          </div>
        </div>
      </section>

      {/* Payment Information */}
      <section className="py-12 md:py-20 bg-[#F5EFE6]">
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <SectionHeading
            title="Payment Information"
            subtitle="A clear payment process from deposit through to final balance."
          />

          <div className="grid gap-3 md:grid-cols-3 md:gap-8">
            <InfoCard title="Deposit">
              {depositPercentage !== null
                ? `A ${depositPercentage}% deposit is payable when your booking is confirmed.`
                : "A deposit is payable when your booking is confirmed."}
            </InfoCard>

            <InfoCard title="Remaining Balance">
              The remaining balance is due 14 days before arrival.
            </InfoCard>

            <InfoCard title="Short Notice Bookings">
              Bookings within 14 days of arrival require full payment upon
              confirmation.
            </InfoCard>
          </div>
        </div>
      </section>

      {/* Vaccination Requirements */}
      <section className="py-12 md:py-20 bg-[#E8DDCF]">
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <SectionHeading
            title="Pre-stay Requirements"
            subtitle="Keeping every dog safe is an important part of the booking process."
          />

          <div className="grid gap-3 md:grid-cols-2 md:gap-8">
            <InfoCard title="Up-to-date vaccinations required">
              All dogs staying at Browns Boarding must have up-to-date
              vaccinations before their stay. Vaccination details can be added
              and managed through your customer account.
            </InfoCard>

            <InfoCard title="Up-to-date Flea and Worm Treatment Required">
              All dogs staying at Browns Boarding must also have up-to-date flea
              and workm treatment before their stay.
            </InfoCard>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 md:py-20 bg-[#8B6A4E] text-white">
        <div className="max-w-4xl mx-auto px-4 md:px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-[#F5EFE6]">
            Ready to Book?
          </h2>

          <p className="mt-3 md:mt-4 text-base md:text-lg text-[#F5EFE6]/90">
            Create an account, add your dog's details and request a stay with
            Browns Boarding.
          </p>

          <div className="mt-6 md:mt-8 flex flex-wrap gap-4 justify-center">
            <Button variant="light" href="/bookings">
              Book a Stay
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
