import { connectDb } from "@/lib/mongodb";
import { verifyFirebaseToken } from "@/lib/firebase-admin";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import xss from "xss";

const sanitize = (text) => (typeof text === "string" ? xss(text).trim() : "");

export async function POST(request) {
  try {
    const authorization = request.headers.get("authorization");
    const token = authorization?.split(" ")[1];

    const authResult = await verifyFirebaseToken(token);

    if (!authResult.valid) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          reason: authResult.reason,
        },
        { status: 401 }
      );
    }

    const decodedToken = authResult.decodedToken;


    const body = await request.json();
    const reason = sanitize(body.reason);
    const details = sanitize(body.details);
    const date = sanitize(body.date);

    if (!reason) {
      return jsonError("Reason is required and must be a string", 400);
    }
    if (!details) {
      return jsonError("Details are required and must be a string", 400);
    }
    if (!date) {
      return jsonError("Date is required and must be a string", 400);
    }

    const db = await connectDb();

    const exceptionData = {
      reason,
      details,
      date,
      studentEmail: decodedToken.email,
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection("exceptions").insertOne(exceptionData);

    return jsonSuccess(
      {
        id: result.insertedId,
        message: "Exception request created successfully",
      },
      201,
    );
  } catch (error) {
    console.error("Exception creation error:", error);
    return jsonError("Internal server error", 500);
  }
}
