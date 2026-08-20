type AccountButtonProps = {
  userInitials: string;
  onClick: () => void;
};

export default function AccountButton({
  userInitials,
  onClick,
}: AccountButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group h-11 w-11 rounded-full border border-[#8B6A4E] text-[#8B6A4E] flex items-center justify-center hover:text-[#5C4033] hover:bg-[#F5EFE6] hover:scale-105 transition-all duration-300 cursor-pointer"
      aria-label="Open account menu"
    >
      <span className="text-sm font-bold tracking-wide">
        {userInitials || "?"}
      </span>
    </button>
  );
}
