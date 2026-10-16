import { describe, expect, test } from "bun:test";
import { draftFields, draftLink, draftStatusLabel, htmlToText, isGmailProposal } from "./gmail-drafts";
import type { CrmWriteChange, CrmWriteProposalView } from "./types";

const change = (field: string, after: CrmWriteChange["after"], label = field): CrmWriteChange => ({ field, label, before: null, after });

function view(overrides: Partial<CrmWriteProposalView> = {}): CrmWriteProposalView {
  return {
    proposalId: "p1",
    requestId: "r1",
    tool: "gmail_create_draft",
    provider: "gmail",
    target: { entity: "gmailDraft", id: null, label: "Reply to Priya" },
    changes: [],
    status: "pending",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    ...overrides,
  };
}

describe("draftFields", () => {
  test("picks the email's fields out of the changes and keeps the rest as extra rows", () => {
    const body = "Hi Priya,\n\nCould you send a scan of your passport?\n\nThanks";
    const f = draftFields([
      change("to", "priya@example.com", "To"),
      change("cc", "office@experteducation.com", "Cc"),
      change("subject", "Passport scan", "Subject"),
      change("body", body, "Body"),
      change("threadId", "18c2f", "Thread"),
      change("importance", "high", "Importance"),
      change("empty", null, "Empty"),
    ]);
    expect(f).toEqual({
      to: "priya@example.com",
      cc: "office@experteducation.com",
      bcc: null,
      subject: "Passport scan",
      body,
      bodyIsHtml: false,
      inReplyTo: "18c2f",
      others: [{ field: "importance", label: "Importance", value: "high" }],
    });
  });

  test("matches the backend's normalised labels, whatever the raw arg is called", () => {
    const f = draftFields([
      change("recipients", "priya@example.com", "To"),
      change("cc", "a@x.com, b@x.com", "Cc"),
      change("bcc", "c@x.com", "Bcc"),
      change("subject", "Offer letter", "Subject"),
      change("plain_text_body", "Hi Priya", "Body"),
      change("replyToMessageId", "msg-1", "In reply to message"),
      change("priority", "high", "priority"),
    ]);
    expect(f).toEqual({
      to: "priya@example.com",
      cc: "a@x.com, b@x.com",
      bcc: "c@x.com",
      subject: "Offer letter",
      body: "Hi Priya",
      bodyIsHtml: false,
      inReplyTo: "msg-1",
      others: [{ field: "priority", label: "priority", value: "high" }],
    });
    expect(draftFields([change("threadId", "t-1", "In reply to thread")]).inReplyTo).toBe("t-1");
  });

  test("an HTML-only body is the body, as text, never as markup", () => {
    const f = draftFields([
      change("to", "priya@example.com", "To"),
      change("htmlBody", '<p>Hi <b>Priya</b>,</p><p>Please <a href="https://evil.tld/login">sign in</a>.<br>Thanks</p><img src="https://evil.tld/t.png" alt="logo"><script>alert(1)</script>', "Body (HTML)"),
    ]);
    expect(f.bodyIsHtml).toBe(true);
    expect(f.body).toBe("Hi Priya,\n\nPlease sign in (https://evil.tld/login).\nThanks\n[image: logo https://evil.tld/t.png]");
    expect(f.body).not.toContain("<");
    expect(f.others).toEqual([]);
  });

  test("with a plain body too, the HTML body is still shown, as its own text row", () => {
    const f = draftFields([change("body", "Hi Priya", "Body"), change("htmlBody", "<p>Hi <i>Priya</i> &amp; team</p>", "Body (HTML)")]);
    expect(f.body).toBe("Hi Priya");
    expect(f.bodyIsHtml).toBe(false);
    expect(f.others).toEqual([{ field: "htmlBody", label: "Body (HTML)", value: "Hi Priya & team" }]);
  });

  test("nothing approved is dropped: repeated recipients join, a second subject or body gets its own row", () => {
    const f = draftFields([
      change("to", "a@x.com", "To"),
      change("recipients", "b@x.com", "To"),
      change("subject", "One", "Subject"),
      change("title", "Two", "Subject"),
      change("body", "First", "Body"),
      change("text", "Second", "Body"),
    ]);
    expect(f.to).toBe("a@x.com, b@x.com");
    expect(f.subject).toBe("One");
    expect(f.body).toBe("First");
    expect(f.others).toEqual([
      { field: "title", label: "Subject", value: "Two" },
      { field: "text", label: "Body", value: "Second" },
    ]);
  });

  test("older proposals without normalised labels still match on the field name", () => {
    const f = draftFields([change("To", "a@x.com", "To"), change("htmlBody", "<p>Hi</p>", "htmlBody"), change("replyToMessageId", "m-9", "replyToMessageId")]);
    expect(f.to).toBe("a@x.com");
    expect(f.body).toBe("Hi");
    expect(f.bodyIsHtml).toBe(true);
    expect(f.inReplyTo).toBe("m-9");
    expect(f.others).toEqual([]);
  });

  test("matches field names case-insensitively and joins address lists", () => {
    const f = draftFields([change("To", ["a@x.com", "b@x.com"] as unknown as string), change("BCC", "c@x.com"), change("subject", "  ")]);
    expect(f.to).toBe("a@x.com, b@x.com");
    expect(f.bcc).toBe("c@x.com");
    expect(f.subject).toBeNull();
    expect(f.body).toBeNull();
  });
});

describe("htmlToText", () => {
  test("decodes entities, drops comments, styles and scripts, keeps list items", () => {
    expect(htmlToText("<style>p{color:red}</style><!-- hi --><ul><li>One &lt;1&gt;</li><li>Two&nbsp;&#8212;&#x21;</li></ul>")).toBe("• One <1>\n• Two —!");
  });

  test("a body cut off mid-tag by the backend's preview cap keeps its truncation note", () => {
    expect(htmlToText('<p>Hello</p><a href="https://x.co\n… (120 more characters)')).toBe("Hello\n… (120 more characters)");
  });
});

describe("Gmail proposal helpers", () => {
  test("provider gmail, or a gmailDraft target, is a Gmail proposal; a row without provider is CRM", () => {
    expect(isGmailProposal(view())).toBe(true);
    expect(isGmailProposal(view({ provider: undefined }))).toBe(true);
    expect(isGmailProposal({ provider: undefined, target: { entity: "contact", id: "c1", label: "x" } })).toBe(false);
    expect(isGmailProposal({ provider: "crm", target: { entity: "note", id: null, label: "x" } })).toBe(false);
  });

  test("status wording says nothing is sent", () => {
    expect(draftStatusLabel(view({ status: "applied" }))).toBe("Saved to Gmail Drafts");
    expect(draftStatusLabel(view({ status: "rejected" }))).toBe("Discarded, nothing saved");
    expect(draftStatusLabel(view({ status: "expired" }))).toBe("Expired, not saved");
    expect(draftStatusLabel(view({ status: "failed", error: "Gmail is disconnected" }))).toBe("Not saved: Gmail is disconnected");
  });

  test("the Open in Gmail link is only a real https link on an applied draft", () => {
    expect(draftLink(view({ status: "applied", result: { link: "https://mail.google.com/mail/#drafts?compose=abc" } }))).toBe("https://mail.google.com/mail/#drafts?compose=abc");
    expect(draftLink(view({ status: "applied", result: { link: "javascript:alert(1)" } }))).toBeNull();
    expect(draftLink(view({ status: "applied", result: { id: "r-1" } }))).toBeNull();
    expect(draftLink(view({ status: "pending", result: { link: "https://mail.google.com/x" } }))).toBeNull();
  });
});
