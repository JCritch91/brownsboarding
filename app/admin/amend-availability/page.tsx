"use client";

import { useEffect, useState } from "react";
import { DayPicker } from "react-day-picker";

import { supabase } from "@/lib/supabase";
import {
  formatDateForDatabase,
  formatDisplayDate,
  getDatesInRange,
} from "@/lib/helpers";

import AdminPageLayout from "@/components/AdminPageLayout";
import PageCard from "@/components/PageCard";
import Button from "@/components/Buttons";
import MessageBox from "@/components/MessageBox";
import LoadingScreen from "@/components/LoadingScreen";
import { authenticatedApiRequest } from "@/lib/client/authenticated-api";

type SaveAvailabilityDateResponse = {
  success: boolean;
  availabilitySaved: boolean;
  followUpRequired: boolean;
  availability?: {
    id: string;
    date: string;
    available: boolean;
    totalSpaces: number;
    spacesAvailable: number;
    notes: string | null;
  };
  calendar?: {
    updated: boolean;
    error: string | null;
  };
  message?: string;
  error?: string;
};

type Availability = {
  id: string;
  date: string;
  available: boolean;
  total_spaces: number;
  spaces_available: number;
  notes: string | null;
};

type SelectedDateForm = {
  date: string;
  available: boolean;
  total_spaces: number;
  spaces_available: number;
  notes: string;
};

