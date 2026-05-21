import { connectDb } from "@/lib/mongodb";
import { verifyFirebaseToken, getUserProfile } from "@/lib/firebase-admin";
import { jsonError, jsonSuccess } from "@/lib/api-response";

export async function GET(request) {
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


    const profile = await getUserProfile(decodedToken.uid);

    if (!profile) {
      return jsonError("User profile not found", 404);
    }

    const { searchParams } = new URL(request.url);

    // Pagination params
    const page = parseInt(searchParams.get("page")) || 1;
    const limit = parseInt(searchParams.get("limit")) || 10;

    // Search params
    const search = searchParams.get("search") || "";

    // Sorting params
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder =
      searchParams.get("sortOrder") === "asc" ? 1 : -1;

    // Validation
    if (page < 1 || limit < 1) {
      return jsonError(
        "Page and limit must be greater than 0",
        400
      );
    }

    const skip = (page - 1) * limit;

    const db = await connectDb();
    const collection = db.collection("exceptions");

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    // Fetch total document count under query
    const total = await collection.countDocuments(query);

    let exceptions;

    if (profile.role === "admin" || profile.role === "teacher") {
      exceptions = await db
        .collection("exceptions")
        .find({ status: "pending" })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();
    } else if (profile.role === "student") {
      exceptions = await db
        .collection("exceptions")
        .find({ status: "pending", studentEmail: decodedToken.email })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();
    } else {
      return jsonError("Forbidden", 403);
    }

    // Search filter
    if (search) {
      query.$or = [
        {
          reason: {
            $regex: search,
            $options: "i",
          },
        },
        {
          studentEmail: {
            $regex: search,
            $options: "i",
          },
        },
      ];
    }

    // Total count
    const total = await collection.countDocuments(query);

    // Fetch paginated data
    const exceptions = await collection
      .find(query)
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit)
      .toArray();

    const totalPages = Math.ceil(total / limit);

    return jsonSuccess(
      {
        exceptions,
        pagination: {
          total,
          page,
          limit,
          totalPages,
          hasNextPage: page < totalPages,
        },
      },
      200
    );
  } catch (error) {
    console.error("Exception fetch error:", error);
    return jsonError("Internal server error", 500);
  }
}
