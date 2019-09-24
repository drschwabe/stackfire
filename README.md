![stackfire logo](./logo.svg)

# Stackfire

Route driven async control flow library (and pattern) for your next game or app

## Install
```
npm install stackfire --save
```

## Usage
```javascript
const stack = require('stackfire')

stack.on('moon-shot', () =>
console.log('we about to shoot for
the moon!')
) //^this listener is synchronous

stack.on('moon-shot', (next) => {
  console.log('launch!!')
  launchCraft()
  setTimeout(next), 1000)
})
//^this listener is asynchronous
//(note the use of next)

stack.on('moon-shot', () => {
  showText('craft launched!')
})
//^this listener will execute last
//(even though it is synchronous)

stack.fire('moon-shot')
```


## API

### stack.fire
`stack.fire(command, callback)`   
Fire `command`; invokes all listeners for said command in sequence, followed by an optional concluding callback
```javascript
stack.fire('green')
stack.fire('red', console.log('runs last'))
```

### stack.on
`stack.on(command, callback)`   
Creates a listener that invokes `callback` on the given `command`
```javascript
stack.on('green', () => console.log('its green'))
```

### stack.on(next)
`stack.on((next) => callback)`   
Pass an optional `next` object to `stack.on` to make your listener asynchronous; the entire stack will hold while said listener executes (until the `next` object itself is invoked).

```javascript
stack.on('go', (next) => {
  setTimeout(() => {
    console.log('go!')//< executes first
    next()
  }, 100)
})

stack.on('go', () => {
  console.log('going!')
  //^ executes last (after 100ms) despite being synchronous function
})

stack.fire('go')
```
### next.fire

The next object can be optionally used to invoke a nested command.

```javascript
stack.on('detonate-apple', (next) => {
  next.fire('detonate-bannana')
})

stack.on('detonate-apple', () => {
  setTimeout(() => {
    detonate('apple') //< executes last
  }, 100)
})

stack.on('detonate-bannana', (next) => {
  setTimeout(() => {
    detonate('bannana')//< executes first
    next()
  }, 100)
})

stack.fire('detonate-apple')
//(completes in 200ms)
```

If next.fire is called within a listener, as shown on line 2 above, it will invoke the stated command as a child of the command in progress - branching from the current stack of listeners from where it was called - to a new column over - returning upon completion of said child command back to the original column where it left off to finish remaining listeners not yet run.

----

#### stack.params
`property`   
Parameters as part of the current command in progress (ie: `do-something/:time`) are available as a property of the `stack.params` object  (ie: `stack.params.time`).


#### stack.aliaser

Create an aliaser to enable shorthand aliases:

```javascript
const fire = new stack.aliaser()
stack.on('fruit/apple', () => console.log('good in shakes'))
fire.fruitApple()
// > 'good in shakes'
```

#### Testing / dev

To run only a specific test update test.js with newTest.only or from command line without needing to modify the script you can run:

```
node run-test.js "No doubling up of one time listener/trailing callbacks" | tap-spec
```

#### TODO
- finish documenting features
- improve performance
- fix bugs
- website
- launch
- Tools/Visualizer, and extra utility modules

#### License
MIT
