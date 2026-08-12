import {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  ReactNode,
} from "react";

type FormInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export function FormInput({
  label,
  id,
  className = "",
  ...props
}: FormInputProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block mb-1 md:mb-2 text-sm md:text-base text-[#5C4033] font-medium"
      >
        {label}
      </label>

      <input
        id={id}
        className={`w-full min-h-11 border border-[#D9CBB8] rounded-lg px-3 py-2 text-sm md:text-base text-[#5C4033] bg-[#FFFDF9] placeholder:text-[#B89C82] focus:outline-none focus:ring-2 focus:ring-[#8B6A4E] ${className}`}
        {...props}
      />
    </div>
  );
}

type FormSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  children: ReactNode;
};

export function FormSelect({
  label,
  id,
  className = "",
  children,
  ...props
}: FormSelectProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block mb-1 md:mb-2 text-sm md:text-base text-[#5C4033] font-medium"
      >
        {label}
      </label>

      <select
        id={id}
        className={`w-full min-h-11 border border-[#D9CBB8] rounded-lg px-3 py-2 text-sm md:text-base text-[#5C4033] bg-[#FFFDF9] focus:outline-none focus:ring-2 focus:ring-[#8B6A4E] ${className}`}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}

type FormTextareaProps =
  TextareaHTMLAttributes<HTMLTextAreaElement> & {
    label: string;
  };

export function FormTextarea({
  label,
  id,
  className = "",
  ...props
}: FormTextareaProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block mb-1 md:mb-2 text-sm md:text-base text-[#5C4033] font-medium"
      >
        {label}
      </label>

      <textarea
        id={id}
        className={`w-full border border-[#D9CBB8] rounded-lg px-3 py-2 text-sm md:text-base text-[#5C4033] bg-[#FFFDF9] placeholder:text-[#B89C82] focus:outline-none focus:ring-2 focus:ring-[#8B6A4E] ${className}`}
        {...props}
      />
    </div>
  );
}