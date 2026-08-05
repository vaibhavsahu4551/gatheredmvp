import { Briefcase, Cigarette, Ruler, Wine } from "lucide-react";

export type ProfileDetailsProps = {
  heightCm?: number | null;
  profession?: string | null;
  smoking?: string | null;
  drinking?: string | null;
};

function formatHeight(cm: number) {
  const totalIn = Math.round(cm / 2.54);
  return `${cm} cm · ${Math.floor(totalIn / 12)}′ ${totalIn % 12}″`;
}

export function ProfileDetails({ heightCm, profession, smoking, drinking }: ProfileDetailsProps) {
  const items: { icon: React.ReactNode; label: string }[] = [];
  if (heightCm) items.push({ icon: <Ruler className="h-3.5 w-3.5" />, label: formatHeight(heightCm) });
  if (profession) items.push({ icon: <Briefcase className="h-3.5 w-3.5" />, label: profession });
  if (smoking) items.push({ icon: <Cigarette className="h-3.5 w-3.5" />, label: `Smokes: ${smoking.toLowerCase()}` });
  if (drinking) items.push({ icon: <Wine className="h-3.5 w-3.5" />, label: `Drinks: ${drinking.toLowerCase()}` });
  if (items.length === 0) return null;

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-[13px] font-medium">
          {it.icon}
          {it.label}
        </span>
      ))}
    </div>
  );
}
