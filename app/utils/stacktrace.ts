/**
 * Cleans server runner proxy URLs from stack traces to show relative paths instead
 */
export function cleanStackTrace(stackTrace: string): string {
  // Function to clean a single URL
  const cleanUrl = (url: string): string => {
    // Match server runner proxy URLs like http://localhost:8080/preview/:id/:port/path
    const serverRegex = /^https?:\/\/[^/]+\/preview\/[^/]+\/\d+\/(.*?)$/;
    const serverMatch = url.match(serverRegex);
    if (serverMatch) {
      return serverMatch[1];
    }

    return url;
  };

  // Split the stack trace into lines and process each line
  return stackTrace
    .split('\n')
    .map((line) => {
      let cleaned = line;
      cleaned = cleaned.replace(/(https?:\/\/[^\s)]+)/g, (match) => cleanUrl(match));
      return cleaned;
    })
    .join('\n');
}
