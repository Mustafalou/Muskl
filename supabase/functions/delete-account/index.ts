// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

// Deletes the calling user's account and all of their app data. Requires the
// caller's own session JWT (auth: "user") — never callable on behalf of someone else.
//
// App data is deleted explicitly, table by table, rather than relying on FK cascade
// behavior we can't fully verify on tables that predate this function. ctx.supabaseAdmin
// bypasses RLS (needed here — a user's own RLS policies don't allow deleting other users'
// rows, and this needs to clean up storage + auth.users which RLS can't touch at all).
export default {
  fetch: withSupabase({ auth: "user" }, async (_req, ctx) => {
    const userId = ctx.userClaims?.sub;

    if (!userId) {
      return Response.json({ error: "Invalid session" }, { status: 401 });
    }

    const admin = ctx.supabaseAdmin;

    const { data: workoutRows } = await admin
      .from("workouts")
      .select("id")
      .eq("user_id", userId);
    const workoutIds = (workoutRows ?? []).map((workout) => workout.id);

    if (workoutIds.length > 0) {
      const { data: exerciseRows } = await admin
        .from("exercises")
        .select("id")
        .in("workout_id", workoutIds);
      const exerciseIds = (exerciseRows ?? []).map((exercise) => exercise.id);

      if (exerciseIds.length > 0) {
        await admin.from("sets").delete().in("exercise_id", exerciseIds);
      }
      await admin.from("exercises").delete().in("workout_id", workoutIds);
    }

    await admin.from("workouts").delete().eq("user_id", userId);
    await admin.from("body_weight_logs").delete().eq("user_id", userId);
    await admin.from("profile_stats").delete().eq("user_id", userId);
    await admin.from("content_reports").delete().eq("reporter_id", userId);

    const { data: avatarFiles } = await admin.storage.from("avatars").list(userId);
    if (avatarFiles && avatarFiles.length > 0) {
      await admin.storage
        .from("avatars")
        .remove(avatarFiles.map((file) => `${userId}/${file.name}`));
    }

    await admin.from("profiles").delete().eq("id", userId);

    const { error: deleteUserError } = await admin.auth.admin.deleteUser(userId);

    if (deleteUserError) {
      return Response.json({ error: deleteUserError.message }, { status: 500 });
    }

    return Response.json({ deleted: true });
  }),
};

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request with a real user access token:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/delete-account' \
    --header 'Authorization: Bearer <user-access-token>'

*/
