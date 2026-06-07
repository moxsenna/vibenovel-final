import type { IntakeMessage } from "@/types";
import { Icon } from "@/components/ui";

function renderContent(content: string) {
  const parts = content.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-on-background">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.includes("\n\n")) {
      return part.split("\n\n").map((paragraph, j) => (
        <span key={`${i}-${j}`}>
          {j > 0 && (
            <>
              <br />
              <br />
            </>
          )}
          {paragraph}
        </span>
      ));
    }
    return <span key={i}>{part}</span>;
  });
}

export interface ChatBubbleProps {
  message: IntakeMessage;
}

export function ChatBubble({ message }: ChatBubbleProps) {
  const isAgent = message.role === "agent";

  return (
    <div className={`flex items-start gap-4 ${isAgent ? "" : "flex-row-reverse"}`}>
      <div
        className={[
          "mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full",
          isAgent ? "bg-primary-soft" : "bg-surface-variant",
        ].join(" ")}
      >
        <Icon
          name={isAgent ? "auto_awesome" : "person"}
          size={16}
          filled={isAgent}
          className={isAgent ? "text-primary" : "text-on-surface"}
        />
      </div>
      <div
        className={[
          "max-w-[85%] p-4 font-body-md text-body-md leading-relaxed",
          isAgent
            ? "rounded-2xl rounded-tl-sm border border-border bg-surface-soft text-on-background"
            : "rounded-2xl rounded-tr-sm bg-primary-soft text-primary-dark shadow-sm",
        ].join(" ")}
      >
        {renderContent(message.content)}
      </div>
    </div>
  );
}