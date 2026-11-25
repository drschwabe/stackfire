# Stackfire 5

An async control flow library and pattern for your next game or app. Commands queue in the order they're fired, each running a chain of listeners that can control their place in the execution order. Branch into a child command, await its listener chain, then resume the parent where it left off—all while queued commands wait their turn.

## Install

```sh
npm install stackfire
```

## Usage

```js
const stack = require('stackfire')

stack.on('moon-shot', body => {
  console.log(`Preparing ${body.craft}`)
})

stack.on('moon-shot', async body => {
  await new Promise(resolve => setTimeout(resolve, 100))
  return stack.merge({ launched: true })
})

stack.on('moon-shot', body => console.log(`${body.craft} launched!`))

async function main() {
  const result = await stack.fire('moon-shot', { craft: 'Apollo' })
  console.log(result) // { craft: 'Apollo', launched: true }
}
main()
```

Listeners can be synchronous or return promises; each finishes before the next starts. The v5 API uses async/await rather than the original `next` callbacks.

## API

- **`stack.on(path, handler)`** — register a listener. Paths accept `:named` parameters, `*splats`, or an array of paths. A leading `/` is optional. Pass `true` as an extra argument for a once-only listener.
- **`await stack.fire(path, body)`** — run matching listeners and return the resulting body. An optional callback is registered as a once-only listener. Fires issued while a command runs are queued; use `branch` for nested work you need to await inside a listener.
- **`await stack.branch(path, body)`** — run a child command, then resume the parent. When no command is running, behaves like `fire`. `stack.auto(path, body)` is an alias for this behavior.
- **`stack.body`, `stack.params`, `stack.path`** — inspect the current body, matched route parameters, and command path. The body is also the handler's argument.

```js
stack.on('fuel/:craft', () => ({ craft: stack.params.craft, fuel: 100 }))
stack.on('prepare/:craft', async () => {
  return await stack.branch(`fuel/${stack.params.craft}`)
})
// await stack.fire('prepare/Apollo') → { craft: 'Apollo', fuel: 100 }
```

**Body and cancellation:** mutate the body directly, return a replacement, or return `stack.merge({ ... })` to deep-merge into an existing object. Returning `undefined` retains the body; `null` clears it; `false` stops the command. Return `{ ...body, _stackfireCancel: true }` to stop with a result. In normal dispatch, `0` and `''` also retain the previous body.

**Ordering:** listeners normally run in registration order. Use `stack.first`, `second` through `sixth`, `last`, `veryFirst`, or `veryLast`, or pass a numeric priority to `on` (lower runs earlier).

**Caching:** `stack.on(path, handler, { cacheable: true })` caches the entire command's result by concrete path. `stack.refresh(...paths)` invalidates entries; `await stack.refreshNow(path, body)` invalidates and dispatches via `auto`. `stack.flush()` clears listeners and cache.

**Pausing and skipping:** `await stack.pause()` waits until `stack.play()` is called. Use `stack.skip(path, handler)` as a temporary no-op registration in place of `on`; it does not disable existing listeners.

**Inspection:** `stack.command`, `listeners`, `fireQ`, and `cache` expose runtime state. Pass `{ ...body, _stackfireStore: true }` to preserve a shallow copy of the initial body in `stack.store`. Add async lifecycle hooks with `stack.utils.push((event, detail) => { ... })`, or enable console tracing with `stack.logUtil()`.

## Browser input

After the document body exists:

```js
require('stackfire/input')(stack, 'click', 'link', 'keydown', { basename: '/app' })
```

Explicitly select `click`, `dblclick`, `keydown`, `keyup`, and/or `link`. Keys fire paths such as `keydown/Enter`; matching links fire their decoded path with the basename stripped. The DOM event becomes the body.

## Experimental features

`stack.freeze()` builds a faster dispatch snapshot for a static listener table; `stack.unfreeze()` restores normal dispatch. Frozen dispatch supports routes, priorities, body merging, branching, and utility hooks, but bypasses once-only removal, caching, fire callbacks, and initial-body storage. It also treats `0` and `''` as replacement bodies. Unfreeze before changing listeners.

## Testing

```sh
npm install
npm test
# One test file:
node tests/array-of-listeners/test.js
```

## License

Copyright (c) 2019–2026 Derrick Schwabe. [MIT](LICENSE).
