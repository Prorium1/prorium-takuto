import type { ReportVersion } from "@/lib/domain/types";
import { preparedEvent } from "@/lib/server/prepared-event";
import { EventSpotlight } from "@/components/report/event-spotlight";
import { EventPreparationForm } from "./event-preparation-form";

export function EventPreparationCard({ report }: { report: ReportVersion }) {
  return (
    <section className="event-preparation">
      <span className="eyebrow">READY TO ADD / 大会の映像</span>
      <h2>6月の国際大会を、映像で伝える。</h2>
      <p>
        6月2日・3日の開催概要と、ご指定の大会動画を準備しました。成果や事業への寄与は、追加後の編集画面から追記できます。
      </p>
      <details>
        <summary>追加する大会情報と、動画の見え方を確認</summary>
        <div className="monthly-report">
          <EventSpotlight
            event={preparedEvent}
            period={report.period}
            print={false}
          />
        </div>
      </details>
      <EventPreparationForm id={report.id} revision={report.revision} />
    </section>
  );
}
