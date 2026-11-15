import { useContext } from "react";
import { RichText } from "../../../design-system/index.ts";
import { Ctx } from "./workspace.tsx";

/** RichText that also underlines the student's glossary terms. Plain RichText without a workspace. */
export default function GlossaryText({ text, className }: { text: string; className?: string }) {
  const v = useContext(Ctx);
  return <RichText text={text} className={className} split={v?.splitter} />;
}
