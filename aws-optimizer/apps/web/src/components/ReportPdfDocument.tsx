/**
 * Report PDF Document
 *
 * Converts markdown report content to a PDF document using @react-pdf/renderer.
 * Parses markdown syntax and renders it as PDF-compatible components.
 */

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    lineHeight: 1.5,
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: "#3b82f6",
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: "#64748b",
  },
  section: {
    marginBottom: 12,
  },
  h1: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1e293b",
    marginTop: 16,
    marginBottom: 8,
  },
  h2: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#334155",
    marginTop: 12,
    marginBottom: 6,
  },
  h3: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#475569",
    marginTop: 10,
    marginBottom: 4,
  },
  h4: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#64748b",
    marginTop: 8,
    marginBottom: 4,
  },
  paragraph: {
    fontSize: 10,
    color: "#374151",
    marginBottom: 6,
    textAlign: "justify",
  },
  bold: {
    fontWeight: "bold",
  },
  italic: {
    fontStyle: "italic",
  },
  listItem: {
    flexDirection: "row",
    marginBottom: 3,
    paddingLeft: 10,
  },
  listBullet: {
    width: 15,
    fontSize: 10,
    color: "#6b7280",
  },
  listContent: {
    flex: 1,
    fontSize: 10,
    color: "#374151",
  },
  orderedListNumber: {
    width: 20,
    fontSize: 10,
    color: "#6b7280",
  },
  codeBlock: {
    backgroundColor: "#f1f5f9",
    padding: 10,
    marginVertical: 8,
    borderRadius: 4,
    fontFamily: "Courier",
    fontSize: 9,
  },
  inlineCode: {
    backgroundColor: "#f1f5f9",
    fontFamily: "Courier",
    fontSize: 9,
    paddingHorizontal: 2,
  },
  table: {
    marginVertical: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    borderBottomWidth: 2,
    borderBottomColor: "#cbd5e1",
  },
  tableCell: {
    flex: 1,
    padding: 6,
    fontSize: 9,
    color: "#374151",
  },
  tableHeaderCell: {
    flex: 1,
    padding: 6,
    fontSize: 9,
    fontWeight: "bold",
    color: "#1e293b",
  },
  hr: {
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    marginVertical: 12,
  },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: "#3b82f6",
    paddingLeft: 10,
    marginVertical: 8,
    fontStyle: "italic",
    color: "#64748b",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 8,
    color: "#94a3b8",
  },
  pageNumber: {
    position: "absolute",
    bottom: 30,
    right: 40,
    fontSize: 8,
    color: "#94a3b8",
  },
});

interface ReportPdfDocumentProps {
  title: string;
  content: string;
  reportType: string;
  generatedAt?: number;
}

interface ParsedElement {
  type: "h1" | "h2" | "h3" | "h4" | "paragraph" | "list" | "ordered-list" | "code-block" | "table" | "hr" | "blockquote";
  content: string;
  items?: string[];
  rows?: string[][];
}

/**
 * Parse inline markdown formatting (bold, italic, code)
 */
