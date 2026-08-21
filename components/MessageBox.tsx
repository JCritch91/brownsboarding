import { ReactNode } from "react";

type MessageBoxProps = {
  type?: "success" | "error" | "info" | "warning";
  children: ReactNode;
  className?: string;
};

export default function MessageBox({
  type = "info",
  children,
  className = "",
}: MessageBoxProps) {
  const styles = {
    success: "bg-green-50 border-green-300 text-green-800",
    error: "bg-red-50 border-red-300 text-red-800",
    info: "bg-blue-50 border-blue-300 text-blue-800",
    warning: "bg-amber-50 border-amber-300 text-amber-800",
  };

  return (
    <div
      className={`rounded-lg border p-3 md:p-4 ${styles[type]} ${className}`}
    >
      <p className="text-sm font-medium md:text-base">{children}</p>
    </div>
  );
}
