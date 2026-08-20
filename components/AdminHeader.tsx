"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import NavLink from "@/components/NavLink";
import AccountButton from "@/components/AccountButton";
import AccountDropdown from "@/components/AccountDropdown";
import DesktopNavLinks from "@/components/DesktopNavLinks";
import MobileMenuButton from "@/components/MobileMenuButton";
import MobileMenuDropdown from "@/components/MobileMenuDropdown";
import useClickOutside from "@/hooks/useClickOutside";
import { logout } from "@/lib/appActions";
import { supabase } from "@/lib/supabase";

export default function AdminHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const navRef = useRef<HTMLElement | null>(null);

  const [userInitials, setUserInitials] = useState("");
  const [userDisplayName, setUserDisplayName] = useState("");
  const [userEmail, setUserEmail] = useState("");

  const adminNavLinks = [
    { href: "/", label: "Home Page" },
    { href: "/admin", label: "Dashboard" },
  ];

  const loadUserProfile = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name, email")
      .eq("id", user.id)
      .single();

    const firstName = profile?.first_name || "";
    const lastName = profile?.last_name || "";
    const email = profile?.email || user.email || "";

    const initials =
      `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
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
          <DesktopNavLinks links={adminNavLinks} />

          {/* Account icon right */}
          <div className="flex justify-end relative">
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

          {/* Account icon right */}
          <div className="flex justify-end relative">
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
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <MobileMenuDropdown
            links={adminNavLinks}
            onClose={() => setMobileMenuOpen(false)}
          />
        )}
      </div>
    </nav>
  );
}
