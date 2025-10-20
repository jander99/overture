/**
 * Output formatters for static analysis results
 */

/**
 * Format results as JSON
 */
function formatJSON(results) {
  return JSON.stringify(results, null, 2);
}

/**
 * Format results as Markdown
 */
function formatMarkdown(results) {
  let output = '# Static Analysis Report\n\n';

  for (const result of results) {
    output += `## ${result.file}\n\n`;
    output += `- Lines of Code: ${result.lines_of_code}\n`;
    output += `- Cyclomatic Complexity: ${result.cyclomatic_complexity}\n\n`;

    if (result.issues && result.issues.length > 0) {
      output += '### Issues\n\n';
      for (const issue of result.issues) {
        output += `- **${issue.severity}**: ${issue.message} (Line ${issue.line})\n`;
      }
      output += '\n';
    }
  }

  return output;
}

/**
 * Format results as plain text
 */
function formatText(results) {
  let output = 'Static Analysis Report\n';
  output += '='.repeat(50) + '\n\n';

  for (const result of results) {
    output += `File: ${result.file}\n`;
    output += `  LOC: ${result.lines_of_code}\n`;
    output += `  Complexity: ${result.cyclomatic_complexity}\n`;

    if (result.issues && result.issues.length > 0) {
      output += `  Issues: ${result.issues.length}\n`;
    }
    output += '\n';
  }

  return output;
}

module.exports = {
  formatJSON,
  formatMarkdown,
  formatText
};
