const fetch = require('node-fetch');
const express = require('express');
const cheerio = require('cheerio');
const minify = require('html-minifier').minify;
const CleanCSS = require('clean-css');
const Jimp = require('jimp');

const app = express();

if(process.argv.includes('--help') || isNaN(process.argv[2])) {
  const info = require('./package.json');
  console.log(`${info.name} ${info.version}`);
  console.log('\n'+info.description+'\n');
  console.log('Arguments:');
  console.log('    <port> : port to listen on');
  console.log('    --css : Do not strip CSS. CSS will be minified.');
  console.log('    --fullimages : Do not resize or convert images.');
  console.log('    --help : display this message');
  process.exit();
}
const port = process.argv[2];
const stripCSS = !process.argv.includes('--css');
const minifyImages = !process.argv.includes('--fullimages');

const maxSrcWidth = 800;
const maxInlineWidth = 608;

const cssMinifyOptions = {
  compatibility: {
    colors: {
      opacity: false // controls `rgba()` / `hsla()` color support
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
      zeroUnits: true // controls removal of units `0` value
    },
    selectors: {
      adjacentSpace: false, // controls extra space before `nav` element
      ie7Hack: false, // controls removal of IE7 selector hacks, e.g. `*+html...`
      mergeLimit: 8191, // controls maximum number of selectors in a single rule (since 4.1.0)
      multiplePseudoMerging: true // controls merging of rules with multiple pseudo classes / elements (since 4.1.0)
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
      vmin: false // controls treating `vmin` as a supported unit
    }
  }
};

const minifyOptions = {
  collapseBooleanAttributes:true,
  collapseWhitespace:true,
  removeComments:true,
  minifyCSS:stripCSS? false : cssMinifyOptions
};

app.get('*', async (req, res, next) => {
  const url = req.originalUrl;
  //console.log('\n\nGET: ',url);
  
  const upstream = await fetch(url);
  const contentType = upstream.headers.get('content-type');
  //console.log(contentType);
  if(contentType.startsWith('text/html')) {
    const text = await upstream.text();
    const $ = cheerio.load(text);
    $('script').remove();
    $('noscript').after(function(index) {
      $(this).contents();
    });
    $('noscript').remove();
    if(stripCSS) {
      $('style').remove();
      $('link').remove();
      $('*').removeAttr('class');
      $('*').removeAttr('style');
      $("img").each(function(index) {
        const width = $(this).attr('width');
        const height = $(this).attr('height');
        if(!width && !height) {
          $(this).attr('width',maxInlineWidth);
        }
      });
    }
    $("img").each(function(index) {
      const width = $(this).attr('width');
      const height = $(this).attr('height');
      if(width) {
        const newWidth = Math.min(maxInlineWidth,width);
        $(this).attr('width',newWidth);
        if(height) {
          $(this).attr('height',height*newWidth/width);
        }
      }
    });
    $("[href^='https:']").each(function(index,element) {
      const href = $(element).attr('href');
      $(this).attr('href',href.replace(/^https:/, 'http:'));
    });
    $("[src^='https:']").each(function() {
      const src = $(this).attr('src');
      $(this).attr('src',src.replace(/^https:/, 'http:'));
    });
    res.set('Content-Type','text/html');
    res.status(upstream.status);
    res.send(minify($.root().html().replace(/&apos;/g,"'"),minifyOptions));
    console.log('html minified',contentType,url);
  } else if(contentType.startsWith('text/css')) {
    const text = await upstream.text();
    res.set('Content-Type','text/css');
    res.status(upstream.status);
    res.send(new CleanCSS(cssMinifyOptions).minify(text).styles);
    console.log('css minified',contentType,url);
  } else if(minifyImages && contentType.startsWith('image/') && !contentType.includes('xml')) {
    const image = await Jimp.read(await upstream.buffer());
    image.resize(Math.min(maxSrcWidth,image.bitmap.width),Jimp.AUTO);
    /*if(contentType == 'image/png') {
      const output = await image.getBufferAsync('image/gif');
      res.set('Content-Type','image/gif');
      res.status(upstream.status);
      res.send(output);
    } else {*/
      image.quality(50);
      const output = await image.getBufferAsync('image/jpeg');
      res.set('Content-Type','image/jpeg');
      res.status(upstream.status);
      res.send(output);      
    //}
    console.log('image minified',contentType,url);
  } else {
    res.set('Content-Type',contentType);
    res.status(upstream.status);
    res.send(await upstream.buffer());
  }
});

app.listen(port);

console.log(`Listening on port ${port}, CSS is ${stripCSS?'disabled':'enabled'}, images are ${minifyImages?'compressed':'original quality'}`);