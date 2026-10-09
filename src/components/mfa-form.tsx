"use client";
import { useActionState } from "react";
import { enrollMfaAction, verifyMfaAction } from "@/app/auth-actions";
import { MfaEnrollmentGuide } from "./mfa-enrollment-guide";
export function MfaForm({ existingFactor }: { existingFactor?: string }) {
  const [setup, enroll, enrolling] = useActionState(enrollMfaAction, {});
  const [result, verify, verifying] = useActionState(verifyMfaAction, {});
  const factor = existingFactor || setup.factorId;
  return (
    <div className="admin-panel">
      <h2>管理者の本人確認</h2>
      <p className="admin-info">
        財務情報を保護するため、管理画面では認証アプリによる確認が必要です。
      </p>
      {!existingFactor && !setup.qrCode && (
        <form action={enroll}>
          <button className="button primary" disabled={enrolling}>
            認証アプリを設定する
          </button>
        </form>
      )}
      {setup.qrCode && setup.secret && (
        <MfaEnrollmentGuide qrCode={setup.qrCode} secret={setup.secret} />
      )}
      {factor && (
        <form action={verify} className="create-form">
          <input type="hidden" name="factorId" value={factor} />
          <label>
            認証コード
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
            />
          </label>
          <button className="button primary" disabled={verifying}>
            本人確認して管理画面へ
          </button>
        </form>
      )}
      {(setup.error || result.error) && (
        <p className="form-error" role="alert">
          {result.error || setup.error}
        </p>
      )}
    </div>
  );
}
