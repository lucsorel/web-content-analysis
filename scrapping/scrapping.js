'use strict';

// scrapping dependencies
var request = require('request'),
    cheerio = require('cheerio'),
    extractableTags = ['div', 'span', 'a'],
    tagsToSkip = ['script'],
    alphaNumRegex = /[_\W]+/g,
    singleSpaceRegex = /[\s]+/g,
    parseOptions = {
        lowerCaseTags: true,
        normalizeWhitespace: true
    };

function onResponseFactory(callback) {
    return function(error, response, responseBody) {
        if (error) {
            callback({ isErr: true, error: error });
        }

        var $ = cheerio.load(responseBody, parseOptions),
            body = $('body'),
            wordsCache = {},
            wordWeight, tagWeight;

        body.children().each(parseFactory(wordsCache, $));

        callback({ content: wordsCache });
    }
}

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
                var words = elementText.toLowerCase().replace(alphaNumRegex, ' ').replace(singleSpaceRegex, ' ').split(' '),
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

function scrapPage(url, callback) {
    request(url, onResponseFactory(callback));
}

module.exports = {
    scrapPage: scrapPage
};
