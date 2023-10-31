const express = require("express");
const puppeteer = require("puppeteer");
const CharacterAI = require("node_characterai");
const async = require("async");

const app = express();

app.use(express.json());

let browser;

async function initializeBrowser() {
  if (browser) {
    return browser;
  }

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox'],
    });

    browser.on('disconnected', () => {
      console.log('Browser disconnected. Reinitializing...');
      setTimeout(initializeBrowser, 1000);
    });

    return browser;
  } catch (error) {
    console.error('Failed to initialize the browser:', error);
    throw error;
  }
}

const queue = async.queue(async (task, callback) => {
  const { characterId, message, accessToken, res } = task;

  try {
    if (!characterId || !message || !accessToken) {
      throw new Error("Missing required parameters");
    }

    const isolatedCharacterAI = new CharacterAI();
    await isolatedCharacterAI.authenticateWithToken(accessToken);

    const chat = await isolatedCharacterAI.createOrContinueChat(characterId);
    const start = Date.now();

    const browser = await initializeBrowser();
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.removeAllListeners('request');
    page.on('request', (request) => {
      request.continue();
    });

    const response = await chat.sendAndAwaitResponse(message, true);

    const end = Date.now();
    const elapsedTime = end - start;

    const jsonResponse = {
      Developer: "Sazumi Viki",
      Loaded: `${elapsedTime} ms`,
      Response: response.text,
    };

    await browser.close();

    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(jsonResponse, null, 2));

    if (typeof callback === 'function') {
      callback();
    }
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ error: error.message || "Internal server error" });

    if (typeof callback === 'function') {
      callback(error);
    }
  }
}, 1);

app.get("/", (req, res) => {
  const characterId = req.query.id;
  const message = req.query.teks;
  const accessToken = req.query.token;
  // const accessToken = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IkVqYmxXUlVCWERJX0dDOTJCa2N1YyJ9.eyJpc3MiOiJodHRwczovL2NoYXJhY3Rlci1haS51cy5hdXRoMC5jb20vIiwic3ViIjoiYXV0aDB8NjUxNmU5MzE4MDY0MGRjZjc1MGNjZjZjIiwiYXVkIjpbImh0dHBzOi8vYXV0aDAuY2hhcmFjdGVyLmFpLyIsImh0dHBzOi8vY2hhcmFjdGVyLWFpLnVzLmF1dGgwLmNvbS91c2VyaW5mbyJdLCJpYXQiOjE2OTg3NTUwMzEsImV4cCI6MTcwMTM0NzAzMSwiYXpwIjoiZHlEM2dFMjgxTXFnSVNHN0Z1SVhZaEwyV0VrbnFaenYiLCJzY29wZSI6Im9wZW5pZCBwcm9maWxlIGVtYWlsIn0.A0pZMo-u8IUha7Nxn7a7NpaZF8xpfOLa99ci1MS19oKIc6PDoclbGYntRga45zed094UlADZpdy7qlNyAEVQI572w2iuE4N7K_O9IM2cIEVU3qTrtSSPvT_OCva_vteMtqJlJG0Wc5C6Cx2rlcXS6eJDYVcHZYLpL8l-jLSXjbVjI3PWWXkrEvfTIwS5xzojYxOiEEFGUSJMokoBPtfBcec8UaMPh9UNogLRLOJO2_ieWt94gYCL9YbHx7ItT89qyFYB9EWiEKMyAEPmG8qwa09XuY9FOAoZxLwIYKs3vTAm1cvojsXtxIOE1bU_bUwccBlWcGugpgyLZtPKOgy2uA";

  queue.push({ characterId, message, accessToken, res }, (error) => {
    if (error) {
      console.error("Error in queue callback:", error.message);
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
