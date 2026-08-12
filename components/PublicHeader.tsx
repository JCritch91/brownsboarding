"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import NavLink from "@/components/NavLink";
import AccountButton from "@/components/AccountButton";
import AccountDropdown from "@/components/AccountDropdown";
import DesktopNavLinks from "@/components/DesktopNavLinks";
import MobileMenuButton from "@/components/MobileMenuButton";
import MobileMenuDropdown from "@/components/MobileMenuDropdown";
import useClickOutside from "@/hooks/useClickOutside";
import { supabase } from "@/lib/supabase";
import {
  getOptionalCurrentUser,
  logout,
} from "@/lib/appActions";

export default function PublicHeader() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const navRef = useRef<HTMLElement | null>(null);

  const [userInitials, setUserInitials] = useState("");
  const [userDisplayName, setUserDisplayName] = useState("");
  const [userEmail, setUserEmail] = useState("");

  const publicNavLinks = [
    { href: "/", label: "Home" },
    { href: "/about", label: "About Us" },
    { href: "/contact", label: "Contact" },
    { href: "/prices", label: "Prices" },
  ];

  const navLinks =
    loggedIn === true
      ? [
          ...publicNavLinks,
          { href: isAdmin ? "/admin" : "/dashboard", label: "Dashboard" },
        ]
      : publicNavLinks;

  const mobileMenuLinks =
    loggedIn === true
      ? navLinks
      : [
          ...publicNavLinks,
          { href: "/signup", label: "Signup" },
        ];

  const loadUserProfile = useCallback(async () => {
    const user = await getOptionalCurrentUser();

    setLoggedIn(!!user);

    if (!user) {
      setIsAdmin(false);
      setUserInitials("");
      setUserDisplayName("");
      setUserEmail("");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name, email, is_admin")
      .eq("id", user.id)
      .single();

    setIsAdmin(profile?.is_admin === true);

    const firstName = profile?.first_name || "";
    const lastName = profile?.last_name || "";
    const email = profile?.email || user.email || "";

    const initials = `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
    const displayName = `${firstName} ${lastName}`.trim();

    setUserInitials(initials || email?.[0]?.toUpperCase() || "?");
    setUserDisplayName(displayName || email);
    setUserEmail(email);
  }, []);

  useEffect(() => {
    loadUserProfile();

    window.addEventListener("profile-updated", loadUserProfile);

    return () => {
      window.removeEventListener("profile-updated", loadUserProfile);
    };
  }, [loadUserProfile]);

  useClickOutside(navRef, () => {
    setMobileMenuOpen(false);
    setAccountMenuOpen(false);
  });

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

  {/* Links centre */}
  <DesktopNavLinks links={navLinks} />

  {/* Account / Auth right */}
  <div className="flex justify-end items-center relative">
    {loggedIn === true ? (
      <>
        <AccountButton
          userInitials={userInitials}
          onClick={() => {
            setMobileMenuOpen(false);
            setAccountMenuOpen((current) => !current);
          }}
        />

        {accountMenuOpen && (
          <AccountDropdown
            variant="desktop"
            userInitials={userInitials}
            userDisplayName={userDisplayName}
            userEmail={userEmail}
            onClose={() => {
              setAccountMenuOpen(false);
              setMobileMenuOpen(false);
            }}
            onLogout={() => {
              setAccountMenuOpen(false);
              setMobileMenuOpen(false);
              logout();
            }}
          />
        )}
      </>
    ) : (
      <div className="flex items-center gap-3 text-base lg:text-lg">
        <NavLink href="/login"
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
    )}
  </div>
</div>
        {/* Mobile Header */}
        <div className="grid grid-cols-[48px_1fr_48px] items-center md:hidden">
          {/* Hamburger left */}
          <div className="flex justify-start">
            <MobileMenuButton
              isOpen={mobileMenuOpen}
              onClick={() => {
                setAccountMenuOpen(false);
                setMobileMenuOpen((current) => !current);
              }}
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
          

          {/* Account / Login right */}
          <div className="flex justify-end relative">
            {loggedIn === true ? (
              <>
                <AccountButton
                  userInitials={userInitials}
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setAccountMenuOpen((current) => !current);
                  }}
                />

                {accountMenuOpen && (
                  <AccountDropdown
                    variant="mobile"
                    userInitials={userInitials}
                    userDisplayName={userDisplayName}
                    userEmail={userEmail}
                    onClose={() => {
                      setAccountMenuOpen(false);
                      setMobileMenuOpen(false);
                    }}
                    onLogout={() => {
                      setAccountMenuOpen(false);
                      setMobileMenuOpen(false);
                      logout();
                    }}
                  />
                )}
              </>
            ) : (
              <NavLink href="/login"
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
            )}
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <MobileMenuDropdown
            links={mobileMenuLinks}
            onClose={() => setMobileMenuOpen(false)}
          />
        )}
      </div>
    </nav>
  );
}