/**
 * Supabase Edge Function: notify-parent
 *
 * Called after an IDP is published. Looks up all parents linked to the player
 * and sends them a "New IDP published" email via Resend.
 *
 * Required Supabase secrets:
 *   RESEND_API_KEY  — your Resend API key
 *   RESEND_FROM     — (optional) verified sender, e.g. "Player IDP <noreply@yourdomain.com>"
 *
 * Payload: { player_id: string, player_name: string, club_name?: string, portal_url?: string }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // ── 1. Verify caller is an authenticated coach or admin ──────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: callerProfile } = await adminClient
      .from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (!callerProfile || !['coach', 'admin'].includes(callerProfile.role)) {
      return json({ error: 'Forbidden' }, 403);
    }

    // ── 2. Parse payload ─────────────────────────────────────────────────────
    const { player_id, player_name, club_name, portal_url } = await req.json();
    if (!player_id) return json({ error: 'Missing player_id' }, 400);

    // ── 3. Look up parents linked to this player ─────────────────────────────
    // Collect both stored invite_email (token-based) and email from profiles (logged-in parents)
    const { data: links } = await adminClient
      .from('parent_players')
      .select('invite_email, parent_id, profiles(email, full_name)')
      .eq('player_id', player_id);

    if (!links || links.length === 0) {
      return json({ ok: true, sent: 0, message: 'No parents linked to this player' });
    }

    // Deduplicate emails
    const emailMap = new Map<string, string>(); // email -> name
    for (const link of links) {
      // Logged-in parent profile email
      const profileEmail = (link as any).profiles?.email;
      const profileName  = (link as any).profiles?.full_name || 'Parent';
      if (profileEmail) emailMap.set(profileEmail.toLowerCase(), profileName);
      // Token-based invite_email
      if (link.invite_email) emailMap.set(link.invite_email.toLowerCase(), emailMap.get(link.invite_email.toLowerCase()) || 'Parent');
    }

    if (emailMap.size === 0) {
      return json({ ok: true, sent: 0, message: 'No parent emails found' });
    }

    // ── 4. Check Resend is configured ────────────────────────────────────────
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      // Graceful degradation — IDP was published, just no email sent
      return json({ ok: true, sent: 0, message: 'Email not configured — set RESEND_API_KEY to enable notifications' });
    }

    const RESEND_FROM  = Deno.env.get('RESEND_FROM') || 'onboarding@resend.dev';
    const clubDisplay  = club_name || 'Player IDP';
    const playerDisplay = player_name || 'your player';
    const portalLink   = portal_url || Deno.env.get('PORTAL_URL') || '';

    // ── 5. Send email to each parent ─────────────────────────────────────────
    let sent = 0;
    for (const [email, name] of emailMap) {
      const firstName = (name || 'there').split(' ')[0];
      const html = buildEmailHTML({ clubDisplay, firstName, playerDisplay, portalLink });

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from:    RESEND_FROM,
          to:      email,
          subject: `New IDP published for ${playerDisplay} — ${clubDisplay}`,
          html,
        }),
      });

      if (res.ok) sent++;
      else {
        const err = await res.json();
        console.error(`Failed to send to ${email}:`, err);
      }
    }

    return json({ ok: true, sent });

  } catch (err) {
    console.error('notify-parent error:', err);
    return json({ error: (err as Error).message }, 500);
  }
});

function buildEmailHTML({ clubDisplay, firstName, playerDisplay, portalLink }: {
  clubDisplay: string; firstName: string; playerDisplay: string; portalLink: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>New IDP published — ${clubDisplay}</title>
</head>
<body style="margin:0;padding:0;background:#0D1B2A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center" style="padding:48px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
          style="max-width:520px;background:#0F2035;border-radius:16px;overflow:hidden;border:1px solid #1E3A5F;">

          <tr><td style="background:#1B8A6B;padding:4px 0;"></td></tr>

          <tr>
            <td style="padding:36px 40px 0;">
              <div style="font-size:22px;font-weight:800;color:#1B8A6B;letter-spacing:-0.5px;">${clubDisplay}</div>
              <div style="font-size:12px;color:#475569;margin-top:2px;">Player Development Platform</div>
            </td>
          </tr>

          <tr>
            <td style="padding:28px 40px 0;">
              <h1 style="margin:0 0 16px;font-size:26px;font-weight:700;color:#F1F5F9;line-height:1.2;">
                New IDP published, ${firstName}!
              </h1>
              <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#94A3B8;">
                Your coaching staff has published an updated Individual Development Plan for
                <strong style="color:#E2E8F0;">${playerDisplay}</strong>.
              </p>
              <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#94A3B8;">
                Click below to view the full plan, track progress, and send a message to the coach.
              </p>
              ${portalLink ? `
              <a href="${portalLink}"
                 style="display:inline-block;background:#1B8A6B;color:#ffffff;text-decoration:none;
                        font-weight:700;font-size:15px;padding:14px 32px;border-radius:8px;letter-spacing:0.01em;">
                View Development Plan →
              </a>` : ''}
            </td>
          </tr>

          <tr>
            <td style="padding:24px 40px 0;">
              <p style="margin:0;font-size:12px;color:#475569;line-height:1.5;">
                You're receiving this because you're linked as a parent or guardian in ${clubDisplay}.<br>
                Questions? Reply to your coach directly.
              </p>
            </td>
          </tr>

          ${portalLink ? `
          <tr>
            <td style="padding:20px 40px 36px;">
              <div style="border-top:1px solid #1E3A5F;padding-top:16px;">
                <p style="margin:0;font-size:11px;color:#334155;">
                  Button not working? Copy and paste this link:<br>
                  <a href="${portalLink}" style="color:#4A9EE6;word-break:break-all;">${portalLink}</a>
                </p>
              </div>
            </td>
          </tr>` : ''}

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
