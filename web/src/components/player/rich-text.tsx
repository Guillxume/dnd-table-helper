import { Fragment } from "react";

/**
 * Affiche les textes du moteur de règles, écrits pour Discord : **gras**, lignes,
 * puces « • » ou « - ». Aucun HTML n'est interprété : seulement ces marques.
 */
export function RichText({ text, className }: { text: string; className?: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className={className}>
      {blocks.map((block, blockIndex) => (
        <p key={blockIndex} className="mb-2 last:mb-0">
          {block.split("\n").map((line, lineIndex, lines) => (
            <Fragment key={lineIndex}>
              <Line text={line} />
              {lineIndex < lines.length - 1 ? <br /> : null}
            </Fragment>
          ))}
        </p>
      ))}
    </div>
  );
}

function Line({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, index) =>
        part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
          <strong key={index} className="font-semibold text-foreground">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  );
}
