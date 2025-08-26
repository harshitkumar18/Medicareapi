const readline = require("readline");
const fetch = require("node-fetch");

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Classes for API interaction
class Filters {
  constructor(
    sources = null,
    yearStart = null,
    yearEnd = null,
    onlyHighQuality = false,
    articleTypes = null
  ) {
    this.sources = sources || [
      "scientificArticles",
      "internationalHealthGuidelines",
      "medicineGuidelines",
      "healthline",
      "books",
    ];

    this.year_start = yearStart;
    this.year_end = yearEnd;
    this.only_high_quality = onlyHighQuality;

    this.article_types = articleTypes || [
      "metaAnalysis",
      "reviews",
      "clinicalTrials",
      "other",
    ];
  }
}

class Settings {
  constructor(language = "English", filters = null, modelType = "standard") {
    this.language = language;
    this.filters = filters || new Filters();
    this.model_type = modelType;
  }
}

class MediSearchClient {
  constructor(apiKey, baseUrl = "https://api.backend.medisearch.io") {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
    this.sseEndpoint = `${this.baseUrl}/sse/medichat`;
  }

  async sendQuestion(question, settings) {
    try {
      // Generate conversation ID
      const id = Array(32)
        .fill(0)
        .map(() => Math.floor(Math.random() * 36).toString(36))
        .join("");

      // Create payload
      const payload = {
        event: "user_message",
        conversation: [question],
        key: this.apiKey,
        id: id,
        settings: settings,
      };

      console.log("Connecting to MediSearch API...");

      // Make the request
      const response = await fetch(this.sseEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          Connection: "keep-alive",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Connection failed: ${response.status} - ${errorText}`);
      }

      console.log("Connected. Waiting for response...");

      // Process the stream - modified to use response.body directly
      const stream = response.body;
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      stream.on("data", (chunk) => {
        const text = decoder.decode(chunk);
        buffer += text;

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine.startsWith("data: ")) {
            try {
              const content = trimmedLine.substring(6);
              const message = JSON.parse(content);

              if (message.event === "llm_response") {
                // Clear line and update
                process.stdout.write("\r\x1b[K");
                process.stdout.write(message.data || "");
              } else if (message.event === "articles") {
                console.log("\n\nSources:");
                const articles = message.data || [];

                if (articles.length === 0) {
                  console.log("No sources found.");
                } else {
                  articles.forEach((article, index) => {
                    console.log(`${index + 1}. ${article.title}`);

                    if (article.authors && article.authors.length > 0) {
                      console.log(`   Authors: ${article.authors.join(", ")}`);
                    }

                    if (article.publication_date) {
                      console.log(`   Published: ${article.publication_date}`);
                    }

                    if (article.journal) {
                      console.log(`   Journal: ${article.journal}`);
                    }

                    console.log("");
                  });
                }
              } else if (message.event === "error") {
                console.error(`\nError: ${message.data || "unknown_error"}`);
              }
            } catch (error) {
              console.error("Error processing event:", error);
            }
          }
        }
      });

      stream.on("end", () => {
        console.log("\nStream complete");
      });

      stream.on("error", (error) => {
        console.error("Stream error:", error);
      });
    } catch (error) {
      console.error("Error:", error.message);
    }
  }
}

// Available languages
const LANGUAGES = [
  "English",
  "Spanish",
  "French",
  "German",
  "Italian",
  "Portuguese",
  "Russian",
  "Chinese",
  "Japanese",
];

// Available models
const MODELS = ["standard", "pro"];

// Available sources
const SOURCES = {
  1: "scientificArticles",
  2: "internationalHealthGuidelines",
  3: "medicineGuidelines",
  4: "healthline",
  5: "books",
};

// Available article types
const ARTICLE_TYPES = {
  1: "metaAnalysis",
  2: "reviews",
  3: "clinicalTrials",
  4: "other",
};

// Interactive CLI
async function run() {
  console.log("===== MediSearch API Client =====\n");

  // Get health question
  rl.question("Paste your health question:\n", (question) => {
    if (!question.trim()) {
      console.log("Question cannot be empty. Exiting.");
      rl.close();
      return;
    }

    // Get API key
    rl.question(
      "\nPaste your API key (visit https://medisearch.io/developers to get one):\n",
      (apiKey) => {
        if (!apiKey.trim()) {
          console.log("API key is required. Exiting.");
          rl.close();
          return;
        }

        // Create client
        const client = new MediSearchClient(apiKey);

        // Language selection
        console.log("\nSelect language:");
        LANGUAGES.forEach((lang, index) => {
          console.log(`${index + 1}. ${lang}`);
        });

        rl.question("Enter language choice (number): ", (langChoice) => {
          const languageIndex = parseInt(langChoice) - 1;
          const language =
            languageIndex >= 0 && languageIndex < LANGUAGES.length
              ? LANGUAGES[languageIndex]
              : "English";

          // Model selection
          console.log("\nSelect model:");
          console.log("1. Standard");
          console.log("2. Pro");

          rl.question("Enter model choice (1-2): ", (modelChoice) => {
            const modelType = modelChoice === "2" ? "pro" : "standard";

            // Filter data
            console.log("\nSelect sources (comma-separated numbers):");
            Object.entries(SOURCES).forEach(([key, value]) => {
              console.log(`${key}. ${value}`);
            });
            console.log("Leave empty for all sources");

            rl.question("Enter sources: ", (sourcesInput) => {
              let selectedSources = null;

              if (sourcesInput.trim()) {
                const sourceNumbers = sourcesInput
                  .split(",")
                  .map((n) => n.trim());
                selectedSources = sourceNumbers
                  .filter((n) => SOURCES[n])
                  .map((n) => SOURCES[n]);

                if (selectedSources.length === 0) {
                  selectedSources = null; // Use default if invalid selection
                }
              }

              // Article types (only if scientificArticles is selected)
              const askArticleTypes =
                !selectedSources ||
                selectedSources.includes("scientificArticles");

              if (askArticleTypes) {
                console.log(
                  "\nSelect article types (comma-separated numbers):"
                );
                Object.entries(ARTICLE_TYPES).forEach(([key, value]) => {
                  console.log(`${key}. ${value}`);
                });
                console.log("Leave empty for all types");

                rl.question("Enter article types: ", (typesInput) => {
                  let selectedTypes = null;

                  if (typesInput.trim()) {
                    const typeNumbers = typesInput
                      .split(",")
                      .map((n) => n.trim());
                    selectedTypes = typeNumbers
                      .filter((n) => ARTICLE_TYPES[n])
                      .map((n) => ARTICLE_TYPES[n]);

                    if (selectedTypes.length === 0) {
                      selectedTypes = null; // Use default if invalid selection
                    }
                  }

                  // Create settings
                  const filters = new Filters(
                    selectedSources,
                    null,
                    null,
                    false,
                    selectedTypes
                  );
                  const settings = new Settings(language, filters, modelType);

                  console.log("\nSending request...\n");

                  // Send request
                  client
                    .sendQuestion(question, settings)
                    .finally(() => rl.close());
                });
              } else {
                // Create settings without asking for article types
                const filters = new Filters(selectedSources);
                const settings = new Settings(language, filters, modelType);

                console.log("\nSending request...\n");

                // Send request
                client
                  .sendQuestion(question, settings)
                  .finally(() => rl.close());
              }
            });
          });
        });
      }
    );
  });
}

// Run the application
run();


