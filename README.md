# web-content-analysis

Web scrapper for HTML and sitemap.xml content analysis.

This Node.js webapp is a small tool for SEO with 2 functionalities which can be discovered on [this free-dynoed Heroku app](https://web-content-analysis.herokuapp.com/), which may be subject to downtimes if overused:

## HTML analysis

This tab parses the content of a given url (`http://www.lucsorel.com/` for example) and displays the words by a decreasing order of importance, according to some weights assigned to different html tags. Being displayed in a `h1` tag brings more weight to a word than being displayed in a `h2` tag, and so on). The weighs are (rather arbitrarily) [defined on the front-end side](https://github.com/lucsorel/web-content-analysis/blob/master/www/js/web-content-analysis.js#L227-L239).

In the result of the [analysis of the `http://www.lucsorel.com/` page](https://web-content-analysis.herokuapp.com/#/content/http://www.lucsorel.com/), you can interpret:

```
 virtual: 33
a: 3  h2: 2  b: 1
```

as:
* a total weight of 23 for the word `virtual`
* which appears 3 times in a `<a>` tag, 2ce in a `<h2>` tag and 1ce in a `<b>` tag

## Sitemap.xml analysis

A sitemap is an XML file, often located at the root of a website along the `robots.txt` file, listing the URLs of a website to ease the work of indexation engines. Its format is explained on [sitemaps.org](https://www.sitemaps.org). Each URL can be optionally characterized with:
* a `priority` describing the importance of the page in the site
* an `update frequency` to let indexation engines know how often the content is updated
* a `last edition date`

For example, the [www.sitemaps.org/sitemap.xml](https://www.sitemaps.org/sitemap.xml) only describes the URLs and their last edition date (when this doc was written).

The sitemap analysis is done in two steps (see the example of the [www.sitemaps.org/sitemap.xml](https://web-content-analysis.herokuapp.com/#/sitemap/https://www.sitemaps.org/sitemap.xml) analysis):
* the first step lists the URLs along with their optional characteristics and highlights duplicated URLs
* on this result screen, you can select the URLs to check their existence, HTML title, HTTP status and possible redirection

## Technologies involved

* the Node.js back-end `express` app uses:
  * [cheerio](https://github.com/cheeriojs/cheerio) to parse HTML
  * [RxJS 4](https://github.com/Reactive-Extensions/RxJS) to orchestrate the scrapping of sitemap's URLs
* the `AngularJS` front-end app uses:
  * [ui-router](https://github.com/angular-ui/ui-router) and the [ui-router-menu-service](https://github.com/lucsorel/ui-router-menu-service) I designed to help routing and menu-highlighting in ng1.x apps
* server-client communication is done via [socket.io](https://socket.io/) and uses the [socket-io-ng-service](https://github.com/lucsorel/socket-io-ng-service) module I packaged
