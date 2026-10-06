"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type Section = "editor" | "notes" | "documents" | "financial" | "workflow";
type SectionState = { dirty: boolean; busy: boolean };
const EditingContext = createContext<{
  sections: Partial<Record<Section, SectionState>>;
  setSection: (section: Section, state: SectionState) => void;
} | null>(null);

export function ReportEditingProvider({ children }: { children: ReactNode }) {
  const [sections, setSections] = useState<
    Partial<Record<Section, SectionState>>
  >({});
  const setSection = useCallback((section: Section, state: SectionState) => {
    setSections((current) =>
      current[section]?.dirty === state.dirty &&
      current[section]?.busy === state.busy
        ? current
        : { ...current, [section]: state },
    );
  }, []);
  const dirty = Object.values(sections).some((state) => state.dirty);
  useEffect(() => {
    if (!dirty) return;
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  return (
    <EditingContext.Provider value={{ sections, setSection }}>
      {children}
    </EditingContext.Provider>
  );
}

export function useReportEditing() {
  const context = useContext(EditingContext);
  if (!context) throw new Error("Report editing context is required");
  return {
    ...context,
    dirty: Object.values(context.sections).some((state) => state.dirty),
    busy: Object.values(context.sections).some((state) => state.busy),
    editorDirty: Boolean(context.sections.editor?.dirty),
    otherBusy: (section: Section) =>
      Object.entries(context.sections).some(
        ([key, state]) => key !== section && state.busy,
      ),
  };
}

export function useReportSection(
  section: Section,
  dirty: boolean,
  busy: boolean,
) {
  const editing = useReportEditing();
  const { setSection } = editing;
  useEffect(() => {
    setSection(section, { dirty, busy });
    return () => setSection(section, { dirty: false, busy: false });
  }, [section, dirty, busy, setSection]);
  return editing;
}
