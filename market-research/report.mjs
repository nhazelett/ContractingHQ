import { today, safeURL, reportSections } from "./core.mjs?v=20260909-3";
export function buildWordDocument(project, d) {
  const { Document, Paragraph, TextRun, HeadingLevel, ExternalHyperlink } = d;
  const sections = reportSections(project);
  const paragraphs = [
    new Paragraph({
      text: "DRAFT MARKET RESEARCH REPORT",
      heading: HeadingLevel.TITLE,
    }),
    new Paragraph({
      text: project.brief.title || "Untitled requirement",
      heading: HeadingLevel.HEADING_1,
    }),
    new Paragraph({ text: `Prepared ${today()}` }),
  ];
  for (const s of sections) {
    paragraphs.push(
      new Paragraph({
        text: s.title,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 140 },
        keepNext: true,
      }),
    );
    for (const block of s.lines)
      for (const line of block.split("\n"))
        paragraphs.push(
          new Paragraph({
            children: [new TextRun(line)],
            spacing: { after: 100 },
          }),
        );
  }
  if (project.evidence.some((e) => safeURL(e.url))) {
    paragraphs.push(
      new Paragraph({ text: "Source links", heading: HeadingLevel.HEADING_1 }),
    );
    for (const e of project.evidence)
      if (safeURL(e.url))
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun(`[${e.citation}] `),
              new ExternalHyperlink({
                link: safeURL(e.url),
                children: [new TextRun({ text: e.title, style: "Hyperlink" })],
              }),
            ],
            spacing: { after: 100 },
          }),
        );
  }
  return new Document({
    creator: "KTHQ Market Research Desk",
    title: project.brief.title || "Market research draft",
    styles: {
      default: {
        document: {
          run: { font: "Arial", size: 21 },
          paragraph: { spacing: { line: 276 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
          },
        },
        children: paragraphs,
      },
    ],
  });
}
