'use strict';

// scrapping dependencies
var request = require('request'),
    cheerio = require('cheerio'),
    tagsToSkip = ['script'],
    // taken from http://stackoverflow.com/questions/4328500/how-can-i-strip-all-punctuation-from-a-string-in-javascript-using-regex#answer-21224179
    charsToStripRegex = /[\-=_!"#%&'*{},.\/:;?\(\)\[\]@\\$\^*+<>~`\u00a1\u00a7\u00b6\u00b7\u00bf\u037e\u0387\u055a-\u055f\u0589\u05c0\u05c3\u05c6\u05f3\u05f4\u0609\u060a\u060c\u060d\u061b\u061e\u061f\u066a-\u066d\u06d4\u0700-\u070d\u07f7-\u07f9\u0830-\u083e\u085e\u0964\u0965\u0970\u0af0\u0df4\u0e4f\u0e5a\u0e5b\u0f04-\u0f12\u0f14\u0f85\u0fd0-\u0fd4\u0fd9\u0fda\u104a-\u104f\u10fb\u1360-\u1368\u166d\u166e\u16eb-\u16ed\u1735\u1736\u17d4-\u17d6\u17d8-\u17da\u1800-\u1805\u1807-\u180a\u1944\u1945\u1a1e\u1a1f\u1aa0-\u1aa6\u1aa8-\u1aad\u1b5a-\u1b60\u1bfc-\u1bff\u1c3b-\u1c3f\u1c7e\u1c7f\u1cc0-\u1cc7\u1cd3\u2016\u2017\u2020-\u2027\u2030-\u2038\u203b-\u203e\u2041-\u2043\u2047-\u2051\u2053\u2055-\u205e\u2cf9-\u2cfc\u2cfe\u2cff\u2d70\u2e00\u2e01\u2e06-\u2e08\u2e0b\u2e0e-\u2e16\u2e18\u2e19\u2e1b\u2e1e\u2e1f\u2e2a-\u2e2e\u2e30-\u2e39\u3001-\u3003\u303d\u30fb\ua4fe\ua4ff\ua60d-\ua60f\ua673\ua67e\ua6f2-\ua6f7\ua874-\ua877\ua8ce\ua8cf\ua8f8-\ua8fa\ua92e\ua92f\ua95f\ua9c1-\ua9cd\ua9de\ua9df\uaa5c-\uaa5f\uaade\uaadf\uaaf0\uaaf1\uabeb\ufe10-\ufe16\ufe19\ufe30\ufe45\ufe46\ufe49-\ufe4c\ufe50-\ufe52\ufe54-\ufe57\ufe5f-\ufe61\ufe68\ufe6a\ufe6b\uff01-\uff03\uff05-\uff07\uff0a\uff0c\uff0e\uff0f\uff1a\uff1b\uff1f\uff20\uff3c\uff61\uff64\uff65]+/g,
    singleSpaceRegex = /[\s]+/g,
    parseOptions = {
        lowerCaseTags: true,
        normalizeWhitespace: true
    },
    // promise library
    RSVP = require('rsvp');

/**
 * Generic scrapping response factory
 *
 * @param contentProcessor processes the response body of the request when no error occurred.
 *        It should be a function with a single parameter holding the text of the response.
 *        It should return the content to be passed to the callback.
 * @param callback applied to the content provided by the contentProcessor
 * @return
 */
function onResponseFactory(contentProcessor, callback) {
    return function(error, response, responseBody) {
        if (error) {
            callback({ isErr: true, error: error });
        }

        callback({ content: contentProcessor(responseBody) });
    }
}

/**
 * Parses the XML content of sitemap
 *
 * @param responseBody
 * @return JSON representation of the sitemap
 */
function sitemapContentProcessor(responseBody) {
    var $ = cheerio.load(responseBody, parseOptions),
        // root tag is 'urlset', entry tags are 'url'
        urls = $('urlset'),
        urlTagName = 'url',
        // the sitemap to return
        sitemap = [];

    // main and entry tags can also be 'sitemapindex' and 'sitemap'
    if (urls.children().length < 1) {
        urls = $('sitemapindex');
        urlTagName = 'sitemap'
    }
    // iterates over the sitemap entries to gather information for each url
    urls.children().each(function(index, element) {
        // processes sitemap url tags only
        if (urlTagName === element.name) {
            var urlElementName, sitemapEntry;

            $(element).children().each(function(index, urlElement) {
                urlElementName = urlElement.name
                if ('loc' === urlElementName || 'priority' === urlElementName || 'changefreq' === urlElementName || 'lastmod' === urlElementName) {
                    sitemapEntry = sitemapEntry || {};
                    sitemapEntry[urlElementName] = $(urlElement).text();
                }
            });
            // adds only valid sitemap entries
            if (sitemapEntry) {
                sitemap.push(sitemapEntry);
            }
        }
    });

    return sitemap;
}

/**
 * Parses the html body to extract the occurrences of the tags where a word is found
 *
 * @param responseBody
 * @return a cache associating each word with the occurrences of the tags where it has been found
 */
function scrappingContentProcessor(responseBody) {
    var $ = cheerio.load(responseBody, parseOptions),
        body = $('body'),
        wordsCache = {};

    body.children().each(parseFactory(wordsCache, $));

    return wordsCache;
}

/**
 * Recursively parses the HTML document to populate the word cache
 *
 * @param wordsCache
 * @param $ the response wrapped by the cheerio utility
 */
function parseFactory(wordsCache, $) {
    function parse(index, element) {
        var elementTagName = element.name,
            wrappedElement = $(element);

        if (wrappedElement.children().length > 0) {
            wrappedElement.children().each(parse);
        }
        else if (tagsToSkip.indexOf(elementTagName) < 0) {
            var elementText = wrappedElement.text();
            if (elementText !== null && elementText.length > 0) {
                var words = elementText.toLowerCase().replace(charsToStripRegex, ' ').replace(singleSpaceRegex, ' ').split(' '),
                    count;
                words.filter(function(word) {
                        return null !== word && word.length > 3;
                    })
                    .map(function(word) {
                        if (!wordsCache[word]) {
                            wordsCache[word] = {};
                            count = 1

                        }
                        else if (!wordsCache[word][elementTagName]) {
                            count = 1;
                        }
                        else {
                            count = wordsCache[word][elementTagName] + 1;
                        }

                        wordsCache[word][elementTagName] = count;
                    });
            }
        }
    }

    return parse;
}

/**
 * Requests the given page to scrap its content. The scrapped words cache is applied to the given callback
 *
 * @param url of the page holding the content to scrap
 * @param callback
 */
function scrapPage(url, callback) {
    request({
        method: 'GET',
        uri: url,
        gzip: true
    }, onResponseFactory(scrappingContentProcessor, callback));
}

/**
 * Requests the given page and verify its accessibility and the page title
 *
 * @param url of the expected sitemap
 * @param callback
 */
function retrieveSitemap(url, callback) {
    request({
        method: 'GET',
        uri: url,
        gzip: true,
        headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
    }, onResponseFactory(sitemapContentProcessor, callback));
}

/**
 * Handler factory for verification requests
 *
 * @param url the url being verified
 * @param callback to apply on the verification
 */
function onUrlVerificationResponseFactory(url, callback) {
    return function(error, response, responseBody) {
        // flags the url of the verified url
        var verification = { url: url };

        // flags the error if any
        if (error) {
            verification.isErr = true;
            verification.error = error;
        }
        // defines the content of the verification
        else {
            var $ = cheerio.load(responseBody, parseOptions),
                // flags the response HTTP status and the page head title (or HTTP status message for failures)
                content = {
                    status: response.statusCode,
                    title: $('head title').text() || response.statusMessage
                 };

            // flags whether a redirection occurred
            if (response && response.request && response.request.href !== url) {
                content.redirect = response.request.href;
            }

            verification.content = content;
        }

        // applies the callback
        callback(verification);
    }
}

/**
 * Verifies the accessibility and the page title of the given url
 *
 * @param url
 * @return a promise of the verification
 */
function verifyUrl(url) {
    // initializes the deferred verification
    var deferredVerification = RSVP.defer();

    request({
        method: 'GET',
        uri: url,
        gzip: true,
        headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
    }, onUrlVerificationResponseFactory(url, function(verification) {
        deferredVerification.resolve(verification);
    }));

    return deferredVerification.promise;
}

// packages the scrapping utilities
module.exports = {
    scrapPage: scrapPage,
    retrieveSitemap: retrieveSitemap,
    verifyUrl: verifyUrl
};
