"use client";

import { useEffect, useState } from "react";

import { getActivePricingSettings } from "@/lib/appActions";
import { formatMoney } from "@/lib/helpers";

import PublicPageLayout from "@/components/PublicPageLayout";
import PublicHero from "@/components/PublicHero";
import SectionHeading from "@/components/SectionHeading";
import InfoCard from "@/components/InfoCard";
import Button from "@/components/Buttons";
import MessageBox from "@/components/MessageBox";

type Pricing = {
  nightlyRate: number;
  boardingDepositPercentage: number;
  daycareFullDayRate: number;
  daycareHalfDayRate: number;
  daycareDepositPercentage: number;
};

export default function PricesPage() {
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [loadingPricing, setLoadingPricing] = useState(true);
  const [pricingError, setPricingError] = useState("");

  useEffect(() => {
    loadPricingSettings();
  }, []);

  async function loadPricingSettings() {
    setLoadingPricing(true);
    setPricingError("");

    try {
      const pricingData = await getActivePricingSettings();

      if (!pricingData) {
        setPricing(null);
        setPricingError(
          "Current pricing is temporarily unavailable. Please contact Browns Boarding for a quote.",
        );
        return;
      }

      setPricing({
        nightlyRate: Number(pricingData.nightly_rate),
        boardingDepositPercentage: Number(pricingData.deposit_percentage),
        daycareFullDayRate: Number(pricingData.daycare_full_day_rate),
        daycareHalfDayRate: Number(pricingData.daycare_half_day_rate),
        daycareDepositPercentage: Number(
          pricingData.daycare_deposit_percentage,
        ),
      });
    } catch (error) {
      console.error("Error loading pricing settings:", error);

      setPricing(null);
      setPricingError(
        "Current pricing is temporarily unavailable. Please contact Browns Boarding for a quote.",
      );
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
      <section className="bg-[#F5EFE6] py-12 md:py-20">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <SectionHeading
            title="Simple Pricing"
            subtitle="Clear pricing so you know what to expect before requesting a booking."
          />

          {pricingError && (
            <div className="mx-auto mb-6 max-w-4xl">
              <MessageBox type="warning">{pricingError}</MessageBox>
            </div>
          )}

          <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-2 md:gap-8">
            <InfoCard title="Home Boarding">
              <div className="flex h-full flex-col">
                <div>
                  <p className="text-3xl font-bold text-[#5C4033] md:text-4xl">
                    {loadingPricing
                      ? "Loading..."
                      : pricing
                        ? formatMoney(pricing.nightlyRate)
                        : "Contact us"}
                  </p>

                  <p className="mt-2 text-sm text-[#8B6A4E] md:text-base">
                    Per night
                  </p>
                </div>

                <div className="mt-6 border-t border-[#D9CBB8] pt-4">
                  <p className="text-sm font-semibold text-[#5C4033] md:text-base">
                    Deposit
                  </p>

                  <p className="mt-1 text-[#8B6A4E]">
                    {loadingPricing
                      ? "Loading..."
                      : pricing
                        ? `${pricing.boardingDepositPercentage}%`
                        : "Contact us"}{" "}
                    Due immediately when your booking is confirmed.
                  </p>
                </div>
              </div>
            </InfoCard>

            <InfoCard title="Doggy Day Care">
              <div className="flex h-full flex-col">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-semibold text-[#5C4033] md:text-base">
                      Full Day
                    </p>

                    <p className="mt-2 text-2xl font-bold text-[#5C4033] md:text-3xl">
                      {loadingPricing
                        ? "Loading..."
                        : pricing
                          ? formatMoney(pricing.daycareFullDayRate)
                          : "Contact us"}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-[#5C4033] md:text-base">
                      Half Day
                    </p>

                    <p className="mt-2 text-2xl font-bold text-[#5C4033] md:text-3xl">
                      {loadingPricing
                        ? "Loading..."
                        : pricing
                          ? formatMoney(pricing.daycareHalfDayRate)
                          : "Contact us"}
                    </p>
                  </div>
                </div>

                <div className="mt-6 border-t border-[#D9CBB8] pt-4">
                  <p className="text-sm font-semibold text-[#5C4033] md:text-base">
                    Deposit
                  </p>

                  <p className="mt-1 text-[#8B6A4E]">
                    {loadingPricing
                      ? "Loading..."
                      : pricing
                        ? `${pricing.daycareDepositPercentage}%`
                        : "Contact us"}{" "}
                    Due immediately when your booking is confirmed.
                  </p>
                </div>
              </div>
            </InfoCard>
          </div>
        </div>
      </section>

      {/* What's Included */}
      <section className="bg-[#E8DDCF] py-12 md:py-20">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <SectionHeading
            title="What's Included?"
            subtitle="Everything your dog needs for safe, comfortable and caring support."
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
              Updates during your dog's stay so you know how the stay is
              progressing.
            </InfoCard>

            <InfoCard title="Meet & greet">
              A meet and greet before first bookings where required.
            </InfoCard>
          </div>
        </div>
      </section>

      {/* Payment Information */}
      <section className="bg-[#F5EFE6] py-12 md:py-20">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <SectionHeading
            title="Payment Information"
            subtitle="A clear payment process from deposit through to final balance."
          />

          <div className="grid gap-3 md:grid-cols-3 md:gap-8">
            <InfoCard title="Deposit">
              The deposit is due immediately when your booking is confirmed.
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

      {/* Pre-stay Requirements */}
      <section className="bg-[#E8DDCF] py-12 md:py-20">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
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

            <InfoCard title="Up-to-date flea and worm treatment required">
              All dogs staying at Browns Boarding must also have up-to-date flea
              and worm treatment before their stay.
            </InfoCard>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#8B6A4E] py-12 text-white md:py-20">
        <div className="mx-auto max-w-4xl px-4 text-center md:px-6">
          <h2 className="text-3xl font-bold text-[#F5EFE6] md:text-4xl">
            Ready to Book?
          </h2>

          <p className="mt-3 text-base text-[#F5EFE6]/90 md:mt-4 md:text-lg">
            Create an account, add your dog's details and request a stay with
            Browns Boarding.
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-4 md:mt-8">
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
