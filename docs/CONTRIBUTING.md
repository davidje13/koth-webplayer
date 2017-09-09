# Introduction

* Looking to make an online, javascript-based king-of-the-hill game? Great!
  Simply fork this project and follow the
  [create a game guide](CREATE_A_GAME.md). Once you're done, if you think
  something added for your game would be useful to others, read on to find out
  how to contribute it back to the framework!

* Looking to improve the framework? Even better! This document will tell you
  what you need to know.


# Ground Rules

First off, as with all projects: be nice. Now that that's out of the way:

To report a bug (or make a feature request) please use the
[issue tracker](https://github.com/davidje13/koth-webplayer/issues).

To contribute code (e.g. to fix a bug, add a feature, improve documentation),
please open a [pull request](https://github.com/davidje13/koth-webplayer/pulls).
Before opening the pull request, make sure:

* Any new Javascript files you created have been added to the linting suite or
  (even better) the test suite. Both can be found in `test.htm`.
* The unit tests are passing. At a minimum they should be passing in the latest
  version of Google Chrome, but if you want to go above and beyond feel free to
  check them in more of the supported browsers (Firefox, Safari, Safari on iOS).
  You can run the unit tests by simply opening `test.htm` in your browser.
* The linter is passing for all files (again this is reported by opening
  `test.htm` in *any* browser). On **rare** occasions it is necessary to
  explicitly ignore a linter warning using a `/* jshint -W*** */` marker, but
  these should always be accompanied by a comment explaining why it's OK to
  ignore the warning, and you should be prepared to justify that decision before
  your PR is accepted.
* You are not adding (or leaving behind) any dead code. Be ruthless in your
  deletions; code can always be recovered using version control if it later
  turns out to be useful again.
* You are happy to release your code under the license of this project, which
  you can read [here](LICENSE).

If you want to make a large change to the codebase, please open an issue on the
[issue tracker](https://github.com/davidje13/koth-webplayer/issues) first, where
you can discuss the change with others.


## Testing

This project is designed to be runnable from the local filesystem; there should
be no need to start a localhost server or run a browser with any special
configuration. Just clone the repository, and open the `htm` files.

Existing test coverage isn't amazing, but that doesn't mean tests aren't
welcome. If your new feature or bug fix includes relevant tests, it will only
help it get accepted faster, and will reduce the chance of future changes
breaking your good work.

If you want to add tests to an existing component, that's great! Just make sure
they run fast and are well written (you can refer to the existing tests as a
guide; the tests in `/core` are pretty good).


## Code Structure

This project has few dependencies, and they are bundled with the source code to
avoid the need for package management / build systems.

* [CodeMirror](https://codemirror.net/) is used to render code in the entry
  editor. It is bundled in `/codemirror`.
* [JSHint](http://jshint.com/) is used to perform Javascript code linting. It
  is bundled in `/jshint`.

The rest of the code is written from scratch, but several APIs are inspired by
existing projects (for example, you may find the `require` / `define` syntax
familiar, or the unit-testing). I make no claims that home-growing these is a
good (or even remotely sensible) architectural choice, just that I felt like
working from the lowest level.


### Packages

* `/core`: common utility methods, along with iframe and web-worker management
* `/math`: mathematical utilities such as randomisation and statistical analysis
* `/tester`: the code used by `test.htm` to perform unit testing and linting
* `/fetch`: tools related to fetching data from internet resources (Stack
  Exchange)
* `/display`: generic visual components
* `/3d`: utilities for working with WebGL, as well as common 3D models
* `/engine`: the core webplayer engine, including components such as the code
  editor, game, match and tournament management, and navigation
* `/teams`: team pickers which can be used by games
* `/matches`: match / tournament managers which can be used by games
* `/games`: the games themselves


## Browser Support

The supported browsers are:

* Google Chrome (latest version)
* Mozilla Firefox (latest version)
* Apple Safari Desktop (latest version)
* Apple Safari iOS (latest version)

Bugs found in those browsers can be reported and should be fixed.

No other browsers are supported (yes that means neither Internet Explorer nor
Edge are supported), but changes to make the code more standards-
compliant will generally be welcomed. Language-wise, the features of ECMAScript
6 are assumed, and no polyfils are included.


## Adding Games

If you want to make a game, the best way is to fork this project and work on
your own copy. That way you own all the code and don't need anybody's approval
for what you're doing; it is entirely your own. You can always merge changes
from this repository into yours as new features are added and bugs are fixed.

If you really want to add a game to this repository, you can do so by opening a
pull request (just like you would to add a new feature). But note:

* Your game must be playable. Work-in-progress games will not be accepted.
* Your code will be put under a high degree of scrutiny. Be prepared to make
  many changes before your code is accepted.
* Games which are considered too similar to existing games (or too simple) may
  not be accepted at all.
