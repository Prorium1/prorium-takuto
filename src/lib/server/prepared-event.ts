import "server-only";
import { eventSpotlightSchema } from "@/lib/domain/validation";

// Public video and event facts supplied by the company owner on 2026-10-11.
// This is an admin preparation, not a publication or a development fixture.
export const preparedEvent = eventSpotlightSchema.parse({
  title: "アジアチャンピオンシップマッサージ 2026",
  occurredOn: "2026-06-02",
  summary:
    "2026年6月2日・3日に開催された、マッサージの国際大会です。大会当日の様子を、映像でご覧いただけます。",
  outcomes: [],
  nextAction: "",
  videoUrl: "https://www.youtube.com/watch?v=PkRCXZ00fh8",
  videoTitle: "アジアチャンピオンシップマッサージ 2026｜大会映像",
});
