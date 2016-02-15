'use strict';

module.exports = function(scrapping) {
    return function(socket) {
        socket.on('getContent', function(contentUrl, callback) {
            scrapping.scrapPage(contentUrl, callback);
        })
    }
}
