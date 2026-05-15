import { useMemo } from "react";
import { TRUCKS, TRUCK_ROUTES } from "@/data/trucks";
import { Slider } from "@/components/ui/slider";

interface Props {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  selectedTruck: string | null;
}

const DAYS = Array.from({ length: 14 }, (_, i) => {
  const d = new Date(Date.UTC(2025, 6, 7 + i));
  return {
    index: i,
    date: d,
    label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    isToday: i === 4,
  };
});

export default function TimeSlider({ selectedDate, onDateChange, selectedTruck }: Props) {
  const currentDay = useMemo(() => {
    const start = new Date(Date.UTC(2025, 6, 7));
    const diff = selectedDate.getTime() - start.getTime();
    return Math.floor(diff / 86400000);
  }, [selectedDate]);

  const selectedTruckData = TRUCKS.find((t) => t.id === selectedTruck);
  const route = selectedTruck
    ? TRUCK_ROUTES.find((r) => r.truck.id === selectedTruck && r.weekIndex === 0)
    : null;

  const handleDayChange = (value: number[]) => {
    const dayIndex = value[0];
    const base = new Date(Date.UTC(2025, 6, 7 + dayIndex, selectedDate.getUTCHours(), selectedDate.getUTCMinutes()));
    onDateChange(base);
  };

  const handleHourChange = (value: number[]) => {
    const d = new Date(selectedDate);
    d.setUTCHours(value[0], 0, 0, 0);
    onDateChange(d);
  };

  return (
    <div className="h-full flex bg-[#f5e6c8] border-t-2 border-[#3d2b1f]/30">
      {/* Day + Hour controls */}
      <div className="w-64 flex-shrink-0 border-r border-[#3d2b1f]/20 px-3 py-2 flex flex-col justify-center gap-2">
        {/* Day slider */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-serif text-[#5a3e2b] uppercase tracking-wider w-8">Day</span>
          <Slider
            value={[Math.max(0, Math.min(13, currentDay))]}
            onValueChange={handleDayChange}
            min={0} max={13} step={1}
            className="flex-1"
          />
          <span className="text-[10px] font-bold text-[#3d2b1f] w-16 text-right">
            {DAYS[Math.max(0, Math.min(13, currentDay))]?.label || ""}
          </span>
        </div>

        {/* Hour slider */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-serif text-[#5a3e2b] uppercase tracking-wider w-8">Hr</span>
          <Slider
            value={[selectedDate.getUTCHours()]}
            onValueChange={handleHourChange}
            min={0} max={23} step={1}
            className="flex-1"
          />
          <span className="text-[10px] font-bold text-[#3d2b1f] w-16 text-right">
            {selectedDate.toLocaleTimeString("en-US", { hour: "numeric", hour12: true, timeZone: "UTC" })}
          </span>
        </div>

        {/* Day labels */}
        <div className="flex gap-0 mt-0.5">
          {DAYS.map((d) => (
            <div key={d.index} className="flex-1 text-center text-[7px]" style={{ color: d.isToday ? "#c0392b" : "#7a6e5b" }}>
              {d.isToday ? "TODAY" : d.label.split(" ")[0]}
            </div>
          ))}
        </div>
      </div>

      {/* Mini Gantt */}
      <div className="flex-1 px-3 py-2 overflow-hidden">
        <div className="text-[10px] font-serif text-[#5a3e2b] uppercase tracking-wider mb-1">
          {selectedTruckData ? `${selectedTruckData.id} — ${selectedTruckData.name}` : "Select a truck to view route timeline"}
        </div>
        {selectedTruckData ? (
          <svg viewBox="0 0 336 60" className="w-full h-full" preserveAspectRatio="none">
            {/* Day grid */}
            {Array.from({ length: 15 }, (_, i) => (
              <line key={i} x1={i * 24} y1={0} x2={i * 24} y2={60} stroke="#3d2b1f" strokeWidth={0.3} opacity={0.2} />
            ))}
            {/* Today line */}
            <line x1={4 * 24} y1={0} x2={4 * 24} y2={60} stroke="#c0392b" strokeWidth={1} opacity={0.5} strokeDasharray="4,2" />
            {/* Current time indicator */}
            {(() => {
              const hour = selectedDate.getUTCHours();
              const dayOffset = Math.max(0, Math.min(13, currentDay)) * 24;
              const x = dayOffset + hour;
              return <line x1={x} y1={0} x2={x} y2={60} stroke="#3d2b1f" strokeWidth={1.5} />;
            })()}
            {/* Route bars */}
            {route ? route.segments.map((seg, i) => {
              const weekStart = new Date(Date.UTC(2025, 6, 7));
              const depart = new Date(seg.depart);
              const arrive = new Date(seg.arrive);
              const startHour = (depart.getTime() - weekStart.getTime()) / 3600000;
              const endHour = (arrive.getTime() - weekStart.getTime()) / 3600000;
              const isPast = arrive.getTime() <= selectedDate.getTime();
              return (
                <g key={i}>
                  <rect
                    x={startHour}
                    y={12 + (i % 3) * 16}
                    width={Math.max(endHour - startHour, 2)}
                    height={12}
                    rx={2}
                    fill={isPast ? (selectedTruckData?.color || "#333") : "#999"}
                    opacity={isPast ? 0.9 : 0.3}
                  />
                  {endHour - startHour > 20 && (
                    <text x={startHour + 2} y={22 + (i % 3) * 16} fontSize={5} fill="#fff" fontFamily="sans-serif">
                      {seg.from}→{seg.to}
                    </text>
                  )}
                </g>
              );
            }) : null}
          </svg>
        ) : (
          <div className="h-full flex items-center justify-center text-[10px] text-[#7a6e5b] italic">
            Click a truck on the map or sidebar to see its route
          </div>
        )}
      </div>
    </div>
  );
}
