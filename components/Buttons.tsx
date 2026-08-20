"use client";

import Link from "next/link";
import { ReactNode } from "react";

type ButtonProps = {
  children: ReactNode;
  href?: string;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  className?: string;
  variant?: "light" | "dark";
};

export default function Button({
  children,
  href,
  disabled,
  onClick,
  type = "button",
  className = "",
  variant = "dark",
}: ButtonProps) {
  const baseClasses =
    "inline-flex items-center justify-center px-4 py-2 text-sm md:text-base md:px-8 md:py-3 rounded-lg font-semibold transition-all duration-300 cursor-pointer hover:scale-105";

  const variantClasses =
    variant === "light"
      ? "bg-[#FDF9F5] text-[#6F5440] hover:bg-white border border-[#D9CBB8]"
      : "bg-[#8B6A4E] text-white hover:bg-[#6F5440]";

  const classes = `${baseClasses} ${variantClasses} ${className}`;

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={classes}
    >
      {children}
    </button>
  );
}
