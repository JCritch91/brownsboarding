type LoadingScreenProps = {
  message?: string;
};

export default function LoadingScreen({
  message = "Loading...",
}: LoadingScreenProps) {
  return (
    <main className="min-h-screen bg-[#8B6A4E] flex items-center justify-center px-4 md:px-6">
      <div className="text-center">
        <p className="text-[#F5EFE6] text-base md:text-xl font-semibold">
          {message}
        </p>
      </div>
    </main>
  );
}