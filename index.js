require("dotenv").config();
const fs = require("fs");
const fetch = require("node-fetch");
const express = require("express");
const cheerio = require("cheerio");
const minify = require("html-minifier").minify;
const CleanCSS = require("clean-css");
const Jimp = require("jimp");
const { URL } = require("url");

const app = express();

const ip = process.env.IP;
const port = process.env.PORT || 3000;
const stripCSS = process.env.NO_CSS;
const stripJs = process.env.NO_JS;
const minifyImages = Boolean(process.env.RESIZE_TO);
let friendlies = [];
try {
  const input = fs.readFileSync(process.env.ALLOWLIST, { encoding: "utf-8" });
  friendlies = input.trim().split("\n");
  console.log("allow-list", friendlies);
} catch (error) {
  console.error("Failed to load allow-list!");
  friendlies = [];
}
const maxSrcWidth = process.env.RESIZE_TO;
const maxInlineWidth = process.env.SCALE_TO;

const cssMinifyOptions = {
  compatibility: {
    colors: {
      opacity: false, // controls `rgba()` / `hsla()` color support
    },
    properties: {
      backgroundClipMerging: false, // controls background-clip merging into shorthand
      backgroundOriginMerging: false, // controls background-origin merging into shorthand
      backgroundSizeMerging: false, // controls background-size merging into shorthand
      colors: true, // controls color optimizations
      ieBangHack: true, // controls keeping IE bang hack
      ieFilters: true, // controls keeping IE `filter` / `-ms-filter`
      iePrefixHack: true, // controls keeping IE prefix hack
      ieSuffixHack: true, // controls keeping IE suffix hack
      merging: false, // controls property merging based on understandability
      shorterLengthUnits: false, // controls shortening pixel units into `pc`, `pt`, or `in` units
      spaceAfterClosingBrace: true, // controls keeping space after closing brace - `url() no-repeat` into `url()no-repeat`
      urlQuotes: true, // controls keeping quoting inside `url()`
      zeroUnits: true, // controls removal of units `0` value
    },
    selectors: {
      adjacentSpace: false, // controls extra space before `nav` element
      ie7Hack: false, // controls removal of IE7 selector hacks, e.g. `*+html...`
      mergeLimit: 8191, // controls maximum number of selectors in a single rule (since 4.1.0)
      multiplePseudoMerging: true, // controls merging of rules with multiple pseudo classes / elements (since 4.1.0)
    },
    units: {
      ch: false, // controls treating `ch` as a supported unit
      in: false, // controls treating `in` as a supported unit
      pc: false, // controls treating `pc` as a supported unit
      pt: false, // controls treating `pt` as a supported unit
      rem: false, // controls treating `rem` as a supported unit
      vh: false, // controls treating `vh` as a supported unit
      vm: false, // controls treating `vm` as a supported unit
      vmax: false, // controls treating `vmax` as a supported unit
      vmin: false, // controls treating `vmin` as a supported unit
    },
  },
};

const minifyOptions = {
  collapseBooleanAttributes: true,
  collapseWhitespace: true,
  processConditionalComments: true,
  removeComments: true,
  minifyCSS: stripCSS ? false : cssMinifyOptions,
};

app.get("*", async (req, res, next) => {
  const friendly = friendlies.some((f) => req.hostname.endsWith(f));
  const url = req.originalUrl;
  if (friendly) {
    console.log("friendly site:", url);
  }
  try {
    const upstream = await fetch(url);
    const contentType = upstream.headers.get("content-type");
    //console.log(contentType);
    if (contentType.startsWith("text/html")) {
      const imageSizes = {};
      const text = (await upstream.text()).replace(/https:\/\//g, "http://");
      const $ = cheerio.load(text);
      if (!friendly && stripJs) {
        $("script").remove();
        $("noscript").after(function (index) {
          $(this).contents();
        });
        $("noscript").remove();
      }
      if (!friendly && stripCSS) {
        $("style").remove();
        $("link").remove();
        $("*").removeAttr("class");
        $("*").removeAttr("style");
      }
      if (!friendly) {
        const imgs = [];
        $("img").each(function () {
          const src = new URL($(this).attr("src"), url).href;
          //remove SVGs for now
          if (src.toLowerCase().endsWith(".svg")) {
            $(this).remove();
          } else {
            imgs.push(this);
          }
        });

        if (maxInlineWidth) {
          //set image tag sizes
          for (let img of imgs) {
            const src = new URL($(img).attr("src"), url).href;
            const attrWidth = $(img).attr("width");
            const attrHeight = $(img).attr("height");
            if (!attrWidth) {
              try {
                if (!imageSizes[src]) {
                  const image = await Jimp.read(src);
                  imageSizes[src] = {
                    width: image.bitmap.width,
                    height: image.bitmap.height,
                  };
                }
                const width = Math.min(maxInlineWidth, imageSizes[src].width);
                const height =
                  (imageSizes[src].height * width) / imageSizes[src].width;
                $(this).attr("width", width);
                $(this).attr("height", height);
              } catch (error) {
                console.error(error);
              }
            } else {
              const width = Math.min(maxInlineWidth, attrWidth);
              const height = (attrHeight * width) / attrWidth;
              $(this).attr("width", width);
              $(this).attr("height", height);
            }
          }
        }
      }
      //fix root-relative URLs for Netscape
      $("[href^='/']").each(function(index,element) {
      const href = $(element).attr('href');
      $(this).attr('href',new URL(url).origin+href);
    });
      res.set("Content-Type", "text/html");
      res.status(upstream.status);
      if (!friendly) {
        console.log("html minified", contentType, url);
        res.send(
          minify(
            $.root()
              .html()
              .replace(/&apos;/g, "'"),
            minifyOptions
          )
        );
      } else {
        res.send(
          $.root()
            .html()
            .replace(/&apos;/g, "'")
        );
      }
    } else if (contentType.startsWith("text/css")) {
      const text = await upstream.text();
      res.set("Content-Type", "text/css");
      res.status(upstream.status);
      res.send(new CleanCSS(cssMinifyOptions).minify(text).styles);
      console.log("css minified", contentType, url);
    } else if (
      !friendly &&
      minifyImages &&
      contentType.startsWith("image/") &&
      !contentType.includes("xml")
    ) {
      const buffer = await upstream.buffer();
      const image = await Jimp.read(buffer);
      image.resize(Math.min(maxSrcWidth, image.bitmap.width), Jimp.AUTO);
      image.quality(50);
      const output = await image.getBufferAsync("image/jpeg");
      res.set("Content-Type", "image/jpeg");
      res.status(upstream.status);
      res.send(output);
      console.log("image minified", contentType, url);
    } else {
      res.set("Content-Type", contentType);
      res.status(upstream.status);
      res.send(await upstream.buffer());
    }
  } catch (error) {
    console.error(error);
    res.set("Content-Type", "text/html");
    res.status(502);
    res.send(
      `<html>
  <head>
    <title>502 - Bad Gateway</title>
  </head>
  <body>
    <h1>502 - Bad Gateway</h1>
    <p>An error occurred while retrieving the page:
    <p>
      ${error}
    </p>
  </body>
</html>`
    );
  }
});

if (ip != "") {
  app.listen(port, ip);
} else {
  app.listen(port);
}

console.log(
  `Listening on port ${port}, CSS is ${
    stripCSS ? "disabled" : "enabled"
  }, images are ${minifyImages ? "compressed" : "original quality"}`
);
