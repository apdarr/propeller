import { useState, useEffect } from "react";
import { Action, ActionPanel, Form, useNavigation, Detail, getPreferenceValues, Toast, showToast } from "@raycast/api";
import fetch from "node-fetch";

interface Preferences {
  defaultVersion: string;
}

interface FormValues {
  query: string;
}

interface SearchResult {
  answer: string;
  sourceLinks: string[];
  isLoading: boolean;
  error: string | null;
}

export default function SearchForm() {
  const { push } = useNavigation();
  
  const handleSubmit = async (values: FormValues) => {
    if (!values.query.trim()) {
      await showToast({ style: Toast.Style.Failure, title: "Please enter a search query" });
      return;
    }
    
    push(<SearchResults query={values.query} />);
  };

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Search" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField 
        id="query" 
        title="Search Query" 
        placeholder="How do I configure OpenID Connect in GitHub?" 
        info="Enter your question about GitHub"
        autoFocus
      />
    </Form>
  );
}

function SearchResults({ query }: { query: string }) {
  const [result, setResult] = useState<SearchResult>({
    answer: "",
    sourceLinks: [],
    isLoading: true,
    error: null
  });
  
  useEffect(() => {
    const fetchResults = async () => {
      try {
        // Get user preferences
        const preferences = getPreferenceValues<Preferences>();
        const version = preferences.defaultVersion || "free-pro-team@latest";
        
        console.log(`Performing search in SearchResults for query: "${query}", version: "${version}"`);

        // Show timeout message if request takes too long
        const timeoutId = setTimeout(() => {
          setResult(prev => ({
            ...prev,
            isLoading: true, // Keep isLoading true to show the message
            error: "Request is taking longer than expected. GitHub API might be under heavy load."
          }));
        }, 10000); // 10 seconds timeout warning
        
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

        // Clear the timeout
        clearTimeout(timeoutId);
        console.log(`API Response Status in SearchResults: ${response.status} ${response.statusText}`);

        if (!response.ok) {
          const errorBody = await response.text();
          console.error("API Error Body in SearchResults:", errorBody);
          if (response.status === 503) {
            throw new Error("GitHub docs API is temporarily unavailable. Please try again later.");
          } else {
            throw new Error(`Failed to fetch from GitHub docs API: ${response.status} ${response.statusText}`);
          }
        }

        // Process the NDJSON response
        const text = await response.text();
        console.log("API Response Text in SearchResults:", text);
        const lines = text.trim().split("\n");
        console.log(`Response split into ${lines.length} lines in SearchResults.`);
        
        // Extract the answer from the response
        let answer = "";
        let sourceLinks: string[] = [];
        let foundAnswer = false;
        let foundSources = false;
        
        for (const line of lines) {
          console.log("Processing line in SearchResults:", line);
          try {
            const data = JSON.parse(line);
            console.log("Parsed data from line in SearchResults:", data);
            
            if (data.chunkType === "MESSAGE_CHUNK" && typeof data.text === 'string') {
              answer += data.text;
              foundAnswer = true;
              console.log("Found MESSAGE_CHUNK segment in SearchResults:", data.text);
            } else if (data.chunkType === "SOURCES" && data.sources) {
              sourceLinks = data.sources.map((source: any) => source.url);
              foundSources = true;
              console.log("Found SOURCES_CHUNK in SearchResults:", sourceLinks);
            } else if (data.type === "answer") { // Keep old logic as a fallback
              answer += data.value;
              foundAnswer = true;
              console.log("Found answer segment (legacy) in SearchResults:", data.value);
            } else if (data.type === "sources") { // Keep old logic as a fallback
              sourceLinks = data.value.map((source: any) => source.url);
              foundSources = true;
              console.log("Found sources (legacy) in SearchResults:", sourceLinks);
            }
          } catch (error) {
            console.error("Error parsing line in SearchResults:", line, error);
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

        console.log("Final extracted answer in SearchResults:", answer);
        console.log("Final extracted sources in SearchResults:", sourceLinks);

        if (!answer && !foundSources && lines.length > 0) {
          console.warn("No answer or sources found, but received data. Raw response in SearchResults:", text);
          setResult({
            answer: "",
            sourceLinks: [],
            isLoading: false,
            error: "No answer or sources found in the API response. The API might have returned an unexpected format or an error message."
          });
          return;
        } else if (!answer && !foundSources) {
          console.warn("No answer or sources found, and response seemed empty or unparsable in SearchResults.");
          setResult({
            answer: "",
            sourceLinks: [],
            isLoading: false,
            error: "No results found. The API response was empty or unparsable."
          });
          return;
        }
        
        setResult({
          answer,
          sourceLinks,
          isLoading: false,
          error: null
        });
      } catch (error) {
        console.error("Search error in SearchResults:", error);
        setResult({
          answer: "",
          sourceLinks: [],
          isLoading: false,
          error: String(error)
        });
      }
    };
    
    fetchResults();
  }, [query]);
  
  // Format the markdown
  let markdown = "# Search Results\n\n";
  
  if (result.isLoading) {
    markdown += "Searching GitHub docs...";
  } else if (result.error) {
    markdown += `## Error\n\n${result.error}`;
  } else if (!result.answer) {
    markdown += "No results found. Try a different query.";
  } else {
    markdown += `## Answer\n\n${result.answer}\n\n`;
    
    if (result.sourceLinks.length > 0) {
      markdown += "## Sources\n\n";
      result.sourceLinks.forEach((link) => {
        markdown += `- [${link}](${link})\n`;
      });
    }
  }
  
  return (
    <Detail
      markdown={markdown}
      isLoading={result.isLoading}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard
            title="Copy Answer"
            content={result.answer}
            shortcut={{ modifiers: ["cmd"], key: "c" }}
          />
          {result.sourceLinks.length > 0 && (
            <Action.OpenInBrowser
              title="Open First Source"
              url={result.sourceLinks[0]}
              shortcut={{ modifiers: ["cmd"], key: "o" }}
            />
          )}
          <Action
            title="New Search"
            shortcut={{ modifiers: ["cmd"], key: "n" }}
            onAction={() => {
              const { pop } = useNavigation();
              pop();
            }}
          />
        </ActionPanel>
      }
    />
  );
}