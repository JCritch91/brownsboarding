"use client";

import CustomerPageLayout from "@/components/CustomerPageLayout";
import PageCard from "@/components/PageCard";
import Button from "@/components/Buttons";
import Link from "next/link";

export default function MeetAndGreetPage() {
  return (
    <CustomerPageLayout>
      <PageCard
        title="Meet & Greet"
        subtitle="Before your dog's first stay, a meet and greet must be completed."
        actions={<Button href="/dashboard">Back to Dashboard</Button>}
      >
        <div className="space-y-5 md:space-y-8">
          <div>
            <h2 className="text-xl md:text-2xl font-semibold text-[#5C4033] mb-3 md:mb-4">
              What to Expect
            </h2>

            <div className="space-y-2 md:space-y-3 text-sm md:text-base text-[#5C4033]">
              <p>• Meet you and your dog</p>
              <p>• Discuss routines and requirements</p>
              <p>• Answer any questions</p>
              <p>• Ensure Browns Boarding is the right fit</p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-300 p-4 md:p-6 rounded-lg">
            <h2 className="text-lg md:text-xl font-semibold text-amber-800 mb-2 md:mb-3">
              Important
            </h2>

            <p className="text-sm md:text-base text-amber-700">
              Meet and greets must be completed before a dog's first boarding
              stay can be confirmed.
            </p>
          </div>

          <div className="bg-[#F5EFE6] border border-[#D9CBB8] p-4 md:p-6 rounded-lg">
            <h2 className="text-xl md:text-2xl font-semibold text-[#5C4033] mb-3 md:mb-4">
              Contact Us
            </h2>

            <p className="text-sm md:text-base text-[#8B6A4E]">
              Phone: 07xxx xxxxxx
            </p>

            <Link
              href="mailto:brownsboarding@outlook.com"
              className="block mt-2 text-sm md:text-base text-[#8B6A4E] hover:text-[#5C4033] break-all"
            >
              Email: brownsboarding@outlook.com
            </Link>
          </div>
        </div>
      </PageCard>
    </CustomerPageLayout>
  );
}
