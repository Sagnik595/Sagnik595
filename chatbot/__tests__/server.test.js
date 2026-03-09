const request = require("supertest");

// Prevent dotenv from loading .env during tests
process.env.NODE_ENV = "test";

const app = require("../server");

describe("AI Chatbot API", () => {
  describe("GET /api/health", () => {
    it("returns ok status", async () => {
      const res = await request(app).get("/api/health");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: "ok" });
    });
  });

  describe("POST /api/chat", () => {
    it("rejects empty message", async () => {
      const res = await request(app)
        .post("/api/chat")
        .send({ message: "" });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Message is required/);
    });

    it("rejects missing message field", async () => {
      const res = await request(app)
        .post("/api/chat")
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Message is required/);
    });

    it("rejects whitespace-only message", async () => {
      const res = await request(app)
        .post("/api/chat")
        .send({ message: "   " });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Message is required/);
    });

    it("returns error when no API key is configured", async () => {
      // No OPENAI_API_KEY in env and none in body
      delete process.env.OPENAI_API_KEY;
      const res = await request(app)
        .post("/api/chat")
        .send({ message: "Hello" });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/API key/);
    });

    it("returns error when API key is the placeholder value", async () => {
      process.env.OPENAI_API_KEY = "your_openai_api_key_here";
      const res = await request(app)
        .post("/api/chat")
        .send({ message: "Hello" });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/API key/);
      delete process.env.OPENAI_API_KEY;
    });
  });

  describe("DELETE /api/chat/:sessionId", () => {
    it("clears conversation and returns success", async () => {
      const res = await request(app).delete("/api/chat/test-session");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: "cleared" });
    });
  });

  describe("GET / (frontend)", () => {
    it("serves the index.html", async () => {
      const res = await request(app).get("/");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/html/);
      expect(res.text).toContain("AI Chatbot");
    });
  });
});
