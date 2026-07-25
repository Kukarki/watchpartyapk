import { Link } from 'react-router-dom';

const LAST_UPDATED = 'July 25, 2026';
const CONTACT_EMAIL = 'kushalkarki1415@gmail.com';

function Section({ title, children }) {
  return (
    <section>
      <h2 className="font-display font-bold text-lg text-bright mb-3">{title}</h2>
      <div className="text-sub text-sm leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-void">
      <nav className="border-b border-border bg-surface/50 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-xl">🎬</span>
            <span className="font-display font-bold text-lg text-bright">
              Watch<span className="text-gradient">Party</span>
            </span>
          </Link>
          <Link to="/" className="btn-ghost text-xs px-3 py-1.5 border border-border">
            ← Home
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-10 sm:py-14 space-y-10">
        <header>
          <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-bright mb-3">
            Privacy Policy
          </h1>
          <p className="text-dim text-xs">Last updated {LAST_UPDATED}</p>
        </header>

        <Section title="What this covers">
          <p>
            This policy applies to the WatchParty website and the WatchParty browser
            extension, which work together to let you watch Netflix, Prime Video, Disney+,
            YouTube and other platforms in sync with friends, with live chat, voice/video
            calls and reactions.
          </p>
        </Section>

        <Section title="Account data">
          <p>
            If you sign up with email, we collect your email address, a display name, and
            a date of birth (used only to confirm you're 18+ — WatchParty requires this).
            If you sign up with Google, we receive your name, email and profile photo from
            Google via our authentication provider, Supabase. Passwords are never seen or
            stored by our own servers — Supabase Auth handles password hashing and storage
            directly.
          </p>
          <p>
            Your avatar is generated automatically from your display name using DiceBear
            (api.dicebear.com) — no photo upload is required or stored.
          </p>
        </Section>

        <Section title="Rooms, chat & activity">
          <p>
            When you create or join a room, we store the room name, who's in it, and the
            video URL being watched. Chat messages you send are stored so they can be
            shown to people who join a room after you, including message content, emoji
            reactions, and the room's video queue and any polls you create or vote in. Your
            list of past rooms is kept so you can find them again from your dashboard.
          </p>
        </Section>

        <Section title="Voice & video calls">
          <p>
            Voice chat, video calls and screen sharing use WebRTC and connect directly
            between participants' browsers — our server only relays connection setup
            information (technical handshake data) to establish that direct connection,
            and never inspects, records or stores your audio, video or screen-share
            content.
          </p>
          <p>
            When a direct connection isn't possible (e.g. due to restrictive networks),
            encrypted call data may be relayed through Metered.ca, a third-party relay
            service. That service can see connection metadata like IP addresses and
            timing, but cannot decrypt your call content.
          </p>
        </Section>

        <Section title="The browser extension">
          <p>
            The WatchParty extension only activates on the streaming sites it lists
            (Netflix, Prime Video, Disney+, YouTube, etc.) and the WatchParty website
            itself. On those pages, it locates the video player so it can keep playback in
            sync — it does not read your account details on those sites, your browsing
            history elsewhere, or the page's other content. It stores your login session,
            display name and current room locally in the browser (via the extension's own
            storage) so you don't have to sign in again on every tab.
          </p>
        </Section>

        <Section title="Who we share data with">
          <p>
            We use a small number of service providers to run WatchParty: Supabase
            (authentication, database and email delivery), DiceBear (avatar images), and
            Metered.ca (voice/video call relay, described above). We don't sell your data,
            and we don't use any advertising or analytics trackers.
          </p>
        </Section>

        <Section title="Server logs">
          <p>
            Like most web services, our server keeps standard access logs (including IP
            address, timestamp and page requested) for security and troubleshooting. These
            logs aren't linked to your account beyond what's needed to investigate abuse or
            technical issues.
          </p>
        </Section>

        <Section title="Deleting your data">
          <p>
            WatchParty doesn't yet have a self-service "delete my account" button. To
            request deletion of your account and associated data, email{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-amber hover:underline underline-offset-2">
              {CONTACT_EMAIL}
            </a>{' '}
            from the address on your account and we'll remove it.
          </p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            If this policy changes in a meaningful way, we'll update the date at the top of
            this page.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about this policy or your data? Email{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-amber hover:underline underline-offset-2">
              {CONTACT_EMAIL}
            </a>.
          </p>
        </Section>
      </main>
    </div>
  );
}
