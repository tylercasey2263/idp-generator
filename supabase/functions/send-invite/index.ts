/**
 * Supabase Edge Function: send-invite
 *
 * Sends an invitation email via Resend (https://resend.com).
 *
 * Required Supabase secrets (set via Dashboard → Edge Functions → Secrets, or CLI):
 *   RESEND_API_KEY  — your Resend API key  (e.g. re_xxxxxxxxxxxxxxxx)
 *   RESEND_FROM     — (optional) verified sender address, e.g. "Player IDP <noreply@yourdomain.com>"
 *                     Defaults to "onboarding@resend.dev" which works without a verified domain
 *                     but can only send to the address registered on your Resend account.
 *
 * Supabase automatically injects SUPABASE_URL and SUPABASE_ANON_KEY — no setup needed for those.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── 1. Verify caller is authenticated ──
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') return json({ error: 'Admin access required' }, 403);

    // ── 2. Read payload ──
    const { email, name, role, invite_link, club_name } = await req.json();
    if (!email || !invite_link) return json({ error: 'Missing required fields: email, invite_link' }, 400);

    // ── 3. Check Resend is configured ──
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      return json({ error: 'Email not configured — ask your admin to set RESEND_API_KEY in Supabase Edge Function secrets.' }, 500);
    }

    const RESEND_FROM = Deno.env.get('RESEND_FROM') || 'onboarding@resend.dev';
    const clubDisplay = club_name || 'Player IDP';
    const roleLabel   = role === 'admin' ? 'Admin' : role === 'parent' ? 'Parent' : 'Coach';
    const firstName   = (name || 'there').split(' ')[0];

    // ── 4. Build HTML email ──
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're invited to ${clubDisplay}</title>
</head>
<body style="margin:0;padding:0;background:#0D1B2A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center" style="padding:48px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:520px;background:#0F2035;border-radius:16px;overflow:hidden;border:1px solid #1E3A5F;">

          <!-- Header bar -->
          <tr>
            <td style="background:#1B8A6B;padding:4px 0;"></td>
          </tr>

          <!-- Logo / Club name -->
          <tr>
            <td style="padding:36px 40px 0;">
              <div style="font-size:22px;font-weight:800;color:#1B8A6B;letter-spacing:-0.5px;">${clubDisplay}</div>
              <div style="font-size:12px;color:#475569;margin-top:2px;">Player Development Platform</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 40px 0;">
              <h1 style="margin:0 0 16px;font-size:26px;font-weight:700;color:#F1F5F9;line-height:1.2;">
                You're invited, ${firstName}!
              </h1>
              <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#94A3B8;">
                You've been added to <strong style="color:#E2E8F0;">${clubDisplay}</strong> as a
                <strong style="color:#E2E8F0;">${roleLabel}</strong>.
              </p>
              <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#94A3B8;">
                Click the button below to create your account and get started.
              </p>
              <a href="${invite_link}"
                 style="display:inline-block;background:#1B8A6B;color:#ffffff;text-decoration:none;
                        font-weight:700;font-size:15px;padding:14px 32px;border-radius:8px;
                        letter-spacing:0.01em;">
                Accept Invitation →
              </a>
            </td>
          </tr>

          <!-- Note -->
          <tr>
            <td style="padding:24px 40px 0;">
              <p style="margin:0;font-size:12px;color:#475569;line-height:1.5;">
                This link is unique to you — please don't share it.<br>
                If you weren't expecting this invitation you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Fallback link -->
          <tr>
            <td style="padding:20px 40px 36px;">
              <div style="border-top:1px solid #1E3A5F;padding-top:16px;">
                <p style="margin:0;font-size:11px;color:#334155;">
                  Button not working? Copy and paste this link into your browser:<br>
                  <a href="${invite_link}" style="color:#4A9EE6;word-break:break-all;">${invite_link}</a>
                </p>
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    // ── 5. Send via Resend ──
    const resendRes = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from:    RESEND_FROM,
        to:      email,
        subject: `You're invited to join ${clubDisplay}`,
        html,
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      console.error('Resend error:', resendData);
      return json({ error: resendData.message || 'Failed to send email via Resend' }, 500);
    }

    return json({ ok: true });

  } catch (err) {
    console.error('send-invite error:', err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
