import type { Character } from "@/types";

export interface FoundationCharacterListProps {
  characters: Character[];
}

export function FoundationCharacterList({ characters }: FoundationCharacterListProps) {
  return (
    <div className="flex flex-col gap-4">
      {characters.map((character) => (
        <div key={character.id} className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
            <span className="font-body-md text-body-md font-medium text-on-surface-variant">
              {character.name}
            </span>
          </div>
          <p className="pl-5 font-body-sm text-body-sm text-muted-text">{character.description}</p>
        </div>
      ))}
    </div>
  );
}