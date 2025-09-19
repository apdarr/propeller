import { showToast, Toast, getPreferenceValues, Clipboard, getSelectedText, open, showHUD } from "@raycast/api";
import fetch from "node-fetch";

interface Preferences {
  defaultVersion: string;
}

export default async function command() {
  try {
    // Get the selected text to use as the search query
    let query = "";
    try {
      query = await getSelectedText();
    } catch (error) {
      console.error("Error getting selected text:", error);
      // Silently fail and move to the clipboard fallback
    }
    
    // If no text is selected, use the Clipboard content as a fallback
    if (!query) {
      try {
        const clipboardText = await Clipboard.readText();
        
        if (clipboardText) {
          query = clipboardText;
          await showToast({
            style: Toast.Style.Success,
            title: "Using clipboard content as query",
          });
        } else {
          await showToast({
            style: Toast.Style.Failure,
            title: "No text available",
            message: "Please select or copy text to search in GitHub docs"
          });
          return;
        }
      } catch (error) {
        console.error("Error reading clipboard:", error);
        await showToast({
          style: Toast.Style.Failure,
          title: "Could not access clipboard",
          message: "Please try using the Search GitHub Docs command instead"
        });
        return;
      }
    }
    
    await performSearch(query);
    
  } catch (error) {
    console.error("Command error:", error);
    await showToast({
      style: Toast.Style.Failure,
      title: "Error",
      message: String(error)
    });
  }
}

async function performSearch(query: string) {
  // Get user preferences
  const preferences = getPreferenceValues<Preferences>();
  const version = preferences.defaultVersion || "free-pro-team@latest";
  
  // Show loading toast
  await showToast({
    style: Toast.Style.Animated,
    title: "Searching GitHub docs",
    message: `Query: ${query}`,
  });

  try {
    console.log(`Performing search for query: "${query}", version: "${version}"`);
    // Prepare the request to GitHub AI search endpoint
    const response = await fetch("https://docs.github.com/api/ai-search/v1", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/x-ndjson, */*", // More specific accept header
        "Accept-Encoding": "gzip, deflate, br",
        "Accept-Language": "en-US,en;q=0.9",
        "Origin": "https://docs.github.com",
        "Referer": "https://docs.github.com/?search-overlay-open=true",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36"
      },
      body: JSON.stringify({
        query,
        version
      })
    });

    console.log(`API Response Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("API Error Body:", errorBody);
      if (response.status === 503) {
        throw new Error("GitHub docs API is temporarily unavailable. Please try again later.");
      } else {
        throw new Error(`Failed to fetch from GitHub docs API: ${response.status} ${response.statusText}`);
      }
    }

    // Process the NDJSON response
    const text = await response.text();
    console.log("API Response Text:", text);
    const lines = text.trim().split("\n");
    console.log(`Response split into ${lines.length} lines.`);
    
    // Extract the answer from the response
    let answer = "";
    let sourceLinks: string[] = [];
    let foundAnswer = false;
    let foundSources = false;
    let lastChunk = ""; // Track the last chunk to avoid immediate duplicates
    
    for (const line of lines) {
      console.log("Processing line:", line);
      try {
        const data = JSON.parse(line);
        console.log("Parsed data from line:", data);
        
        if (data.chunkType === "MESSAGE_CHUNK" && typeof data.text === 'string') {
          // Only skip if this chunk is exactly the same as the previous one
          if (data.text !== lastChunk) {
            answer += data.text;
            lastChunk = data.text;
            foundAnswer = true;
            console.log("Found MESSAGE_CHUNK segment:", data.text);
          } else {
            console.log("Skipping immediate duplicate MESSAGE_CHUNK:", data.text);
          }
        } else if (data.chunkType === "SOURCES" && data.sources) {
          sourceLinks = data.sources.map((source: any) => source.url);
          foundSources = true;
          console.log("Found SOURCES_CHUNK:", sourceLinks);
        } else if (data.type === "answer") { // Keep old logic as a fallback, just in case
          if (data.value !== lastChunk) {
            answer += data.value;
            lastChunk = data.value;
            foundAnswer = true;
            console.log("Found answer segment (legacy):", data.value);
          } else {
            console.log("Skipping immediate duplicate answer segment (legacy):", data.value);
          }
        } else if (data.type === "sources") { // Keep old logic as a fallback
          sourceLinks = data.value.map((source: any) => source.url);
          foundSources = true;
          console.log("Found sources (legacy):", sourceLinks);
        }
      } catch (error) {
        console.error("Error parsing line:", line, error);
      }
    }

    if (!foundAnswer && lines.length > 0 && lines[0].startsWith("{")) {
      // Attempt to parse the first line if it looks like a single JSON object (e.g. an error object)
      try {
        const singleJsonError = JSON.parse(lines[0]);
        if (singleJsonError.message) {
          throw new Error(`API returned an error: ${singleJsonError.message}`);
        }
      } catch (e) {
        // Not a single JSON error, or already handled
      }
    }
    
    console.log("Final extracted answer:", answer);
    console.log("Final extracted sources:", sourceLinks);

    if (!answer && !foundSources && lines.length > 0) {
      console.warn("No answer or sources found, but received data. Raw response:", text);
    } else if (!answer && !foundSources) {
      console.warn("No answer or sources found, and response seemed empty or unparsable.");
      // Potentially show a "No results found" message here if appropriate
    }

    if (sourceLinks.length > 0) {
      answer += "\n\nSources:\n" + sourceLinks.map((link: string) => `- ${link}`).join("\n");
    }

    // Copy to clipboard and show success message
    await Clipboard.copy(answer);
    
    await showToast({
      style: Toast.Style.Success,
      title: "Answer copied to clipboard",
      message: "Use ⌘+V to paste",
      primaryAction: {
        title: "View Sources",
        onAction: async () => {
          if (sourceLinks.length > 0) {
            await open(sourceLinks[0]);
          }
        },
      },
    });
  } catch (error) {
    console.error("Search error:", error);
    await showToast({
      style: Toast.Style.Failure,
      title: "Search failed",
      message: String(error),
    });
  }
}