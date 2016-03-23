angular.module('WebContentAnalysis', ['ui.router', 'SocketIoNgService', 'UiRouterMenuService'])
    .config(['$stateProvider', '$urlRouterProvider', function($stateProvider, $urlRouterProvider) {
        $stateProvider
            // define a root state with the MenuController which will handle the menu
            .state('root', {
                abstract: true,
                url: '/',
                templateUrl: 'templates/root.html',
                controller: 'MenuController as menuCtrl'
            })
            .state('root.content', {
                url: 'content/{contentUrl:.*}',
                resolve: {
                    page: ['menuService', function(menuService) {
                        return menuService.setViewName('content');
                    }],
                    url: ['$stateParams', '$q', function($stateParams, $q) {
                        return $q.when($stateParams.contentUrl);
                    }]
                    // ,
                    // // ensures a valid (or empty) url to analyze is preset
                    // content: ['contentService', 'url', function(contentService, url) {
                    //     return contentService.getContent(url);
                    // }]
                },
                views: {
                    content: {
                        templateUrl: 'templates/content.html',
                        controller: 'ContentController as contentCtrl'
                    }
                }
            })
            .state('root.sitemap', {
                url: 'sitemap/{sitemapUrl:.*}',
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
        var contentService = {
            getContent: function(contentUrl) {
                // returns the content for the given url
                if ('string' === typeof contentUrl && contentUrl.length > 0) {
                    return socketService.qemit('getContent', contentUrl);
                }
                // no content for empty urls
                else {
                    return $q.when();
                }

            }
        };

        return contentService;
    }])
    .controller('MenuController', ['menuService', function(menuService) {
        this.page = menuService.page;
    }])
    .controller('SitemapController', ['$state', 'url', function($state, url) {
        var sitemapCtrl = this;
        sitemapCtrl.url = url;
    }])
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
        contentCtrl.loading = false;

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
                        contentCtrl.failure = 'Failed to retrieve content from ' + contentCtrl.url;
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
            }
        );
    }])
;
