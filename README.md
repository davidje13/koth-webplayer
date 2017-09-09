# koth-webplayer

This is a framework for Javascript-based King-of-the-Hill competitions.

## See it in Action

* https://davidje13.github.io/koth-webplayer/formic.htm
  (test implementation based on the existing [Formic Functions - Ant Queen of the Hill Contest](https://codegolf.stackexchange.com/q/135102/8927) challenge)
* https://davidje13.github.io/koth-webplayer/battlebots.htm
  (test implementation based on the existing [Red vs. Blue - Pixel Team Battlebots](https://codegolf.stackexchange.com/q/48353/8927) challenge)
* https://davidje13.github.io/koth-webplayer/botflocks.htm
  (test implementation based on the existing [Block Building Bot Flocks!](https://codegolf.stackexchange.com/q/50690/8927) challenge)

And see the current unit test / linter status on master here:
https://davidje13.github.io/koth-webplayer/test.htm


## Making Games

Check the [create-a-game](CREATE_A_GAME.md) guide for details on how to create
your own games using this framework.


## Aims

This project has some rough aims:

* Easy fetching of entries from Stack Exchange answers (done!)
* Sandboxed and super-fast game simulation via the power of sandboxed iframes
  and Web Workers (done!)
* Re-runnable games via a random seed system (done!)
* Out-of-the-box management of entries, and UI for testing/debugging new entries
  (mostly done!)
* Configurable out-of-the-box match and tournament management (mostly done!)
* Fancy visualisations (see the game as a torus!) (done!)
* Local storage persistence of display preferences & in-progress entries (not
  done)


## Modifying the Framework

This is early stages, and lots of functionality doesn't exist yet, or is rather
quick-and-dirty, so it's likely that new games will need some changes to the
engine itself.

Contributions are welcome! Check the [contributing guidelines](CONTRIBUTING.md)
for details.
