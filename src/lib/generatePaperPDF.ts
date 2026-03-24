import jsPDF from "jspdf";

interface PaperOptions {
  title: string;
  institution: string;
  subject: string;
  duration: string;
  totalMarks: string;
  questions: {
    question: string;
    options: string[];
    correct_answer: number;
  }[];
}

export function generateQuestionPaperPDF(opts: PaperOptions) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = 20;

  const checkPage = (needed: number) => {
    if (y + needed > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      y = 20;
    }
  };

  // Header
  if (opts.institution) {
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(opts.institution, pageWidth / 2, y, { align: "center" });
    y += 8;
  }

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(opts.title || "Question Paper", pageWidth / 2, y, { align: "center" });
  y += 8;

  // Meta line
  const metaParts: string[] = [];
  if (opts.subject) metaParts.push(`Subject: ${opts.subject}`);
  if (opts.duration) metaParts.push(`Duration: ${opts.duration}`);
  if (opts.totalMarks) metaParts.push(`Total Marks: ${opts.totalMarks}`);

  if (metaParts.length > 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(metaParts.join("   |   "), pageWidth / 2, y, { align: "center" });
    y += 6;
  }

  // Divider
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  // Instructions
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Instructions:", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const instructions = [
    "1. All questions are compulsory.",
    "2. Each question carries equal marks.",
    "3. Choose the most appropriate answer for each question.",
    "4. No negative marking.",
  ];
  instructions.forEach((line) => {
    doc.text(line, margin + 4, y);
    y += 4.5;
  });
  y += 4;

  // Thin divider
  doc.setLineWidth(0.2);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // Questions
  doc.setFontSize(10);
  opts.questions.forEach((q, i) => {
    checkPage(35);

    // Question text (wrap)
    doc.setFont("helvetica", "bold");
    const qText = `Q${i + 1}. ${q.question}`;
    const qLines = doc.splitTextToSize(qText, contentWidth);
    qLines.forEach((line: string) => {
      checkPage(6);
      doc.text(line, margin, y);
      y += 5;
    });

    y += 2;

    // Options in 2-column layout
    doc.setFont("helvetica", "normal");
    const colWidth = (contentWidth - 8) / 2;
    q.options.forEach((opt, oi) => {
      const col = oi % 2;
      if (col === 0) checkPage(6);
      const xPos = margin + 4 + col * (colWidth + 8);
      const optText = `(${String.fromCharCode(65 + oi)}) ${opt}`;
      const optLines = doc.splitTextToSize(optText, colWidth - 4);
      optLines.forEach((line: string, li: number) => {
        doc.text(line, xPos, y + li * 4.5);
      });
      if (col === 1) y += Math.max(optLines.length, 1) * 4.5 + 1;
    });
    // Handle odd number of options
    if (q.options.length % 2 !== 0) y += 5;

    y += 4;
  });

  // Answer key on last page
  doc.addPage();
  y = 20;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Answer Key", pageWidth / 2, y, { align: "center" });
  y += 10;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  // Answer key in grid
  const cols = 5;
  const cellW = contentWidth / cols;
  opts.questions.forEach((q, i) => {
    const col = i % cols;
    if (col === 0 && i > 0) y += 7;
    if (col === 0) checkPage(8);
    const x = margin + col * cellW;
    doc.setFont("helvetica", "bold");
    doc.text(`${i + 1}.`, x, y);
    doc.setFont("helvetica", "normal");
    doc.text(` ${String.fromCharCode(65 + q.correct_answer)}`, x + 6, y);
  });

  // Save
  const fileName = `${opts.title || "Question_Paper"}.pdf`.replace(/\s+/g, "_");
  doc.save(fileName);
}
