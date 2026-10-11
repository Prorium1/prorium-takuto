"use client";
import { useActionState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { addPreparedEventAction } from "@/app/event-actions";

export function EventPreparationForm({
  id,
  revision,
}: {
  id: string;
  revision: number;
}) {
  const [state, action, pending] = useActionState(addPreparedEventAction, {});
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="revision" value={revision} />
      <button className="button primary" disabled={pending}>
        {pending ? (
          <>
            <LoaderCircle size={16} className="spinner" />
            追加しています…
          </>
        ) : (
          <>
            大会情報と動画を下書きに追加
            <ArrowRight size={16} />
          </>
        )}
      </button>
      {state.error && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
