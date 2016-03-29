'use strict';

module.exports = function(scrapping) {
    return function(socket) {
        socket.on('getContent', function(contentUrl, callback) {
            scrapping.scrapPage(contentUrl, callback);
        });

        socket.on('getSitemap', function(sitemapUrl, callback) {
            scrapping.retrieveSitemap(sitemapUrl, callback);
        });
    }
}
