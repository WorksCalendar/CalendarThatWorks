import { TRUCKS, FACILITIES, getTruckPositionAtTime, ALL_CONFLICTS } from "@/data/trucks";

interface Props {
  selectedDate: Date;
  selectedTruck: string | null;
  onSelectTruck: (id: string) => void;
}

export default function TruckSidebar({ selectedDate, selectedTruck, onSelectTruck }: Props) {
  // Filter pre-computed conflicts by the selected day
  const dayStart = new Date(Date.UTC(selectedDate.getUTCFullYear(), selectedDate.getUTCMonth(), selectedDate.getUTCDate()));
  const dayEnd = new Date(dayStart.getTime() + 86400000);
  const conflicts = ALL_CONFLICTS.filter((c) => {
    const t = new Date(c.timeA);
    return t >= dayStart && t < dayEnd;
  });
  const conflictTrucks = new Set<string>();
  for (const c of conflicts) {
    conflictTrucks.add(c.truckA);
    conflictTrucks.add(c.truckB);
  }

  return (
    <div className="h-full flex flex-col border-r-2 border-[#3d2b1f]/20 bg-[#f5e6c8]">
      <div className="px-3 py-2 border-b border-[#3d2b1f]/20">
        <h2 className="font-serif text-sm font-bold text-[#3d2b1f] tracking-wider uppercase">
          Fleet Status
        </h2>
        <div className="flex gap-2 mt-1 text-[10px] text-[#5a3e2b]">
          <span>{TRUCKS.length} active</span>
          <span className="text-[#c0392b] font-bold">{conflictTrucks.size} conflicted</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
        <div className="py-1">
          {TRUCKS.map((truck) => {
            const pos = getTruckPositionAtTime(truck.id, selectedDate);
            const fac = pos?.facility ? FACILITIES[pos.facility] : null;
            const hasConflict = conflictTrucks.has(truck.id);
            const isSelected = selectedTruck === truck.id;

            return (
              <button
                key={truck.id}
                type="button"
                onClick={() => onSelectTruck(isSelected ? "" : truck.id)}
                className={[
                  "w-full text-left px-3 py-2 border-b border-[#3d2b1f]/10 transition-all",
                  isSelected ? "bg-[#3d2b1f] text-white shadow-inner" : "hover:bg-[#3d2b1f]/5",
                ].join(" ")}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0 border border-white/50"
                    style={{ backgroundColor: truck.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className={`text-[11px] font-bold truncate ${isSelected ? "text-white" : "text-[#3d2b1f]"}`}>
                        {truck.id}
                      </span>
                      {hasConflict && (
                        <span className="text-[9px] bg-[#c0392b] text-white px-1 rounded">
                          CONFLICT
                        </span>
                      )}
                    </div>
                    <div className={`text-[10px] truncate ${isSelected ? "text-white/80" : "text-[#5a3e2b]"}`}>
                      {truck.name}
                    </div>
                    <div className={`text-[9px] mt-0.5 ${isSelected ? "text-white/60" : "text-[#7a6e5b]"}`}>
                      {pos?.moving ? "En route" : fac ? `@ ${fac.code}` : "Unknown"}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
