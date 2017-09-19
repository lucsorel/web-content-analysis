angular.module('WebContentAnalysis', ['ui.router', 'SocketIoNgService', 'UiRouterMenuService'])
    .config(['$locationProvider', function($locationProvider) {
        $locationProvider.hashPrefix('');
    }])
    .config(['$stateProvider', '$urlRouterProvider', '$urlMatcherFactoryProvider', function($stateProvider, $urlRouterProvider, $urlMatcherFactoryProvider) {
        // defines a custom parameter type to prevent the escaping of url slashes
        var uriTypePattern = /.*/;
        function valToString(val) { return val !== null ? val.toString() : val; }
        function regexpMatches(val) { return uriTypePattern.test(val); }
        $urlMatcherFactoryProvider.type('uriType', {
          encode: valToString, decode: valToString, is: regexpMatches, pattern: uriTypePattern
        });

        // routing
        $stateProvider
            // define a root state with the MenuController which will handle the menu
            .state('root', {
                abstract: true,
                url: '/',
                templateUrl: 'templates/root.html',
                controller: 'MenuController as menuCtrl'
            })
            .state('root.content', {
                url: 'content/{contentUrl:uriType}',
                resolve: {
                    page: ['menuService', function(menuService) {
                        return menuService.setViewName('content');
                    }],
                    url: ['$stateParams', '$q', function($stateParams, $q) {
                        return $q.when($stateParams.contentUrl);
                    }]
                },
                views: {
                    content: {
                        templateUrl: 'templates/content.html',
                        controller: 'ContentController as contentCtrl'
                    }
                }
            })
            .state('root.sitemap', {
                url: 'sitemap/{sitemapUrl:uriType}',
                resolve: {
                    page: ['menuService', function(menuService) {
                        return menuService.setViewName('sitemap');
                    }],
                    url: ['$stateParams', '$q', function($stateParams, $q) {
                        return $q.when($stateParams.sitemapUrl);
                    }]
                },
                views: {
                    content: {
                        templateUrl: 'templates/sitemap.html',
                        controller: 'SitemapController as sitemapCtrl'
                    }
                }
            })
            ;

        $urlRouterProvider.otherwise('/content/');
    }])
    .factory('contentService', ['$q', 'socketService', function($q, socketService) {
        function isStringNotEmpty(text) {
            return 'string' === typeof text && text.length > 0;
        }

        var contentService = {
            getContent: function(contentUrl) {
                // returns the content for the given url
                if (isStringNotEmpty(contentUrl)) {
                    return socketService.qemit('getContent', contentUrl);
                }
                // no content for empty urls
                else {
                    return $q.when();
                }
            },

            getSitemap: function(sitemapUrl) {
                // returns the sitemap for the given url
                if (isStringNotEmpty(sitemapUrl)) {
                    return socketService.qemit('getSitemap', sitemapUrl);
                }
                // no content for empty urls
                else {
                    return $q.when();
                }
            },

            verifyUrls: function(urls) {
                if (urls && urls.length > 0) {
                    socketService.emit('verifyUrls', urls);
                }
            },

            onVerifiedUrl: function(scope, callback) {
                socketService.on('verifiedUrl', callback, scope);
            },

            stopVerifying: function() {
                socketService.emit('stopVerifying');
            }
        };

        return contentService;
    }])
    .controller('MenuController', ['menuService', function(menuService) {
        this.page = menuService.page;
    }])
    // manages the sitemap analysis view
    .controller('SitemapController', ['$state', '$scope', 'url', 'contentService', function($state, $scope, url, contentService) {
        var sitemapCtrl = this;
        sitemapCtrl.url = url;
        sitemapCtrl.entryfilter = {};
        sitemapCtrl.sitemap = [];

        // reloads the state with the defined url
        sitemapCtrl.scrap = function() {
            if (url === sitemapCtrl.url) {
                // shows the progress bar and starts retrieving the sitemap
                sitemapCtrl.loading = true;
                contentService.getSitemap(sitemapCtrl.url).then(function(sitemap) {
                    // hides the progress bar
                    sitemapCtrl.loading = false;

                    if (sitemap) {
                        // displays the error if any
                        if (sitemap.isErr) {
                            sitemapCtrl.failure = 'Failed to retrieve sitemap from ' + url;
                            sitemapCtrl.error = sitemap.error;
                        }
                        // empty sitemap
                        else if (!sitemap.content || sitemap.content.length < 1) {
                            sitemapCtrl.failure = 'no sitemap at this url';
                        }
                        // filters out duplicate urls
                        else {
                            // initializes the array of sitemap entries (objects) and duplicate urls (strings)
                            sitemapCtrl.sitemap = [];
                            sitemapCtrl.duplicates = [];
                            var processedLocations = [];

                            // filters unique and duplicate locations
                            sitemap.content.forEach(function(sitemapEntry) {
                                // flags duplicate sitemap locations
                                if (processedLocations.indexOf(sitemapEntry.loc) > 0) {
                                    if (sitemapCtrl.duplicates.indexOf(sitemapEntry.loc) < 0) {
                                        sitemapCtrl.duplicates.push(sitemapEntry.loc);
                                    }
                                }
                                // flags processed sitemap locations
                                else {
                                    sitemapCtrl.sitemap.push(sitemapEntry);
                                    processedLocations.push(sitemapEntry.loc);
                                }
                            });
                        }
                    }
                }, function() {
                    sitemapCtrl.loading = false;
                    sitemapCtrl.failure = 'Failed to retrieve sitemap from ' + url;
                });
            }
            else {
                $state.go('root.sitemap', {
                    sitemapUrl: sitemapCtrl.url
                });
            }
        }

        // starts scrapping the sitemap
        sitemapCtrl.scrap();

        // de/selects all entries
        $scope.$watch('sitemapCtrl.selectAll', function(newValue) {
            if (sitemapCtrl.sitemap) {
                sitemapCtrl.sitemap.forEach(function(sitemapEntry) {
                    if (!sitemapEntry.verifying) {
                        sitemapEntry.verify = newValue;
                    }
                });
            }
        });

        // verifies the selected urls (http code, page title)
        sitemapCtrl.verify = function() {
            // collects the urls of the selected sitemap entries not being verified
            var urlsToVerify = [];
            sitemapCtrl.sitemap.reduce(function(urlsToVerify, sitemapEntry) {
                if (sitemapEntry.verify && !sitemapEntry.verifying) {
                    urlsToVerify.push(sitemapEntry.loc);
                    sitemapEntry.verifying = true;
                }
                return urlsToVerify;
            }, urlsToVerify);

            contentService.verifyUrls(urlsToVerify);
        };

        // handles url verification events
        contentService.onVerifiedUrl($scope, function(verifiedUrl) {
            // finds the sitemap url related to the verification
            var sitemapEntry = sitemapCtrl.sitemap.find(function(sitemapUrl) {
                return sitemapUrl.loc === verifiedUrl.url;
            });

            if (sitemapEntry) {
                if (verifiedUrl.isErr) {
                    sitemapEntry.title = verifiedUrl.error;
                    sitemapEntry.status = 'error';
                }
                else {
                    sitemapEntry.title = verifiedUrl.content.title;
                    sitemapEntry.status = verifiedUrl.content.status;
                    sitemapEntry.redirect = verifiedUrl.content.redirect;
                }
                sitemapEntry.verifying = false;
                sitemapEntry.verify = false;
            }
        });

        // stops verifying urls when leaving
        $scope.$on('$destroy', contentService.stopVerifying);
    }])
    // manages the content scrapping view
    .controller('ContentController', ['$state', 'url', 'contentService', function($state, url, contentService) {
        var contentCtrl = this,
            tagWeights = {
                title: 15,
                h1: 10,
                h2: 9,
                h3: 8,
                h4: 7,
                h5: 6,
                h6: 5,
                a: 4,
                strong: 3,
                b: 3,
                i: 2
            };

        contentCtrl.url = url;

        contentCtrl.scrap = function() {
            contentCtrl.loading = true;
            $state.go('root.content', {
                contentUrl: contentCtrl.url
            });
        }

        contentCtrl.loading = true;
        contentService.getContent(url).then(function(content) {
                contentCtrl.loading = false;
                if ('object' === typeof content) {
                    if (content.isErr) {
                        contentCtrl.failure = 'Failed to retrieve content from ' + url;
                        contentCtrl.error = content.error;
                    }
                    else {
                        var wordsCache = content.content;
                        contentCtrl.words = [];

                        Object.keys(wordsCache).map(function(word) {
                            wordWeight = Object.keys(wordsCache[word]).reduce(function(weight, tag) {
                                tagWeight = tagWeights[tag] || 1;
                                return weight + (tagWeight * wordsCache[word][tag]);
                            }, 0);

                            contentCtrl.words.push({ label: word, weight: wordWeight, tags: wordsCache[word] });
                        });
                    }
                }
            }, function() {
                contentCtrl.loading = false;
                contentCtrl.failure = 'Failed to retrieve content from ' + url;
            }
        );
    }])
;
