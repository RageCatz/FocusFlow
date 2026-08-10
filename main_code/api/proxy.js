module.exports = async function handler(request, response) {
  const renderBaseUrl = process.env.RENDER_API_URL;

  if (!renderBaseUrl) {
    return response.status(503).json({
      error: "RENDER_API_URL is not configured in Vercel."
    });
  }

  const rawPath = String(request.query.path || "").replace(/^\/+/, "");
  if (!rawPath || rawPath.includes("..")) {
    return response.status(400).json({ error: "Invalid API path." });
  }

  const target = `${renderBaseUrl.replace(/\/$/, "")}/api/${rawPath}`;
  const headers = { "Content-Type": "application/json" };
  if (request.headers.authorization) {
    headers.Authorization = request.headers.authorization;
  }

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method)
        ? undefined
        : JSON.stringify(request.body || {})
    });

    const text = await upstream.text();
    response.status(upstream.status);
    response.setHeader(
      "Content-Type",
      upstream.headers.get("content-type") || "application/json"
    );
    return response.send(text);
  } catch (error) {
    return response.status(502).json({
      error: "Could not reach the Render API.",
      detail: error.message
    });
  }
};
