export type ArticleBlock =
  | { type: "heading"; id: string; text: string }
  | { type: "quote"; text: string; attribution: string | null }
  | { type: "paragraph"; text: string };

export function parseArticleContent(content: string): ArticleBlock[] {
  const blocks: ArticleBlock[] = [];
  const paragraphs = content.split(/\n\s*\n/);
  for (const raw of paragraphs) {
    const text = raw.trim();
    if (!text) continue;
    if (text.startsWith("## ")) {
      const heading = text.slice(3).trim();
      blocks.push({
        type: "heading",
        id: heading
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, ""),
        text: heading,
      });
    } else if (text.startsWith("> ")) {
      const lines = text.split("\n");
      const quoteLines = lines.filter((l) => l.startsWith("> ")).map((l) => l.slice(2));
      const attributionLine = lines.find((l) => l.startsWith("— ") || l.startsWith("- "));
      blocks.push({
        type: "quote",
        text: quoteLines.join(" "),
        attribution: attributionLine ? attributionLine.replace(/^[—-]\s*/, "") : null,
      });
    } else {
      blocks.push({ type: "paragraph", text });
    }
  }
  return blocks;
}

export function NewsArticleBody({ content }: { content: string }) {
  const blocks = parseArticleContent(content);
  return (
    <div className="space-y-4">
      {blocks.map((block, i) => {
        if (block.type === "heading") {
          return (
            <h2 key={i} id={block.id} className="pt-2 text-xl font-black text-white scroll-mt-24">
              {block.text}
            </h2>
          );
        }
        if (block.type === "quote") {
          return (
            <blockquote
              key={i}
              className="rounded-2xl border-l-4 border-primary bg-[#151225] p-4"
            >
              <span className="text-3xl leading-none text-primary/60">&ldquo;</span>
              <p className="-mt-3 text-base italic leading-relaxed text-white/90">{block.text}</p>
              {block.attribution ? (
                <p className="mt-2 text-sm font-semibold text-muted-foreground">— {block.attribution}</p>
              ) : null}
            </blockquote>
          );
        }
        return (
          <p key={i} className="text-[15px] leading-[1.75] text-white/85">
            {block.text}
          </p>
        );
      })}
    </div>
  );
}
