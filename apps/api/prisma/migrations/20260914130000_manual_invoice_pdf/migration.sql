-- Client download is only for staff-uploaded PDFs after Paid.
-- Clear previously auto-generated invoice PDFs.
UPDATE "Invoice" SET "pdfPath" = NULL;
