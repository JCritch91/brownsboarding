import NavLink from "@/components/NavLink";

type MobileMenuLink = {
  href: string;
  label: string;
};

type MobileMenuDropdownProps = {
  links: MobileMenuLink[];
  onClose: () => void;
};

export default function MobileMenuDropdown({
  links,
  onClose,
}: MobileMenuDropdownProps) {
  return (
    <div className="md:hidden absolute left-0 top-full mt-3 w-max min-w-40 rounded-xl border border-[#D9CBB8] bg-[#FFFDF9] shadow-lg p-3">
      <div className="flex flex-col gap-1 text-[#5C4033] text-left">
        {links.map((link) => (
            <NavLink
                key={link.href}
                href={link.href}
                onClick={onClose}
                className="block px-4 py-2.5 text-xs rounded-lg hover:bg-[#F5EFE6] transition-all duration-300"
            >
                {link.label}
            </NavLink>
        ))}
      </div>
    </div>
  );
}