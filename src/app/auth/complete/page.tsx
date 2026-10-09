"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { completeEmailLoginAction } from "@/app/auth-actions";

export default function CompleteEmailLoginPage() {
  const started = useRef(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(location.hash.slice(1));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    history.replaceState(null, "", location.pathname);
    if (!accessToken || !refreshToken) {
      queueMicrotask(() =>
        setError(
          "認証リンクを確認できませんでした。新しいメールでお試しください。",
        ),
      );
      return;
    }
    void completeEmailLoginAction(accessToken, refreshToken)
      .then((result) =>
        setError(result.error ?? "ログインを完了できませんでした。"),
      )
      .catch(() =>
        setError(
          "ログインを完了できませんでした。新しいメールでお試しください。",
        ),
      );
  }, []);
  return (
    <main className="login-page auth-complete-page">
      <section className="login-panel">
        <div className="login-panel-inner">
          <span className="eyebrow">PRORIUM INVESTOR RELATIONS</span>
          <h1>ログインを確認しています</h1>
          {error ? (
            <p role="alert" className="form-error">
              {error}
            </p>
          ) : (
            <p role="status">このままお待ちください。</p>
          )}
          {error && (
            <Link href="/login" className="button secondary">
              ログイン画面へ戻る
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}
