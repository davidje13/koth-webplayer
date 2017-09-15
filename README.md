# koth-webplayer

This is a framework for Javascript-based King-of-the-Hill competitions.

## See it in Action

* [Formic Functions](https://davidje13.github.io/koth-webplayer/formic.htm):
  Test implementation based on
  [an existing challenge](https://codegolf.stackexchange.com/q/135102/8927)

* [Everybody Loves Tokens](https://davidje13.github.io/koth-webplayer/tokens.htm):
  Test implementation based on
  [an existing challenge](https://codegolf.stackexchange.com/q/77235/8927)

* [Fastest Gun of the West](https://davidje13.github.io/koth-webplayer/fgtw.htm):
  Test implementation based on
  [an existing challenge](https://codegolf.stackexchange.com/q/51698/8927)

* [Block Building Bot Flocks](https://davidje13.github.io/koth-webplayer/botflocks.htm):
  Test implementation based on
  [an existing challenge](https://codegolf.stackexchange.com/q/50690/8927)

* [Capture The Flag](https://davidje13.github.io/koth-webplayer/captureflag.htm):
  Test implementation based on
  [an existing challenge](https://codegolf.stackexchange.com/q/49028/8927)

* [Pixel Team Battlebots](https://davidje13.github.io/koth-webplayer/battlebots.htm):
  Test implementation based on
  [an existing challenge](https://codegolf.stackexchange.com/q/48353/8927)

And see the current unit test / linter status on master
[here](https://davidje13.github.io/koth-webplayer/test.htm).


## Making Games

Check the [create-a-game](docs/CREATE_A_GAME.md) guide for details on how to
create your own games using this framework.


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

Contributions are welcome! Check the
[contributing guidelines](docs/CONTRIBUTING.md) for details.
