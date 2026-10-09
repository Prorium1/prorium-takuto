import { redirect } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { Brand } from "@/components/brand";
import { LoginForm } from "@/components/login-form";
import { getActor } from "@/lib/server/auth";
import {
  isMockEnvironment,
  productionConfigured,
} from "@/lib/server/environment";

export const dynamic = "force-dynamic";
export default async function LoginPage() {
  const actor = await getActor();
  if (actor) redirect("/dashboard");
  return (
    <main className="login-page">
      <section className="login-story">
        <Brand />
        <div className="login-story-main">
          <span className="eyebrow">PRORIUM SHAREHOLDER PORTAL</span>
          <h1>
            成長のいまを、
            <br />
            次の可能性を。
          </h1>
          <p>
            事業の変化を、数字とその理由から。
            <br />
            Proriumの経営を、ひとつのレポートで。
          </p>
          <div className="login-report-cover">
            <span className="cover-top">
              MONTHLY SHAREHOLDER REPORT
              <ArrowUpRight size={18} />
            </span>
            <div className="cover-title">
              Clarity.
              <br />
              Every month.
            </div>
            <span className="cover-caption">
              数字の先にある、経営の意思を。
            </span>
            <div className="cover-contents">
              <span>
                <i>01</i> Performance
              </span>
              <span>
                <i>02</i> Perspective
              </span>
              <span>
                <i>03</i> Possibilities
              </span>
            </div>
            <span className="cover-bottom">
              PRIVATE SHAREHOLDER PUBLICATION
              {isMockEnvironment() && <span>MOCK</span>}
            </span>
          </div>
        </div>
        <span className="login-copyright">
          © 2026 Prorium Inc. · Investor Relations
        </span>
      </section>
      <section className="login-panel">
        <div className="login-panel-inner">
          <span className="eyebrow">WELCOME TO PRORIUM</span>
          <h2>株主の皆さまへ。</h2>
          <p className="login-intro">
            最新の経営状況と、これからの成長をお届けします。
          </p>
          <LoginForm
            mockEnabled={isMockEnvironment()}
            productionEnabled={productionConfigured()}
          />
        </div>
      </section>
    </main>
  );
}
