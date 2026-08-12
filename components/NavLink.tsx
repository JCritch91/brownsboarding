import Link from "next/link";
import { MouseEventHandler, ReactNode } from "react";

type NavLinkProps = {
  href: string;
  children: ReactNode;
  className?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
};

export default function NavLink({
  href,
  children,
  className = "",
  onClick,
}: NavLinkProps) {
  return (
    <Link href={href} 
    onClick={onClick}
    className={`font-medium text-[#8B6A4E] hover:text-[#5C4033] hover:bg-[#F5EFE6] px-3 py-2 rounded-lg transition-all duration-300 ${className}`}>
      {children}
    </Link>
  );
}