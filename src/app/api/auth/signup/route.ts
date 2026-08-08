import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models/User";
import { signupSchema } from "@/lib/validation";
import { errorResponse } from "@/lib/api-errors";

const SALT_ROUNDS = 10;
const DUPLICATE_EMAIL_MESSAGE = "An account with this email already exists";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = signupSchema.safeParse(body);

  if (!parsed.success) {
    return errorResponse(400, parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { email, password } = parsed.data;

  await connectDB();

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return errorResponse(409, DUPLICATE_EMAIL_MESSAGE);
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  try {
    const user = await User.create({ email, passwordHash });
    return Response.json(
      { id: user._id.toString(), email: user.email },
      { status: 201 },
    );
  } catch (error) {
    // The `findOne` check above isn't atomic with `create` — two concurrent
    // signups for the same email could both pass it. The schema's unique
    // index on `email` is the real guard; translate its violation into the
    // same clean error instead of a raw 500.
    if (isDuplicateKeyError(error)) {
      return errorResponse(409, DUPLICATE_EMAIL_MESSAGE);
    }
    throw error;
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === 11000
  );
}
