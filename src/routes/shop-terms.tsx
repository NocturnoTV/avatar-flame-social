import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, LegalSection } from "@/components/LegalPage";

export const Route = createFileRoute("/shop-terms")({
  head: () => ({
    meta: [
      { title: "Shop Terms & Refund Policy - Bloxspark" },
      {
        name: "description",
        content:
          "Bloxspark Shop Terms: Blox virtual currency, packs, gifting, Blox Store badges, Spark Plus, pricing, and your refund and withdrawal rights.",
      },
      { property: "og:title", content: "Shop Terms & Refund Policy - Bloxspark" },
      {
        property: "og:description",
        content: "How purchases, Blox, gifting and refunds work on Bloxspark.",
      },
      { property: "og:url", content: "https://bloxspark.app/shop-terms" },
      { name: "robots", content: "index, follow" },
    ],
    links: [{ rel: "canonical", href: "https://bloxspark.app/shop-terms" }],
  }),
  component: () => (
    <LegalPage title="Shop Terms & Refund Policy" updated="Last updated: September 14, 2026">
      <p className="text-sm leading-relaxed text-muted-foreground">
        This page governs every purchase you make on Bloxspark: Blox (our virtual currency), Blox
        Store badges, gifting, and Bloxspark Premium (Spark Plus). It supplements our{" "}
        <a href="/terms" className="underline">
          Terms of Use
        </a>{" "}
        and does not replace Section 7 of those Terms, which covers the Spark Plus subscription
        itself. Where the two overlap, this page controls for anything purchase- or refund-related.
      </p>

      <LegalSection title="1. What you're buying and who sells it">
        <p>
          All purchases described here are made from Bloxspark, and payments are processed by
          Stripe, an independent third-party payment processor, acting as our payment service
          provider. Bloxspark never receives or stores your full card number, CVC, or bank
          credentials. Prices are shown in euros (EUR) inclusive of any VAT required for your
          location unless stated otherwise at checkout; Stripe determines and applies the tax rate
          that applies to you based on your billing information.
        </p>
        <p>
          You must meet the minimum age and, where applicable, parental-consent requirements set out
          in Section 2 of our Terms of Use before making any purchase. A parent or legal guardian
          who authorizes a minor's account is responsible for purchases made on it.
        </p>
      </LegalSection>

      <LegalSection title="2. Blox: what it is and what it isn't">
        <p>
          Blox is a virtual, in-app currency with no monetary value outside Bloxspark. It is not
          money, e-money, a security, a commodity, or a cryptocurrency; it cannot be exchanged for
          cash, withdrawn, transferred to a bank account, or redeemed anywhere outside the Service.
          Blox does not earn interest or increase in value, and Bloxspark makes no promise that Blox
          will remain available, priced the same, or exchangeable for the same in-app benefits in
          the future.
        </p>
        <p>
          Buying Blox grants you a limited, personal, non-transferable, revocable license to spend
          that balance within Bloxspark (for example, on Blox Store badges or as a gift through the
          in-app gifting feature). It is not a purchase of property, and you have no ownership
          interest in your Blox balance beyond that license.
        </p>
        <p>
          We may suspend or void a Blox balance obtained through fraud, a chargeback, a payment
          reversal, an exploit, or a breach of our Terms, and may deduct or zero out a balance used
          in violation of these rules, without compensation, in addition to any other action we take
          on the account (see Section 17, Termination, of our Terms of Use).
        </p>
      </LegalSection>

      <LegalSection title="3. Buying Blox packs">
        <p>
          Blox packs are one-time purchases; they are not subscriptions and do not renew. The Blox
          amount, bonus percentage, and price of each pack are shown before you pay. Featured or
          discounted packs (for example, a "most popular" price) are promotional and may be changed,
          rotated, or withdrawn at any time without notice; a promotion available today is not a
          guarantee of the same price later.
        </p>
        <p>
          Blox is credited to your balance as soon as your payment is confirmed. Promo codes applied
          at checkout are single-use unless stated otherwise, have no cash value, cannot be resold
          or transferred, and may be refused or revoked if we reasonably suspect abuse or fraud.
        </p>
      </LegalSection>

      <LegalSection title="4. Blox Store: badges">
        <p>
          Badges are cosmetic digital items purchased with Blox, not with a card or bank payment
          directly. Buying a badge grants a personal, non-transferable license to display it on your
          profile; it carries no functional gameplay advantage, no real-world value, and cannot be
          resold, exchanged for Blox or money, or moved to another account except by removal and
          re-purchase. We may retire a badge design, rename it, or change its price for future
          buyers; badges you already own are not affected by a later price or catalog change.
        </p>
      </LegalSection>

      <LegalSection title="5. Gifting Blox and Spark Plus">
        <p>
          Bloxspark lets you send Blox you own, buy a Blox pack credited directly to someone else,
          or gift a month of Spark Plus to another Bloxspark account. A gift is a voluntary transfer
          you authorize to a specific recipient; once sent or credited, it cannot be recalled, and
          the sender has no refund right against the recipient's use of it. You're responsible for
          choosing the right recipient - Bloxspark cannot reverse a gift sent to the wrong account.
        </p>
        <p>
          Gifting a Blox pack or a month of Spark Plus is still a purchase for the purposes of
          Sections 8-11 below (pricing, refunds, and withdrawal rights apply to the payer, not the
          recipient).
        </p>
      </LegalSection>

      <LegalSection title="6. Daily quests and reward Blox">
        <p>
          Blox earned by completing daily quests or other in-app rewards is not a purchase and was
          not paid for; it is a promotional grant we may modify, rebalance, or discontinue at any
          time, including changing which quests exist, their targets, or their rewards, without
          compensation for previously available quests.
        </p>
      </LegalSection>

      <LegalSection title="7. Spark Plus">
        <p>
          Bloxspark Premium ("Spark Plus") is a recurring subscription governed primarily by Section
          7 of our Terms of Use (billing cycle, automatic renewal, cancellation, and administrator
          grants). A month of Spark Plus received as a gift under Section 5 above is a one-time
          credit, not a subscription: it does not renew, is not billed again, and simply extends or
          starts an active Plus period on the recipient's account.
        </p>
      </LegalSection>

      <LegalSection title="8. Your right of withdrawal (EU/EEA and UK consumers)">
        <p>
          If you are a consumer in the European Union, the European Economic Area, or the United
          Kingdom, you normally have a 14-day right to withdraw from an online purchase without
          giving a reason, under the EU Consumer Rights Directive (2011/83/EU) and the UK Consumer
          Contracts (Information, Cancellation and Additional Charges) Regulations 2013.
        </p>
        <p>
          Blox, badges, and gifted Spark Plus months are digital content not supplied on a tangible
          medium, delivered to you immediately (your Blox balance, badge, or gifted period updates
          as soon as payment is confirmed). Under both frameworks, this 14-day right ends once
          performance has begun, if you expressly requested immediate delivery and acknowledged that
          you lose the right of withdrawal by doing so. By clicking "Pay" at checkout, you give that
          consent and acknowledgment for that specific purchase. If a purchase has not yet been
          delivered (for example, a payment that failed to complete), your withdrawal right is
          unaffected.
        </p>
      </LegalSection>

      <LegalSection title="9. Consumers outside the EU/EEA/UK">
        <p>
          If mandatory consumer-protection law in your country of residence grants you a
          cancellation, cooling-off, or refund right for digital purchases that this policy does not
          already provide, that local law applies and is not limited by this page. Nothing here
          restricts a right you cannot waive by contract under your local law, including applicable
          U.S. state consumer-protection statutes.
        </p>
      </LegalSection>

      <LegalSection title="10. When we do refund">
        <p>
          Outside of a legally protected withdrawal right, purchases are final. We do, however,
          refund or reverse a charge when:
        </p>
        <ul>
          <li>You were charged more than once for the same purchase (a duplicate charge);</li>
          <li>
            A technical error on our side credited the wrong amount of Blox, the wrong badge, or no
            benefit at all despite a successful charge;
          </li>
          <li>
            We determine, after review, that the payment was unauthorized or fraudulent and you were
            not the one who made it;
          </li>
          <li>Applicable law requires a refund in your specific situation.</li>
        </ul>
        <p>
          We do not refund Blox, badges, or Spark Plus because you changed your mind after immediate
          delivery, because you no longer use the account, or because your account was suspended or
          terminated for a Terms of Use violation.
        </p>
      </LegalSection>

      <LegalSection title="11. How to request a refund or dispute a charge">
        <p>
          Contact the in-app Support center first, with the date, amount, and (if you have it) the
          receipt or order reference from Purchases & Billing. We aim to review and respond to
          payment issues promptly. Filing a card chargeback before contacting Support can delay
          resolution and, where a charge turns out to have been legitimate, may lead to a temporary
          restriction on your account's purchasing ability while the dispute is resolved with our
          payment processor.
        </p>
      </LegalSection>

      <LegalSection title="12. Pricing changes and errors">
        <p>
          We may change the price, Blox amount, or composition of any pack, badge, or promotion for
          future purchases at any time; a change never retroactively affects a purchase you already
          completed. If a price is displayed incorrectly due to a technical or typographical error,
          we may cancel and refund the affected order rather than honor the incorrect price.
        </p>
      </LegalSection>

      <LegalSection title="13. Effect of account termination">
        <p>
          If your account is suspended or terminated under Section 17 of our Terms of Use, any
          remaining Blox balance, unequipped or equipped badges, and any unused portion of a paid or
          gifted Spark Plus period are forfeited without compensation, except where applicable law
          requires otherwise.
        </p>
      </LegalSection>

      <LegalSection title="14. Changes to this policy">
        <p>
          We may update this Shop Terms & Refund Policy as our purchase features change. We'll post
          the new version here with an updated date; material changes affecting how a purchase you
          already made works will not be applied retroactively to that purchase.
        </p>
      </LegalSection>

      <LegalSection title="15. Governing law and contact">
        <p>
          This policy is governed by French law, without prejudice to any mandatory
          consumer-protection provisions of the law of your country of habitual residence, which
          continue to apply where applicable - see Sections 8 and 9 above. For any question about a
          purchase, contact us through the in-app Support center.
        </p>
      </LegalSection>
    </LegalPage>
  ),
});
