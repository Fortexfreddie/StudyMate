import type { Metadata } from "next";
import { LegalLayout, LegalSection } from "../LegalLayout";

export const metadata: Metadata = {
  title: "Privacy Policy — StudyMate",
};

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" updated="June 2026">
      <p>
        StudyMate is an academic study companion built at the Federal University of Technology,
        Owerri. It lets you upload your own PDF lecture notes and study them through AI-powered chat,
        summaries, and quizzes, with every answer grounded strictly in your uploaded material. This
        policy explains what we collect, why, and the control you have over it.
      </p>

      <LegalSection heading="1. Information We Collect">
        <ul className="list-disc pl-5 flex flex-col gap-1.5">
          <li>
            <strong className="text-white">Account details:</strong> your full name, email address,
            an optional study major/institution, and a securely hashed password (we never store your
            password in plain text).
          </li>
          <li>
            <strong className="text-white">Documents you upload:</strong> the PDF files you submit,
            from which we extract text and split it into small excerpts (&ldquo;chunks&rdquo;).
          </li>
          <li>
            <strong className="text-white">Derived study data:</strong> vector embeddings of your
            document chunks, plus your chat history, generated summaries, and quiz sessions/scores.
          </li>
          <li>
            <strong className="text-white">Usage metrics:</strong> daily token consumption and study
            activity dates, used to enforce plan limits and show your study streak.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="2. How We Use Your Information">
        <p>
          Your data is used solely to operate the service: to authenticate you, to process your PDFs
          into a searchable form, to retrieve the most relevant excerpts when you ask a question, to
          generate grounded answers/summaries/quizzes, to keep your study history, and to enforce
          daily usage limits. We do not sell your data or use it for advertising.
        </p>
      </LegalSection>

      <LegalSection heading="3. Third-Party Processing">
        <p>
          To provide AI features, document text and your queries are sent to Google&rsquo;s Gemini
          API (for generation) and Google&rsquo;s embedding model (to index your documents). Vectors
          are stored with Qdrant Cloud and relational data with a managed PostgreSQL provider. These
          providers process data on our behalf to deliver the service; review their respective
          policies for details.
        </p>
      </LegalSection>

      <LegalSection heading="4. Data Storage & Security">
        <p>
          Account and history records are stored in PostgreSQL; document vectors are stored in
          Qdrant, keyed to your account. Passwords are hashed with Argon2id, access is protected by
          short-lived JWT tokens, and every document is scoped to its owner — other users cannot
          access your materials.
        </p>
      </LegalSection>

      <LegalSection heading="5. Your Choices & Deletion">
        <p>
          You can edit your profile at any time, and deleting a document removes both its metadata
          and all of its indexed vectors from our systems. The AI is constrained to your retrieved
          content — if your documents don&rsquo;t cover a question, it will say so rather than
          inventing an answer. To request full account deletion, contact the project maintainer.
        </p>
      </LegalSection>

      <LegalSection heading="6. AI-Generated Content">
        <p>
          Answers, summaries, and quizzes are produced by an AI model and may contain mistakes. They
          are a study aid, not an authoritative source — always verify important facts against your
          original materials.
        </p>
      </LegalSection>

      <LegalSection heading="7. Contact">
        <p>
          This is an academic project. For questions about this policy or your data, contact the
          project maintainer, Ekwem Kamsiyochukwu Fredrick.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
