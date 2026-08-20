"use client";

import { useRef, useState } from "react";
import NavLink from "@/components/NavLink";
import DesktopNavLinks from "@/components/DesktopNavLinks";
import MobileMenuButton from "@/components/MobileMenuButton";
import MobileMenuDropdown from "@/components/MobileMenuDropdown";
import useClickOutside from "@/hooks/useClickOutside";

export default function AuthHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navRef = useRef<HTMLElement | null>(null);

  useClickOutside(navRef, () => {
    setMobileMenuOpen(false);
  });

  const authNavLinks = [
    { href: "/", label: "Home" },
    { href: "/signup", label: "Signup" },
  ];

  return (
    <nav
      ref={navRef}
      className="sticky top-3 bg-[#FFFDF9]/95 backdrop-blur-sm rounded-xl shadow-lg mb-8 relative z-50"
    >
      <div className="px-4 py-4 md:px-8 md:py-5">
        {/* Desktop Header */}
        <div className="hidden md:grid grid-cols-[1fr_auto_1fr] items-center">
          {/* Logo left */}
          <div className="flex justify-start">
            <NavLink href="/">
              <img
                src="/images/logo.jpg"
                alt="Browns Boarding Logo"
                className="h-20 lg:h-24 w-auto rounded-xl"
              />
            </NavLink>
          </div>

          <DesktopNavLinks links={authNavLinks} />

          {/* Login icon right */}
          <div className="flex justify-end relative">
            <NavLink
              href="/login"
              className="!h-11 !w-11 !p-0 !rounded-full border border-[#8B6A4E] text-[#8B6A4E] flex items-center justify-center hover:text-[#5C4033] hover:bg-[#F5EFE6] transition-all duration-300 cursor-pointer"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path d="M20 21a8 8 0 0 0-16 0" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </NavLink>
          </div>
        </div>

        {/* Mobile Header */}
        <div className="grid grid-cols-[48px_1fr_48px] items-center md:hidden">
          {/* Hamburger left */}
          <div className="flex justify-start">
            <MobileMenuButton
              isOpen={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((current) => !current)}
            />
          </div>

          {/* Logo centre */}
          <div className="flex justify-center">
            <NavLink href="/">
              <img
                src="/images/logo.jpg"
                alt="Browns Boarding Logo"
                className="h-14 w-auto rounded-xl"
              />
            </NavLink>
          </div>
          <div className="flex justify-end relative">
            <NavLink
              href="/login"
              className="!h-11 !w-11 !p-0 !rounded-full border border-[#8B6A4E] text-[#8B6A4E] flex items-center justify-center hover:text-[#5C4033] hover:bg-[#F5EFE6] transition-all duration-300 cursor-pointer"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path d="M20 21a8 8 0 0 0-16 0" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </NavLink>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <MobileMenuDropdown
            links={authNavLinks}
            onClose={() => setMobileMenuOpen(false)}
          />
        )}
      </div>
    </nav>
  );
}
