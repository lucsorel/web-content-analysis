'use strict';

var Rx = require('rx'),
    // waits 300ms between each verification
    delay = Rx.Observable.empty().delay(300);

module.exports = function(scrapping) {
    return function(socket) {
        // creates the events channel for url verification
        var urlVerificationSubject = new Rx.Subject(),
            verifiedUrlChannel = urlVerificationSubject
                // delays the management of each url
                .map(function (url) {
                    return Rx.Observable.return(url).concat(delay);
                })
                .concatAll()
                // starts the verification of the URL
                .flatMap(function(url) {
                    return Rx.Observable.fromPromise(scrapping.verifyUrl(url));
                }),

            // subscribes to the url verification channel on socket connection
            verificationSubscription = null;

        socket.on('getContent', function(contentUrl, callback) {
            scrapping.scrapPage(contentUrl, callback);
        });

        socket.on('getSitemap', function(sitemapUrl, callback) {
            scrapping.retrieveSitemap(sitemapUrl, callback);
        });

        // subscribes to the url verification channel if necessary
        function subscribe() {
            if (null === verificationSubscription) {
                verificationSubscription = verifiedUrlChannel.subscribe(function(verification) {
                    socket.emit('verifiedUrl', verification);
                });
            }
        }
        // safely unsubscribes to the url verification channel
        function unsubscribe() {
            if (null !== verificationSubscription) {
                verificationSubscription.dispose();
                verificationSubscription = null;
            }
        }

        socket.on('verifyUrls', function(urlsToVerify) {
            subscribe();
            urlsToVerify.forEach(function(url) {
                urlVerificationSubject.onNext(url);
            });
        });

        // unsubscribes on disconnection and when leaving
        socket.on('disconnect', unsubscribe);
        socket.on('stopVerifying', unsubscribe);
    }
}
