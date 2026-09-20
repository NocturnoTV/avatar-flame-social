import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, LegalSection } from "@/components/LegalPage";

export const Route = createFileRoute("/sound-rights")({
  head: () => ({
    meta: [
      { title: "Sound Rights Policy - Bloxspark" },
      {
        name: "description",
        content: "Rules for publishing sounds to the Bloxspark community sound library.",
      },
      { property: "og:title", content: "Sound Rights Policy - Bloxspark" },
      { property: "og:description", content: "What you're agreeing to when you publish a sound." },
      { property: "og:url", content: "https://bloxspark.app/sound-rights" },
      { name: "robots", content: "index, follow" },
    ],
    links: [{ rel: "canonical", href: "https://bloxspark.app/sound-rights" }],
  }),
  component: () => (
    <LegalPage title="Sound Rights Policy" updated="Last updated: September 20, 2026">
      <p className="text-sm leading-relaxed text-muted-foreground">
        This policy governs any sound you publish to Bloxspark's community sound library, whether
        it's a piece of original music, a voice clip, or any other audio - and applies whether you
        set it to public or private.
      </p>

      <LegalSection title="1. Your sound must be free of rights, or your own">
        <p>
          You may only publish a sound if at least one of the following is true: (a) you are the
          sole owner of the sound and have the right to distribute it, (b) the sound is
          royalty-free or licensed in a way that explicitly permits redistribution and use by
          others on a social platform, or (c) you hold a license that covers this specific use and
          you are authorized to sublicense it to Bloxspark and its users under this policy. You may
          not publish commercial music, a copyrighted recording, or someone else's original sound
          without their permission, even if you give credit.
        </p>
      </LegalSection>

      <LegalSection title="2. What publishing a sound means you're agreeing to">
        <p>By checking the compliance box and publishing a sound, you confirm and agree that:</p>
        <ul>
          <li>the sound complies with Section 1 above;</li>
          <li>
            you grant Bloxspark a worldwide, non-exclusive, royalty-free license to host, store,
            reproduce, and distribute the sound within the Service, including making it available
            for other users to attach to their own videos and Stories when you publish it as
            public; and
          </li>
          <li>
            you are solely responsible for the sound you publish - Bloxspark is not responsible
            for a sound that turns out not to be free of rights, and publishing it does not shift
            that responsibility onto Bloxspark.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Private sounds">
        <p>
          Setting a sound to private keeps it out of the public community library and search - it
          is only usable on your own posts. The same rights requirements in Section 1 still apply:
          private visibility limits who can find and reuse the sound, not whether you were allowed
          to publish it in the first place.
        </p>
      </LegalSection>

      <LegalSection title="4. Removal and enforcement">
        <p>
          We may remove a sound at any time, without notice, if we determine or are notified that
          it isn't free of rights, that it violates this policy, our Terms of Use, or applicable
          law, or in response to a valid copyright notice (see the Terms of Use, Intellectual
          Property section, for how to submit one). Repeatedly publishing sounds that violate this
          policy may result in a warning, loss of sound-publishing privileges, or account
          suspension.
        </p>
      </LegalSection>

      <LegalSection title="5. Relationship to the Terms of Use">
        <p>
          This policy supplements, and should be read together with, Bloxspark's Terms of Use,
          which govern all content you publish on the Service, including sounds.
        </p>
      </LegalSection>
    </LegalPage>
  ),
});
