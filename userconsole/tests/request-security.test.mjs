import assert from "node:assert/strict";
import test from "node:test";
import {
  isSameOriginMutation,
  isSecureRequest,
  requestOrigin,
} from "../src/lib/api/request-security.ts";

test("HTTP requests use cookies that the browser can return", () => {
  const request = new Request("http://console.example.com/api/auth/login");

  assert.equal(isSecureRequest(request), false);
});

test("direct HTTPS requests use secure cookies", () => {
  const request = new Request("https://console.example.com/api/auth/login");

  assert.equal(isSecureRequest(request), true);
});

test("the browser-facing protocol is read from the reverse proxy header", () => {
  const request = new Request("http://userconsole:3000/api/auth/login", {
    headers: { "x-forwarded-proto": "https, http" },
  });

  assert.equal(isSecureRequest(request), true);
});

test("an HTTP proxy header takes precedence over the internal request URL", () => {
  const request = new Request("https://userconsole:3000/api/auth/login", {
    headers: { "x-forwarded-proto": "http" },
  });

  assert.equal(isSecureRequest(request), false);
});

test("the public origin is reconstructed from reverse proxy headers", () => {
  const request = new Request("http://userconsole:3000/api/backend/brands", {
    headers: {
      host: "userconsole:3000",
      "x-forwarded-host": "geo-next-ui.d.gbicom.com",
      "x-forwarded-proto": "http",
    },
  });

  assert.equal(requestOrigin(request), "http://geo-next-ui.d.gbicom.com");
});

test("same-origin mutations pass when standalone is exposed directly", () => {
  const request = new Request("http://0.0.0.0:3000/api/backend/brands", {
    method: "POST",
    headers: {
      host: "geo-next-ui.d.gbicom.com",
      origin: "http://geo-next-ui.d.gbicom.com",
    },
  });

  assert.equal(isSameOriginMutation(request), true);
});

test("same-origin mutations pass behind a reverse proxy", () => {
  const request = new Request("http://userconsole:3000/api/backend/brands", {
    method: "POST",
    headers: {
      origin: "http://geo-next-ui.d.gbicom.com",
      "x-forwarded-host": "geo-next-ui.d.gbicom.com",
      "x-forwarded-proto": "http",
    },
  });

  assert.equal(isSameOriginMutation(request), true);
});

test("the forwarded protocol and original Host header can identify the public origin", () => {
  const request = new Request(
    "http://userconsole:3000/api/backend/knowledge-bases",
    {
      method: "POST",
      headers: {
        host: "geo-next-ui.d.gbicom.com",
        origin: "https://geo-next-ui.d.gbicom.com",
        "x-forwarded-proto": "https",
      },
    },
  );

  assert.equal(isSameOriginMutation(request), true);
});

test("cross-origin mutations remain blocked behind a reverse proxy", () => {
  const request = new Request("http://userconsole:3000/api/backend/brands", {
    method: "POST",
    headers: {
      origin: "http://attacker.example.com",
      "x-forwarded-host": "geo-next-ui.d.gbicom.com",
      "x-forwarded-proto": "http",
    },
  });

  assert.equal(isSameOriginMutation(request), false);
});

test("malformed origins are rejected", () => {
  const request = new Request("http://userconsole:3000/api/backend/brands", {
    method: "POST",
    headers: { origin: "not-an-origin" },
  });

  assert.equal(isSameOriginMutation(request), false);
});
