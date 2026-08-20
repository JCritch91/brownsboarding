type BookingStatusSummaryProps = {
  pendingCount: number;
  confirmedCount: number;
  depositReceivedCount: number;
  balancePaidCount: number;
  completedCount: number;
  cancelledCount: number;
};

export default function BookingStatusSummary({
  pendingCount,
  confirmedCount,
  depositReceivedCount,
  balancePaidCount,
  completedCount,
  cancelledCount,
}: BookingStatusSummaryProps) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-6">
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 md:p-4">
        <p className="text-xs font-semibold text-amber-800 md:text-base">
          Pending: {pendingCount}
        </p>
      </div>

      <div className="rounded-lg border border-green-300 bg-green-50 p-3 md:p-4">
        <p className="text-xs font-semibold text-green-800 md:text-base">
          Confirmed: {confirmedCount}
        </p>
      </div>

      <div className="rounded-lg border border-blue-300 bg-blue-50 p-3 md:p-4">
        <p className="text-xs font-semibold text-blue-800 md:text-base">
          Deposit Received: {depositReceivedCount}
        </p>
      </div>

      <div className="rounded-lg border border-teal-300 bg-teal-50 p-3 md:p-4">
        <p className="text-xs font-semibold text-teal-800 md:text-base">
          Full Balance Paid: {balancePaidCount}
        </p>
      </div>

      <div className="rounded-lg border border-gray-300 bg-gray-50 p-3 md:p-4">
        <p className="text-xs font-semibold text-gray-700 md:text-base">
          Completed: {completedCount}
        </p>
      </div>

      <div className="rounded-lg border border-red-300 bg-red-50 p-3 md:p-4">
        <p className="text-xs font-semibold text-red-700 md:text-base">
          Cancelled: {cancelledCount}
        </p>
      </div>
    </div>
  );
}
