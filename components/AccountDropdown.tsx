import Link from "next/link";

type AccountDropdownProps = {
  variant: "desktop" | "mobile";
  userInitials: string;
  userDisplayName: string;
  userEmail: string;
  onClose: () => void;
  onLogout: () => void;
};

export default function AccountDropdown({
  variant,
  userInitials,
  userDisplayName,
  userEmail,
  onClose,
  onLogout,
}: AccountDropdownProps) {
  const isMobile = variant === "mobile";

  const containerClass = isMobile
    ? "md:hidden absolute right-0 top-14 w-[calc(100vw-2rem)] max-w-64 rounded-xl bg-[#FFFDF9] shadow-lg border border-[#D9CBB8] p-3"
    : "hidden md:block absolute right-0 top-14 w-72 rounded-xl bg-[#FFFDF9] shadow-lg border border-[#D9CBB8] p-3";

  const nameClass = isMobile
    ? "font-semibold text-[#5C4033] text-xs leading-snug break-words"
    : "font-semibold text-[#5C4033] text-sm leading-snug break-words";

  const emailClass = isMobile
    ? "text-[11px] text-[#8B6A4E] leading-snug break-all mt-0.5"
    : "text-xs text-[#8B6A4E] leading-snug break-all mt-0.5";

  const linkClass = isMobile
    ? "block px-3 py-2.5 text-xs rounded-lg hover:bg-[#F5EFE6] transition-all duration-300"
    : "block px-3 py-2.5 rounded-lg hover:bg-[#F5EFE6] transition-all duration-300";

  const logoutClass = isMobile
    ? "block w-full text-right px-3 py-2.5 text-xs rounded-lg hover:bg-[#F5EFE6] transition-all duration-300"
    : "block w-full text-right px-3 py-2.5 rounded-lg hover:bg-[#F5EFE6] transition-all duration-300";

  return (
    <div className={containerClass}>
      <div className="flex flex-col gap-1 text-[#8B6A4E] text-right">
        <div className="flex items-start justify-end gap-3 px-3 py-3 border-b border-[#D9CBB8] mb-1 text-right">
          <div className="min-w-0 flex-1 text-right">
            <div className={nameClass}>
              {userDisplayName || "My Account"}
            </div>

            {userEmail && (
              <div className={emailClass}>
                {userEmail}
              </div>
            )}
          </div>

          <div className="h-9 w-9 shrink-0 rounded-full bg-[#F5EFE6] border border-[#D9CBB8] flex items-center justify-center text-sm font-bold text-[#5C4033]">
            {userInitials || "?"}
          </div>
        </div>

        <Link 
          href="/my-details" 
          className={linkClass}
          onClick={onClose}>
          My Profile
        </Link>

        <div className="my-1 border-t border-[#D9CBB8]" />

        <button
          type="button"
          onClick={onLogout}
          className={logoutClass}
        >
          Logout
        </button>
      </div>
    </div>
  );
}