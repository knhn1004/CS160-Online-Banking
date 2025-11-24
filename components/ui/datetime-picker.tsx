"use client";

import * as React from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import ReactDatePicker from "react-datepicker";
import { cn } from "@/lib/utils";
import "react-datepicker/dist/react-datepicker.css";

interface DateTimePickerProps {
  value?: string; // ISO datetime string or empty string
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  min?: Date | string; // Date object or ISO datetime string
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Pick a date and time",
  disabled = false,
  className,
  id,
  min,
}: DateTimePickerProps) {
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(
    value ? new Date(value) : null,
  );

  // Update internal state when value prop changes
  React.useEffect(() => {
    if (value) {
      setSelectedDate(new Date(value));
    } else {
      setSelectedDate(null);
    }
  }, [value]);

  const handleDateChange = (date: Date | null) => {
    setSelectedDate(date);
    if (onChange) {
      if (date) {
        // Format as ISO string for datetime-local input compatibility
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        const formatted = `${year}-${month}-${day}T${hours}:${minutes}`;
        onChange(formatted);
      } else {
        onChange("");
      }
    }
  };

  // Parse min date - if it's already a Date, use it; if it's a string, parse it
  // If string doesn't have timezone info, treat it as local time
  const minDate = React.useMemo(() => {
    if (!min) return undefined;
    if (min instanceof Date) return min;
    // If string has 'Z' or timezone offset, parse normally
    if (
      typeof min === "string" &&
      (min.includes("Z") || min.match(/[+-]\d{2}:\d{2}$/))
    ) {
      return new Date(min);
    }
    // If string is in format "YYYY-MM-DDTHH:mm" (no timezone), treat as local time
    // Parse manually to avoid timezone conversion issues
    if (
      typeof min === "string" &&
      min.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    ) {
      const [datePart, timePart] = min.split("T");
      const [year, month, day] = datePart.split("-").map(Number);
      const [hours, minutes] = timePart.split(":").map(Number);
      return new Date(year, month - 1, day, hours, minutes);
    }
    // Fallback to standard parsing
    return new Date(min);
  }, [min]);
  return (
    <div className={cn("relative", className)}>
      <ReactDatePicker
        id={id}
        selected={selectedDate}
        onChange={handleDateChange}
        showTimeSelect
        timeIntervals={15}
        dateFormat="MMMM d, yyyy h:mm aa"
        placeholderText={placeholder}
        disabled={disabled}
        minDate={minDate}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          !selectedDate && "text-muted-foreground",
        )}
        calendarClassName="!bg-popover !border-border !rounded-md !shadow-lg"
        dayClassName={(date) =>
          cn(
            "!rounded-md hover:!bg-accent hover:!text-accent-foreground",
            date.toDateString() === selectedDate?.toDateString() &&
              "!bg-primary !text-primary-foreground",
            date.toDateString() === new Date().toDateString() &&
              "!bg-primary/20 !text-primary-foreground !font-semibold",
          )
        }
        wrapperClassName="w-full"
        popperClassName="!z-50 react-datepicker-popper-left"
        popperPlacement="bottom-start"
      />
      <CalendarIcon className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
    </div>
  );
}
