import { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import { cn } from "../lib/cn";

interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  minHeight?: string;
  maxHeight?: string;
  className?: string;
}

const jsonParse = [json()];

export function CodeEditor({
  value,
  onChange,
  readOnly = false,
  minHeight = "220px",
  maxHeight = "600px",
  className,
}: CodeEditorProps) {
  const handleChange = useMemo(
    () => onChange ?? (() => undefined),
    [onChange]
  );

  return (
<div
      className={cn(
        "overflow-hidden rounded-md border border-emerald-500/10 bg-[#0a1912]",
        className
      )}
    >
      <CodeMirror
        value={value}
        height={maxHeight}
        style={{ minHeight, fontSize: "12px" }}
        theme={vscodeDark}
        extensions={jsonParse}
        onChange={handleChange}
        readOnly={readOnly}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: !readOnly,
          highlightActiveLineGutter: !readOnly,
          bracketMatching: true,
          closeBrackets: !readOnly,
          autocompletion: true,
          indentOnInput: true,
        }}
      />
    </div>
  );
}