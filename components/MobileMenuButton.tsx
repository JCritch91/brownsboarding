type MobileMenuButtonProps = {
  isOpen: boolean;
  onClick: () => void;
};

export default function MobileMenuButton({
  isOpen,
  onClick,
}: MobileMenuButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-11 w-11 rounded-full border border-[#8B6A4E] text-[#8B6A4E] flex items-center justify-center hover:text-[#5C4033] hover:bg-[#F5EFE6] transition-all duration-300 cursor-pointer"
      aria-label="Toggle menu"
    >
      {isOpen ? "✕" : "☰"}
    </button>
  );
}