function parseInlineFormatting(text: string): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  let remaining = text;
  let keyIndex = 0;

  while (remaining.length > 0) {
    // Check for bold+italic (***text***)
    const boldItalicMatch = remaining.match(/^\*\*\*(.+?)\*\*\*/);
    if (boldItalicMatch) {
      elements.push(
        <Text key={keyIndex++} style={[styles.bold, styles.italic]}>
          {boldItalicMatch[1]}
        </Text>
      );
      remaining = remaining.slice(boldItalicMatch[0].length);
      continue;
    }

    // Check for bold (**text** or __text__)
    const boldMatch = remaining.match(/^(\*\*|__)(.+?)(\1)/);
    if (boldMatch) {
      elements.push(
        <Text key={keyIndex++} style={styles.bold}>
          {boldMatch[2]}
        </Text>
      );
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Check for italic (*text* or _text_)
    const italicMatch = remaining.match(/^([*_])(.+?)\1/);
    if (italicMatch) {
      elements.push(
        <Text key={keyIndex++} style={styles.italic}>
          {italicMatch[2]}
        </Text>
      );
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // Check for inline code (`code`)
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      elements.push(
        <Text key={keyIndex++} style={styles.inlineCode}>
          {codeMatch[1]}
        </Text>
      );
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // Find the next special character
    const nextSpecial = remaining.search(/[*_`]/);
    if (nextSpecial === -1) {
      // No more special characters, add the rest as plain text
      elements.push(<Text key={keyIndex++}>{remaining}</Text>);
      break;
    } else if (nextSpecial === 0) {
      // Special character at start but didn't match any pattern, treat as plain text
      elements.push(<Text key={keyIndex++}>{remaining[0]}</Text>);
      remaining = remaining.slice(1);
    } else {
      // Add plain text up to the special character
      elements.push(<Text key={keyIndex++}>{remaining.slice(0, nextSpecial)}</Text>);
      remaining = remaining.slice(nextSpecial);
    }
  }

  return elements;
}

/**
 * Parse markdown content into structured elements
 */
function parseMarkdown(content: string): ParsedElement[] {
  const elements: ParsedElement[] = [];
  const lines = content.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Skip empty lines
    if (!trimmedLine) {
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(---+|\*\*\*+|___+)$/.test(trimmedLine)) {
      elements.push({ type: "hr", content: "" });
      i++;
      continue;
    }

    // Headers
    const h1Match = trimmedLine.match(/^#\s+(.+)$/);
    if (h1Match) {
      elements.push({ type: "h1", content: h1Match[1] });
      i++;
      continue;
    }

    const h2Match = trimmedLine.match(/^##\s+(.+)$/);
    if (h2Match) {
      elements.push({ type: "h2", content: h2Match[1] });
      i++;
      continue;
    }

    const h3Match = trimmedLine.match(/^###\s+(.+)$/);
    if (h3Match) {
      elements.push({ type: "h3", content: h3Match[1] });
      i++;
      continue;
    }

    const h4Match = trimmedLine.match(/^####\s+(.+)$/);
    if (h4Match) {
      elements.push({ type: "h4", content: h4Match[1] });
      i++;
      continue;
    }

    // Code block
    if (trimmedLine.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // Skip closing ```
      elements.push({ type: "code-block", content: codeLines.join("\n") });
      continue;
    }

    // Table
    if (trimmedLine.includes("|") && i + 1 < lines.length && lines[i + 1].includes("|-")) {
      const tableRows: string[][] = [];
      
      // Parse header row
      const headerCells = trimmedLine
        .split("|")
        .map((cell) => cell.trim())
        .filter((cell) => cell.length > 0);
      tableRows.push(headerCells);
      
      i += 2; // Skip header and separator
      
      // Parse data rows
      while (i < lines.length && lines[i].includes("|")) {
        const cells = lines[i]
          .split("|")
          .map((cell) => cell.trim())
          .filter((cell) => cell.length > 0);
        if (cells.length > 0) {
          tableRows.push(cells);
        }
        i++;
      }
      
      elements.push({ type: "table", content: "", rows: tableRows });
      continue;
    }

    // Blockquote
    if (trimmedLine.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s*/, ""));
        i++;
      }
      elements.push({ type: "blockquote", content: quoteLines.join(" ") });
      continue;
    }

    // Unordered list
    if (/^[-*+]\s+/.test(trimmedLine)) {
      const listItems: string[] = [];
      while (i < lines.length && /^[-*+]\s+/.test(lines[i].trim())) {
        listItems.push(lines[i].trim().replace(/^[-*+]\s+/, ""));
        i++;
      }
      elements.push({ type: "list", content: "", items: listItems });
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(trimmedLine)) {
      const listItems: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        listItems.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i++;
      }
      elements.push({ type: "ordered-list", content: "", items: listItems });
      continue;
    }

    // Regular paragraph
    const paragraphLines: string[] = [trimmedLine];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith("#") &&
      !lines[i].trim().startsWith("```") &&
      !lines[i].trim().startsWith(">") &&
      !/^[-*+]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim()) &&
      !lines[i].includes("|") &&
      !/^(---+|\*\*\*+|___+)$/.test(lines[i].trim())
    ) {
      paragraphLines.push(lines[i].trim());
      i++;
    }
    elements.push({ type: "paragraph", content: paragraphLines.join(" ") });
  }

  return elements;
}

