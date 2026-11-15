"use strict";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== "SRT_GEMINI_REQUEST") return;

  (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    try {
      const model = String(message.model || "").trim();
      const apiKey = String(message.apiKey || "").trim();
      const prompt = String(message.prompt || "");
      if (!apiKey) throw new Error("Missing API key. Save your Gemini API key first.");
      if (!/^[a-zA-Z0-9._-]+$/.test(model)) throw new Error("Invalid model name.");

      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/" +
          encodeURIComponent(model) + ":generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
          },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.35, maxOutputTokens: 300 }
          }),
          signal: controller.signal
        }
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const messageText = data && data.error && data.error.message;
        throw new Error(messageText || "Gemini API returned HTTP " + response.status);
      }

      const parts = data && data.candidates && data.candidates[0] &&
        data.candidates[0].content && data.candidates[0].content.parts;
      const answer = Array.isArray(parts)
        ? parts.map(part => part.text || "").join("").trim()
        : "";
      if (!answer) throw new Error("Gemini returned no text. Check the model and API key.");
      sendResponse({ ok: true, answer });
    } catch (error) {
      const timedOut = error && error.name === "AbortError";
      sendResponse({
        ok: false,
        error: timedOut
          ? "Gemini took longer than 25 seconds. Check your connection and try again."
          : (error && error.message ? error.message : String(error))
      });
    } finally {
      clearTimeout(timeout);
    }
  })();

  return true;
});
