import fetch from "node-fetch";

async function run() {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "(redacted)";
  if(GEMINI_API_KEY === "(redacted)") {
    console.error("No API key"); return;
  }
  const body = {
    contents: [
      { role: "user", parts: [{ text: "hi" }] },
      { role: "model", parts: [{ text: "" }] },
      { role: "user", parts: [{ text: "hello" }] }
    ]
  };
  const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );
  console.log("Status:", response.status);
  console.log("Body:", await response.text());
}
run();
