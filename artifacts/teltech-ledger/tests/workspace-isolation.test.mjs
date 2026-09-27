import test from "node:test";
import assert from "node:assert/strict";

// Helper function simulating workspace isolation access verification
function verifyUserWorkspaceAccess({ userWorkspaces, targetWorkspaceId, requiredRoles }) {
  const membership = userWorkspaces.find(w => w.workspaceId === targetWorkspaceId);
  if (!membership) {
    return { allowed: false, reason: "NOT_A_MEMBER", status: 403 };
  }
  if (requiredRoles && requiredRoles.length > 0) {
    if (!requiredRoles.includes(membership.role)) {
      return { allowed: false, reason: "INSUFFICIENT_ROLE", status: 403 };
    }
  }
  return { allowed: true, membership, status: 200 };
}

// Helper simulating mobile device detection logic
function isMobileDevice({ width, height, hasCoarsePointer }) {
  if (width < 768) return true;
  // Mobile landscape: height <= 500 && width <= 950 with touch
  if (height <= 500 && width <= 950 && hasCoarsePointer) return true;
  return false;
}

test("cross-workspace access is blocked when user is not a member", () => {
  const userWorkspaces = [
    { workspaceId: "ws-alpha", role: "member" },
    { workspaceId: "ws-beta", role: "admin" }
  ];

  const access = verifyUserWorkspaceAccess({
    userWorkspaces,
    targetWorkspaceId: "ws-gamma"
  });

  assert.equal(access.allowed, false);
  assert.equal(access.status, 403);
  assert.equal(access.reason, "NOT_A_MEMBER");
});

test("workspace member can access resources in their own workspace", () => {
  const userWorkspaces = [
    { workspaceId: "ws-alpha", role: "member" }
  ];

  const access = verifyUserWorkspaceAccess({
    userWorkspaces,
    targetWorkspaceId: "ws-alpha"
  });

  assert.equal(access.allowed, true);
  assert.equal(access.status, 200);
  assert.equal(access.membership.role, "member");
});

test("administrative actions require admin or owner role", () => {
  const memberWorkspaces = [
    { workspaceId: "ws-alpha", role: "member" }
  ];
  const adminWorkspaces = [
    { workspaceId: "ws-alpha", role: "admin" }
  ];

  const memberAccess = verifyUserWorkspaceAccess({
    userWorkspaces: memberWorkspaces,
    targetWorkspaceId: "ws-alpha",
    requiredRoles: ["owner", "admin"]
  });
  assert.equal(memberAccess.allowed, false);
  assert.equal(memberAccess.reason, "INSUFFICIENT_ROLE");

  const adminAccess = verifyUserWorkspaceAccess({
    userWorkspaces: adminWorkspaces,
    targetWorkspaceId: "ws-alpha",
    requiredRoles: ["owner", "admin"]
  });
  assert.equal(adminAccess.allowed, true);
});

test("mobile device detection identifies portrait and landscape smartphones", () => {
  // iPhone 13/14 portrait (390 x 844)
  assert.equal(isMobileDevice({ width: 390, height: 844, hasCoarsePointer: true }), true);
  // iPhone SE portrait (375 x 667)
  assert.equal(isMobileDevice({ width: 375, height: 667, hasCoarsePointer: true }), true);
  // iPhone landscape (844 x 390)
  assert.equal(isMobileDevice({ width: 844, height: 390, hasCoarsePointer: true }), true);
  // Desktop screen (1440 x 900, fine pointer)
  assert.equal(isMobileDevice({ width: 1440, height: 900, hasCoarsePointer: false }), false);
  // iPad / tablet landscape (1024 x 768)
  assert.equal(isMobileDevice({ width: 1024, height: 768, hasCoarsePointer: true }), false);
});
