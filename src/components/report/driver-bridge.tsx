import { ArrowRight } from "lucide-react";
import type { Driver } from "@/lib/domain/types";
import { millions } from "@/lib/domain/finance";

export function DriverBridge({
  title,
  previous,
  current,
  drivers,
}: {
  title: string;
  previous: number;
  current: number;
  drivers: Driver[];
}) {
  const max = Math.max(1, ...drivers.map((d) => Math.abs(d.amount)));
  const delta = current - previous;
  return (
    <article className="driver-card">
      <div className="driver-header">
        <h3>{title}</h3>
        <span
          className={
            delta < 0
              ? "negative"
              : delta > 0
                ? "positive"
                : "comparison-neutral"
          }
        >
          {delta > 0 ? "+" : ""}
          {millions(delta)}
          <small>百万円</small>
        </span>
      </div>
      <div className="bridge-endpoints">
        <div>
          <span>前年同月</span>
          <strong>{millions(previous)}</strong>
        </div>
        <ArrowRight size={18} />
        <div>
          <span>当月</span>
          <strong>{millions(current)}</strong>
        </div>
        <span className="bridge-unit">百万円</span>
      </div>
      <div className="driver-rows">
        {drivers.map((d, i) => (
          <div className="driver-row" key={d.label}>
            <div>
              <span className="driver-number">
                {String(i + 1).padStart(2, "0")}
              </span>
              <strong>{d.label}</strong>
              <span className={d.amount >= 0 ? "positive" : "negative"}>
                {d.amount > 0 ? "+" : ""}
                {millions(d.amount)}
              </span>
            </div>
            <div className="driver-bar-track">
              <i
                style={{
                  width: `${(Math.abs(d.amount) / max) * 100}%`,
                  background:
                    d.amount >= 0
                      ? "var(--report-driver-positive)"
                      : "var(--report-driver-negative)",
                }}
              />
            </div>
            <p>{d.description}</p>
          </div>
        ))}
      </div>
      <div className="driver-total">
        <span>変化要因の合計</span>
        <strong>
          {current - previous > 0 ? "+" : ""}
          {millions(current - previous)} 百万円
        </strong>
      </div>
    </article>
  );
}
