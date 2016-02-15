angular.module('WebContentAnalysis', ['ui.router', 'SocketIoNgService'])
    .config(['$stateProvider', '$urlRouterProvider', function($stateProvider, $urlRouterProvider) {
        $stateProvider.state('home', {
            url: '/{contentUrl:.*}',
            resolve: {
                url: ['$stateParams', '$q', function($stateParams, $q) {
                    return $q.when($stateParams.contentUrl);
                }],
                // ensures a valid (or empty) host is preset
                content: ['contentService', 'url', function(contentService, url) {
                    return contentService.getContent(url);
                }]
            },
            views: {
                content: {
                    templateUrl: 'templates/content.html',
                    controller: 'ContentController as contentCtrl'
                }
            }
        });

        $urlRouterProvider.otherwise('/');
    }])
    .factory('contentService', ['$q', 'socketService', function($q, socketService) {
        var contentService = {
            getContent: function(contentUrl) {
                // returns the content for the given url
                if ('string' === typeof contentUrl && contentUrl.length > 0) {
                    return socketService.qemit('getContent', contentUrl);
                }
                // no content for empty urls (home page)
                else {
                    return $q.when();
                }
            }
        };
        return contentService;
    }])
    .controller('ContentController', ['$state', 'url', 'content', function($state, url, content) {
        var contentCtrl = this,
            tagWeights = {
                title: 10,
                h1: 10,
                h2: 9,
                h3: 8,
                h4: 7,
                h5: 6,
                h6: 5,
                a: 3
            };

        contentCtrl.url = url;
        contentCtrl.loading = false;

        contentCtrl.scrap = function() {
            contentCtrl.loading = true;
            $state.go('home', {
                contentUrl: contentCtrl.url
            });
        }

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
    }])
;
