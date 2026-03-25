import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Privacy Policy | CreativeBridge',
  description:
    "CreativeBridge privacy policy — learn how we protect children's privacy and comply with COPPA.",
};

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <article className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-display text-3xl text-primary md:text-4xl">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          Last updated: March 25, 2026
        </p>

        <div className="mt-8 space-y-8 text-base leading-relaxed text-text-secondary">
          <section>
            <h2 className="mb-3 text-xl font-semibold text-text">
              Introduction
            </h2>
            <p>
              CreativeBridge (&quot;we,&quot; &quot;our,&quot; or
              &quot;us&quot;) is an AI-powered educational storytelling
              application designed for students in grades K-12. We are committed
              to protecting the privacy of all our users, especially children.
              This Privacy Policy explains how we collect, use, and safeguard
              information when you use our application.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-text">
              COPPA Compliance
            </h2>
            <p>
              CreativeBridge complies with the Children&apos;s Online Privacy
              Protection Act (COPPA). We take the following measures to protect
              children&apos;s privacy:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>
                We do not collect personal information from children under 13
                without verifiable parental consent.
              </li>
              <li>
                Parents and guardians can review, delete, or refuse further
                collection of their child&apos;s data at any time by contacting
                us.
              </li>
              <li>
                Data collected is used solely for providing the educational
                storytelling experience within the app.
              </li>
              <li>
                We do not use behavioral advertising or third-party ad networks.
              </li>
              <li>
                There are no social features or user-to-user communication for
                users under 13.
              </li>
              <li>
                We maintain strict data retention and deletion policies — user
                data is retained only as long as necessary to provide the
                service, and is permanently deleted upon account deletion or
                parental request.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-text">
              Information We Collect
            </h2>
            <p>
              To provide the CreativeBridge educational experience, we may
              collect:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>
                Account information (name, email address, grade level) provided
                during registration with parental consent for users under 13.
              </li>
              <li>
                Story content created by users within the app, including text
                and AI-generated illustrations.
              </li>
              <li>
                Usage data such as grade level selections, story preferences,
                and engagement metrics (XP, streaks) to personalize the learning
                experience.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-text">
              How We Use Information
            </h2>
            <p>We use collected information exclusively to:</p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>
                Provide age-appropriate, AI-powered storytelling experiences.
              </li>
              <li>
                Save and manage user-created stories in the Story Library.
              </li>
              <li>
                Track educational progress through the XP and achievement
                system.
              </li>
              <li>
                Improve the quality and safety of our educational content.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-text">
              Data Security
            </h2>
            <p>
              We implement industry-standard security measures to protect user
              data, including encryption in transit and at rest, secure
              authentication, and regular security audits. Access to user data
              is strictly limited to authorized personnel who need it to operate
              and improve the service.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-text">
              Third-Party Services
            </h2>
            <p>
              CreativeBridge uses third-party AI services (OpenAI) to generate
              story content and illustrations. Content sent to these services is
              processed in accordance with their privacy policies and is not
              used to train their models. We do not share personal information
              with any third-party advertisers or marketing platforms.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-text">
              Parental Rights
            </h2>
            <p>Parents and guardians of children under 13 have the right to:</p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>
                Review the personal information we have collected from their
                child.
              </li>
              <li>
                Request deletion of their child&apos;s personal information and
                account.
              </li>
              <li>
                Refuse to permit any further collection or use of their
                child&apos;s information.
              </li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, please contact us at{' '}
              <a
                href="mailto:privacy@creativebridge.app"
                className="text-primary-dark underline hover:text-primary"
              >
                privacy@creativebridge.app
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-text">
              Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. We will
              notify users of any material changes by posting the new Privacy
              Policy within the app and updating the &quot;Last updated&quot;
              date above. Continued use of CreativeBridge after changes
              constitutes acceptance of the revised policy.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-text">Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy or our data
              practices, please contact us at{' '}
              <a
                href="mailto:privacy@creativebridge.app"
                className="text-primary-dark underline hover:text-primary"
              >
                privacy@creativebridge.app
              </a>
              .
            </p>
          </section>
        </div>
      </article>
      <Footer />
    </>
  );
}
