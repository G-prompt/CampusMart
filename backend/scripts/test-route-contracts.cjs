
"use strict";

// Read-only CampusMart API contract test.
// node scripts/test-route-contracts.cjs
// node scripts/test-route-contracts.cjs --live

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");

const read = (relative) =>
  fs.readFileSync(path.join(root, relative), "utf8");

const routes = read("backend/src/routes/vendor.routes.ts");
const app = read("backend/src/app.ts");
const sellerPage = read("frontend/app/sell/page.tsx");

test("buyer-to-seller frontend uses the expected API path", () => {
  assert.match(
    sellerPage,
    /\/api\/vendor\/become-seller/
  );
});

test("both seller-upgrade URLs use the same authenticated handler", () => {
  assert.match(
    routes,
    /router\.post\(\s*\[\s*["']\/upgrade["']\s*,\s*["']\/become-seller["']\s*\]\s*,\s*requireAuth\s*,\s*upgradeBuyerToVendor\s*\)/,
    "Both paths must share requireAuth and upgradeBuyerToVendor"
  );

  assert.match(
    app,
    /app\.use\(\s*["']\/api\/vendor["']\s*,\s*vendorRoutes\s*\)/
  );
});

test("existing seller routes remain registered", () => {
  for (const endpoint of [
    "/eligibility",
    "/profile",
    "/pickup-points",
    "/pickup-points/:pickupPointId",
    "/storefront/:vendorId/pickup-points",
    "/storefront/:vendorId",
  ]) {
    assert.ok(
      routes.includes(`"${endpoint}"`),
      `Missing existing route ${endpoint}`
    );
  }
});

if (process.argv.includes("--live")) {
  const base = (
    process.env.CAMPUSMART_TEST_API_URL ||
    "http://127.0.0.1:5000"
  ).replace(/\/+$/, "");

  test("live API health responds", async () => {
    const response = await fetch(`${base}/api/health`, {
      signal: AbortSignal.timeout(10000),
    });

    assert.equal(response.status, 200);

    const result = await response.json();
    assert.equal(result.success, true);
  });

  for (const endpoint of [
    "/api/vendor/upgrade",
    "/api/vendor/become-seller",
  ]) {
    test(
      `live POST ${endpoint} rejects unauthenticated requests`,
      async () => {
        const response = await fetch(`${base}${endpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
          signal: AbortSignal.timeout(10000),
        });

        assert.equal(
          response.status,
          401,
          `${endpoint} must reject guests, not return 404`
        );

        const result = await response.json();
        assert.equal(result.success, false);
      }
    );
  }
}
