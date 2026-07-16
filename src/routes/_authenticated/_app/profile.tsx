import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loadMe, signedPhotoUrl, ageFromDob } from "@/lib/huddl";
import { LogOut, ShieldCheck, MapPin } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app/profile")({
  component: Profile,
});

function Profile() {
  const navigate = useNavigate();
  const [me, setMe] = useState<Awaited<ReturnType<typeof loadMe>>>(null);
  const [hero, setHero] = useState<string>("");

  useEffect(() => {
    loadMe().then(async (data) => {
      setMe(data);
      if (data?.profile?.photos?.[0]) setHero(await signedPhotoUrl(data.profile.photos[0]));
    });
  }, []);

  if (!me?.profile) return <div className="min-h-screen flex items-center justify-center"><div className="h-6 w-6 rounded-full border-2 border-muted border-t-primary animate-spin" /></div>;
  const p = me.profile;

  return (
    <div>
      <div className="relative h-64 bg-muted">
        {hero && <img src={hero} className="h-full w-full object-cover" alt="" />}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent" />
      </div>

      <div className="px-5 -mt-10 relative">
        <h1 className="text-2xl font-semibold tracking-tight">
          {p.full_name}{p.dob && <span className="text-muted-foreground font-normal">, {ageFromDob(p.dob)}</span>}
        </h1>
        <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
          {p.city && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{p.city}</span>}
          <span className="inline-flex items-center gap-1 text-primary"><ShieldCheck className="h-3.5 w-3.5" />Verified</span>
        </div>

        {p.bio && <p className="mt-4 text-[15px] leading-relaxed">{p.bio}</p>}

        <div className="mt-5">
          <div className="text-xs font-medium text-muted-foreground mb-2">INTERESTS</div>
          <div className="flex flex-wrap gap-2">
            {p.interests.map((i) => (
              <span key={i} className="rounded-full bg-muted px-3 py-1 text-[13px] font-medium">{i}</span>
            ))}
          </div>
        </div>

        <button
          onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/" }); }}
          className="mt-10 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </div>
  );
}
