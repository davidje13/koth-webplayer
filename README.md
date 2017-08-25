# koth-webplayer

This is a work-in-progress framework for Javascript-based King-of-the-Hill
competitions.

See it in action:

* https://davidje13.github.io/koth-webplayer/formic.htm
  (test implementation based on the existing [Formic Functions - Ant Queen of the Hill Contest](https://codegolf.stackexchange.com/q/135102/8927) challenge)
* https://davidje13.github.io/koth-webplayer/battlebots.htm
  (test implementation based on the existing [Red vs. Blue - Pixel Team Battlebots](https://codegolf.stackexchange.com/q/48353/8927) challenge)

A rough set of aims for this project:

* Easy fetching of entries from Stack Exchange answers (done!)
* Sandboxed and super-fast game simulation via the power of sandboxed iframes
  and Web Workers (done!)
* Re-runnable games via a random seed system (done!)
* Out-of-the-box management of entries, and UI for testing/debugging new entries
  (not done)
* Configurable out-of-the-box match and tournament management (mostly done!)
* Fancy visualisations (see the game as a torus!) (done!)
* Local storage persistence of display preferences & in-progress entries (not
  done)

## Adding new games

The aim is for games to be entirely modular, with helper classes (as well as
match & tournament handling logic) kept separate and reusable. Adding a new game
should be as simple as defining its `GameManager`, `GameScorer` and `Display`
inside a folder named `/games/<game-name-here>/`, and creating a new HTML file
in the root with the desired configuration metatags.

## Modification of the engine

This is very early stages, and most functionality doesn't exist yet, or is
rather quick-and-dirty, so it's likely that new games will need some changes to
the engine itself.

The project is designed to be runnable from the local filesystem; there should
be no need to start a localhost server or run a browser with any special
configuration. There are no dependencies (no jQuery, React, requirejs, etc.); I
make no claims that that's a good (or even remotely sensible) architectural
choice, just that I felt like working from the lowest level (several APIs here
are heavily inspired by such projects and may be vaguely familiar).

Modern Javascript syntax and APIs are used throughout and no polyfils are
included, so don't expect this to work in Internet Explorer. So far it's only
been tested in Google Chrome & Safari (iOS), but in theory it should also work
in Mozilla Firefox (perhaps with some minor fixes).

Unit tests (few though they are) can be run by opening the `test.htm` file in
the root (see the current test status on master at:
https://davidje13.github.io/koth-webplayer/test.htm).
