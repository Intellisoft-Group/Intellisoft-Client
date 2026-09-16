/**
 * Upsert corporate Intellisoft FAQs without wiping the database.
 * Run inside the API container:
 *   node prisma/upsert-faqs.js
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const FAQS = [
  {
    question: 'Who is Intellisoft?',
    answer:
      'Intellisoft is an IT services company that designs, builds, hosts, and supports digital products for businesses. We partner with clients as a long-term technology team—not a one-time vendor.',
  },
  {
    question: 'What services does Intellisoft provide?',
    answer:
      'We deliver software development, websites and web apps, cloud and hosting, IT support, AMC, and related digital services. Each engagement is scoped to your business goals, timeline, and budget.',
  },
  {
    question: 'Do you serve clients online across the globe?',
    answer:
      'Yes. Intellisoft works with clients online and delivers services remotely, so we can support businesses in India and across the world. Communication, delivery reviews, billing, and support all run through secure digital channels—including this client app and portal.',
  },
  {
    question: 'How does an engagement with Intellisoft typically work?',
    answer:
      'We begin with your requirements, agree the scope and commercial terms, then deliver in clear stages. You can track projects, invoices, files, and support updates in the Intellisoft client app throughout the engagement.',
  },
  {
    question: 'How do I pay an invoice?',
    answer:
      'Open Bills, select the invoice, and choose Clear invoice. Transfer the amount using the bank details shown and include the invoice number as the payment reference. After we confirm receipt, the invoice is marked Paid.',
  },
  {
    question: 'How do I get support for a live service or project?',
    answer:
      'Use the Support section in the app to raise a ticket. Describe the issue clearly and attach details where helpful. Our team responds in-app so you have a full record of the conversation.',
  },
  {
    question: 'Where can I track project progress and share files?',
    answer:
      'Open Projects to view milestones, payment stages, chat, and project files. You can upload logos, briefs, contracts, and delivery assets so both teams work from the same source of truth.',
  },
  {
    question: 'Can I download invoice PDFs?',
    answer:
      'Yes. When an invoice PDF is available, a download option appears on that invoice in Bills. If a PDF is still pending, our finance team will upload it after the document is ready.',
  },
  {
    question: 'How is my business information protected?',
    answer:
      'Access to the client app is limited to authorised accounts for your organisation. Files, invoices, and support history are handled through Intellisoft systems under your service agreement and our operational security practices.',
  },
  {
    question: 'How do I start a new project or request additional services?',
    answer:
      'Contact your Intellisoft account manager, or use in-app chat / Support to share your requirement. Our team will confirm scope, commercial terms, and next steps before work begins.',
  },
];

async function main() {
  for (let i = 0; i < FAQS.length; i++) {
    const item = FAQS[i];
    const existing = await prisma.faq.findFirst({ where: { question: item.question } });
    if (existing) {
      await prisma.faq.update({
        where: { id: existing.id },
        data: { answer: item.answer, sortOrder: i, isActive: true },
      });
      console.log(`Updated: ${item.question}`);
    } else {
      await prisma.faq.create({
        data: { question: item.question, answer: item.answer, sortOrder: i, isActive: true },
      });
      console.log(`Created: ${item.question}`);
    }
  }
  console.log(`Done. ${FAQS.length} FAQs ready for the client app.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