/**
 * Render a parsed element to PDF components
 */
function renderElement(element: ParsedElement, index: number): React.ReactNode {
  switch (element.type) {
    case "h1":
      return (
        <Text key={index} style={styles.h1}>
          {element.content}
        </Text>
      );
    case "h2":
      return (
        <Text key={index} style={styles.h2}>
          {element.content}
        </Text>
      );
    case "h3":
      return (
        <Text key={index} style={styles.h3}>
          {element.content}
        </Text>
      );
    case "h4":
      return (
        <Text key={index} style={styles.h4}>
          {element.content}
        </Text>
      );
    case "paragraph":
      return (
        <Text key={index} style={styles.paragraph}>
          {parseInlineFormatting(element.content)}
        </Text>
      );
    case "list":
      return (
        <View key={index} style={styles.section}>
          {element.items?.map((item, itemIndex) => (
            <View key={itemIndex} style={styles.listItem}>
              <Text style={styles.listBullet}>•</Text>
              <Text style={styles.listContent}>{parseInlineFormatting(item)}</Text>
            </View>
          ))}
        </View>
      );
    case "ordered-list":
      return (
        <View key={index} style={styles.section}>
          {element.items?.map((item, itemIndex) => (
            <View key={itemIndex} style={styles.listItem}>
              <Text style={styles.orderedListNumber}>{itemIndex + 1}.</Text>
              <Text style={styles.listContent}>{parseInlineFormatting(item)}</Text>
            </View>
          ))}
        </View>
      );
    case "code-block":
      return (
        <View key={index} style={styles.codeBlock}>
          <Text>{element.content}</Text>
        </View>
      );
    case "table":
      if (!element.rows || element.rows.length === 0) return null;
      return (
        <View key={index} style={styles.table}>
          {element.rows.map((row, rowIndex) => (
            <View
              key={rowIndex}
              style={rowIndex === 0 ? styles.tableHeaderRow : styles.tableRow}
            >
              {row.map((cell, cellIndex) => (
                <Text
                  key={cellIndex}
                  style={rowIndex === 0 ? styles.tableHeaderCell : styles.tableCell}
                >
                  {cell}
                </Text>
              ))}
            </View>
          ))}
        </View>
      );
    case "hr":
      return <View key={index} style={styles.hr} />;
    case "blockquote":
      return (
        <View key={index} style={styles.blockquote}>
          <Text>{parseInlineFormatting(element.content)}</Text>
        </View>
      );
    default:
      return null;
  }
}

/**
 * Format report type for display
 */
function formatReportType(type: string): string {
  const typeMap: Record<string, string> = {
    summary: "Summary Report",
    detailed: "Detailed Analysis",
    recommendation: "Recommendations Report",
    comparison: "Comparison Report",
  };
  return typeMap[type] || type;
}

/**
 * Main PDF Document component
 */
export function ReportPdfDocument({
  title,
  content,
  reportType,
  generatedAt,
}: ReportPdfDocumentProps) {
  const elements = parseMarkdown(content);
  const generatedDate = generatedAt
    ? new Date(generatedAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>
            {formatReportType(reportType)} • Generated on {generatedDate}
          </Text>
        </View>

        {/* Content */}
        {elements.map((element, index) => renderElement(element, index))}

        {/* Footer */}
        <Text style={styles.footer}>AWS Cost Optimizer Report</Text>
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}

export default ReportPdfDocument;