export default function AmendAvailabilityPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const [availability, setAvailability] = useState<Availability[]>([]);
  const [selectedDay, setSelectedDay] = useState<Date | undefined>();
  const [selectedDateForm, setSelectedDateForm] =
    useState<SelectedDateForm | null>(null);

  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [calendarMonths, setCalendarMonths] = useState(1);

  const [bulkStartDate, setBulkStartDate] = useState("");
  const [bulkEndDate, setBulkEndDate] = useState("");
  const [bulkAvailable, setBulkAvailable] = useState(true);
  const [bulkTotalSpaces, setBulkTotalSpaces] = useState(1);
  const [bulkSpacesAvailable, setBulkSpacesAvailable] = useState(1);
  const [bulkNotes, setBulkNotes] = useState("");
  const [bulkSyncCurrent, setBulkSyncCurrent] = useState(0);
  const [bulkSyncTotal, setBulkSyncTotal] = useState(0);

  useEffect(() => {
    loadAvailability();
  }, [calendarMonth, calendarMonths]);

  useEffect(() => {
    function updateCalendarMonths() {
      setCalendarMonths(window.innerWidth >= 768 ? 2 : 1);
    }

    updateCalendarMonths();

    window.addEventListener("resize", updateCalendarMonths);

    return () => {
      window.removeEventListener("resize", updateCalendarMonths);
    };
  }, []);

  async function loadAvailability() {
    setLoading(true);
    setMessage("");
    setIsError(false);

    const monthStart = formatDateForDatabase(
      new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1),
    );

    const monthEnd = formatDateForDatabase(
      new Date(
        calendarMonth.getFullYear(),
        calendarMonth.getMonth() + calendarMonths,
        0,
      ),
    );

    const { data, error } = await supabase
      .from("availability")
      .select("id, date, available, total_spaces, spaces_available, notes")
      .gte("date", monthStart)
      .lte("date", monthEnd)
      .order("date", { ascending: true });

    if (error) {
      setIsError(true);
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setAvailability(data || []);
    setLoading(false);
  }

  function findAvailabilityForDate(date: Date) {
    const dateKey = formatDateForDatabase(date);

    return availability.find((day) => day.date === dateKey);
  }

  function isUnavailableDate(date: Date) {
    const dayAvailability = findAvailabilityForDate(date);

    if (!dayAvailability) {
      return false;
    }

    if (!dayAvailability.available) {
      return true;
    }

    if (dayAvailability.spaces_available <= 0) {
      return true;
    }

    return false;
  }

  function isLimitedAvailabilityDate(date: Date) {
    const dayAvailability = findAvailabilityForDate(date);

    if (!dayAvailability) {
      return false;
    }

    return (
      dayAvailability.available &&
      dayAvailability.spaces_available > 0 &&
      dayAvailability.spaces_available < dayAvailability.total_spaces
    );
  }

  function isGoodAvailabilityDate(date: Date) {
    const dayAvailability = findAvailabilityForDate(date);

    if (!dayAvailability) {
      return false;
    }

    return (
      dayAvailability.available &&
      dayAvailability.spaces_available > 0 &&
      dayAvailability.spaces_available === dayAvailability.total_spaces
    );
  }

  function handleSelectDate(date: Date | undefined) {
    setSelectedDay(date);
    setMessage("");
    setIsError(false);

    if (!date) {
      setSelectedDateForm(null);
      return;
    }

    const dateKey = formatDateForDatabase(date);
    const existingAvailability = findAvailabilityForDate(date);

    if (existingAvailability) {
      setSelectedDateForm({
        date: existingAvailability.date,
        available: existingAvailability.available,
        total_spaces: existingAvailability.total_spaces,
        spaces_available: existingAvailability.spaces_available,
        notes: existingAvailability.notes || "",
      });

      return;
    }

    setSelectedDateForm({
      date: dateKey,
      available: true,
      total_spaces: 1,
      spaces_available: 1,
      notes: "",
    });
  }

  async function saveSelectedDate() {
    if (!selectedDateForm || saving) {
      return;
    }

    setMessage("");
    setIsError(false);

    if (
      !Number.isInteger(selectedDateForm.total_spaces) ||
      selectedDateForm.total_spaces < 0
    ) {
      setIsError(true);
      setMessage("Total spaces must be a whole number of zero or greater.");
      return;
    }

    if (
      !Number.isInteger(selectedDateForm.spaces_available) ||
      selectedDateForm.spaces_available < 0
    ) {
      setIsError(true);
      setMessage("Spaces available must be a whole number of zero or greater.");
      return;
    }

    if (selectedDateForm.spaces_available > selectedDateForm.total_spaces) {
      setIsError(true);
      setMessage("Spaces available cannot be higher than total spaces.");
      return;
    }

    if (selectedDateForm.available && selectedDateForm.total_spaces === 0) {
      setIsError(true);
      setMessage("An available date must have at least one total space.");
      return;
    }

    if (
      !selectedDateForm.available &&
      (selectedDateForm.total_spaces !== 0 ||
        selectedDateForm.spaces_available !== 0)
    ) {
      setIsError(true);
      setMessage(
        "An unavailable date must have zero total spaces and zero spaces available.",
      );
      return;
    }

    setSaving(true);

    const result = await authenticatedApiRequest<SaveAvailabilityDateResponse>(
      "/api/admin/availability/date",
      {
        body: {
          date: selectedDateForm.date,
          available: selectedDateForm.available,
          totalSpaces: selectedDateForm.total_spaces,
          spacesAvailable: selectedDateForm.spaces_available,
          notes: selectedDateForm.notes,
        },
      },
    );

    if (result.unauthenticated) {
      setSaving(false);
      window.location.href = "/login";
      return;
    }

    if (!result.ok) {
      setSaving(false);
      setIsError(true);
      setMessage(result.error || "Unable to save availability.");
      return;
    }

    if (!result.data || !result.data.availabilitySaved) {
      setSaving(false);
      setIsError(true);
      setMessage(
        result.data?.error ||
          "The availability service did not save the selected date.",
      );
      return;
    }

    await loadAvailability();

    setSaving(false);

    if (result.data.followUpRequired) {
      setIsError(true);
      setMessage(
        result.data.message ||
          result.data.calendar?.error ||
          "Availability was saved, but Google Calendar could not be updated.",
      );
      return;
    }

    setIsError(false);
    setMessage(
      result.data.message ||
        "Availability was saved and Google Calendar was updated successfully.",
    );
  }

  async function applyBulkAvailability() {
    setMessage("");
    setIsError(false);

    if (!bulkStartDate || !bulkEndDate) {
      setIsError(true);
      setMessage("Please choose a start date and end date.");
      return;
    }

    if (bulkEndDate < bulkStartDate) {
      setIsError(true);
      setMessage("End date cannot be before start date.");
      return;
    }

    if (bulkTotalSpaces < 0) {
      setIsError(true);
      setMessage("Total spaces cannot be less than zero.");
      return;
    }

    if (bulkSpacesAvailable < 0) {
      setIsError(true);
      setMessage("Spaces available cannot be less than zero.");
      return;
    }

    if (bulkSpacesAvailable > bulkTotalSpaces) {
      setIsError(true);
      setMessage("Spaces available cannot be higher than total spaces.");
      return;
    }

    const dates = getDatesInRange(bulkStartDate, bulkEndDate);

    const availabilityRows = dates.map((date) => ({
      date,
      available: bulkAvailable,
      total_spaces: bulkTotalSpaces,
      spaces_available: bulkSpacesAvailable,
      notes: bulkNotes.trim() || null,
      updated_at: new Date().toISOString(),
    }));

    setSaving(true);

    const { data: savedAvailability, error } = await supabase
      .from("availability")
      .upsert(availabilityRows, {
        onConflict: "date",
      })
      .select("id, date, available, total_spaces, spaces_available, notes");

    if (error || !savedAvailability) {
      setSaving(false);
      setIsError(true);
      setMessage(error?.message || "Unable to update availability.");
      return;
    }

    setBulkSyncCurrent(0);
    setBulkSyncTotal(savedAvailability.length);

    let calendarSyncFailures = 0;

    for (let index = 0; index < savedAvailability.length; index += 1) {
      const availabilityRecord = savedAvailability[index];

      try {
        const calendarResponse = await fetch(
          "/api/google/sync-availability-event",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              availabilityId: availabilityRecord.id,
              date: availabilityRecord.date,
              available: availabilityRecord.available,
              totalSpaces: availabilityRecord.total_spaces,
              spacesAvailable: availabilityRecord.spaces_available,
              notes: availabilityRecord.notes,
            }),
          },
        );

        if (!calendarResponse.ok) {
          calendarSyncFailures += 1;

          const calendarErrorText = await calendarResponse.text();

          console.error(
            `Google Calendar sync failed for ${availabilityRecord.date}:`,
            calendarErrorText,
          );
        }
      } catch (calendarError) {
        calendarSyncFailures += 1;

        console.error(
          `Google Calendar sync failed for ${availabilityRecord.date}:`,
          calendarError,
        );
      }

      setBulkSyncCurrent(index + 1);
    }

    setSaving(false);

    setBulkStartDate("");
    setBulkEndDate("");
    setBulkAvailable(true);
    setBulkTotalSpaces(1);
    setBulkSpacesAvailable(1);
    setBulkNotes("");

    await loadAvailability();

    if (calendarSyncFailures > 0) {
      setIsError(true);
      setMessage(
        `Availability was saved for ${savedAvailability.length} date(s), but ${calendarSyncFailures} Google Calendar event(s) could not be synced.`,
      );
      return;
    }

    setIsError(false);
    setMessage(
      `Availability and Google Calendar were updated for ${savedAvailability.length} date(s).`,
    );
  }

  if (loading) {
    return <LoadingScreen message="Loading availability..." />;
  }

  return (
    <AdminPageLayout>
      <PageCard
        title="Amend Availability"
        subtitle="Manage daily boarding spaces, availability and admin notes."
      >
        <div className="space-y-6 md:space-y-8">
          {message && (
            <MessageBox type={isError ? "error" : "success"}>
              {message}
            </MessageBox>
          )}

          <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <h2 className="text-xl md:text-2xl font-semibold text-[#5C4033] mb-4 md:mb-6">
                Availability Calendar
              </h2>

              <div className="bg-white border border-[#D9CBB8] rounded-xl p-3 md:p-6 shadow-sm overflow-x-auto">
                <DayPicker
                  mode="single"
                  selected={selectedDay}
                  onSelect={handleSelectDate}
                  month={calendarMonth}
                  onMonthChange={setCalendarMonth}
                  numberOfMonths={calendarMonths}
                  fixedWeeks
                  modifiers={{
                    available: isGoodAvailabilityDate,
                    limited: isLimitedAvailabilityDate,
                    unavailable: isUnavailableDate,
                  }}
                  modifiersClassNames={{
                    available:
                      "bg-green-100 text-green-800 border border-green-300 hover:bg-green-200",
                    limited:
                      "bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200",
                    unavailable:
                      "bg-red-50 text-red-700 line-through border border-red-300",
                    selected: "bg-[#8B6A4E] text-white border border-[#8B6A4E]",
                  }}
                  classNames={{
                    months:
                      "flex flex-col md:flex-row justify-center gap-4 md:gap-6",
                    month: "w-full max-w-xs md:max-w-md",
                    month_caption:
                      "flex justify-center items-center mb-3 md:mb-4",
                    caption_label:
                      "text-lg md:text-xl font-bold text-[#5C4033]",
                    nav: "flex items-center justify-between mb-4",
                    button_previous:
                      "text-[#5C4033] hover:text-[#8B6A4E] hover:scale-110 transition-all duration-200",
                    button_next:
                      "text-[#5C4033] hover:text-[#8B6A4E] hover:scale-110 transition-all duration-200",
                    weekdays: "grid grid-cols-7 mb-2",
                    weekday:
                      "text-center text-xs md:text-sm font-semibold text-[#8B6A4E]",
                    week: "grid grid-cols-7 gap-1.5 md:gap-2 mb-1 md:mb-2",
                    day: "h-8 w-8 md:h-9 md:w-9 flex items-center justify-center rounded-full text-xs md:text-sm font-medium transition-all duration-200",
                    today: "ring-2 ring-[#8B6A4E] ring-offset-2",
                  }}
                  className="mx-auto"
                />
              </div>

              <div className="mt-3 md:mt-4 grid grid-cols-3 gap-2 md:gap-3 text-[10px] md:text-sm">
                <div className="bg-green-50 border border-green-300 text-green-800 px-2 py-2 md:p-3 rounded-lg font-medium text-center">
                  Available
                </div>

                <div className="bg-amber-50 border border-amber-300 text-amber-800 px-2 py-2 md:p-3 rounded-lg font-medium text-center">
                  Limited spaces
                </div>

                <div className="bg-red-50 border border-red-300 text-red-700 px-2 py-2 md:p-3 rounded-lg font-medium text-center">
                  Unavailable / full
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-xl md:text-2xl font-semibold text-[#5C4033] mb-4 md:mb-6">
                Selected Date
              </h2>

              <div className="bg-white border border-[#D9CBB8] rounded-xl p-4 md:p-6 shadow-sm">
                {!selectedDateForm ? (
                  <p className="text-sm md:text-base text-[#8B6A4E]">
                    Select a date from the calendar to amend availability.
                  </p>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-[#F5EFE6] border border-[#D9CBB8] p-3 md:p-4 rounded-lg">
                      <p className="text-sm md:text-base text-[#5C4033] font-semibold">
                        {formatDisplayDate(selectedDateForm.date)}
                      </p>
                    </div>

                    <label className="flex min-h-11 items-center justify-between gap-4 rounded-lg border border-[#D9CBB8] bg-[#FFFDF9] px-3 py-3 text-sm md:text-base font-medium text-[#5C4033]">
                      Available
                      <input
                        type="checkbox"
                        checked={selectedDateForm.available}
                        onChange={(e) => {
                          const isAvailable = e.target.checked;

                          setSelectedDateForm({
                            ...selectedDateForm,
                            available: isAvailable,
                            total_spaces: isAvailable
                              ? selectedDateForm.total_spaces || 1
                              : 0,
                            spaces_available: isAvailable
                              ? selectedDateForm.spaces_available || 1
                              : 0,
                          });
                        }}
                        className="h-5 w-5 accent-[#8B6A4E]"
                      />
                    </label>

                    <div>
                      <label className="block text-sm md:text-base font-medium text-[#5C4033] mb-2">
                        Total spaces
                      </label>

                      <input
                        type="number"
                        min="0"
                        value={selectedDateForm.total_spaces}
                        disabled={!selectedDateForm.available}
                        onChange={(e) =>
                          setSelectedDateForm({
                            ...selectedDateForm,
                            total_spaces: Number(e.target.value),
                          })
                        }
                        className="w-full min-h-11 rounded-lg border border-[#D9CBB8] bg-white px-3 py-2 text-sm md:text-base text-[#5C4033] outline-none focus:border-[#8B6A4E] focus:ring-2 focus:ring-[#8B6A4E]/20 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                      />
                    </div>

                    <div>
                      <label className="block text-sm md:text-base font-medium text-[#5C4033] mb-2">
                        Spaces available
                      </label>

                      <input
                        type="number"
                        min="0"
                        value={selectedDateForm.spaces_available}
                        disabled={!selectedDateForm.available}
                        onChange={(e) =>
                          setSelectedDateForm({
                            ...selectedDateForm,
                            spaces_available: Number(e.target.value),
                          })
                        }
                        className="w-full min-h-11 rounded-lg border border-[#D9CBB8] bg-white px-3 py-2 text-sm md:text-base text-[#5C4033] outline-none focus:border-[#8B6A4E] focus:ring-2 focus:ring-[#8B6A4E]/20 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                      />
                    </div>

                    <div>
                      <label className="block text-sm md:text-base font-medium text-[#5C4033] mb-2">
                        Notes
                      </label>

                      <textarea
                        rows={3}
                        value={selectedDateForm.notes}
                        onChange={(e) =>
                          setSelectedDateForm({
                            ...selectedDateForm,
                            notes: e.target.value,
                          })
                        }
                        placeholder="Optional admin note..."
                        className="w-full rounded-lg border border-[#D9CBB8] bg-white px-3 py-2 text-sm md:text-base text-[#5C4033] outline-none focus:border-[#8B6A4E] focus:ring-2 focus:ring-[#8B6A4E]/20"
                      />
                    </div>

                    <div className="flex justify-center">
                      <Button
                        type="button"
                        variant="dark"
                        onClick={saveSelectedDate}
                        disabled={saving}
                        className="disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
                      >
                        {saving ? "Saving..." : "Save Date"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl md:text-2xl font-semibold text-[#5C4033] mb-4 md:mb-6">
              Bulk Update Availability
            </h2>

            <div className="bg-white border border-[#D9CBB8] rounded-xl p-4 md:p-6 shadow-sm">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm md:text-base font-medium text-[#5C4033] mb-2">
                    Start date
                  </label>

                  <input
                    type="date"
                    value={bulkStartDate}
                    onChange={(e) => setBulkStartDate(e.target.value)}
                    className="w-full min-h-11 rounded-lg border border-[#D9CBB8] bg-white px-3 py-2 text-sm md:text-base text-[#5C4033] outline-none focus:border-[#8B6A4E] focus:ring-2 focus:ring-[#8B6A4E]/20"
                  />
                </div>

                <div>
                  <label className="block text-sm md:text-base font-medium text-[#5C4033] mb-2">
                    End date
                  </label>

                  <input
                    type="date"
                    value={bulkEndDate}
                    onChange={(e) => setBulkEndDate(e.target.value)}
                    className="w-full min-h-11 rounded-lg border border-[#D9CBB8] bg-white px-3 py-2 text-sm md:text-base text-[#5C4033] outline-none focus:border-[#8B6A4E] focus:ring-2 focus:ring-[#8B6A4E]/20"
                  />
                </div>

                <label className="mt-4 flex min-h-11 items-center justify-between gap-4 rounded-lg border border-[#D9CBB8] bg-[#FFFDF9] px-3 py-3 text-sm md:text-base font-medium text-[#5C4033] md:col-span-2">
                  Available
                  <input
                    type="checkbox"
                    checked={bulkAvailable}
                    onChange={(e) => {
                      const isAvailable = e.target.checked;

                      setBulkAvailable(isAvailable);

                      if (isAvailable) {
                        setBulkTotalSpaces(1);
                        setBulkSpacesAvailable(1);
                      } else {
                        setBulkTotalSpaces(0);
                        setBulkSpacesAvailable(0);
                      }
                    }}
                    className="h-5 w-5 accent-[#8B6A4E]"
                  />
                </label>

                <div>
                  <label className="block text-sm md:text-base font-medium text-[#5C4033] mb-2">
                    Total spaces
                  </label>

                  <input
                    type="number"
                    min="0"
                    value={bulkTotalSpaces}
                    disabled={!bulkAvailable}
                    onChange={(e) => setBulkTotalSpaces(Number(e.target.value))}
                    className="w-full min-h-11 rounded-lg border border-[#D9CBB8] bg-white px-3 py-2 text-sm md:text-base text-[#5C4033] outline-none focus:border-[#8B6A4E] focus:ring-2 focus:ring-[#8B6A4E]/20 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                  />
                </div>

                <div>
                  <label className="block text-sm md:text-base font-medium text-[#5C4033] mb-2">
                    Spaces available
                  </label>

                  <input
                    type="number"
                    min="0"
                    value={bulkSpacesAvailable}
                    disabled={!bulkAvailable}
                    onChange={(e) =>
                      setBulkSpacesAvailable(Number(e.target.value))
                    }
                    className="w-full min-h-11 rounded-lg border border-[#D9CBB8] bg-white px-3 py-2 text-sm md:text-base text-[#5C4033] outline-none focus:border-[#8B6A4E] focus:ring-2 focus:ring-[#8B6A4E]/20 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm md:text-base font-medium text-[#5C4033] mb-2">
                  Notes
                </label>

                <textarea
                  rows={2}
                  value={bulkNotes}
                  onChange={(e) => setBulkNotes(e.target.value)}
                  placeholder="Optional note applied to every date..."
                  className="w-full rounded-lg border border-[#D9CBB8] bg-white px-3 py-2 text-sm md:text-base text-[#5C4033] outline-none focus:border-[#8B6A4E] focus:ring-2 focus:ring-[#8B6A4E]/20"
                />
              </div>

              <div className="mt-5 flex justify-center">
                <Button
                  type="button"
                  variant="dark"
                  onClick={applyBulkAvailability}
                  disabled={saving}
                  className="disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {saving ? "Applying..." : "Apply to Date Range"}
                </Button>
              </div>
              {saving && bulkSyncTotal > 0 && (
                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between gap-3 text-xs md:text-sm text-[#5C4033]">
                    <span>
                      Syncing Google Calendar: {bulkSyncCurrent} of{" "}
                      {bulkSyncTotal} dates
                    </span>

                    <span className="font-semibold">
                      {Math.round((bulkSyncCurrent / bulkSyncTotal) * 100)}%
                    </span>
                  </div>

                  <div className="h-3 w-full overflow-hidden rounded-full bg-[#E8DDCF]">
                    <div
                      className="h-full rounded-full bg-[#8B6A4E] transition-all duration-300"
                      style={{
                        width: `${Math.round(
                          (bulkSyncCurrent / bulkSyncTotal) * 100,
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </PageCard>
    </AdminPageLayout>
  );
}
