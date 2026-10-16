import { describe, expect, test } from "bun:test";
import { citationNumber, citedNumbers, hostOf, isCalendarSource, isCrmSource, isDriveSource, isGmailSource, isWorkspaceSource, linkifyCitations, openableUrl, originOf, provenanceLabel } from "./citations";

describe("citations", () => {
  test("linkifies [n] markers outside code and leaves links and code alone", () => {
    expect(linkifyCitations("Fees are AUD 20k [1][3]. See [2](https://x) and `[4]`.")).toBe("Fees are AUD 20k [1](#cite-1)[3](#cite-3). See [2](https://x) and `[4]`.");
    expect(citationNumber("#cite-7")).toBe(7);
    expect(citationNumber("https://x")).toBeNull();
  });

  test("lists distinct cited numbers in first-use order", () => {
    expect(citedNumbers("A [2] then [1][2] and ```[9]```")).toEqual([2, 1]);
  });

  test("never exposes a crm:// identifier as a link", () => {
    expect(isCrmSource({ url: "crm://crm_get_contact/abc" })).toBe(true);
    expect(openableUrl({ url: "crm://crm_get_contact/abc", docType: "crm_record", webUrl: "https://crm.example/c/1" })).toBe("https://crm.example/c/1");
    expect(openableUrl({ url: "crm://crm_get_contact/abc", docType: "crm_record" })).toBeNull();
    expect(openableUrl({ url: "https://monash.edu/x" })).toBe("https://monash.edu/x");
  });

  test("names provenance in words", () => {
    expect(provenanceLabel({ url: "crm://x" })).toBe("CRM record");
    expect(provenanceLabel({ url: "https://a", live: true })).toBe("Live page");
    expect(provenanceLabel({ url: "https://a", source: "web:google" })).toBe("Web search");
    expect(provenanceLabel({ url: "https://a", sourceKind: "partner" })).toBe("Partner site");
    expect(provenanceLabel({ url: "https://a", source: "upload:policy" })).toBe("Uploaded document");
    expect(provenanceLabel({ url: "https://experteducation.com/nepal/x" })).toBe("Expert Education");
    expect(provenanceLabel({ url: "https://a" })).toBe("Knowledge base");
  });

  describe("Gmail and Drive evidence", () => {
    const gmail = { url: "gmail://thread/18c2f", source: "gmail", docType: "email_thread", webUrl: "https://mail.google.com/mail/u/0/#all/18c2f" };
    const drive = { url: "drive://file/1AbC", source: "drive", docType: "drive_file", webUrl: "https://docs.google.com/document/d/1AbC/edit" };

    test("recognises each by source, docType or URI scheme", () => {
      expect(isGmailSource(gmail)).toBe(true);
      expect(isGmailSource({ url: "gmail://x" })).toBe(true);
      expect(isGmailSource({ url: "https://a", docType: "email_thread" })).toBe(true);
      expect(isGmailSource({ url: "https://a", source: "gmail" })).toBe(true);
      expect(isDriveSource(drive)).toBe(true);
      expect(isDriveSource({ url: "drive://x" })).toBe(true);
      expect(isDriveSource({ url: "https://a", docType: "drive_file" })).toBe(true);
      expect(isGmailSource(drive)).toBe(false);
      expect(isDriveSource(gmail)).toBe(false);
      expect(isWorkspaceSource({ url: "https://mail.google.com/x" })).toBe(false);
      expect(isCrmSource(gmail)).toBe(false);
      expect(isGmailSource(undefined)).toBe(false);
    });

    test("opens through webUrl, never the gmail:// or drive:// identifier", () => {
      expect(openableUrl(gmail)).toBe(gmail.webUrl);
      expect(openableUrl(drive)).toBe(drive.webUrl);
      expect(openableUrl({ ...gmail, webUrl: null })).toBeNull();
      expect(openableUrl({ ...drive, webUrl: undefined })).toBeNull();
      // A scheme that is not http(s) never reaches an href, whatever the backend sends.
      expect(openableUrl({ ...gmail, webUrl: "javascript:alert(1)" })).toBeNull();
      expect(openableUrl({ ...drive, webUrl: "drive://file/1AbC" })).toBeNull();
    });

    test("names provenance and origin in words", () => {
      expect(provenanceLabel(gmail)).toBe("From your Gmail");
      expect(provenanceLabel(drive)).toBe("From your Drive");
      expect(provenanceLabel({ url: "gmail://x" })).toBe("From your Gmail");
      expect(originOf(gmail)).toBe("your Gmail");
      expect(originOf(drive)).toBe("your Drive");
    });

    test("hostOf never prints the raw scheme", () => {
      expect(hostOf("gmail://thread/18c2f")).toBe("your Gmail");
      expect(hostOf("drive://file/1AbC")).toBe("your Drive");
      expect(hostOf("gmail://thread/18c2f")).not.toContain("gmail://");
      expect(hostOf("https://www.monash.edu/x")).toBe("monash.edu");
    });
  });

  describe("Calendar evidence", () => {
    const event = { url: "calendar://event/abc123", source: "calendar", docType: "calendar_event", webUrl: "https://calendar.google.com/calendar/event?eid=YWJjMTIz" };

    test("recognised by source, docType or URI scheme, and counted as workspace evidence", () => {
      expect(isCalendarSource(event)).toBe(true);
      expect(isCalendarSource({ url: "calendar://x" })).toBe(true);
      expect(isCalendarSource({ url: "https://a", docType: "calendar_event" })).toBe(true);
      expect(isCalendarSource({ url: "https://a", source: "calendar" })).toBe(true);
      expect(isWorkspaceSource(event)).toBe(true);
      expect(isGmailSource(event)).toBe(false);
      expect(isDriveSource(event)).toBe(false);
      expect(isCrmSource(event)).toBe(false);
      expect(isCalendarSource({ url: "https://calendar.google.com/x" })).toBe(false);
    });

    test("opens the event through webUrl; names it in words", () => {
      expect(openableUrl(event)).toBe(event.webUrl);
      expect(openableUrl({ ...event, webUrl: "calendar://event/abc123" })).toBeNull();
      expect(provenanceLabel(event)).toBe("From your Calendar");
      expect(originOf(event)).toBe("your Calendar");
      expect(hostOf("calendar://event/abc123")).toBe("your Calendar");
      expect(hostOf(event.webUrl)).toBe("calendar.google.com");
    });
  });
});
