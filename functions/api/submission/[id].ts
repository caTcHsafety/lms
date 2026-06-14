// Cloudflare Pages Function — proxies a student submission PDF through our own domain.
// URL: https://lms.safetycatch.in/api/submission/{submissionId}
// The auditor only ever sees this clean URL. Supabase project, storage path,
// student ID and tokens are never exposed.

interface Env {
  VITE_SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { params, env } = context;
  const submissionId = params.id as string;

  if (!submissionId) {
    return new Response("Not found", { status: 404 });
  }

  const supabaseUrl = env.VITE_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return new Response("Server not configured", { status: 500 });
  }

  try {
    // 1. Look up the submission's storage path using the service role (bypasses RLS)
    // The {id} in the URL is the assignment_id
    const lookupResp = await fetch(
      `${supabaseUrl}/rest/v1/submissions?assignment_id=eq.${submissionId}&select=storage_path&order=submitted_at.desc&limit=1`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      },
    );

    if (!lookupResp.ok) {
      return new Response("Lookup failed", { status: 502 });
    }

    const rows = (await lookupResp.json()) as Array<{ storage_path: string | null }>;
    if (!rows.length || !rows[0].storage_path) {
      return new Response("Submission not found", { status: 404 });
    }

    const storagePath = rows[0].storage_path;

    // 2. Download the file from storage using the service role
    const fileResp = await fetch(
      `${supabaseUrl}/storage/v1/object/student_submissions/${storagePath}`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      },
    );

    if (!fileResp.ok) {
      return new Response("File not available", { status: 404 });
    }

    const fileBuffer = await fileResp.arrayBuffer();

    // 3. Stream it back under our own domain — no Supabase info leaks
    return new Response(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="submission_${submissionId}.pdf"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    return new Response("Internal error", { status: 500 });
  }
};
