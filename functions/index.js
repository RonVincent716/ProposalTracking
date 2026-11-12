/* eslint-env node */
const { setGlobalOptions } = require("firebase-functions");
const { onRequest } = require("firebase-functions/https");
const { onCall, HttpsError } = require("firebase-functions/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

admin.initializeApp();

setGlobalOptions({ maxInstances: 10 });

// Example function to avoid unused vars
exports.helloWorld = onRequest((req, res) => {
  logger.info("Hello logs!", { structuredData: true });
  res.send("Hello from Firebase!");
});

/**
 * Changes a user's role from trusted server code. Direct Firestore role writes
 * are denied by rules, which prevents users from promoting their own account.
 */
exports.changeUserRole = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const { userId, role } = request.data || {};
  const validRoles = ["user", "client", "admin", "superadmin"];
  if (typeof userId !== "string" || !validRoles.includes(role)) {
    throw new HttpsError("invalid-argument", "A valid user ID and role are required.");
  }
  if (userId === request.auth.uid) {
    throw new HttpsError("permission-denied", "You cannot change your own role.");
  }

  const db = admin.firestore();
  const callerRef = db.collection("users").doc(request.auth.uid);
  const caller = await callerRef.get();
  if (!caller.exists || caller.get("role") !== "superadmin") {
    throw new HttpsError("permission-denied", "Only superadmins can change roles.");
  }

  const targetRef = db.collection("users").doc(userId);
  if (!(await targetRef.get()).exists) {
    throw new HttpsError("not-found", "User profile not found.");
  }

  await targetRef.update({
    role,
    roleUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    roleUpdatedBy: request.auth.uid
  });

  logger.info("User role changed", { actorUid: request.auth.uid, userId, role });
  return { success: true };
});

/** Creates a staff/client account without exposing privileged profile writes to the browser. */
exports.createManagedUser = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "You must be signed in.");

  const { email, password, displayName, role, status } = request.data || {};
  const validRoles = ["user", "client", "admin"];
  if (typeof email !== "string" || typeof password !== "string" ||
      !validRoles.includes(role) || password.length < 6) {
    throw new HttpsError("invalid-argument", "Valid account details are required.");
  }

  const db = admin.firestore();
  const caller = await db.collection("users").doc(request.auth.uid).get();
  if (!caller.exists || caller.get("role") !== "superadmin") {
    throw new HttpsError("permission-denied", "Only superadmins can create accounts.");
  }

  const normalizedEmail = email.trim().toLowerCase();
  let createdUser;
  try {
    createdUser = await admin.auth().createUser({
      email: normalizedEmail,
      password,
      displayName: typeof displayName === "string" ? displayName.trim() || undefined : undefined
    });
    await db.collection("users").doc(createdUser.uid).set({
      uid: createdUser.uid,
      email: normalizedEmail,
      displayName: createdUser.displayName || normalizedEmail.split("@")[0],
      role,
      status: status === "suspended" ? "suspended" : "active",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: request.auth.uid,
      roleUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      statusUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    logger.error("Managed user creation failed", { actorUid: request.auth.uid, error: error.code });
    throw new HttpsError("internal", "Unable to create the user account.");
  }

  logger.info("Managed user created", { actorUid: request.auth.uid, userId: createdUser.uid, role });
  return { uid: createdUser.uid, email: normalizedEmail };
});
