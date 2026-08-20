import NavLink from "@/components/NavLink";

type DesktopNavLink = {
  href: string;
  label: string;
};

type DesktopNavLinksProps = {
  links: DesktopNavLink[];
};

export default function DesktopNavLinks({ links }: DesktopNavLinksProps) {
  return (
    <div className="flex justify-center items-center gap-6 text-base lg:text-lg">
      {links.map((link) => (
        <NavLink key={link.href} href={link.href}>
          {link.label}
        </NavLink>
      ))}
    </div>
  );
}
