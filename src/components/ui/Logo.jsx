import { Cuboid } from "lucide-react";

/** Current logo (the original cube mark), in the brand teals. */
export default function Logo({ size = "md" }) {
  const box = size === "sm" ? "w-8 h-8 rounded-[10px]" : "w-10 h-10 rounded-xl";
  return (
    <span className="flex items-center gap-2.5 select-none">
      <span className={`${box} grid place-items-center text-[#06302f] shadow-[0_6px_14px_-6px_rgb(0_200_181/0.8)]`} style={{ background: "linear-gradient(135deg, #00d5c9, #00c8b5 45%, #28a1ab)" }}>
        <Cuboid size={size === "sm" ? 17 : 21} strokeWidth={2.2} />
      </span>
      <span className={`font-display font-bold tracking-tight ${size === "sm" ? "text-base" : "text-xl"}`}>Foldify</span>
    </span>
  );
}
